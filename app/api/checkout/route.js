import { NextResponse } from 'next/server';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

export async function POST(request) {
  try {
    const { cart, paymentMethod, locationData, customerId, customerNote } = await request.json();

    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!locationData) {
      return NextResponse.json({ error: 'Location data is required' }, { status: 400 });
    }

    // Build payment method for WooCommerce
    let wcPaymentMethod = paymentMethod;
    if (paymentMethod === 'mpesa') {
      wcPaymentMethod = 'mpesa_stk';
    } else if (paymentMethod === 'apple_pay' || paymentMethod === 'google_pay') {
      wcPaymentMethod = 'digital_wallet';
    }

    const orderPayload = {
      payment_method: wcPaymentMethod,
      set_paid: paymentMethod !== 'mpesa',
      customer_id: customerId || 0,
      billing: {
        phone: locationData.phone || '',
        city: 'Nairobi',
      },
      shipping: {
        address_1: locationData.text || `GPS: ${locationData.lat}, ${locationData.lng}`,
        city: 'Nairobi',
      },
      customer_note: customerNote || `Landmark: ${locationData.text || 'GPS coordinates provided'}`,
      line_items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
      meta_data: [
        {
          key: 'payment_method_display',
          value: paymentMethod,
        },
        {
          key: 'landmark_hint',
          value: locationData.text || '',
        },
      ],
    };

    const response = await fetch(
      `${WC_URL}/wp-json/wc/v3/orders?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to create order' },
        { status: response.status }
      );
    }

    const order = await response.json();

    // For M-Pesa, simulate STK Push initiation
    if (paymentMethod === 'mpesa') {
      // In production, this would call Safaricom Daraja API
      // For now, we simulate the STK Push response
      return NextResponse.json({
        id: order.id,
        status: 'pending',
        total: order.total,
        stkPrompt: true,
        stkMessage: `STK Push sent to ${locationData.phone || 'your phone'}. Enter PIN to complete.`,
      });
    }

    // For Apple/Google Pay, order is already paid
    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: order.total,
      paid: true,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
