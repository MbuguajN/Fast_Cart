import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { kvGet, kvDelete } from '../../../../../lib/kv-store.js';
import {
  buildTradeAccount,
  upsertTradeAccount,
  addTradeUser,
  toPublicTradeUser,
} from '../../../../../lib/trade/trade-store.js';
import {
  signTradeToken,
  TRADE_COOKIE,
  tradeCookieOptions,
} from '../../../../../lib/trade/trade-auth.js';
import { rateLimitRequest } from '../../../../../lib/rate-limit.js';

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 30, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please wait.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, code } = body || {};

    if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Email and 6-digit verification code are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    const stored = await kvGet(`trade_signup_otp:${cleanEmail}`);
    if (!stored || String(stored.code).trim() !== cleanCode) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new one.' },
        { status: 400 }
      );
    }

    // 1. Provision active individual trade account
    const account = buildTradeAccount(
      {
        tradingName: stored.name,
        contactName: stored.name,
        phone: stored.phone,
        email: stored.email,
        segment: 'individual',
        isGuest: false,
      },
      { status: 'active' }
    );
    account.segment = 'individual';
    account.isGuest = false;
    account.status = 'active';

    await upsertTradeAccount(account);

    // 2. Provision owner user seat
    const user = {
      id: 'usr_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
      accountId: account.id,
      name: stored.name,
      email: stored.email,
      phone: stored.phone,
      seatType: 'owner',
      role: 'Account Owner',
      passwordHash: stored.passwordHash,
    };

    await addTradeUser(user);

    // 3. Clear the OTP challenge key
    await kvDelete(`trade_signup_otp:${cleanEmail}`);

    // 4. Issue authenticated session token
    const token = await signTradeToken({
      userId: user.id,
      accountId: account.id,
      seatType: user.seatType,
      role: user.role,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: toPublicTradeUser(user),
      account,
    });

    response.cookies.set(TRADE_COOKIE, token, tradeCookieOptions());
    return response;
  } catch (error) {
    console.error('Trade signup verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
