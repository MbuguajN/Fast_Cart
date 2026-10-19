import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { verifyToken, AUDIENCE } from '@/lib/crypto-tokens.js';
import { findTradeUserByIdentifier, setTradeUserPasswordHash } from '@/lib/trade/trade-store.js';
import { hashPassword, validatePasswordStrength } from '@/lib/trade/trade-password.js';

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { token, newPassword } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Password reset token is missing. Please request a new reset link.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Please enter your new password.' }, { status: 400 });
    }

    const payload = await verifyToken(AUDIENCE.TRADE, token);
    if (!payload || payload.purpose !== 'pwd_reset' || !payload.userId) {
      return NextResponse.json(
        { error: 'This password reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const user = await findTradeUserByIdentifier(payload.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User account associated with this reset link was not found.' },
        { status: 404 }
      );
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await setTradeUserPasswordHash(user.id, passwordHash, { mustChange: false });

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[trade-password] Password reset submission error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}

