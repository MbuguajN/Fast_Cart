import { NextResponse } from 'next/server';
import { requireTradeAuth } from '@/lib/trade/trade-auth.js';
import { getAccountStatement } from '@/lib/trade/trade-store.js';

export async function GET(request) {
  try {
    const auth = await requireTradeAuth(request);
    const statement = getAccountStatement(auth.account.id);

    return NextResponse.json({
      success: true,
      statement,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
  }
}

