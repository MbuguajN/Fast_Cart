/**
 * Controls which pricing internals reach a trade buyer.
 *
 * `calculateTradeOrderPricing` returns landed cost and margin alongside the
 * customer-facing prices, because the admin margin report needs them. Those
 * fields must not travel to a buyer seat: they are the wholesale cost base and
 * margin structure of the business.
 */

/** Seat types allowed to see cost and margin data. */
const ECONOMICS_ROLES = new Set(['owner', 'admin']);

const LINE_ECONOMICS_FIELDS = [
  'prkCostSnapshot',
  'totalCostSnapshot',
  'marginPercent',
];

export function canSeeEconomics(user) {
  if (!user) return false;
  return ECONOMICS_ROLES.has(String(user.seatType || '').toLowerCase());
}

/**
 * Return a copy of a pricing result with cost/margin fields removed unless the
 * viewer is entitled to them.
 */
export function stripEconomics(pricing, user) {
  if (!pricing || canSeeEconomics(user)) return pricing;

  const { economics, ...rest } = pricing;

  return {
    ...rest,
    items: (pricing.items || []).map((item) => {
      const clean = { ...item };
      for (const field of LINE_ECONOMICS_FIELDS) delete clean[field];
      return clean;
    }),
  };
}
