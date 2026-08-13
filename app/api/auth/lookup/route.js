import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { rateLimitRequest } from '@/lib/rate-limit';

function extract9Digits(rawPhone) {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
}

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const clean9 = extract9Digits(phone);
    if (clean9.length < 9) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const searchVariants = [phone.replace(/\s/g, ''), `0${clean9}`, `254${clean9}`, clean9];

    let match = null;

    for (const searchTerm of searchVariants) {
      if (!searchTerm) continue;
      const url = wcUrl('customers', { search: searchTerm, per_page: '20' });
      const res = await fetch(url);
      if (!res.ok) continue;

      const customers = await res.json();
      if (!Array.isArray(customers) || customers.length === 0) continue;

      match = customers.find((c) => {
        const b = extract9Digits(c.billing?.phone);
        const s = extract9Digits(c.shipping?.phone);
        const u = extract9Digits(c.username);
        return b === clean9 || s === clean9 || u === clean9;
      });

      if (match) break;
    }

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
