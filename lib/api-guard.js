import { NextResponse } from 'next/server';
import { requireAdmin } from './auth.js';
import { getTradeAuthFromRequest } from './trade/trade-auth.js';
import { getCustomerSession } from './session.js';

/**
 * Route-handler guards.
 *
 * Each guard returns `null` when the caller is authorised, or a ready-to-return
 * NextResponse when it is not. Usage:
 *
 *   const denied = await adminGuard(request);
 *   if (denied) return denied;
 *
 * `proxy.js` runs an optimistic version of these checks at the edge of the app,
 * but the Next.js docs are explicit that proxy is not an authorisation
 * boundary — these in-handler checks are the authoritative ones.
 */

function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** Requires a valid `admin_token` cookie. Returns null when allowed. */
export async function adminGuard(request) {
  const user = await requireAdmin(request);
  if (!user) return unauthorized();
  return null;
}

/** Requires a valid `trade_token`. Returns null when allowed. */
export async function tradeGuard(request) {
  const auth = await getTradeAuthFromRequest(request);
  if (!auth) return unauthorized('Trade authentication required');
  return null;
}

/** Requires a verified customer session cookie. Returns null when allowed. */
export async function customerGuard(request) {
  const session = await getCustomerSession(request);
  if (!session) return unauthorized('Sign in to continue');
  return null;
}

/**
 * Resolves the admin identity, or returns a 401 response.
 * Use when the handler needs the admin's details, not just the yes/no.
 */
export async function requireAdminOr401(request) {
  const user = await requireAdmin(request);
  if (!user) return { user: null, denied: unauthorized() };
  return { user, denied: null };
}

/**
 * Resolves the trade user + account, or returns a 401 response.
 */
export async function requireTradeOr401(request) {
  const auth = await getTradeAuthFromRequest(request);
  if (!auth) return { auth: null, denied: unauthorized('Trade authentication required') };
  return { auth, denied: null };
}

/**
 * Resolves the customer session, or returns a 401 response.
 */
export async function requireCustomerOr401(request) {
  const session = await getCustomerSession(request);
  if (!session) return { session: null, denied: unauthorized('Sign in to continue') };
  return { session, denied: null };
}
