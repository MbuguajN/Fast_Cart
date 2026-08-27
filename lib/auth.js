/**
 * Admin authentication.
 *
 * Thin audience-specific wrapper over lib/crypto-tokens.js, which supplies the
 * fail-fast secret resolution, constant-time signature check and audience
 * binding.
 */

import { signToken as signAudienceToken, verifyToken as verifyAudienceToken, readCookie, AUDIENCE } from './crypto-tokens.js';

const EXPIRY = 8 * 60 * 60 * 1000; // 8 hours

export const ADMIN_COOKIE = 'admin_token';

export async function signToken(payload) {
  return signAudienceToken(AUDIENCE.ADMIN, payload, EXPIRY);
}

export async function verifyToken(token) {
  return verifyAudienceToken(AUDIENCE.ADMIN, token);
}

export function getTokenFromRequest(request) {
  return readCookie(request, ADMIN_COOKIE);
}

export async function getAuthFromRequest(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAdmin(request) {
  return getAuthFromRequest(request);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: EXPIRY / 1000,
  };
}
