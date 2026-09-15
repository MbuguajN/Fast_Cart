import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { getTradeOrders } from '@/lib/trade/trade-store.js';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');

    const orders = await getTradeOrders({
      status: status || undefined,
      accountId: accountId || undefined,
      search: search || undefined,
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Admin trade orders fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch trade orders' }, { status: 500 });
  }
}

