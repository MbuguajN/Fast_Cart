import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';
import { sendTradeDeliveryNoteEmail } from '@/lib/trade/trade-email.js';
import { rateLimitRequest } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request, { params }) {
  let auth;
  try {
    auth = await requireTradeAuth(request);
  } catch {
    return NextResponse.json({ error: 'Trade authentication required' }, { status: 401 });
  }

  try {
    const rl = await rateLimitRequest(request, { scope: '/api/trade/delivery-notes/email', maxRequests: 10, windowMs: 300000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many email attempts. Try again shortly.' }, { status: 429 });
    }

    const { id } = await params;
    const order = await getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }
    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this delivery note.' }, { status: 403 });
    }

    const { recipientEmail } = await request.json();
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }

    const deliveryNote = generateTradeDeliveryNote(order, auth.account);
    await sendTradeDeliveryNoteEmail({ to: recipientEmail, deliveryNote });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trade delivery note email failed:', error.message);
    return NextResponse.json({ error: 'Failed to email delivery note. Please try again.' }, { status: 500 });
  }
}
