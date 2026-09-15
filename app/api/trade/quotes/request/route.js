import { NextResponse } from 'next/server';
import { requireTradeOr401 } from '@/lib/api-guard';
import { resolveTradeLineItems } from '@/lib/trade/trade-catalog.js';
import { createTradeQuote } from '@/lib/trade/trade-store.js';
import { rateLimitRequest } from '@/lib/rate-limit';

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { items, notes, requestedDeliveryDate } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Quote request must contain at least one product' }, { status: 400 });
    }

    // Resolve items securely against trade catalog
    let resolvedItems;
    try {
      resolvedItems = await resolveTradeLineItems(items, { account: auth.account, checkStock: false });
    } catch (resolutionError) {
      return NextResponse.json({ error: resolutionError.message }, { status: 400 });
    }

    const noteText = [
      notes ? notes.trim() : '',
      requestedDeliveryDate ? `Target Delivery / Event Date: ${requestedDeliveryDate}` : '',
      `Requested by: ${auth.user.name} (${auth.user.email})`,
    ]
      .filter(Boolean)
      .join(' | ');

    const quote = await createTradeQuote({
      accountId: auth.account.id,
      accountName: auth.account.tradingName,
      items: resolvedItems,
      notes: noteText,
      tierOverride: auth.account.tierOverride || null,
    });

    return NextResponse.json({
      success: true,
      message: 'Volume quote requested successfully. Your account specialist has been notified.',
      quote,
    });
  } catch (error) {
    console.error('Quote request error:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to submit quote request' }, { status: 500 });
  }
}

