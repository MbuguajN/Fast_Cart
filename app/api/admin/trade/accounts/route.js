import { NextResponse } from 'next/server';
import { getTradeAccounts } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const accounts = getTradeAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to fetch trade accounts' }, { status: 500 });
  }
}

