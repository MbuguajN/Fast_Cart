import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById, updateTradeOrderStatus } from '@/lib/trade/trade-store.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;
    const order = getTradeOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this trade order.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const order = getTradeOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'approve') {
      if (auth.user.seatType !== 'owner') {
        return NextResponse.json({ error: 'Only the account owner can approve orders exceeding purchase ceilings.' }, { status: 403 });
      }
      const updated = await updateTradeOrderStatus(id, 'confirmed', { approvedBy: auth.user.name });
      return NextResponse.json({ success: true, message: 'Order approved and released to fulfillment.', order: updated });
    }

    if (action === 'reject') {
      if (auth.user.seatType !== 'owner') {
        return NextResponse.json({ error: 'Only the account owner can reject orders.' }, { status: 403 });
      }
      const updated = await updateTradeOrderStatus(id, 'cancelled');
      return NextResponse.json({ success: true, message: 'Order rejected.', order: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}

