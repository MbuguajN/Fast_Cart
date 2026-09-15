/**
 * B2B landed-cost engine.
 *
 * Weighted-average cost, not FIFO (see design spec §8). This module holds
 * two kinds of exports: pure math (this section) unit-testable with zero
 * dependencies, and DB-backed operations (receipts, overrides — added in
 * later tasks) that use lib/trade/trade-pg.js directly.
 *
 * `prk_cost_inc_vat` keeps its name everywhere downstream (checkout,
 * invoices, margin report) — its value just becomes landed cost instead of a
 * hand-typed figure. See design spec §3.
 */

import { roundCent } from './pricing-engine.js';

/** Blends existing stock value with newly received stock value, per bottle. */
export function computeWeightedAverageCost({ existingQty, existingCost, newQty, newCost }) {
  const eQty = Math.max(0, Number(existingQty) || 0);
  const eCost = Math.max(0, Number(existingCost) || 0);
  const nQty = Math.max(0, Number(newQty) || 0);
  const nCost = Math.max(0, Number(newCost) || 0);

  const totalQty = eQty + nQty;
  if (totalQty === 0) return 0;

  const existingValue = eQty * eCost;
  const newValue = nQty * nCost;
  return roundCent((existingValue + newValue) / totalQty);
}

/**
 * Splits a receipt's total logistics cost (freight + clearing + handling)
 * across its lines by each line's share of total product-cost value, then
 * divides that line's share across its bottles. Value-based allocation is
 * more defensible than per-bottle/per-case for a mixed shipment — a case of
 * an expensive spirit and a case of a cheap mixer don't cost the same to
 * insure or clear.
 */
export function allocateLogisticsByValue(lines, totalLogisticsCost) {
  const total = Math.max(0, Number(totalLogisticsCost) || 0);
  const totalValue = lines.reduce((sum, l) => sum + l.bottles * l.unitProductCost, 0);

  return lines.map((line) => {
    if (total === 0 || totalValue === 0) {
      return { ...line, allocatedLogisticsPerUnit: 0 };
    }
    const lineValue = line.bottles * line.unitProductCost;
    const lineShare = (lineValue / totalValue) * total;
    return { ...line, allocatedLogisticsPerUnit: roundCent(lineShare / line.bottles) };
  });
}

/**
 * Classifies an override or receipt-derived margin against the configured
 * floor. Negative margin (selling below landed cost) is always 'blocked'
 * regardless of the floor value.
 */
export function classifyMarginStatus(marginPercent, floorPercent) {
  if (marginPercent < 0) return 'blocked';
  if (marginPercent < floorPercent) return 'flagged';
  return 'ok';
}
