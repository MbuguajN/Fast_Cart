import { NextResponse } from 'next/server';
import { verifyPayment, verifyWebhookSignature } from '@/lib/paystack';
import { settleOrderFromPayment } from '@/lib/order-payment';

/**
 * POST /api/paystack/webhook
 *
 * The signature is checked against the raw request body. Reading the body with
 * `request.json()` and hashing `JSON.stringify(parsed)` — as this did before —
 * re-serialises the payload and changes the bytes, so valid events were being
 * rejected and paid orders never left `pending`.
 *
 * The event payload is treated as a notification only: the transaction is
 * re-verified against the Paystack API before anything is settled.
 */
export async function POST(request) {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('PAYSTACK_WEBHOOK_SECRET not configured — rejecting webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Raw bytes, exactly as signed.
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('Paystack webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const { event, data } = body;

    if (event !== 'charge.success') {
      return NextResponse.json({ received: true, ignored: event });
    }

    if (!data?.reference) {
      return NextResponse.json({ received: true, ignored: 'no_reference' });
    }

    // Never trust the amount or status in the webhook body itself.
    const paystackData = await verifyPayment(data.reference);
    const result = await settleOrderFromPayment(paystackData);

    if (!result.settled) {
      console.error(`Webhook could not settle order ${result.orderId ?? '?'}: ${result.reason}`);
    }

    // Always 200 on a validly signed event — a non-2xx makes Paystack retry,
    // and a business-rule rejection will not resolve on retry.
    return NextResponse.json({ received: true, settled: result.settled, reason: result.reason });
  } catch (error) {
    console.error('Paystack webhook processing failed:', error.message);
    // A genuine processing failure is worth retrying.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
