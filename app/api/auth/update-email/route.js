import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const { email, customerId } = await req.json();

    if (!email || !customerId) {
      return NextResponse.json({ error: 'Missing email or customerId' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (payload.phone !== String(customerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = wcUrl(`customers/${customerId}`);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('WC update email error:', res.status, text);
      return NextResponse.json({ error: 'Failed to update email in WooCommerce' }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, email: data.email });
  } catch (error) {
    console.error('Update email error:', error);
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
  }
}
