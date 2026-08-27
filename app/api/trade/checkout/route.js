import { NextResponse } from 'next/server';
import { requireTradeOr401 } from '@/lib/api-guard';
import { createTradeOrder } from '@/lib/trade/trade-store.js';
import { resolveTradeLineItems } from '@/lib/trade/trade-catalog.js';
import { stripEconomics } from '@/lib/trade/pricing-visibility.js';
import { rateLimitRequest } from '@/lib/rate-limit';

/**
 * POST /api/trade/checkout
 *
 * Line items are re-derived from the trade catalogue before pricing. The
 * pricing engine computes a unit price from `prkCostIncVat`, and both that
 * cost and the `priceLine` used to arrive from the request body — so a buyer
 * could post a cost of KES 1 and have the order priced against it, and could
 * label spirits as `jaba` to skip the liquor-licence check.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  const { auth, denied } = await requireTradeOr401(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { items, deliveryAddress, deliveryDate, poReference, notes, paymentMethod } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });
    }

    // Only buyers with an ordering seat may place orders.
    if (auth.user.seatType === 'viewer') {
      return NextResponse.json(
        { error: 'Your seat has view-only access. Ask an owner to place this order.' },
        { status: 403 }
      );
    }

    // Server-authoritative line resolution: identifier + quantity only.
    let resolvedItems;
    try {
      resolvedItems = resolveTradeLineItems(items, { account: auth.account });
    } catch (resolutionError) {
      return NextResponse.json({ error: resolutionError.message }, { status: 400 });
    }

    // Delivery address must be one the account actually holds, so an order
    // cannot be routed to an arbitrary drop point.
    const address = resolveDeliveryAddress(auth.account, deliveryAddress);
    if (!address) {
      return NextResponse.json(
        { error: 'Select one of your registered delivery addresses' },
        { status: 400 }
      );
    }

    const order = await createTradeOrder({
      account: auth.account,
      user: auth.user,
      items: resolvedItems,
      deliveryAddress: address,
      deliveryDate,
      poReference: sanitizeText(poReference, 60),
      notes: sanitizeText(notes, 500),
      paymentMethod: paymentMethod === 'pay_on_account' ? 'pay_on_account' : 'mpesa_paybill',
      source: 'portal',
    });

    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      order: stripEconomics(order, auth.user),
    });
  } catch (error) {
    // createTradeOrder throws user-actionable messages (minimum order, credit
    // limit, licence) — those belong in front of the buyer.
    console.error('Trade checkout error:', error.message);
    return NextResponse.json({ error: error.message || 'Order creation failed' }, { status: 400 });
  }
}

/**
 * Match the requested address against the account's registered addresses.
 * Falls back to the account default when nothing is specified.
 */
function resolveDeliveryAddress(account, requested) {
  const addresses = account?.addresses || [];
  if (!addresses.length) return null;

  if (requested?.id) {
    return addresses.find((a) => a.id === requested.id) || null;
  }

  return addresses.find((a) => a.isDefault) || addresses[0];
}

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength);
}
