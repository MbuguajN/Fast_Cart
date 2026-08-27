/**
 * Turning a WooCommerce product payload into a cache update.
 *
 * Kept out of the route so the mapping is testable without a signed request,
 * and so the reconcile job applies exactly the same transformation as the
 * webhook — two paths that disagree would be worse than one that is late.
 */

/**
 * @returns {{ wcId, name, price, regularPrice, salePrice, stockStatus, stockQuantity, sku } | null}
 */
export function extractStockDelta(payload) {
  if (!payload || !payload.id) return null;

  // stock_quantity null means WooCommerce is not tracking quantity for this
  // product. Coercing it to 0 would read as "sold out" and hide the product.
  const qty = payload.stock_quantity;

  return {
    wcId: payload.id,
    name: payload.name,
    price: payload.price ?? payload.regular_price,
    regularPrice: payload.regular_price,
    salePrice: payload.sale_price,
    stockStatus: payload.stock_status,
    stockQuantity: qty === null || qty === undefined ? null : Number(qty),
    sku: payload.sku || '',
  };
}

export function isDeletion(topic) {
  return topic === 'product.deleted';
}
