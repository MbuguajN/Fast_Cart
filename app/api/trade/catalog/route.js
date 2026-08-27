import { NextResponse } from 'next/server';
import { getTradeAuthFromRequest } from '@/lib/trade/trade-auth.js';
import { getPrkCosts, getSegmentTemplates } from '@/lib/trade/trade-store.js';
import { getProducts } from '@/lib/data-store.js';
import { resolveLineTier, isPrkOrJabaTradeProduct, getTradePriceLine } from '@/lib/trade/pricing-engine.js';

export async function GET(request) {
  try {
    const auth = await getTradeAuthFromRequest(request);
    if (!auth || !auth.user || !auth.account) {
      return NextResponse.json({ error: 'Trade authentication required to view wholesale catalog.' }, { status: 401 });
    }

    const { account } = auth;
    const prkCosts = getPrkCosts();
    const rawProducts = getProducts() || [];

    // Filter STRICTLY to authorized Pernod Ricard Kenya (PRK) portfolio & Happy Hour Jaba juices
    const tradeEligible = rawProducts.filter(isPrkOrJabaTradeProduct);

    // Licence gating: If expired or corporate account without liquor licence, restrict to non-alcoholic Jaba lines
    const isLicenceExpired = account.licenceExpiry && new Date(account.licenceExpiry) < new Date();
    const hasLiquorLicence = !!account.licenceNo;

    const tradeProducts = tradeEligible
      .map((p) => {
        const slug = p.slug || p.id;
        const priceLine = getTradePriceLine(p);

        // If licence is missing or expired, mark spirits as restricted/excluded
        if (priceLine === 'spirits' && (!hasLiquorLicence || isLicenceExpired)) {
          return null;
        }

        const isJaba = priceLine === 'jaba';
        const prkCost = Number(prkCosts[slug] || prkCosts[p.id] || (p.price ? p.price * 0.75 : 2000));

        const t1 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 11 : 6, tierOverride: account.tierOverride });
        const t2 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 51 : 25, tierOverride: account.tierOverride });
        const t3 = resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: isJaba ? 101 : 73, tierOverride: account.tierOverride });
        const t4 = isJaba ? resolveLineTier({ priceLine, prkCostIncVat: prkCost, quantity: 201, tierOverride: account.tierOverride }) : null;

        return {
          id: p.id || p.wcId,
          wcId: p.wcId || p.id,
          sku: p.sku || slug,
          name: p.name,
          slug: p.slug,
          image: p.image || p.images?.[0] || '/images/bottle-placeholder.png',
          categoryName: isJaba ? 'Happy Hour Jaba Juice' : (p.categoryName || 'Pernod Ricard Spirits'),
          brandName: p.brandName || (isJaba ? 'Jaba' : 'Pernod Ricard'),
          priceLine,
          prkCostIncVat: prkCost,
          inStock: p.inStock ?? true,
          stockQuantity: p.stockQuantity ?? 100,
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
    return NextResponse.json({ error: error.message || 'Failed to load catalog' }, { status: 500 });
  }
}
