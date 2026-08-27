/**
 * Password hashing for B2B trade seats.
 *
 * scrypt with a per-user random salt. scrypt is memory-hard, so a leaked store
 * cannot be attacked at GPU speed the way a fast hash (SHA-256, MD5) can.
 *
 * Stored format: `scrypt$N$r$p$<salt-b64>$<hash-b64>`
 * The parameters travel with the hash, so they can be raised later without
 * invalidating existing credentials.
 */

import crypto from 'crypto';

const SCRYPT = {
  N: 16384,   // CPU/memory cost
  r: 8,       // block size
  p: 1,       // parallelisation
  keyLength: 64,
  saltBytes: 16,
};

// scrypt needs memory proportional to 128 * N * r; give it headroom.
const MAX_MEMORY = 128 * SCRYPT.N * SCRYPT.r * 2;

export const MIN_PASSWORD_LENGTH = 12;

function scryptAsync(password, salt, { N, r, p, keyLength }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLength,
      { N, r, p, maxmem: MAX_MEMORY },
      (err, derivedKey) => (err ? reject(err) : resolve(derivedKey))
    );
  });
}

/**
 * Reject the passwords that make a B2B account trivially guessable.
 * Returns null when acceptable, or a message explaining what to change.
 */
export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > 200) {
    return 'Password must be 200 characters or fewer';
  }
  if (/^\d+$/.test(password)) {
    return 'Password cannot be only digits';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'Password cannot be a single repeated character';
  }
  return null;
}

/** Hash a password for storage. */
export async function hashPassword(password) {
  const problem = validatePasswordStrength(password);
  if (problem) throw new Error(problem);

  const salt = crypto.randomBytes(SCRYPT.saltBytes);
  const derived = await scryptAsync(password, salt, SCRYPT);

  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing for any malformed or missing hash, so a
 * seat that has never had a password set simply cannot authenticate.
 */
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Refuse absurd parameters from a tampered store rather than allocating on them.
  if (N > 1 << 20 || r > 32 || p > 16) return false;

  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = await scryptAsync(password, salt, { N, r, p, keyLength: expected.length });

    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Whether a seat has a usable credential at all. */
export function hasPassword(user) {
  return typeof user?.passwordHash === 'string' && user.passwordHash.startsWith('scrypt$');
}

/** A readable temporary password for onboarding a new trade seat. */
export function generateTemporaryPassword() {
  // Ambiguous characters removed — these get read out over the phone.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let chunk = '';
    for (let i = 0; i < 4; i++) {
      chunk += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    groups.push(chunk);
  }
  return groups.join('-');
}
