import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeQuoteById, declineTradeQuote } from '@/lib/trade/trade-store.js';

export async function POST(request, { params }) {
  let auth;
  try {
    auth = await requireTradeAuth(request);
  } catch {
    return NextResponse.json({ error: 'Trade authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const quote = await getTradeQuoteById(id);
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.accountId !== auth.account.id) {
      return NextResponse.json({ error: 'Access denied to this quote' }, { status: 403 });
    }

    if (quote.status === 'accepted') {
      return NextResponse.json({ error: 'Cannot decline an already accepted quote' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'declined_by_customer';

    await declineTradeQuote(id, reason);

    return NextResponse.json({
      success: true,
      message: 'Quotation has been declined. Thank you for your feedback.',
    });
  } catch (error) {
    console.error('Decline quote error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to decline quote' }, { status: 500 });
  }
}

