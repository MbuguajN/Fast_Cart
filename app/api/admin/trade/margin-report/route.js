import { NextResponse } from 'next/server';
import { getTradeMarginReport } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const segment = searchParams.get('segment');

    const report = getTradeMarginReport({ accountId, segment });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

