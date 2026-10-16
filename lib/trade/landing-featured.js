/**
 * Which products the trade landing page features, and the price line shown
 * under each. Pure functions over the public `/api/trade/catalog` payload.
 */

/** Brands buyers recognise, in the order they should lead the shelf. */
const BRAND_PRIORITY = ['jameson', 'absolut', 'chivas', 'beefeater', 'glenlivet', 'ballantine', 'malibu', 'havana', 'martell', 'jacob', 'olmeca'];
const MAX_JABA = 2;

/**
 * Some products carry a parent company (not the consumer brand) in `brandName`,
 * so the brand is read from the product name as well.
 */
function brandKey(product) {
  const text = `${product?.name || ''} ${product?.brandName || ''}`.toLowerCase();
  const known = BRAND_PRIORITY.find((key) => text.includes(key));
  if (known) return known;
  return String(product?.name || product?.brandName || '').toLowerCase().split(/\s+/)[0];
}

function brandRank(product) {
  const i = BRAND_PRIORITY.indexOf(brandKey(product));
  return i === -1 ? BRAND_PRIORITY.length : i;
}

/** `{ from, to }` in KES incl. VAT: the single-bottle price and the lowest volume price. */
export function priceSummary(product) {
  const prices = Object.values(product?.tierPrices || {})
    .map((t) => Number(t?.unitPriceIncVat))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  const from = Number(product.tierPrices.T0?.unitPriceIncVat) || Math.max(...prices);
  const lowest = Math.min(...prices);
  return { from, to: lowest < from ? lowest : null };
}

export function pickFeaturedProducts(products, limit = 8) {
  const sellable = (Array.isArray(products) ? products : []).filter(
    (p) => p?.inStock && priceSummary(p)
  );

  const seenBrands = new Set();
  const spirits = sellable
    .filter((p) => p.priceLine !== 'jaba')
    .sort((a, b) => brandRank(a) - brandRank(b) || (b.stockQuantity || 0) - (a.stockQuantity || 0))
    .filter((p) => {
      const key = brandKey(p);
      if (seenBrands.has(key)) return false;
      seenBrands.add(key);
      return true;
    });

  const jaba = sellable
    .filter((p) => p.priceLine === 'jaba')
    .sort((a, b) => (b.stockQuantity || 0) - (a.stockQuantity || 0))
    .slice(0, MAX_JABA);

  const spiritSlots = Math.max(0, limit - Math.min(jaba.length, MAX_JABA));
  return [...spirits.slice(0, spiritSlots), ...jaba].slice(0, limit);
}
