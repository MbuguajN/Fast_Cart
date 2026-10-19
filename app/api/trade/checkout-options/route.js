import { NextResponse } from 'next/server';
import { getTradeConfig } from '@/lib/trade/trade-store.js';
import { publicCheckoutOptions } from '@/lib/trade/trade-config.js';

/**
 * GET /api/trade/checkout-options
 *
 * Public. Exposes only what the checkout page needs: how long stock is held
 * for a pay-now order, and bank-transfer details when an admin has enabled it.
 */
export async function GET() {
  const config = await getTradeConfig();
  const options = publicCheckoutOptions(config);
  return NextResponse.json(options, { headers: { 'Cache-Control': 'no-store' } });
}
