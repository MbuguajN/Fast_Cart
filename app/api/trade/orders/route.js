import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getTradeOrders } from '@/lib/trade/trade-store.js';

export async function GET(request) {
  try {
    const auth = await requireTradeAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');

    const orders = getTradeOrders({
      accountId: auth.account.id,
      status,
      paymentStatus,
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch orders' }, { status: 401 });
  }
}

