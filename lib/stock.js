/**
 * Stock purchasability.
 *
 * One place decides whether something can be sold, so the storefront
 * listing, the cart and order creation cannot disagree. WooCommerce is
 * still the final arbiter at order creation — these rules exist so a
 * customer almost never reaches that rejection.
 */

/** Backorders are treated as unsellable: we deliver from stock on hand. */
const SELLABLE_STATUSES = new Set(['instock']);

export function isPurchasable(product) {
  if (!product) return false;
  if (product.overrides?.hidden) return false;
  return SELLABLE_STATUSES.has(product.stockStatus);
}

/**
 * How many units may be ordered. `stockQuantity: null` means WooCommerce is
 * not tracking quantity for this product, which is not the same as zero.
 */
export function maxOrderableQty(product) {
  if (!isPurchasable(product)) return 0;

  const qty = product.stockQuantity;
  if (qty === null || qty === undefined) return Infinity;

  const n = Number(qty);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Check cart lines against the catalogue.
 *
 * @param {Array} lines   `{ wcId, qty, name? }`
 * @param {Array} catalog cached products
 * @returns {{ ok: boolean, accepted: Array, rejected: Array }}
 *   rejected entries are `{ wcId, name, reason, availableQty }`
 */
export function validateCartLines(lines = [], catalog = []) {
  const byId = new Map(catalog.map((p) => [Number(p.wcId), p]));
  const accepted = [];
  const rejected = [];

  for (const line of lines) {
    const product = byId.get(Number(line.wcId));
    const qty = Number(line.qty);

    if (!product) {
      rejected.push({
        wcId: line.wcId,
        name: line.name || 'That item',
        reason: 'is no longer available',
        availableQty: 0,
      });
      continue;
    }

    if (!isPurchasable(product)) {
      rejected.push({
        wcId: product.wcId,
        name: product.name,
        reason: 'is out of stock',
        availableQty: 0,
      });
      continue;
    }

    const max = maxOrderableQty(product);
    if (qty > max) {
      rejected.push({
        wcId: product.wcId,
        name: product.name,
        reason: `has only ${max} left`,
        availableQty: max,
      });
      continue;
    }

    accepted.push({ ...line, name: product.name, price: product.price });
  }

  return { ok: rejected.length === 0, accepted, rejected };
}
