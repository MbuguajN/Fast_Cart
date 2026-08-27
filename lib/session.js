/**
 * Server-side customer sessions.
 *
 * Replaces the previous arrangement where `localStorage` held
 * `{ customerId, verified: true }` and every account route trusted whatever
 * `customerId` the client sent back. The identity now lives in a signed,
 * httpOnly cookie that the browser cannot author, and account routes read the
 * customer ID from the cookie only — never from the request body or query.
 */

import { signToken, verifyToken, readCookie, AUDIENCE } from './crypto-tokens.js';

export const CUSTOMER_COOKIE = 'customer_session';

/** 30 days — consumer shopping session, refreshed on activity. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `lax` rather than `strict`: the Paystack payment callback returns the user
 * via a top-level GET navigation from an external origin, and a strict cookie
 * would not be sent on that hop — the customer would land back on the site
 * logged out immediately after paying.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/**
 * Mint a session token for a verified customer.
 *
 * @param {object}  identity
 * @param {number?} identity.customerId WooCommerce customer ID, or null for a
 *                                      phone-verified guest with no WC record yet
 * @param {string}  identity.phone      normalised phone, the durable identity
 * @param {string}  identity.authMethod how the identity was proven ('otp' | 'password')
 */
export async function createCustomerSession({ customerId, phone, authMethod = 'otp' }) {
  if (!phone) throw new Error('Cannot create a session without a phone number');

  return signToken(
    AUDIENCE.CUSTOMER,
    {
      customerId: customerId ?? null,
      phone: normalizePhone(phone),
      authMethod,
    },
    SESSION_TTL_MS
  );
}

/**
 * Read and verify the session on an incoming request.
 * Returns `{ customerId, phone, authMethod }` or null.
 */
export async function getCustomerSession(request) {
  const token = readCookie(request, CUSTOMER_COOKIE);
  if (!token) return null;

  const payload = await verifyToken(AUDIENCE.CUSTOMER, token);
  if (!payload || !payload.phone) return null;

  return {
    customerId: payload.customerId ?? null,
    phone: payload.phone,
    authMethod: payload.authMethod || 'otp',
  };
}

/** Attach a freshly minted session cookie to a response. */
export function setSessionCookie(response, token) {
  response.cookies.set(CUSTOMER_COOKIE, token, cookieOptions());
  return response;
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(response) {
  response.cookies.set(CUSTOMER_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return response;
}

/**
 * Normalised phone identity: last 9 digits, the form the WooCommerce lookups
 * in lib/customer.js already key on.
 */
export function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}
