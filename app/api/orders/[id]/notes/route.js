import { NextResponse } from 'next/server';
import { wcFetch, wcPost } from '@/lib/wc-config';
import { requireCustomerOr401 } from '@/lib/api-guard';
import { rateLimitRequest } from '@/lib/rate-limit';
import { normalizePhone } from '@/lib/session';

/**
 * POST /api/orders/[id]/notes
 *
 * Adds a customer-visible note to an order. Previously unauthenticated, which
 * let anyone spray notes across sequential order IDs — and those notes are
 * shown to the customer and can be emailed by WooCommerce.
 *
 * Now requires a session and confirms the order actually belongs to it.
 */
export async function POST(request, { params }) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  const { session, denied } = await requireCustomerOr401(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!orderId || orderId < 1) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const { note } = await request.json();
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    // Ownership check: the order must belong to this session's customer.
    let order;
    try {
      ({ data: order } = await wcFetch(`orders/${orderId}`));
    } catch {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!ownsOrder(order, session)) {
      // Same response as a missing order — don't confirm the ID exists.
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const sanitizedNote = note.replace(/[<>]/g, '').trim().slice(0, 500);

    try {
      await wcPost(`orders/${orderId}/notes`, { note: sanitizedNote, customer_note: true });
    } catch (err) {
      console.error('WC note creation failed:', err.message);
      return NextResponse.json({ error: 'Failed to add note' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add order note error:', error.message);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}

/**
 * An order belongs to the session if the WooCommerce customer IDs match, or —
 * for guest orders placed before an account existed — if the billing or
 * shipping phone matches the session's verified number.
 */
function ownsOrder(order, session) {
  if (!order) return false;

  if (session.customerId && Number(order.customer_id) === Number(session.customerId)) {
    return true;
  }

  const sessionPhone = normalizePhone(session.phone);
  if (!sessionPhone) return false;

  return (
    normalizePhone(order.billing?.phone) === sessionPhone ||
    normalizePhone(order.shipping?.phone) === sessionPhone
  );
}
