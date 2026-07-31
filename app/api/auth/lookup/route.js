import { NextResponse } from 'next/server';
import { wcFetch, wcUrl } from '@/lib/wc-config';
import { rateLimitRequest } from '@/lib/rate-limit';

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const formattedPhone = phone.replace(/\s/g, '');

    // Basic phone format validation (10 digits starting with 0)
    if (!/^0\d{9}$/.test(formattedPhone)) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const url = wcUrl('customers', { search: formattedPhone });
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ found: false });
    }

    const customers = await res.json();

    const match = customers.find((c) => {
      const billing = c.billing?.phone?.replace(/\s/g, '');
      const shipping = c.shipping?.phone?.replace(/\s/g, '');
      return billing === formattedPhone || shipping === formattedPhone || c.username === formattedPhone;
    });

    if (match) {
      return NextResponse.json({
        found: true,
        customer: {
          id: match.id,
          first_name: match.first_name,
          last_name: match.last_name,
          email: match.email,
          billing: match.billing,
          shipping: match.shipping,
          meta_data: match.meta_data,
        },
      });
    }

    return NextResponse.json({ found: false });
  } catch (error) {
    console.error('Lookup error');
    return NextResponse.json({ found: false });
  }
}
