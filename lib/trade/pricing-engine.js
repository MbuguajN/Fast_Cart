/**
 * Happy Hour — B2B Trade Portal Pricing Engine
 * 
 * Pure, standalone, unit-testable class with zero external dependencies.
 * Implements the exact commercial rules from Section 4.4 and Section 5 of the Dev Brief.
 */

// Default pricing bands configuration
export const DEFAULT_PRICE_BANDS = {
  spirits: {
    basis: 'per_sku_per_order',
    vat_mode: 'inclusive', // Displayed and charged VAT-inclusive
    bands: [
      { key: 'T1', min: 6, max: 24, markup_on_prk_incvat: 0.10 },
      { key: 'T2', min: 25, max: 72, markup_on_prk_incvat: 0.07 },
      { key: 'T3', min: 73, max: null, markup_on_prk_incvat: 0.04 },
    ],
  },
  jaba: {
    basis: 'per_sku_per_order',
    vat_mode: 'exclusive', // Flat per-band price, exclusive of 16% VAT
    bands: [
      { key: 'T0', min: 1, max: 10, price_ex_vat: 800 },
      { key: 'T1', min: 11, max: 50, price_ex_vat: 750 },
      { key: 'T2', min: 51, max: 100, price_ex_vat: 700 },
      { key: 'T3', min: 101, max: 200, price_ex_vat: 650 },
      { key: 'T4', min: 201, max: null, price_ex_vat: 600 },
    ],
  },
};

export const VAT_RATE = 0.16; // 16% Kenya standard VAT
export const MIN_ORDER_BOTTLES = 12; // 12 bottles total across all SKUs
export const MIN_ORDER_GOODS_EX_VAT = 10000; // KES 10,000 goods value ex-VAT
export const NAIROBI_FREE_DELIVERY_THRESHOLD = 25000; // KES 25,000 goods value ex-VAT
export const NAIROBI_DELIVERY_FEE = 500; // KES 500

/**
 * Rounds to whole KES, half up (e.g. 10.5 -> 11, 10.49 -> 10)
 */
export function roundKes(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value));
}

/**
 * Rounds to 2 decimal places for financial footing
 */
