import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { createOtp } from '@/lib/otp-store';
import { findCustomerByPhone } from '@/lib/customer';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 10, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    // Generate OTP
    const result = createOtp(phone);
    if (result.error) {
      return NextResponse.json({ sent: false, error: result.error, cooldown: result.cooldown }, { status: 429 });
    }

    // Look up customer to find their email
    const customer = await findCustomerByPhone(phone);
    let emailSent = false;
    let hasAccount = false;
    let maskedEmail = '';

    if (customer) {
      hasAccount = true;
      const email = customer.email;

      // Only send email if it's a real email (not our generated placeholder)
      if (email && !email.endsWith('@liquordash.local') && !email.endsWith('@liquordash.com')) {
        try {
          await sendOtpEmail({ to: email, code: result.code });
          emailSent = true;
          // Mask email for privacy: ch***@5dm.africa
          const [local, domain] = email.split('@');
          maskedEmail = local.slice(0, 2) + '***@' + domain;
        } catch (err) {
          console.error('Failed to send OTP email:', err);
        }
      }
    }

    // For new users (no account) or users without a valid email,
    // we still generate the OTP but can't deliver it via email.
    // In dev mode, log it. In production, you'd need SMS fallback.
    if (!emailSent) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        console.log(`[DEV] OTP for ${phone}: ${result.code}`);
      }
    }

    return NextResponse.json({
      sent: true,
      hasAccount,
      emailSent,
      maskedEmail,
      // Never expose the code in the response in production
      ...(process.env.NODE_ENV === 'development' ? { devCode: result.code } : {}),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
