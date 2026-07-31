import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!orderId) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const { note } = await request.json();
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const sanitizedNote = note.replace(/[<>]/g, '').trim().slice(0, 500);

    const url = wcUrl(`orders/${orderId}/notes`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: sanitizedNote, customer_note: true }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to add note' }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
