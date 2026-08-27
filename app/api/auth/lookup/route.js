import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findCustomerByPhone } from '@/lib/customer';

/**
 * POST /api/auth/lookup
 *
 * Answers one question: does an account exist for this phone number? The
 * client needs that only to choose between the OTP and password login paths.
 *
 * It deliberately returns nothing else. This endpoint previously returned the
 * full customer record — name, email, billing and shipping addresses — to any
 * unauthenticated caller, which made it an enumeration oracle over the whole
 * customer base. Profile data now comes back only from /api/auth/verify-otp,
 * after the caller has proven control of the number.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const match = await findCustomerByPhone(phone);

    // Existence only — never the record itself.
    return NextResponse.json({ found: Boolean(match) });
  } catch (error) {
    console.error('Lookup error:', error.message);
    return NextResponse.json({ found: false });
  }
}
