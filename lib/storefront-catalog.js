/**
 * What the storefront is allowed to see.
 *
 * Kept separate from the route so the rule is testable without a server and
 * can be reused by every surface that lists products — search, category,
 * brand and upsells all previously filtered inconsistently.
 */

import { isPurchasable, maxOrderableQty } from './stock.js';

export function visibleProducts(catalog = [], { showOutOfStock = false } = {}) {
  return catalog
    .filter((p) => {
      // An admin-hidden product is never shown, whatever the setting says.
      if (p.overrides?.hidden) return false;
      if (showOutOfStock) return true;
      return isPurchasable(p);
    })
    .map((p) => {
      const max = maxOrderableQty(p);
      return {
        ...p,
        purchasable: isPurchasable(p),
        maxQty: max === Infinity ? null : max,
      };
    });
}
