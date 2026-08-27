/**
 * Customer-facing wording for a checkout refused on stock grounds.
 *
 * A rejection has to name the product. "Some items are unavailable" makes
 * the customer re-check a cart line by line to find out which.
 */
export function buildStockRejection(rejected = []) {
  const sentences = rejected.map((r) => `${r.name} ${r.reason}`);

  return {
    error: 'Some items are no longer available',
    message: `${sentences.join(', and ')}.`,
    rejected,
  };
}
