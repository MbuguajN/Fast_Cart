import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeQuotes } from '@/lib/trade/trade-store.js';

export async function GET(request) {
  try {
    const auth = await requireTradeAuth(request);
    const quotes = getTradeQuotes({ accountId: auth.account.id });

    return NextResponse.json({
      success: true,
      quotes,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}

