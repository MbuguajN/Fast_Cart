// In-memory OTP store with TTL and attempt limiting.
// In production with multiple instances, swap for Redis.

const store = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;       // 5 minutes
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000;    // 60 seconds between resends
const MAX_SENDS_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;   // 10 minute window for send rate limit

function generateCode() {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > OTP_TTL_MS * 2) {
      store.delete(key);
    }
  }
}

// Periodic cleanup every 5 minutes
if (typeof globalThis.__otpCleanupInterval === 'undefined') {
  globalThis.__otpCleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
}

export function createOtp(phone) {
  if (!phone) throw new Error('Phone is required');

  const key = phone.replace(/\D/g, '').slice(-9);
  const now = Date.now();
  const existing = store.get(key);

  // Rate limit: check resend cooldown
  if (existing && (now - existing.createdAt) < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000);
    return { error: `Please wait ${waitSec} seconds before requesting a new code`, cooldown: waitSec };
  }

  // Rate limit: max sends per window
  if (existing && existing.sendCount >= MAX_SENDS_PER_WINDOW && (now - existing.windowStart) < SEND_WINDOW_MS) {
    return { error: 'Too many code requests. Please try again later.', blocked: true };
  }

  const code = generateCode();
  const windowStart = (existing && (now - existing.windowStart) < SEND_WINDOW_MS) ? existing.windowStart : now;
  const sendCount = (existing && (now - existing.windowStart) < SEND_WINDOW_MS) ? existing.sendCount + 1 : 1;

  store.set(key, {
    code,
    createdAt: now,
    attempts: 0,
    windowStart,
    sendCount,
  });

  return { code, success: true };
}

export function verifyOtp(phone, code) {
  if (!phone || !code) return { valid: false, error: 'Phone and code are required' };

  const key = phone.replace(/\D/g, '').slice(-9);
  const entry = store.get(key);

  if (!entry) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  const now = Date.now();

  // Check expiry
  if (now - entry.createdAt > OTP_TTL_MS) {
    store.delete(key);
    return { valid: false, error: 'Verification code has expired. Please request a new one.', expired: true };
  }

  // Check attempts
  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(key);
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.', locked: true };
  }

  // Check code
  if (entry.code !== code.trim()) {
    entry.attempts += 1;
    const remaining = MAX_ATTEMPTS - entry.attempts;
    if (remaining <= 0) {
      store.delete(key);
      return { valid: false, error: 'Too many incorrect attempts. Please request a new code.', locked: true };
    }
    return { valid: false, error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, remaining };
  }

  // Success — consume the OTP
  store.delete(key);
  return { valid: true };
}
