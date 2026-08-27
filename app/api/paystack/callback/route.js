import { NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/paystack';
import { settleOrderFromPayment } from '@/lib/order-payment';

/**
 * GET /api/paystack/callback
 *
 * Where Paystack returns the customer's browser after checkout. It races the
 * server-to-server webhook; settlement is idempotent and amount-checked in
 * lib/order-payment.js, so whichever arrives first wins and the other is a
 * no-op.
 *
 * Redirect targets are built from the configured site URL rather than from
 * `request.url`, so a spoofed Host header cannot turn this into an open
 * redirect.
 */

function siteUrl(path) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(path, origin);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  if (!reference) {
    return NextResponse.redirect(siteUrl('/?payment=failed'));
  }

  try {
    const paystackData = await verifyPayment(reference);
    const result = await settleOrderFromPayment(paystackData);

    if (!result.settled) {
      console.error(`Callback could not settle order ${result.orderId ?? '?'}: ${result.reason}`);

      // The money may well have left the customer's account — send them
      // somewhere that says "we're checking", not "failed".
      if (result.reason === 'amount_short' || result.reason === 'wc_update_failed') {
        return NextResponse.redirect(
          siteUrl(`/?payment=review&order=${encodeURIComponent(result.orderId ?? '')}`)
        );
      }
      return NextResponse.redirect(siteUrl('/?payment=failed'));
    }

    const params = new URLSearchParams({
      payment: 'success',
      order: String(result.orderId ?? ''),
    });
    return NextResponse.redirect(siteUrl(`/?${params.toString()}`));
  } catch (error) {
    console.error('Paystack callback failed:', error.message);
    return NextResponse.redirect(siteUrl('/?payment=failed'));
  }
}
