import { NextResponse } from 'next/server';
import { verifyPayment, verifyWebhookSignature } from '@/lib/paystack';
import { settleTradeOrderFromPayment } from '@/lib/trade/trade-payment.js';

/**
 * POST /api/trade/paystack/webhook
 *
 * Server-to-server Paystack webhook for trade payments.
 * The signature is checked against the raw request body.
 * The event payload is treated as a notification only: the transaction
 * is re-verified against the Paystack API before anything is settled.
 *
 * NOTE: This uses the same PAYSTACK_WEBHOOK_SECRET as the retail webhook.
 * Paystack sends the same event to ALL registered webhook URLs, so both
 * /api/paystack/webhook and /api/trade/paystack/webhook will fire. Each
 * only settles orders it recognizes (retail looks for metadata.order_id,
 * trade looks for metadata.trade_order_id).
 */
export async function POST(request) {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('PAYSTACK_WEBHOOK_SECRET not configured — rejecting trade webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error('Trade Paystack webhook signature verification failed');
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

    // Check if this is a trade payment by looking for trade_order_id in metadata
    if (!data?.metadata?.trade_order_id) {
      // Not a trade payment — let the retail webhook handle it
      return NextResponse.json({ received: true, ignored: 'not_trade_payment' });
    }

    // Re-verify against the Paystack API — never trust the webhook body amount
    const paystackData = await verifyPayment(data.reference);
    const result = await settleTradeOrderFromPayment(paystackData);

    if (!result.settled) {
      console.error(`Trade webhook could not settle order ${result.orderId ?? '?'}: ${result.reason}`);
    }

    // Always 200 on a validly signed event — a non-2xx makes Paystack retry,
    // and a business-rule rejection will not resolve on retry.
    return NextResponse.json({ received: true, settled: result.settled, reason: result.reason });
  } catch (error) {
    console.error('Trade Paystack webhook processing failed:', error.message);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
