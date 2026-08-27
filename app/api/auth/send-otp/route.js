import { NextResponse } from 'next/server';
import { rateLimitRequest, rateLimitIdentity } from '@/lib/rate-limit';
import { createOtp } from '@/lib/otp-store';
import { findCustomerByPhone } from '@/lib/customer';
import { sendOtpEmail } from '@/lib/email';
import { normalizePhone } from '@/lib/session';

/**
 * POST /api/auth/send-otp
 *
 * Limited on two axes: by client IP, and by the phone number itself — a
 * rotating-IP caller would otherwise walk straight past an IP-only limit and
 * pump codes at one victim's inbox.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const identity = normalizePhone(phone);

    const identityLimit = await rateLimitIdentity(identity, {
      scope: 'send-otp',
      maxRequests: 5,
      windowMs: 600000,
    });
    if (!identityLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many codes requested for this number. Please try again later.' },
        { status: 429 }
      );
    }

    const result = await createOtp(phone);
    if (result.error) {
      return NextResponse.json({ sent: false, error: result.error, cooldown: result.cooldown }, { status: 429 });
    }

    const customer = await findCustomerByPhone(phone);
    let emailSent = false;
    let hasAccount = false;
    let maskedEmail = '';

    if (customer) {
      hasAccount = true;
      const email = customer.email;

      // Placeholder addresses generated at checkout can't receive anything.
      if (email && !email.endsWith('@liquordash.local') && !email.endsWith('@liquordash.com')) {
        try {
          await sendOtpEmail({ to: email, code: result.code });
          emailSent = true;
          const [local, domain] = email.split('@');
          maskedEmail = `${local.slice(0, 2)}***@${domain}`;
        } catch (err) {
          console.error('Failed to send OTP email:', err.message);
        }
      }
    }

    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${phone}: ${result.code}`);
    }

    return NextResponse.json({
      sent: true,
      hasAccount,
      emailSent,
      maskedEmail,
      // The code is never returned outside development.
      ...(process.env.NODE_ENV === 'development' ? { devCode: result.code } : {}),
    });
  } catch (error) {
    console.error('Send OTP error:', error.message);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
