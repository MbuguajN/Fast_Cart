import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { verifyOtp } from '@/lib/otp-store';
import { findCustomerByPhone } from '@/lib/customer';
import { createCustomerSession, setSessionCookie, normalizePhone } from '@/lib/session';

/**
 * POST /api/auth/verify-otp
 *
 * The one place an anonymous caller can become an authenticated customer.
 *
 * On success it now issues a signed httpOnly session cookie. Previously it
 * returned the customer profile and issued nothing, leaving `localStorage` as
 * the only record that verification had happened — which meant the OTP step
 * gated a UI transition rather than access to any data.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 15, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 });
    }

    const result = await verifyOtp(phone, code);

    if (!result.valid) {
      return NextResponse.json({
        verified: false,
        error: result.error,
        expired: result.expired || false,
        locked: result.locked || false,
        remaining: result.remaining,
      }, { status: 401 });
    }

    // Control of the number is proven — from here the profile is safe to return.
    const customer = await findCustomerByPhone(phone);

    const token = await createCustomerSession({
      customerId: customer?.id ?? null,
      phone,
      authMethod: 'otp',
    });

    const body = customer
      ? {
          verified: true,
          found: true,
          customer: {
            id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.billing?.phone || customer.shipping?.phone || phone,
            billing: customer.billing,
            shipping: customer.shipping,
            meta_data: customer.meta_data,
          },
        }
      : {
          // Verified number, no WooCommerce record yet. The session still
          // issues so profile completion at checkout is an authenticated call.
          verified: true,
          found: false,
          phone: normalizePhone(phone),
        };

    return setSessionCookie(NextResponse.json(body), token);
  } catch (error) {
    console.error('Verify OTP error:', error.message);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
