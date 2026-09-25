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

    // Re-verify against the Paystack API — never trust the webhook body amount
    const paystackData = await verifyPayment(data.reference);
    
    // Check if this is a trade order by looking for trade_order_id in metadata
    if (paystackData?.metadata?.trade_order_id) {
      const { settleTradeOrderFromPayment } = await import('@/lib/trade/trade-payment.js');
      const result = await settleTradeOrderFromPayment(paystackData);

      if (!result.settled) {
        console.error(`Webhook could not settle trade order ${result.orderId ?? '?'}: ${result.reason}`);
      }

      return NextResponse.json({ received: true, type: 'trade', settled: result.settled, reason: result.reason });
    } else {
      // Otherwise process as a retail order
      const result = await settleOrderFromPayment(paystackData);

      if (!result.settled) {
        console.error(`Webhook could not settle retail order ${result.orderId ?? '?'}: ${result.reason}`);
      }

      return NextResponse.json({ received: true, type: 'retail', settled: result.settled, reason: result.reason });
    }
  } catch (error) {
    console.error('Paystack webhook processing failed:', error.message);
    // A genuine processing failure is worth retrying.
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
