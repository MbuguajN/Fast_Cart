import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { verifyOtp } from '@/lib/otp-store';
import { findCustomerByPhone } from '@/lib/customer';

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 15, windowMs: 300000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 });
    }

    const result = verifyOtp(phone, code);

    if (!result.valid) {
      return NextResponse.json({
        verified: false,
        error: result.error,
        expired: result.expired || false,
        locked: result.locked || false,
        remaining: result.remaining,
      }, { status: 401 });
    }

    // OTP verified — now look up the customer and return full profile
    const customer = await findCustomerByPhone(phone);

    if (customer) {
      return NextResponse.json({
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
      });
    }

    // Verified phone but no existing account — new customer
    return NextResponse.json({
      verified: true,
      found: false,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
