import { NextResponse } from 'next/server';
import {
  findTradeUserByIdentifier,
  getTradeUserWithAccount,
  recordTradeLoginAttempt,
  isTradeUserLocked,
  toPublicTradeUser,
} from '@/lib/trade/trade-store.js';
import { signTradeToken, getTradeAuthFromRequest, tradeCookieOptions, TRADE_COOKIE } from '@/lib/trade/trade-auth.js';
import { verifyPassword, hasPassword } from '@/lib/trade/trade-password.js';
import { rateLimitRequest, rateLimitIdentity } from '@/lib/rate-limit';

/**
 * Trade portal authentication.
 *
 * The previous POST handler destructured `password` and never referenced it
 * again — any caller who knew a trade seat's email, phone or user ID received
 * a 24-hour session with wholesale pricing, invoices, statements and the
 * account's credit line. There was no password field in the store to check
 * against.
 *
 * Sign-in now requires a password verified against a stored scrypt hash, and
 * is throttled per IP and per seat.
 */

/** Uniform failure. Never distinguishes "no such seat" from "wrong password". */
function invalidCredentials() {
  return NextResponse.json(
    { error: 'Invalid credentials. Check your details or contact your account manager.' },
    { status: 401 }
  );
}

export async function GET(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      user: toPublicTradeUser(auth.user),
      account: auth.account,
    });
  } catch (error) {
    console.error('Trade session check failed:', error.message);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Please wait.' }, { status: 429 });
  }

  try {
    const { identifier, password } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ error: 'Email, phone, or User ID is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Per-seat throttle, so rotating IPs cannot brute force one account.
    const identityLimit = await rateLimitIdentity(identifier.trim().toLowerCase(), {
      scope: 'trade-login',
      maxRequests: 10,
      windowMs: 900000,
    });
    if (!identityLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts for this account. Please try again later.' },
        { status: 429 }
      );
    }

    const user = findTradeUserByIdentifier(identifier);

    // Unknown seat and wrong password are indistinguishable to the caller —
    // trade emails are guessable from any corporate website, and a distinct
    // 404 would confirm which of them are real accounts.
    if (!user) return invalidCredentials();

    if (isTradeUserLocked(user)) {
      return NextResponse.json(
        { error: 'This account is temporarily locked after repeated failed sign-ins. Try again shortly.' },
        { status: 423 }
      );
    }

    // A seat with no credential fails exactly like a wrong password. Saying
    // "no password set" would confirm the account exists, which is the
    // enumeration problem this route was fixed to avoid — trade emails are
    // guessable from any corporate website. Operators see it in the logs;
    // provision with scripts/set-trade-password.mjs.
    if (!hasPassword(user)) {
      console.warn(`Trade seat ${user.id} has no password set — sign-in refused`);
      return invalidCredentials();
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await recordTradeLoginAttempt(user.id, false);
      return invalidCredentials();
    }

    const authRes = getTradeUserWithAccount(user.id);
    if (!authRes?.account) {
      return NextResponse.json({ error: 'Associated trade account not found' }, { status: 404 });
    }

    if (authRes.account.status === 'suspended') {
      return NextResponse.json(
        { error: 'Trade account is currently suspended. Please contact your account manager.' },
        { status: 403 }
      );
    }

    await recordTradeLoginAttempt(user.id, true);

    const token = await signTradeToken({
      userId: user.id,
      accountId: authRes.account.id,
      seatType: user.seatType,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: toPublicTradeUser(authRes.user),
      account: authRes.account,
      mustChangePassword: Boolean(user.mustChangePassword),
      // The token is not echoed in the body — it lives in the httpOnly cookie
      // below, where page scripts cannot read it.
    });

    response.cookies.set(TRADE_COOKIE, token, tradeCookieOptions());
    return response;
  } catch (error) {
    console.error('Trade login error:', error.message);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set(TRADE_COOKIE, '', { ...tradeCookieOptions(), maxAge: 0 });
  return response;
}
