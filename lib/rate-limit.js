/**
 * Request rate limiting.
 *
 * Two changes from the previous version:
 *
 *  • State lives in lib/kv-store.js, so limits hold across instances when
 *    Redis is configured instead of dividing by the instance count.
 *
 *  • The client IP is read from a trusted position in `x-forwarded-for`
 *    rather than the leftmost value. The leftmost value is whatever the client
 *    sent, so a spoofed header reset the counter on every request.
 */

import { kvIncrement, kvTimeToLive } from './kv-store.js';

/**
 * How many proxies sit in front of this app. The client IP is that many hops
 * from the right-hand end of `x-forwarded-for`, which is the part a client
 * cannot forge.
 *
 * 1 for a single reverse proxy (nginx, Vercel, Cloudflare). Raise it only if
 * you genuinely run more.
 */
const TRUSTED_PROXY_HOPS = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10);

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    const chain = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    // Count in from the right: everything left of our trusted hops is
    // attacker-controlled and must not be used for keying.
    const index = chain.length - TRUSTED_PROXY_HOPS;
    if (index >= 0 && chain[index]) return chain[index];
    if (chain.length) return chain[chain.length - 1];
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Consume one unit against `key`.
 * Returns `{ allowed, remaining, retryAfter }`.
 *
 * Fails open on a backend error: a Redis outage should degrade the limiter,
 * not take checkout and login down with it.
 */
export async function rateLimit(key, { maxRequests = 10, windowMs = 60000 } = {}) {
  const storageKey = `ratelimit:${key}`;

  try {
    const count = await kvIncrement(storageKey, windowMs);

    if (count > maxRequests) {
      const ttl = await kvTimeToLive(storageKey);
      return { allowed: false, remaining: 0, retryAfter: Math.ceil(ttl / 1000) || 1 };
    }

    return { allowed: true, remaining: Math.max(0, maxRequests - count) };
  } catch (error) {
    console.error('Rate limiter unavailable, allowing request:', error.message);
    return { allowed: true, remaining: maxRequests };
  }
}

/** Rate limit by client IP, scoped to the route path so limits do not collide. */
export async function rateLimitRequest(request, opts = {}) {
  const ip = getClientIp(request);
  const scope = opts.scope || new URL(request.url).pathname;
  return rateLimit(`${scope}:${ip}`, opts);
}

/**
 * Rate limit by a stable identity (phone, email, account ID) rather than IP.
 * Use alongside the IP limit wherever rotating IPs would otherwise defeat it —
 * OTP sends and login attempts especially.
 */
export async function rateLimitIdentity(identity, opts = {}) {
  const scope = opts.scope || 'identity';
  return rateLimit(`${scope}:id:${identity}`, opts);
}
