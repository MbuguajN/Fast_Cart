import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrderById } from '@/lib/trade/trade-store.js';
import { generateTradeInvoiceDocument } from '@/lib/trade/trade-documents.js';

export async function GET(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;
    const order = await getTradeOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (order.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this invoice.' }, { status: 403 });
    }

    const invoice = generateTradeInvoiceDocument(order, auth.account);

    return NextResponse.json({
      success: true,
      invoice,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}

