import { NextResponse } from 'next/server';
import { rateLimitRequest, rateLimitIdentity } from '@/lib/rate-limit';
import { findTradeUserByIdentifier } from '@/lib/trade/trade-store.js';
import { signToken, AUDIENCE } from '@/lib/crypto-tokens.js';
import { sendTradePasswordResetEmail } from '@/lib/trade/trade-email.js';

export async function POST(request) {
  // Throttled per IP to prevent spamming email inboxes
  const rl = await rateLimitRequest(request, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many password reset requests. Please wait a few minutes before trying again.' },
      { status: 429 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Additional rate limit per email identity
    const idLimit = await rateLimitIdentity(`pwd_reset:${cleanEmail}`, {
      scope: 'trade_pwd_reset',
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (!idLimit.allowed) {
      return NextResponse.json(
        { error: 'A password reset was recently requested for this account. Please check your inbox or wait before requesting another.' },
        { status: 429 }
      );
    }

    const user = await findTradeUserByIdentifier(cleanEmail);

    // Uniform response to prevent email enumeration
    const uniformResponse = {
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been sent.',
    };

    if (user && user.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.myhappyhour.co.ke';
      const token = await signToken(
        AUDIENCE.TRADE,
        { userId: user.id, email: user.email, purpose: 'pwd_reset' },
        30 * 60 * 1000 // 30 minutes TTL
      );

      const resetUrl = `${siteUrl.replace(/\/$/, '')}/trade/reset-password?token=${encodeURIComponent(token)}`;

      try {
        await sendTradePasswordResetEmail({ user, resetUrl, expiresInMinutes: 30 });
      } catch (mailErr) {
        console.error('[trade-password] Failed to dispatch password reset email:', mailErr.message);
      }
    }

    return NextResponse.json(uniformResponse);
  } catch (err) {
    console.error('[trade-password] Reset request error:', err.message);
    return NextResponse.json(
      { error: 'Unable to process password reset request. Please try again later.' },
      { status: 500 }
    );
  }
}

