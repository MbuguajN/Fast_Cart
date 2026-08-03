import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { initializePayment, generateReference } from '@/lib/paystack';
import { rateLimitRequest } from '@/lib/rate-limit';

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 500);
}

function validateEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  const rl = rateLimitRequest(request, { maxRequests: 10, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
  }

  try {
    const { cart, paymentMethod, locationData, customerId, customerNote, email } = await request.json();

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (cart.length > 50) {
      return NextResponse.json({ error: 'Cart too large' }, { status: 400 });
    }

    // Validate each cart item
    for (const item of cart) {
      if (!item.id || typeof item.id !== 'number') {
        return NextResponse.json({ error: 'Invalid cart item' }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1 || item.quantity > 100 || !Number.isInteger(item.quantity)) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }
    }

    const lineItems = cart.map((item) => {
      const lineItem = {
        product_id: item.id,
        quantity: item.quantity,
      };
      if (item.variantId) {
        lineItem.variation_id = item.variantId;
      }
      return lineItem;
    });

    const customerName = sanitize(locationData?.name || '');
    const customerPhone = sanitize(locationData?.phone || '');
    const deliveryAddress = sanitize(locationData?.text || '');

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const orderPayload = {
      payment_method: 'paystack',
      payment_method_title: 'Paystack',
      set_paid: false,
      customer_id: customerId || 0,
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
      customer_note: sanitize(customerNote || '').slice(0, 500),
      meta_data: [
        { key: 'delivery_location', value: deliveryAddress },
      ],
    };

    const url = wcUrl('orders');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('WC order creation failed');
      return NextResponse.json({ error: 'Failed to create order' }, { status: res.status });
    }

    const order = await res.json();

    const total = parseFloat(order.total) || cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const customerEmail = validateEmail(email) ? email : `customer_${order.id}@liquordash.com`;
    const reference = generateReference(order.id);

    // Use configured URL, never trust client origin
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const callbackUrl = `${origin}/api/paystack/callback`;

    const paystackData = await initializePayment({
      email: customerEmail,
      amount: total,
      reference,
      metadata: {
        order_id: order.id,
        order_number: order.number,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_location: deliveryAddress,
      },
      callback_url: callbackUrl,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.number,
      status: order.status,
      total: order.total,
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference,
    });
  } catch (error) {
    console.error('Checkout error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
