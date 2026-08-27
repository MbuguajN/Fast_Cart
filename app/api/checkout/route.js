import { NextResponse } from 'next/server';
import { wcPost, wcPut } from '@/lib/wc-config';
import { initializePayment, generateReference } from '@/lib/paystack';
import { rateLimitRequest } from '@/lib/rate-limit';
import { findOrCreateCustomer } from '@/lib/customer';
import { getCustomerSession, normalizePhone } from '@/lib/session';
import { resolveDeliveryFee } from '@/lib/shipping';
import { getProducts } from '@/lib/data-store';
import { validateCartLines } from '@/lib/stock';
import { buildStockRejection } from '@/lib/checkout-guards';
import { timed, recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';

/**
 * POST /api/checkout — create a WooCommerce order and start payment.
 *
 * Two things the client no longer decides:
 *
 *  • The delivery fee. It used to be read straight from the body, so
 *    `{ deliveryFee: 0 }` produced an order with no shipping line. It is now
 *    resolved from the delivery zone catalogue on the server.
 *
 *  • The customer identity. `customerId` from the body is ignored; it comes
 *    from the session cookie when one exists.
 *
 * Line item prices were already safe — WooCommerce prices from `product_id`.
 *
 * Guest checkout is still permitted (a phone number is captured either way),
 * because requiring an account before a first order would be a behavioural
 * change, not a security fix.
 */

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 500);
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { cart, locationData, customerNote, email, kraPin } = await request.json();

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }
    if (cart.length > 50) {
      return NextResponse.json({ error: 'Cart too large' }, { status: 400 });
    }

    for (const item of cart) {
      if (!item.id || typeof item.id !== 'number') {
        return NextResponse.json({ error: 'Invalid cart item' }, { status: 400 });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (item.variantId !== undefined && !Number.isInteger(item.variantId)) {
        return NextResponse.json({ error: 'Invalid cart item' }, { status: 400 });
      }
    }

    // Last cache-side gate before we spend a WooCommerce round trip. The
    // cart may have been sitting open while stock moved.
    const stockCheck = validateCartLines(
      cart.map((item) => ({ wcId: item.id, qty: item.quantity, name: item.name })),
      getProducts()
    );

    if (!stockCheck.ok) {
      recordEvent({
        kind: EVENT_KINDS.ORDER,
        outcome: OUTCOMES.SKIPPED,
        detail: `stock rejection: ${stockCheck.rejected.map((r) => r.wcId).join(',')}`,
      });
      return NextResponse.json(buildStockRejection(stockCheck.rejected), { status: 409 });
    }

    const lineItems = cart.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
      ...(item.variantId ? { variation_id: item.variantId } : {}),
    }));

    const customerName = sanitize(locationData?.name || '');
    const deliveryAddress = sanitize(locationData?.text || '');

    // Prefer the session's verified number over anything in the body.
    const session = await getCustomerSession(request);
    const submittedPhone = sanitize(locationData?.phone || '');
    const customerPhone = session?.phone ? `0${session.phone}` : submittedPhone;

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }
    if (normalizePhone(customerPhone).length < 9) {
      return NextResponse.json({ error: 'A valid phone number is required' }, { status: 400 });
    }

    // Delivery fee is priced here, not by the caller.
    const delivery = resolveDeliveryFee({
      zoneName: locationData?.zone || '',
      address: deliveryAddress,
    });
    const fee = delivery.fee;

    // Identity: session first, then find-or-create from the captured details.
    let finalCustomerId = session?.customerId || 0;

    if (!finalCustomerId) {
      try {
        const customer = await findOrCreateCustomer({
          phone: customerPhone,
          name: customerName,
          email: validateEmail(email) ? email : undefined,
          landmark: deliveryAddress,
          zone: delivery.zoneName,
        });
        finalCustomerId = customer.id;
      } catch (err) {
        console.error('Failed to find or create customer during checkout:', err.message);
      }
    }

    const orderPayload = {
      payment_method: 'paystack',
      payment_method_title: 'Paystack',
      set_paid: false,
      customer_id: finalCustomerId,
      billing: {
        first_name: customerName,
        last_name: '',
        phone: customerPhone,
        email: validateEmail(email) ? email : '',
        city: 'Nairobi',
      },
      shipping: {
        first_name: customerName,
        last_name: '',
        address_1: deliveryAddress,
        city: 'Nairobi',
      },
      line_items: lineItems,
      shipping_lines: fee > 0 ? [{
        method_id: 'nairobi_shipping',
        method_title: delivery.zoneName ? `Delivery — ${delivery.zoneName}` : 'Nairobi Delivery',
        total: String(fee),
      }] : [],
      customer_note: sanitize(customerNote || '').slice(0, 500),
      meta_data: [
        { key: 'delivery_location', value: deliveryAddress },
        { key: 'delivery_zone', value: delivery.zoneName },
        { key: 'delivery_zone_matched', value: String(delivery.matched) },
        { key: 'delivery_fee', value: String(fee) },
        ...(kraPin ? [{ key: 'kra_pin', value: sanitize(kraPin) }] : []),
      ],
    };

    let order;
    try {
      order = await timed(EVENT_KINDS.ORDER, () => wcPost('orders', orderPayload), 'create order');
    } catch (err) {
      console.error('WC order creation failed:', err.message);

      // WooCommerce is the final arbiter on stock. If it refused a line,
      // say so plainly instead of a generic failure the customer cannot act on.
      if (/stock|out of stock|not enough/i.test(err.message || '')) {
        return NextResponse.json(
          { error: 'Some items sold out while you were checking out', message: err.message },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Could not create your order. Please try again.' },
        { status: 502 }
      );
    }

    const customerEmail = validateEmail(email) ? email : `customer_${order.id}@liquordash.com`;
    const reference = generateReference(order.id);

    // Bind the reference to the order before payment starts, so the callback
    // and webhook can verify that a reference belongs to the order it claims.
    try {
      await wcPut(`orders/${order.id}`, {
        meta_data: [
          ...orderPayload.meta_data,
          { key: 'paystack_expected_reference', value: reference },
          { key: 'paystack_expected_amount', value: String(order.total) },
        ],
      });
    } catch (err) {
      console.error('Failed to bind payment reference to order:', err.message);
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const paystackData = await initializePayment({
      email: customerEmail,
      amount: parseFloat(order.total),
      reference,
      metadata: {
        order_id: order.id,
        order_number: order.number,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_location: deliveryAddress,
      },
      callback_url: `${origin}/api/paystack/callback`,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.number,
      status: order.status,
      total: order.total,
      deliveryFee: fee,
      deliveryZone: delivery.zoneName,
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference,
    });
  } catch (error) {
    console.error('Checkout error:', error.message || error);
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 });
  }
}
