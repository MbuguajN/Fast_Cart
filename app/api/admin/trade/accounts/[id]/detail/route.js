import { NextResponse } from 'next/server';
import { getTradeAccountById, getAccountStatement, getTradeOrders, getTradeQuotes } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * One combined read for the admin account-detail page — account info, the
 * statement/aging summary, and this account's order and quote history — so
 * the page fires a single request instead of four.
 */
export async function GET(request, { params }) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const account = getTradeAccountById(id);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const statement = getAccountStatement(id);
    const orders = await getTradeOrders({ accountId: id });
    const quotes = await getTradeQuotes({ accountId: id });

    return NextResponse.json({ success: true, account, statement, orders, quotes });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load account detail' }, { status: 500 });
  }
}
