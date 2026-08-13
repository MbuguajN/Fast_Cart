import { NextResponse } from 'next/server';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findOrCreateCustomer } from '@/lib/customer';

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 5, windowMs: 300000 }); // 5 per 5 min
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  try {
    const { phone, name, landmark, email, zone } = await request.json();

    if (!phone || !name) {
      return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 });
    }

    const formattedPhone = phone.replace(/\s/g, '');

    // Validate phone format
    if (!/^0\d{9}$/.test(formattedPhone)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const customer = await findOrCreateCustomer({ phone: formattedPhone, name, email, landmark, zone });

    return NextResponse.json({ customerId: customer.id, success: true });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

