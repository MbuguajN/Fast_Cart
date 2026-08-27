import { NextResponse } from 'next/server';
import { verifyToken, readCookie, AUDIENCE } from '@/lib/crypto-tokens';

/**
 * Optimistic authorisation gate.
 *
 * Next.js 16 renamed Middleware to Proxy. The docs are explicit that proxy is
 * NOT an authorisation boundary — a matcher change or a route move silently
 * removes coverage. So this is defence in depth only: every guarded route
 * handler still runs its own `adminGuard` / `tradeGuard` / `customerGuard`,
 * which are the authoritative checks. This layer exists to reject the obvious
 * cases before they reach a handler, and to make a newly added admin or trade
 * route fail closed rather than open if someone forgets the in-handler guard.
 *
 * Deliberately imports only lib/crypto-tokens.js — pulling in the trade store
 * here would run filesystem I/O on every matched request.
 */

const ADMIN_COOKIE = 'admin_token';
const TRADE_COOKIE = 'trade_token';

/** Endpoints that must stay reachable without a session (login, status). */
const PRE_AUTH_PATHS = new Set([
  '/api/admin/auth',
  '/api/admin/auth/check',
  '/api/trade/auth',
  '/api/trade/apply',
]);

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

function bearerOrCookie(request, cookieName) {
  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return readCookie(request, cookieName);
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (PRE_AUTH_PATHS.has(pathname)) return NextResponse.next();

  const audience = pathname.startsWith('/api/admin')
    ? AUDIENCE.ADMIN
    : pathname.startsWith('/api/trade')
      ? AUDIENCE.TRADE
      : null;

  if (!audience) return NextResponse.next();

  const cookieName = audience === AUDIENCE.ADMIN ? ADMIN_COOKIE : TRADE_COOKIE;
  const token = bearerOrCookie(request, cookieName);
  if (!token) return unauthorized();

  try {
    const payload = await verifyToken(audience, token);
    if (!payload) return unauthorized();
  } catch {
    // A missing or malformed signing secret throws. Fail closed.
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/trade/:path*'],
};
