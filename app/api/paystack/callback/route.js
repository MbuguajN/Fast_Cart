import { NextResponse } from 'next/server';
import { wcUrl } from '@/lib/wc-config';
import { verifyPayment } from '@/lib/paystack';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');

    if (!reference && !trxref) {
      return NextResponse.redirect(new URL('/?payment=failed', request.url));
    }

    const ref = reference || trxref;
    const paystackData = await verifyPayment(ref);
    const orderId = paystackData.metadata?.order_id;

    if (paystackData.status === 'success' && orderId) {
      const url = wcUrl(`orders/${orderId}`);
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'processing',
          set_paid: true,
          transaction_id: String(paystackData.id),
          meta_data: [
            { key: 'paystack_reference', value: ref },
            { key: 'paystack_transaction_id', value: String(paystackData.id) },
            { key: 'paystack_amount', value: String(paystackData.amount / 100) },
          ],
        }),
      });
    }

    return NextResponse.redirect(new URL(`/?payment=success&order=${orderId || ''}&ref=${ref}`, request.url));
  } catch (error) {
    console.error('Paystack callback failed');
    return NextResponse.redirect(new URL('/?payment=failed', request.url));
  }
}
