import { NextResponse } from 'next/server.js';
import crypto from 'node:crypto';
import { kvSet } from '../../../../lib/kv-store.js';
import { hashPassword, validatePasswordStrength } from '../../../../lib/trade/trade-password.js';
import { findTradeUserByIdentifier } from '../../../../lib/trade/trade-store.js';
import { sendOtpEmail } from '../../../../lib/email.js';
import { rateLimitRequest } from '../../../../lib/rate-limit.js';

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 30, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many signup requests. Please wait a few minutes before trying again.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, phone, password } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    // Check if user already exists
    const existing = await findTradeUserByIdentifier(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const code = crypto.randomInt(100000, 1000000).toString();

    const payload = {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      passwordHash,
      code,
    };

    // Store registration OTP challenge for 15 minutes
    await kvSet(`trade_signup_otp:${cleanEmail}`, payload, 15 * 60 * 1000);

    // Send verification code via Brevo / SMTP (non-fatal if unconfigured in test/dev)
    try {
      await sendOtpEmail({ to: cleanEmail, code });
    } catch (err) {
      console.warn('[trade-signup] Could not send OTP email (continuing):', err.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to email',
    });
  } catch (error) {
    console.error('Trade signup initiation error:', error);
    return NextResponse.json(
      { error: error.message || 'Signup initiation failed. Please try again.' },
      { status: 500 }
    );
  }
}
