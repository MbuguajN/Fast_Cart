/**
 * Shared signed-token core for every audience in the app (admin, trade,
 * customer).
 *
 * Three properties this module exists to guarantee:
 *
 *  1. No hardcoded fallback secret. A missing secret raises at sign/verify
 *     time rather than silently signing with a value committed to the repo.
 *     Resolution is lazy so `next build` still succeeds without runtime env.
 *  2. Constant-time signature comparison, so a signature cannot be recovered
 *     byte-by-byte from response timing.
 *  3. An explicit `aud` claim, so an admin token can never be replayed as a
 *     trade or customer token even if two audiences share a secret.
 *
 * Implemented on Web Crypto (`crypto.subtle`) so it behaves identically in
 * route handlers and in `proxy.js`.
 */

const encoder = new TextEncoder();

/** Audience identifiers. A token is only valid for the audience it was signed for. */
export const AUDIENCE = {
  ADMIN: 'admin',
  TRADE: 'trade',
  CUSTOMER: 'customer',
};

/**
 * Env var backing each audience. Separate secrets mean compromising one
 * audience does not hand over the others.
 */
const SECRET_ENV = {
  [AUDIENCE.ADMIN]: ['ADMIN_JWT_SECRET'],
  [AUDIENCE.TRADE]: ['TRADE_JWT_SECRET', 'ADMIN_JWT_SECRET'],
  [AUDIENCE.CUSTOMER]: ['CUSTOMER_SESSION_SECRET', 'SESSION_SECRET'],
};

const MIN_SECRET_LENGTH = 32;

function resolveSecret(audience) {
  const names = SECRET_ENV[audience];
  if (!names) throw new Error(`Unknown token audience: ${audience}`);

  for (const name of names) {
    const value = process.env[name];
    if (value && value.length >= MIN_SECRET_LENGTH) return value;
    if (value && value.length > 0) {
      throw new Error(
        `${name} is too short (${value.length} chars). Use at least ${MIN_SECRET_LENGTH} characters of high-entropy randomness.`
      );
    }
  }

  throw new Error(
    `Missing signing secret for "${audience}" tokens. Set ${names[0]} in the environment. ` +
    `Generate one with: openssl rand -base64 48`
  );
}

function base64urlFromBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64url(str) {
  return base64urlFromBytes(encoder.encode(str));
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64urlFromBytes(new Uint8Array(signature));
}

/**
 * Constant-time string comparison.
 *
 * Compares every character regardless of where the first mismatch occurs, so
 * elapsed time does not leak how much of the signature was correct. Length is
 * folded into the accumulator rather than short-circuiting on it.
 */
function timingSafeEquals(a, b) {
  const aBytes = encoder.encode(String(a));
  const bBytes = encoder.encode(String(b));
  let diff = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Sign a payload for a given audience.
 *
 * @param {string} audience one of AUDIENCE.*
 * @param {object} payload  claims to embed (keep it small — it is client-visible)
 * @param {number} ttlMs    lifetime in milliseconds
 */
export async function signToken(audience, payload, ttlMs) {
  const secret = resolveSecret(audience);
  const now = Date.now();
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, aud: audience, iat: now, exp: now + ttlMs }));
  const signature = await hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a token and return its payload, or null if it is invalid, expired,
 * or was issued for a different audience.
 *
 * Never throws for an untrusted token — a missing secret is the one condition
 * that propagates, because that is an operator error, not an attacker input.
 */
export async function verifyToken(audience, token) {
  if (!token || typeof token !== 'string') return null;

  const secret = resolveSecret(audience);

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;

    const expected = await hmacSign(secret, `${header}.${body}`);
    if (!timingSafeEquals(signature, expected)) return null;

    const payload = JSON.parse(base64urlDecode(body));

    // Reject a token minted for a different audience even under a shared secret.
    if (payload.aud !== audience) return null;
    if (!payload.exp || Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Read a cookie by exact name from a Request.
 *
 * Anchored on a cookie boundary so `x_admin_token=` cannot satisfy a lookup
 * for `admin_token`.
 */
export function readCookie(request, name) {
  const header = request.headers?.get?.('cookie') || '';
  if (!header) return null;

  for (const part of header.split(';')) {
    const segment = part.trim();
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    if (segment.slice(0, eq) === name) {
      return decodeURIComponent(segment.slice(eq + 1));
    }
  }
  return null;
}

export { timingSafeEquals };
