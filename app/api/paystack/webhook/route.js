import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { verifyPayment } from '@/lib/paystack';
import crypto from 'crypto';

function verifyWebhookSignature(body, signature, secret) {
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(body)).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('x-paystack-signature');
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('PAYSTACK_WEBHOOK_SECRET not configured — rejecting webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (!verifyWebhookSignature(body, signature, webhookSecret)) {
    console.error('Paystack webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const { event, data } = body;

    if (event === 'charge.success') {
      const reference = data.reference;
      const paystackData = await verifyPayment(reference);
      const orderId = paystackData.metadata?.order_id;

      if (orderId && paystackData.status === 'success') {
        const url = wcUrl(`orders/${orderId}`);
        await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'processing',
            set_paid: true,
            transaction_id: String(paystackData.id),
            meta_data: [
              { key: 'paystack_reference', value: reference },
              { key: 'paystack_transaction_id', value: String(paystackData.id) },
              { key: 'paystack_amount', value: String(paystackData.amount / 100) },
              { key: 'paystack_channel', value: paystackData.channel || '' },
            ],
          }),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
