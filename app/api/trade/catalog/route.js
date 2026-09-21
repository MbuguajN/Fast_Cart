import { NextResponse } from 'next/server';
import { getTradeAuthFromRequest } from '@/lib/trade/trade-auth.js';
import { getSegmentTemplates } from '@/lib/trade/trade-store.js';
import { resolveLineTier } from '@/lib/trade/pricing-engine.js';
import { getTradeProductsFromDb } from '@/lib/trade/trade-catalog.js';
import { attachPriceOverrides } from '@/lib/trade/trade-costing.js';

/**
 * Wholesale catalogue is public — no login required to browse or price.
 * Licence verification is only collected for the credit/partner track (see
 * /trade/apply); browsing and cash checkout only need the site's standard
 * age confirmation, taken once at checkout.
 *
 * Tier ladders are built from `resolveLineTier` and then corrected with
 * `attachPriceOverrides` so the displayed price is always the one that will
 * be charged — the catalogue and the checkout must never compute two
 * different numbers for the same SKU and tier.
 */
export async function GET(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    const account = auth?.account || null;
    const dbProducts = await getTradeProductsFromDb();

    const withOverrides = await attachPriceOverrides(
      dbProducts.map((p) => ({ sku: p.sku, priceLine: p.priceLine }))
    );
    const overridesBySku = new Map(withOverrides.map((r) => [r.sku, r.priceOverrides || {}]));

    const tradeProducts = dbProducts
      .map((p) => {
        const priceLine = p.priceLine;
        const isJaba = priceLine === 'jaba';
        const prkCost = p.prkCostIncVat;
        const overrides = overridesBySku.get(p.sku) || {};

        const tierQuantities = isJaba
          ? { T0: 1, T1: 11, T2: 51, T3: 101, T4: 201 }
          : { T0: 1, T1: 6, T2: 25, T3: 73 };
        const tierBands = isJaba
          ? { T0: '1–10 btls', T1: '11–50 btls', T2: '51–100 btls', T3: '101–200 btls', T4: '201+ btls' }
          : { T0: '1–5 btls', T1: '6–24 btls', T2: '25–72 btls', T3: '73+ btls' };

        const tierPrices = {};
        for (const [tierKey, qty] of Object.entries(tierQuantities)) {
          const resolved = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: qty, tierOverride: account?.tierOverride });
          if (!resolved.eligible) continue;

          const override = overrides[tierKey];
          let unitPriceIncVat = resolved.unitPriceIncVat;
          let unitPriceExVat = resolved.unitPriceExVat;
          if (override !== undefined && override !== null) {
            if (isJaba) {
              unitPriceExVat = Number(override);
              unitPriceIncVat = Math.round((unitPriceExVat * 1.16) * 100) / 100;
            } else {
              unitPriceIncVat = Math.round(Number(override));
              unitPriceExVat = Math.round((unitPriceIncVat / 1.16) * 100) / 100;
            }
          }

          tierPrices[tierKey] = { unitPriceIncVat, unitPriceExVat, band: tierBands[tierKey] };
        }

        // prkCostIncVat and the raw override map are the wholesale cost base
        // and admin-set price ladder — never sent to the client. tierPrices
        // (below) already carries every number a buyer is entitled to see.
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          image: p.image || '/images/bottle-placeholder.png',
          categoryName: p.categoryName || (isJaba ? 'Happy Hour Jaba Juice' : 'Pernod Ricard Spirits'),
          brandName: p.brandName || (isJaba ? 'Jaba' : 'Pernod Ricard'),
          priceLine,
          inStock: p.inStock && p.stockQuantity > 0,
          stockQuantity: p.stockQuantity,
          tierPrices,
        };
      })
      .filter(Boolean);

    const templates = getSegmentTemplates();

    return NextResponse.json({
      success: true,
      account: account
        ? {
            id: account.id,
            tradingName: account.tradingName,
            segment: account.segment,
            tierOverride: account.tierOverride,
            creditEnabled: account.creditEnabled,
          }
        : null,
      products: tradeProducts,
      templates,
    });
  } catch (error) {
    console.error('Trade catalog route error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load catalog' }, { status: 500 });
  }
}
