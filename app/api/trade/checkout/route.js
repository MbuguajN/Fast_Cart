import { NextResponse } from 'next/server';
import { getTradeAuthFromRequest } from '@/lib/trade/trade-auth.js';
import { createTradeOrder, findOrCreateGuestTradeAccount, readTradeStore, updateTradeOrderStatus } from '@/lib/trade/trade-store.js';
import { resolveTradeLineItems } from '@/lib/trade/trade-catalog.js';
import { stripEconomics } from '@/lib/trade/pricing-visibility.js';
import { assertPaymentMethodAllowed } from '@/lib/trade/payment-methods.js';
import { markAwaitingPayment, openHoldCount } from '@/lib/trade/trade-hold.js';
import { publicCheckoutOptions } from '@/lib/trade/trade-config.js';
import { rateLimitRequest } from '@/lib/rate-limit';

/**
 * POST /api/trade/checkout
 *
 * Public — no login required. An authenticated trade session is honoured
 * when present (existing accounts, credit/pay-on-account); otherwise this
 * is a guest checkout and buyer + delivery details are read from the body
 * and used to find-or-create a lightweight account (see
 * findOrCreateGuestTradeAccount). Guests can never select pay-on-account —
 * that requires an authenticated, credit-enabled account (also enforced in
 * createTradeOrder as a backstop).
 *
 * Line items are re-derived from the trade catalogue before pricing. The
 * pricing engine computes a unit price from `prkCostIncVat` and `priceLine`,
 * and both used to arrive from the request body — so a buyer could post a
 * cost of KES 1 and price the order against it. Everything here re-derives
 * those fields from the product catalogue.
 */
