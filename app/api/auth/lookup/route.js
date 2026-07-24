import { NextResponse } from 'next/server';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const formattedPhone = phone.replace(/\s/g, '');

    const url = `${WC_URL}/wp-json/wc/v3/customers?search=${formattedPhone}&consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
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
