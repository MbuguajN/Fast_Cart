/**
 * One-time verification codes.
 *
 * Codes are generated with the CSPRNG and compared in constant time. The
 * previous implementation used `Math.floor(100000 + Math.random() * 900000)`,
 * which draws from V8's xorshift128+ — a non-cryptographic PRNG whose internal
 * state is recoverable from a modest run of observed outputs, so an attacker
 * able to request codes for their own numbers could predict a code issued to
 * someone else's.
 *
 * State lives in lib/kv-store.js, which is Redis-backed when configured and
 * in-process otherwise.
 */

import crypto from 'crypto';
import { kvGet, kvSet, kvDelete } from './kv-store.js';
import { timingSafeEquals } from './crypto-tokens.js';

const OTP_TTL_MS = 5 * 60 * 1000;        // code lifetime
const MAX_ATTEMPTS = 3;                   // wrong guesses before the code dies
const RESEND_COOLDOWN_MS = 60 * 1000;     // between sends for one identity
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;

function generateCode() {
  // Uniform over [100000, 999999] — no modulo bias.
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Namespace an identity into a storage key.
 *
 * Phone numbers reduce to their last 9 digits so `+254712345678`, `0712345678`
 * and `712345678` are one identity. Any other string (an email-change
 * challenge, say) is namespaced verbatim, so those challenges cannot be
 * satisfied by a code issued for a login.
 */
function storageKey(identity) {
  const raw = String(identity ?? '');
  const digitsOnly = /^[\d\s+()-]+$/.test(raw);

  if (digitsOnly) {
    const digits = raw.replace(/\D/g, '');
    return `otp:phone:${digits.slice(-9)}`;
  }
  return `otp:challenge:${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}

/**
 * Issue a code for an identity, subject to cooldown and per-window send caps.
 * Returns `{ code, success }` or `{ error, cooldown|blocked }`.
 */
export async function createOtp(identity) {
  if (!identity) throw new Error('An identity is required');

  const key = storageKey(identity);
  const now = Date.now();
  const existing = await kvGet(key);

  if (existing && now - existing.createdAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000);
    return { error: `Please wait ${waitSec} seconds before requesting a new code`, cooldown: waitSec };
  }

  const inWindow = existing && now - existing.windowStart < SEND_WINDOW_MS;

  if (inWindow && existing.sendCount >= MAX_SENDS_PER_WINDOW) {
    return { error: 'Too many code requests. Please try again later.', blocked: true };
  }

  const code = generateCode();
  const windowStart = inWindow ? existing.windowStart : now;
  const sendCount = inWindow ? existing.sendCount + 1 : 1;

  // Outlive the code itself so the send-rate window survives expiry.
  const ttl = Math.max(OTP_TTL_MS, SEND_WINDOW_MS - (now - windowStart)) + 1000;

  await kvSet(key, { code, createdAt: now, attempts: 0, windowStart, sendCount }, ttl);

  return { code, success: true };
}

/**
 * Check a submitted code. Consumes the code on success and on lockout.
 */
export async function verifyOtp(identity, code) {
  if (!identity || !code) return { valid: false, error: 'Phone and code are required' };

  const key = storageKey(identity);
  const entry = await kvGet(key);

  if (!entry) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  const now = Date.now();

  if (now - entry.createdAt > OTP_TTL_MS) {
    await kvDelete(key);
    return { valid: false, error: 'Verification code has expired. Please request a new one.', expired: true };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await kvDelete(key);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.', locked: true };
  }

  if (!timingSafeEquals(entry.code, String(code).trim())) {
    const attempts = entry.attempts + 1;
    const remaining = MAX_ATTEMPTS - attempts;

    if (remaining <= 0) {
      await kvDelete(key);
      return { valid: false, error: 'Too many incorrect attempts. Please request a new code.', locked: true };
    }

    const ttl = Math.max(1000, OTP_TTL_MS - (now - entry.createdAt));
    await kvSet(key, { ...entry, attempts }, ttl);

    return {
      valid: false,
      error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      remaining,
    };
  }

  // Single use.
  await kvDelete(key);
  return { valid: true };
}