export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  const auth = await getTradeAuthFromRequest(request);

  try {
    const body = await request.json();
    const { items, deliveryAddress, deliveryDate, poReference, notes, paymentMethod, ageConfirmed } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 });
    }

    let account;
    let user;
    let address;

    // Validate the method before any account is created or touched. Guests
    // (no session) are never credit accounts, whatever the body claims.
    let effectiveMethod;
    try {
      effectiveMethod = assertPaymentMethodAllowed({
        method: paymentMethod,
        account: auth?.account,
        isGuest: !auth,
        config: readTradeStore().config,
      });
    } catch (methodError) {
      const status = paymentMethod === 'pay_on_account' ? 403 : 400;
      return NextResponse.json({ error: methodError.message }, { status });
    }

    if (auth) {
      // Only buyers with an ordering seat may place orders.
      if (auth.user.seatType === 'viewer') {
        return NextResponse.json(
          { error: 'Your seat has view-only access. Ask an owner to place this order.' },
          { status: 403 }
        );
      }
      account = auth.account;
      user = auth.user;

      // Delivery address must be one the account actually holds — never an
      // arbitrary drop point.
      address = resolveDeliveryAddress(account, deliveryAddress);
      if (!address) {
        return NextResponse.json(
          { error: 'Select one of your registered delivery addresses' },
          { status: 400 }
        );
      }
    } else {
      const { buyerName, buyerPhone, buyerEmail } = body;
      if ([buyerName, buyerPhone, buyerEmail].some((v) => typeof v !== 'string' || !v.trim())) {
        return NextResponse.json({ error: 'Name, phone and email are required to place an order' }, { status: 400 });
      }
      if (!deliveryAddress?.addressLine || !deliveryAddress?.city) {
        return NextResponse.json({ error: 'A delivery address is required' }, { status: 400 });
      }
      const buyerNameClean = sanitizeText(buyerName, 120);
      const buyerPhoneClean = sanitizeText(buyerPhone, 30);
      const addressLineClean = sanitizeText(deliveryAddress.addressLine, 200);
      const cityClean = sanitizeText(deliveryAddress.city, 60);

      ({ account, user } = await findOrCreateGuestTradeAccount({
        name: buyerNameClean,
        phone: buyerPhoneClean,
        email: sanitizeText(buyerEmail, 120),
        addressLine: addressLineClean,
        city: cityClean,
      }));

      // Always the address just typed in this request — a guest account
      // matched from a prior order (see findOrCreateGuestTradeAccount) may
      // carry a different stored address, and it must never be substituted
      // for what this caller actually asked to ship to.
      address = {
        id: `addr_${Date.now()}`,
        label: 'Delivery Address',
        contactName: buyerNameClean,
        phone: buyerPhoneClean,
        addressLine: addressLineClean,
        city: cityClean,
        deliveryWindow: '09:00 - 17:00 EAT',
        isDefault: true,
      };
    }

    // Server-authoritative line resolution: identifier + quantity only.
    let resolvedItems;
    try {
      resolvedItems = await resolveTradeLineItems(items, { checkStock: true });
    } catch (resolutionError) {
      return NextResponse.json({ error: resolutionError.message }, { status: 400 });
    }

    // Paystack needs an email; check before the order exists so a missing one
    // cannot leave stock reserved.
    const buyerEmail = auth?.user?.email || (typeof body.buyerEmail === 'string' ? body.buyerEmail.trim() : '');
    if (effectiveMethod === 'paystack' && !buyerEmail) {
      return NextResponse.json({ error: 'Email is required for card payment' }, { status: 400 });
    }

    // Guest pay-now orders reserve stock for a while without any payment, so
    // bound how many one client can open: per IP, and per guest account.
    if (!auth && effectiveMethod === 'paystack') {
      const holdLimit = await rateLimitRequest(request, { scope: 'trade-guest-holds', maxRequests: 5, windowMs: 10 * 60 * 1000 });
      if (!holdLimit.allowed || (await openHoldCount(account.id)) >= 3) {
        return NextResponse.json(
          { error: 'You already have payments in progress. Please complete them, or wait a few minutes and try again.' },
          { status: 429 }
        );
      }
    }

    const order = await createTradeOrder({
      account,
      user,
      items: resolvedItems,
      deliveryAddress: address,
      deliveryDate,
      poReference: sanitizeText(poReference, 60),
      notes: sanitizeText(notes, 500),
      paymentMethod: effectiveMethod,
      source: auth ? 'portal' : 'portal_guest',
      ageConfirmed: ageConfirmed === true,
    });

    // If Paystack, initialize the payment and return the authorization URL
    if (effectiveMethod === 'paystack') {
      try {
        const { initializePayment, generateReference } = await import('@/lib/paystack.js');

        const reference = generateReference(order.id);
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

        const paystackResult = await initializePayment({
          email: buyerEmail,
          amount: order.grandTotal,
          reference,
          metadata: {
            trade_order_id: order.id,
            order_number: order.orderNumber,
            account_name: order.accountName,
            custom_fields: [
              { display_name: 'Order Number', variable_name: 'order_number', value: order.orderNumber },
              { display_name: 'Account', variable_name: 'account', value: order.accountName },
            ],
          },
          callback_url: `${siteUrl}/api/paystack/callback`,
        });

        // Record the reference and start the stock hold.
        await markAwaitingPayment({
          orderId: order.id,
          reference,
          holdMinutes: publicCheckoutOptions(readTradeStore().config).stockHoldMinutes,
        });

        return NextResponse.json({
          success: true,
          message: 'Redirecting to payment...',
          order: stripEconomics(order, user),
          paystack: {
            authorization_url: paystackResult.authorization_url,
            reference: paystackResult.reference,
          },
        });
      } catch (paystackError) {
        console.error('Paystack initialization failed for trade order:', paystackError.message);
        // Never leave a confirmed, unpaid order holding stock: cancel it
        // (which restocks) and let the buyer try again.
        try {
          await updateTradeOrderStatus(order.id, 'cancelled');
        } catch (cancelError) {
          console.error(`Could not cancel order ${order.id} after Paystack failure:`, cancelError.message);
        }
        const isConfigError = paystackError.message?.includes('PAYSTACK_SECRET_KEY');
        const userMessage = isConfigError
          ? 'Online card payment is currently not configured or unavailable. Please contact the team to place your order.'
          : (paystackError.message || 'We could not start the payment. Nothing was charged and your order was not placed. Please try again.');

        return NextResponse.json(
          { error: userMessage },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order created successfully',
      order: stripEconomics(order, user),
    });
  } catch (error) {
    // createTradeOrder throws user-actionable messages (minimum order, credit
    // limit, age confirmation) — those belong in front of the buyer.
    console.error('Trade checkout error:', error.message);
    return NextResponse.json({ error: error.message || 'Order creation failed' }, { status: 400 });
  }
}

/**
 * Match the requested address against the account's registered addresses.
 * Falls back to the account default when nothing is specified. Used only
 * for the authenticated path — guest checkout builds its address directly
 * from the request body instead (see the guest branch above), and never
 * consults an account's stored addresses.
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
