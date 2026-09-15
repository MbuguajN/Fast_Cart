import { NextResponse } from 'next/server';
import { getTradeAuthFromRequest } from '@/lib/trade/trade-auth.js';
import { getSegmentTemplates } from '@/lib/trade/trade-store.js';
import { resolveLineTier } from '@/lib/trade/pricing-engine.js';
import { getTradeProductsFromDb } from '@/lib/trade/trade-catalog.js';

export async function GET(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required to view wholesale catalog.' }, { status: 401 });
    }

    const { account } = auth;
    const dbProducts = await getTradeProductsFromDb();

    // Licence gating: If expired or corporate account without liquor licence, restrict to non-alcoholic Jaba lines
    const isLicenceExpired = account.licenceExpiry && new Date(account.licenceExpiry) < new Date();
    const hasLiquorLicence = !!account.licenceNo;

    const tradeProducts = dbProducts
      .map((p) => {
        const priceLine = p.priceLine;

        // If licence is missing or expired, mark spirits as restricted/excluded
        if (priceLine === 'spirits' && (!hasLiquorLicence || isLicenceExpired)) {
          return null;
        }

        const isJaba = priceLine === 'jaba';
        const prkCost = p.prkCostIncVat;

        const t1 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 11 : 6, tierOverride: account.tierOverride });
        const t2 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 51 : 25, tierOverride: account.tierOverride });
        const t3 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 101 : 73, tierOverride: account.tierOverride });
        const t4 = isJaba ? resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: 201, tierOverride: account.tierOverride }) : null;

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          image: p.image || '/images/bottle-placeholder.png',
          categoryName: p.categoryName || (isJaba ? 'Happy Hour Jaba Juice' : 'Pernod Ricard Spirits'),
          brandName: p.brandName || (isJaba ? 'Jaba' : 'Pernod Ricard'),
          priceLine,
          prkCostIncVat: prkCost,
          inStock: p.inStock && p.stockQuantity > 0,
          stockQuantity: p.stockQuantity,
          tierPrices: {
            T1: { unitPriceIncVat: t1.unitPriceIncVat, unitPriceExVat: t1.unitPriceExVat, band: isJaba ? '11–50 btls' : '6–24 btls' },
            T2: { unitPriceIncVat: t2.unitPriceIncVat, unitPriceExVat: t2.unitPriceExVat, band: isJaba ? '51–100 btls' : '25–72 btls' },
            T3: { unitPriceIncVat: t3.unitPriceIncVat, unitPriceExVat: t3.unitPriceExVat, band: isJaba ? '101–200 btls' : '73+ btls' },
            ...(t4 ? { T4: { unitPriceIncVat: t4.unitPriceIncVat, unitPriceExVat: t4.unitPriceExVat, band: '201+ btls' } } : {}),
          },
        };
      })
      .filter(Boolean);

    const templates = getSegmentTemplates();

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        tradingName: account.tradingName,
        segment: account.segment,
        tierOverride: account.tierOverride,
        licenceNo: account.licenceNo,
        licenceExpiry: account.licenceExpiry,
        isLicenceExpired,
        hasLiquorLicence,
      },
      products: tradeProducts,
      templates,
    });
  } catch (error) {
    console.error('Trade catalog route error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load catalog' }, { status: 500 });
  }
}
