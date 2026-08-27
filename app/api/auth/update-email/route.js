import { NextResponse } from 'next/server';
import { wcPut } from '@/lib/wc-config';
import { requireCustomerOr401 } from '@/lib/api-guard';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findCustomerByPhone } from '@/lib/customer';
import { createOtp, verifyOtp } from '@/lib/otp-store';
import { sendOtpEmail } from '@/lib/email';

/**
 * POST /api/auth/update-email
 *
 * Two-step, because the email address is the OTP delivery channel — changing
 * it unverified would let an attacker who briefly held a session redirect all
 * future login codes to themselves.
 *
 *   1. POST { email }              → sends a code to the NEW address
 *   2. POST { email, code }        → verifies and commits the change
 *
 * The customer ID comes from the session. The previous version read a
 * `customer_id` from the body and compared it against an `auth_token` cookie
 * that nothing in the app ever issued, so it returned 401 unconditionally.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 6, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 });
  }

  const { session, denied } = await requireCustomerOr401(request);
  if (denied) return denied;

  try {
    const { email, code } = await request.json();

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Resolve the customer from the session, never from the request body.
    let customerId = session.customerId;
    if (!customerId) {
      const customer = await findCustomerByPhone(session.phone);
      customerId = customer?.id ?? null;
    }
    if (!customerId) {
      return NextResponse.json({ error: 'No account found for this session' }, { status: 404 });
    }

    // OTP is keyed on the change request, not the phone, so it cannot be
    // satisfied by a code issued for a login.
    const challengeKey = `email-change:${session.phone}:${normalizedEmail}`;

    // Step 1 — no code supplied yet: send one to the new address.
    if (!code) {
      const challenge = await createOtp(challengeKey);
      if (challenge.error) {
        return NextResponse.json({ error: challenge.error, cooldown: challenge.cooldown }, { status: 429 });
      }

      try {
        await sendOtpEmail({ to: normalizedEmail, code: challenge.code });
      } catch (err) {
        console.error('Failed to send email-change code:', err.message);
        return NextResponse.json({ error: 'Could not send the verification code to that address' }, { status: 502 });
      }

      return NextResponse.json({ verificationSent: true, email: normalizedEmail });
    }

    // Step 2 — verify the code, then commit.
    const check = await verifyOtp(challengeKey, code);
    if (!check.valid) {
      return NextResponse.json({ error: check.error, remaining: check.remaining }, { status: 401 });
    }

    try {
      const updated = await wcPut(`customers/${customerId}`, { email: normalizedEmail });
      return NextResponse.json({ success: true, email: updated.email });
    } catch (err) {
      console.error('WC update email error:', err.message);
      return NextResponse.json({ error: 'Could not update your email address' }, { status: 502 });
    }
  } catch (error) {
    console.error('Update email error:', error.message);
    return NextResponse.json({ error: 'Could not update your email address' }, { status: 500 });
  }
}
