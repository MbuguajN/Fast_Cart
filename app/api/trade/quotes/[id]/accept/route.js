import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { acceptTradeQuote, getTradeQuotes } from '@/lib/trade/trade-store.js';

export async function POST(request, { params }) {
  try {
    const auth = await requireTradeAuth(request);
    const { id } = await params;

    const quotes = getTradeQuotes({ accountId: auth.account.id });
    const match = quotes.find((q) => q.id === id);
    if (!match) {
      return NextResponse.json({ error: 'Quote not found or unauthorized' }, { status: 404 });
    }

    const order = await acceptTradeQuote(id, auth.user);

    return NextResponse.json({
      success: true,
      message: 'Quote accepted and converted to order.',
      order,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Quote conversion failed' }, { status: 400 });
  }
}

