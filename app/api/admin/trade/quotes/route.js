import { NextResponse } from 'next/server';
import { getTradeQuotes, createTradeQuote } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const quotes = getTradeQuotes();
    return NextResponse.json({ success: true, quotes });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const quote = createTradeQuote(body);
    return NextResponse.json({ success: true, quote });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

