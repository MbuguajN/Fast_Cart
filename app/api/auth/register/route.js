import { NextResponse } from 'next/server';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

export async function POST(request) {
  try {
    const { phone, name, landmark, email } = await request.json();

    if (!phone || !name) {
      return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 });
    }

    const [firstName, ...lastParts] = name.split(' ');
    const lastName = lastParts.join(' ') || '';
    const formattedPhone = phone.replace(/\s/g, '');
    const customerEmail = email && email.includes('@') ? email : `liquor_${formattedPhone}@liquordash.local`;

    const customerPayload = {
      email: customerEmail,
      first_name: firstName,
      last_name: lastName,
      billing: {
        phone: formattedPhone,
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
        city: 'Nairobi',
      },
      shipping: {
        phone: formattedPhone,
        first_name: firstName,
        last_name: lastName,
        address_1: landmark || '',
        city: 'Nairobi',
      },
      meta_data: [
        { key: 'landmark_hint', value: landmark || '' },
        { key: 'phone_normalized', value: formattedPhone },
      ],
    };

    const url = `${WC_URL}/wp-json/wc/v3/customers?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerPayload),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('WC customer creation error:', err);
      return NextResponse.json({ error: err.message || 'Failed to create customer' }, { status: res.status });
    }

    const customer = await res.json();
    return NextResponse.json({ customerId: customer.id, success: true });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
