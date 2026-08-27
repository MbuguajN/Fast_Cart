/**
 * B2B trade portal authentication.
 *
 * Sessions are re-hydrated from the trade store on every request, so a
 * suspended account or a deleted seat loses access immediately rather than at
 * token expiry.
 */

import { getTradeUserWithAccount } from './trade-store.js';
import { signToken, verifyToken, readCookie, AUDIENCE } from '../crypto-tokens.js';

const TRADE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const TRADE_COOKIE = 'trade_token';

export async function signTradeToken(payload) {
  return signToken(AUDIENCE.TRADE, payload, TRADE_EXPIRY);
}

export async function verifyTradeToken(token) {
  return verifyToken(AUDIENCE.TRADE, token);
}

export function getTradeTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return readCookie(request, TRADE_COOKIE);
}

export async function getTradeAuthFromRequest(request) {
  const token = getTradeTokenFromRequest(request);
  if (!token) return null;

  const payload = await verifyTradeToken(token);
  if (!payload || !payload.userId) return null;

  const userRes = getTradeUserWithAccount(payload.userId);
  if (!userRes || !userRes.user || !userRes.account) return null;

  // A token outlives a suspension otherwise — re-check on every request.
  if (userRes.account.status === 'suspended') return null;

  return userRes;
}

export async function requireTradeAuth(request) {
  const auth = await getTradeAuthFromRequest(request);
  if (!auth) {
    throw new Error('UNAUTHORIZED_TRADE_ACCESS');
  }
  return auth;
}

export function tradeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TRADE_EXPIRY / 1000,
  };
}
