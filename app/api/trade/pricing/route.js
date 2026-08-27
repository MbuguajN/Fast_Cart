import { NextResponse } from 'next/server';
import { requireTradeOr401 } from '@/lib/api-guard';
import { calculateTradeOrderPricing } from '@/lib/trade/pricing-engine.js';
import { readTradeStore } from '@/lib/trade/trade-store.js';
import { resolveTradeLineItems } from '@/lib/trade/trade-catalog.js';
import { stripEconomics } from '@/lib/trade/pricing-visibility.js';

/**
 * POST /api/trade/pricing
 *
 * Live quote for a basket. Requires a trade session: the response is derived
 * from landed cost and margin data, which previously reached any
 * unauthenticated caller because the auth result was treated as optional.
 *
 * Line costs and price lines are resolved server-side from the cost store, so
 * a quote here matches what /api/trade/checkout will actually charge.
 */
export async function POST(request) {
  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { items = [], deliveryAddress = {}, isNairobi = true } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
    }

    const store = readTradeStore();
    const { account } = auth;

    // Never price from client-supplied cost figures. Resolution failures are
    // the caller's problem (unknown SKU, licence gating) so they surface as 400.
    let resolvedItems;
    try {
      resolvedItems = resolveTradeLineItems(items, { account });
    } catch (resolutionError) {
      return NextResponse.json({ error: resolutionError.message }, { status: 400 });
    }

    const pricing = calculateTradeOrderPricing({
      items: resolvedItems,
      tierOverride: account?.tierOverride || null,
      isNairobi: deliveryAddress?.city ? /nairobi/i.test(deliveryAddress.city) : isNairobi,
      city: deliveryAddress?.city || 'Nairobi',
      customBands: store.config?.priceBands,
      referralCredit: account?.referralCredit || 0,
    });

    return NextResponse.json({
      success: true,
      pricing: stripEconomics(pricing, auth.user),
    });
  } catch (error) {
    console.error('Trade pricing error:', error.message);
    return NextResponse.json({ error: 'Pricing calculation failed' }, { status: 500 });
  }
}
