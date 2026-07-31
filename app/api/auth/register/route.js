import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { rateLimitRequest } from '@/lib/rate-limit';

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 200);
}

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

    const sanitizedName = sanitize(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const [firstName, ...lastParts] = sanitizedName.split(' ');
    const lastName = lastParts.join(' ').slice(0, 100);
    const customerEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : `liquor_${formattedPhone}@liquordash.local`;

    const customerPayload = {
      email: customerEmail,
      first_name: firstName.slice(0, 100),
      last_name: lastName,
      billing: {
        phone: formattedPhone,
        first_name: firstName.slice(0, 100),
        last_name: lastName,
        email: customerEmail,
        city: sanitize(zone || 'Nairobi'),
        address_1: sanitize(landmark || '').slice(0, 200),
      },
      shipping: {
        phone: formattedPhone,
        first_name: firstName.slice(0, 100),
        last_name: lastName,
        address_1: sanitize(landmark || '').slice(0, 200),
        city: sanitize(zone || 'Nairobi'),
      },
      meta_data: [
        { key: 'landmark_hint', value: sanitize(landmark || '').slice(0, 200) },
        { key: 'phone_normalized', value: formattedPhone },
        { key: 'delivery_zone', value: sanitize(zone || '').slice(0, 100) },
      ],
    };

    const url = wcUrl('customers');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerPayload),
    });

    if (!res.ok) {
      console.error('WC customer creation failed');
      return NextResponse.json({ error: 'Failed to create customer' }, { status: res.status });
    }

    const customer = await res.json();
    return NextResponse.json({ customerId: customer.id, success: true });
  } catch (error) {
    console.error('Register error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
