import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/paystack';
import { settleTradeOrderFromPayment } from '@/lib/trade/trade-payment.js';

/**
 * GET /api/trade/paystack/callback
 *
 * Browser redirect from Paystack after a trade checkout payment.
 * Verifies the transaction server-side and settles the trade order.
 * Redirects the buyer to the order detail page with a payment status.
 *
 * This races the webhook; settlement is idempotent, so whichever
 * arrives first wins and the other is a no-op.
 */

function siteUrl(path) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(path, origin);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(siteUrl('/trade/dashboard?payment=failed'));
  }

  try {
    const paystackData = await verifyPayment(reference);
    const result = await settleTradeOrderFromPayment(paystackData);

    if (!result.settled) {
      console.error(`Trade callback could not settle order ${result.orderId ?? '?'}: ${result.reason}`);

      if (result.reason === 'amount_short') {
        return NextResponse.redirect(
          siteUrl(`/trade/orders/${encodeURIComponent(result.orderId ?? '')}?payment=review`)
        );
      }
      return NextResponse.redirect(siteUrl('/trade/dashboard?payment=failed'));
    }

    return NextResponse.redirect(
      siteUrl(`/trade/orders/${encodeURIComponent(result.orderId)}?payment=success`)
    );
  } catch (error) {
    console.error('Trade Paystack callback failed:', error.message);
    return NextResponse.redirect(siteUrl('/trade/dashboard?payment=failed'));
  }
}