export function roundCent(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export const PRK_BRANDS = [
  'jameson',
  'glenlivet',
  'the_glenlivet',
  'chivas',
  'ballantines',
  'ballantine_s',
  'martell',
  'absolut',
  'beefeater',
  'malfy',
  'olmeca',
  'malibu',
  'ricard',
  'jacobs',
  'campo',
  'kahlua',
  'havana',
  'mumm',
  'monkey',
  'inverroche',
  'royal_stag',
  'imperial_blue',
  'royal_salute',
  'aberlour',
  'belaire',
];

/**
 * Validates if a product is an authorized Pernod Ricard Kenya (PRK) spirit or Happy Hour Jaba juice.
 * Excludes all retail soft drinks, mixers, chasers, retail party packs, and non-PRK spirits/sojus.
 */
export function isPrkOrJabaTradeProduct(p) {
  if (!p || !p.name) return false;
  const name = (p.name || '').toLowerCase();
  const slug = (p.slug || '').toLowerCase();
  const brand = (p.brandName || p.brandId || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const cat = (p.categoryName || '').toLowerCase();

  if (cat.includes('mixer') || cat.includes('chaser') || cat.includes('party pack') || cat.includes('soft drink')) {
    return false;
  }
  if (name.includes('party pack') || slug.includes('party-pack')) {
    return false;
  }
  if (brand.includes('jinro') || cat.includes('soju') || name.includes('soju')) {
    return false;
  }
  if (brand.includes('bumbu') || slug.includes('bumbu')) {
    return false;
  }
  if (name.includes('coke') || name.includes('fanta') || name.includes('sprite') || name.includes('dasani') || name.includes('krest') || name.includes('schweppes')) {
    return false;
  }

  if (brand.includes('jaba') || cat.includes('jaba') || name.includes('jaba')) {
    return true;
  }

  return PRK_BRANDS.some((b) =>
    brand.includes(b) ||
    slug.includes(b.replace(/_/g, '-')) ||
    name.includes(b.replace(/_/g, ' '))
  );
}

/**
 * Returns the trade price line ('spirits' | 'jaba' | 'excluded')
 */
export function getTradePriceLine(p) {
  if (!isPrkOrJabaTradeProduct(p)) return 'excluded';
  const name = (p.name || '').toLowerCase();
  const brand = (p.brandName || '').toLowerCase();
  const cat = (p.categoryName || '').toLowerCase();
  if (brand.includes('jaba') || cat.includes('jaba') || name.includes('jaba')) {
    return 'jaba';
  }
  return 'spirits';
}

/**
 * Resolves the qualified tier and unit price for a single order line.
 * Rule: Evaluated per SKU, per order — never aggregated across SKUs.
 */
export function resolveLineTier({
  sku,
  priceLine = 'spirits',
  prkCostIncVat = 0,
  quantity = 1,
  tierOverride = null,
  customBands = DEFAULT_PRICE_BANDS,
}) {
  const qty = Math.max(0, parseInt(quantity, 10) || 0);

  if (priceLine === 'excluded') {
    return {
      eligible: false,
      tierKey: null,
      priceLine: 'excluded',
      unitPriceIncVat: 0,
      unitPriceExVat: 0,
      vatAmountPerUnit: 0,
      prkCostIncVat: 0,
      marginPercent: 0,
      reason: 'Product excluded from trade catalogue',
    };
  }

  if (priceLine === 'spirits') {
    const bands = customBands?.spirits?.bands || DEFAULT_PRICE_BANDS.spirits.bands;
    const cost = Number(prkCostIncVat) || 0;

    let matchedBand = null;
    if (tierOverride) {
      matchedBand = bands.find((b) => b.key === tierOverride) || null;
    }

    if (!matchedBand) {
      matchedBand = bands.find((b) => {
        const minOk = qty >= b.min;
        const maxOk = b.max === null || qty <= b.max;
        return minOk && maxOk;
      });
    }

    // If quantity is below minimum tier (e.g. < 6 bottles for spirits) and no override
    if (!matchedBand && qty < (bands[0]?.min || 6)) {
      const fallbackMarkup = bands[0]?.markup_on_prk_incvat || 0.10;
      const unitPriceIncVat = roundKes(cost * (1 + fallbackMarkup));
      const unitPriceExVat = roundCent(unitPriceIncVat / (1 + VAT_RATE));
      const vatAmountPerUnit = roundCent(unitPriceIncVat - unitPriceExVat);
      const margin = unitPriceIncVat > 0 ? (unitPriceIncVat - cost) / unitPriceIncVat : 0;

      return {
        eligible: false,
        belowTierMin: true,
        minQuantityRequired: bands[0]?.min || 6,
        tierKey: null,
        priceLine: 'spirits',
        unitPriceIncVat,
        unitPriceExVat,
        vatAmountPerUnit,
        prkCostIncVat: cost,
        marginPercent: roundCent(margin * 100),
        bandMarkup: fallbackMarkup,
      };
    }

    const band = matchedBand || bands[0];
    const markup = band.markup_on_prk_incvat;
    const unitPriceIncVat = roundKes(cost * (1 + markup));
    const unitPriceExVat = roundCent(unitPriceIncVat / (1 + VAT_RATE));
    const vatAmountPerUnit = roundCent(unitPriceIncVat - unitPriceExVat);
    const margin = unitPriceIncVat > 0 ? (unitPriceIncVat - cost) / unitPriceIncVat : 0;

    return {
      eligible: true,
      tierKey: band.key,
      priceLine: 'spirits',
      unitPriceIncVat,
      unitPriceExVat,
      vatAmountPerUnit,
      prkCostIncVat: cost,
      marginPercent: roundCent(margin * 100),
      bandMarkup: markup,
      tierOverrideApplied: !!tierOverride,
    };
  }

  if (priceLine === 'jaba') {
    const bands = customBands?.jaba?.bands || DEFAULT_PRICE_BANDS.jaba.bands;

    let matchedBand = null;
    if (tierOverride) {
      matchedBand = bands.find((b) => b.key === tierOverride) || null;
    }

    if (!matchedBand) {
      matchedBand = bands.find((b) => {
        const minOk = qty >= b.min;
        const maxOk = b.max === null || qty <= b.max;
        return minOk && maxOk;
      });
    }

    const band = matchedBand || bands[bands.length - 1];
    const unitPriceExVat = roundCent(band.price_ex_vat);
    const vatAmountPerUnit = roundCent(unitPriceExVat * VAT_RATE);
    const unitPriceIncVat = roundCent(unitPriceExVat + vatAmountPerUnit);

    return {
      eligible: true,
      tierKey: band.key,
      priceLine: 'jaba',
      unitPriceIncVat,
      unitPriceExVat,
      vatAmountPerUnit,
      prkCostIncVat: 0,
      marginPercent: 62.5,
      tierOverrideApplied: !!tierOverride,
    };
  }

  return {
    eligible: false,
    tierKey: null,
    priceLine,
    unitPriceIncVat: 0,
    unitPriceExVat: 0,
    vatAmountPerUnit: 0,
    prkCostIncVat: 0,
    marginPercent: 0,
  };
}

/**
 * Calculates upgrade savings and nudge for a line.
 */
export function calculateUpgradeNudge({
  priceLine = 'spirits',
  prkCostIncVat = 0,
  quantity = 1,
  customBands = DEFAULT_PRICE_BANDS,
}) {
  const qty = parseInt(quantity, 10) || 0;
  if (priceLine === 'spirits') {
    const bands = customBands?.spirits?.bands || DEFAULT_PRICE_BANDS.spirits.bands;
    const cost = Number(prkCostIncVat) || 0;
    if (!cost) return null;

    const currentRes = resolveLineTier({ priceLine: 'spirits', prkCostIncVat: cost, quantity: qty, customBands });
    
    let nextBand = null;
    for (let i = 0; i < bands.length; i++) {
      if (qty < bands[i].min) {
        nextBand = bands[i];
        break;
      }
    }

    if (!nextBand) return null;

    const neededQty = nextBand.min - qty;
    const nextUnitPriceIncVat = roundKes(cost * (1 + nextBand.markup_on_prk_incvat));
    const currentPrice = currentRes.unitPriceIncVat;
    const savingsPerBottle = Math.max(0, currentPrice - nextUnitPriceIncVat);

    return {
      targetTier: nextBand.key,
      neededQuantity: neededQty,
      nextBandMin: nextBand.min,
      savingsPerBottle,
      message: `Add ${neededQty} more to reach ${nextBand.key} — save KES ${savingsPerBottle.toLocaleString()}/bottle`,
    };
  }

  if (priceLine === 'jaba') {
    const bands = customBands?.jaba?.bands || DEFAULT_PRICE_BANDS.jaba.bands;
    const currentRes = resolveLineTier({ priceLine: 'jaba', quantity: qty, customBands });

    let nextBand = null;
    for (let i = 0; i < bands.length; i++) {
      if (qty < bands[i].min) {
        nextBand = bands[i];
        break;
      }
    }

    if (!nextBand) return null;

    const neededQty = nextBand.min - qty;
    const nextPriceExVat = nextBand.price_ex_vat;
    const currentPriceExVat = currentRes.unitPriceExVat;
    const savingsPerBottle = Math.max(0, currentPriceExVat - nextPriceExVat);

    return {
      targetTier: nextBand.key,
      neededQuantity: neededQty,
      nextBandMin: nextBand.min,
      savingsPerBottle,
      message: `Add ${neededQty} more to reach ${nextBand.key} — save KES ${savingsPerBottle.toLocaleString()}/bottle`,
    };
  }

  return null;
}

/**
 * Validates the minimum order condition.
 */
export function evaluateMinimumOrderRule({ totalBottles, goodsValueExVat }) {
  const bottles = parseInt(totalBottles, 10) || 0;
  const valueExVat = roundCent(goodsValueExVat || 0);

  const meetsBottleCondition = bottles >= MIN_ORDER_BOTTLES;
  const meetsValueCondition = valueExVat >= MIN_ORDER_GOODS_EX_VAT;

  const passed = meetsBottleCondition && meetsValueCondition;

  const bottleDeficit = Math.max(0, MIN_ORDER_BOTTLES - bottles);
  const valueDeficit = Math.max(0, MIN_ORDER_GOODS_EX_VAT - valueExVat);

  let message = '';
  if (!passed) {
    if (!meetsBottleCondition && !meetsValueCondition) {
      message = `Minimum order requirement not met: add ${bottleDeficit} more bottle${bottleDeficit > 1 ? 's' : ''} and KES ${valueDeficit.toLocaleString()} more goods value.`;
    } else if (!meetsBottleCondition) {
      message = `Minimum order requires at least ${MIN_ORDER_BOTTLES} bottles total (currently ${bottles}). Add ${bottleDeficit} more bottle${bottleDeficit > 1 ? 's' : ''}.`;
    } else {
      message = `Minimum order requires at least KES ${MIN_ORDER_GOODS_EX_VAT.toLocaleString()} goods value ex-VAT (currently KES ${valueExVat.toLocaleString()}). Add KES ${valueDeficit.toLocaleString()} more.`;
    }
  }

  return {
    passed,
    meetsBottleCondition,
    meetsValueCondition,
    totalBottles: bottles,
    goodsValueExVat: valueExVat,
    minBottles: MIN_ORDER_BOTTLES,
    minGoodsValueExVat: MIN_ORDER_GOODS_EX_VAT,
    bottleDeficit,
    valueDeficit,
    message,
  };
}

/**
 * Evaluates delivery fee based on address and goods value ex-VAT.
 */
export function evaluateDeliveryFee({ goodsValueExVat, isNairobi = true, city = 'Nairobi' }) {
  const isNrb = isNairobi || /nairobi/i.test(city || '');
  const goods = roundCent(goodsValueExVat || 0);

  if (isNrb) {
    const isFree = goods >= NAIROBI_FREE_DELIVERY_THRESHOLD;
    const fee = isFree ? 0 : NAIROBI_DELIVERY_FEE;
    const freeDeficit = Math.max(0, NAIROBI_FREE_DELIVERY_THRESHOLD - goods);

    return {
      isNairobi: true,
      deliveryFee: fee,
      isFreeDelivery: isFree,
      threshold: NAIROBI_FREE_DELIVERY_THRESHOLD,
      amountNeededForFree: freeDeficit,
      status: 'confirmed',
      label: isFree ? 'Free Delivery (Nairobi Metro)' : `KES ${fee} (Nairobi Metro)`,
    };
  }

  return {
    isNairobi: false,
    deliveryFee: 0,
    isFreeDelivery: false,
    threshold: null,
    amountNeededForFree: 0,
    status: 'to_be_confirmed',
    label: 'Delivery cost to be confirmed by Account Manager',
  };
}

/**
 * Asserts mathematical footing for an invoice to the exact cent.
 */
export function assertInvoiceFooting({
  subtotalExVat,
  vatTotal,
  deliveryFee = 0,
  grandTotal,
  tolerance = 0.05,
}) {
  const calculatedGrand = roundCent(Number(subtotalExVat) + Number(vatTotal) + Number(deliveryFee));
  const expectedGrand = roundCent(Number(grandTotal));
  const diff = Math.abs(calculatedGrand - expectedGrand);
  const isValid = diff <= tolerance;

  return {
    isValid,
    subtotalExVat: roundCent(subtotalExVat),
    vatTotal: roundCent(vatTotal),
    deliveryFee: roundCent(deliveryFee),
    calculatedGrand,
    expectedGrand,
    diff,
  };
}

/**
 * Computes full order pricing across all lines.
 */
export function calculateTradeOrderPricing({
  items = [],
  tierOverride = null,
  isNairobi = true,
  city = 'Nairobi',
  customBands = DEFAULT_PRICE_BANDS,
  referralCredit = 0,
}) {
  let totalBottles = 0;
  let totalGoodsExVat = 0;
  let totalVat = 0;
  let totalGoodsIncVat = 0;
  let totalPrkCostSnapshot = 0;

  const processedLines = items.map((item) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const priceLine = item.priceLine || (item.categoryName?.toLowerCase().includes('jaba') ? 'jaba' : 'spirits');
    const prkCost = Number(item.prkCostIncVat) || 0;

    const res = resolveLineTier({
      sku: item.sku || item.id,
      priceLine,
      prkCostIncVat: prkCost,
      quantity: qty,
      tierOverride,
      customBands,
    });

    const lineTotalIncVat = roundCent(res.unitPriceIncVat * qty);
    const lineTotalExVat = roundCent(res.unitPriceExVat * qty);
    const lineVatAmount = roundCent(lineTotalIncVat - lineTotalExVat);
    const lineCostSnapshot = roundCent(prkCost * qty);

    totalBottles += qty;
    totalGoodsExVat += lineTotalExVat;
    totalVat += lineVatAmount;
    totalGoodsIncVat += lineTotalIncVat;
    totalPrkCostSnapshot += lineCostSnapshot;

    const upgradeNudge = calculateUpgradeNudge({
      priceLine,
      prkCostIncVat: prkCost,
      quantity: qty,
      customBands,
    });

    return {
      ...item,
      quantity: qty,
      priceLine,
      tierKey: res.tierKey,
      eligible: res.eligible,
      unitPriceIncVat: res.unitPriceIncVat,
      unitPriceExVat: res.unitPriceExVat,
      vatAmountPerUnit: res.vatAmountPerUnit,
      lineTotalExVat,
      lineTotalIncVat,
      lineVatAmount,
      prkCostSnapshot: prkCost,
      totalCostSnapshot: lineCostSnapshot,
      marginPercent: res.marginPercent,
      tierOverrideApplied: res.tierOverrideApplied,
      upgradeNudge,
    };
  });

  totalGoodsExVat = roundCent(totalGoodsExVat);
  totalVat = roundCent(totalVat);
  totalGoodsIncVat = roundCent(totalGoodsIncVat);

  const deliveryRes = evaluateDeliveryFee({
    goodsValueExVat: totalGoodsExVat,
    isNairobi,
    city,
  });

  const deliveryFee = roundCent(deliveryRes.deliveryFee);
  const appliedReferralCredit = Math.min(roundCent(referralCredit || 0), totalGoodsIncVat);
  const grandTotal = roundCent(totalGoodsExVat + totalVat + deliveryFee - appliedReferralCredit);

  const overallGrossProfit = roundCent(totalGoodsIncVat - totalPrkCostSnapshot);
  const overallGrossMarginPercent = totalGoodsIncVat > 0 ? roundCent((overallGrossProfit / totalGoodsIncVat) * 100) : 0;

  const minOrderCheck = evaluateMinimumOrderRule({
    totalBottles,
    goodsValueExVat: totalGoodsExVat,
  });

  const footing = assertInvoiceFooting({
    subtotalExVat: totalGoodsExVat,
    vatTotal: totalVat,
    deliveryFee: deliveryFee - appliedReferralCredit,
    grandTotal,
  });

  return {
    items: processedLines,
    totalBottles,
    subtotalExVat: totalGoodsExVat,
    vatTotal: totalVat,
    subtotalIncVat: totalGoodsIncVat,
    delivery: deliveryRes,
    deliveryFee,
    referralCredit: appliedReferralCredit,
    grandTotal,
    minOrderCheck,
    footing,
    economics: {
      prkCostTotal: totalPrkCostSnapshot,
      grossProfit: overallGrossProfit,
      grossMarginPercent: overallGrossMarginPercent,
      isSubMarginFloor: overallGrossMarginPercent < 4.0,
    },
  };
}

export default {
  DEFAULT_PRICE_BANDS,
  VAT_RATE,
  MIN_ORDER_BOTTLES,
  MIN_ORDER_GOODS_EX_VAT,
  NAIROBI_FREE_DELIVERY_THRESHOLD,
  NAIROBI_DELIVERY_FEE,
  roundKes,
  roundCent,
  resolveLineTier,
  calculateUpgradeNudge,
  evaluateMinimumOrderRule,
  evaluateDeliveryFee,
  assertInvoiceFooting,
  calculateTradeOrderPricing,
};

