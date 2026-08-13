import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findCustomerByPhone } from '@/lib/customer';

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    const match = await findCustomerByPhone(phone);

    if (match) {
      return NextResponse.json({
        found: true,
        customer: {
          id: match.id,
          first_name: match.first_name,
          last_name: match.last_name,
          email: match.email,
          phone: match.billing?.phone || match.shipping?.phone || phone,
          billing: match.billing,
          shipping: match.shipping,
          meta_data: match.meta_data,
        },
      });
    }

    return NextResponse.json({ found: false });
  } catch (error) {
    console.error('Lookup error:', error);
    return NextResponse.json({ found: false });
  }
}

