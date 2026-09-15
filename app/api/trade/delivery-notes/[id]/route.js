import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById } from '@/lib/trade/trade-store.js';
import { generateTradeDeliveryNote } from '@/lib/trade/trade-documents.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;
    const order = await getTradeOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }

    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this delivery note.' }, { status: 403 });
    }

    const deliveryNote = generateTradeDeliveryNote(order, auth.account);

    return NextResponse.json({
      success: true,
      deliveryNote,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}
