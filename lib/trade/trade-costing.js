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

import { roundCent, calculateTradeOrderPricing, VAT_RATE } from './pricing-engine.js';
import { readTradeStore } from './trade-store.js';
import { query, withTransaction } from './trade-pg.js';

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

/**
 * Per-price-line margin floor, percent, measured against landed cost.
 * Falls back to the legacy flat `config.gmFloorPercent` (pre-existing,
 * still read by the Margin Audit report) when the new per-line config
 * hasn't been set yet, so behavior doesn't silently change on deploy.
 * See design spec §4.5, §9.
 */
export function getMarginFloorConfig() {
  const store = readTradeStore();
  if (store.config?.marginFloor) return store.config.marginFloor;
  const legacy = store.config?.gmFloorPercent || 4.0;
  return { spirits: legacy, jaba: legacy };
}

/**
 * Attaches this-tier price overrides to a list of items (each needing at
 * least `.sku`). One batch query for the whole order — never N+1. Joins
 * through trade_products because overrides are keyed by product_id but
 * every caller's items reliably carry `.sku`, not `.id` (see design spec
 * §5.4).
 */
export async function attachPriceOverrides(items) {
  const skus = [...new Set(items.map((i) => i.sku).filter(Boolean))];
  if (skus.length === 0) return items;

  const res = await query(
    `SELECT tp.sku, tpo.tier_key, tpo.price_inc_vat
     FROM trade_price_overrides tpo
     JOIN trade_products tp ON tp.id = tpo.product_id
     WHERE tp.sku = ANY($1)`,
    [skus]
  );

  const bySku = new Map();
  for (const row of res.rows) {
    if (!bySku.has(row.sku)) bySku.set(row.sku, {});
    bySku.get(row.sku)[row.tier_key] = Number(row.price_inc_vat);
  }

  return items.map((item) => ({
    ...item,
    priceOverrides: bySku.get(item.sku) || {},
  }));
}

/**
 * Thin async wrapper around the pure calculateTradeOrderPricing — the only
 * thing this adds is fetching overrides first. calculateTradeOrderPricing
 * itself stays synchronous and dependency-free (see Global Constraints).
 */
export async function calculateTradeOrderPricingWithOverrides(args) {
  const items = await attachPriceOverrides(args.items || []);
  return calculateTradeOrderPricing({ ...args, items });
}

/**
 * Sets (or replaces) a per-tier price override, enforcing the margin floor.
 * Throws if the price is below landed cost — no silent loss-making prices
 * (design spec §5.5). A price between 0 and the floor saves but the caller
 * should surface `status === 'flagged'` to the admin.
 */
export async function setPriceOverride({ productId, tierKey, priceLine, price, updatedBy }) {
  const prod = await query('SELECT prk_cost_inc_vat FROM trade_products WHERE id = $1', [productId]);
  if (prod.rows.length === 0) throw new Error('Product not found');
  const landedCost = Number(prod.rows[0].prk_cost_inc_vat) || 0;

  const priceNum = Number(price);
  if (!(priceNum > 0)) throw new Error('Price must be a positive number');

  // The override input is ex-VAT for jaba, inc-VAT for spirits (matching
  // pricing-engine.js's convention) — convert to inc-VAT before comparing
  // against landed cost, which is always inc-VAT. See pricing-engine.js's
  // per-line override block for the same rule.
  const priceIncVat = priceLine === 'jaba' ? roundCent(priceNum * (1 + VAT_RATE)) : priceNum;

  const marginPercent = priceIncVat > 0 ? roundCent(((priceIncVat - landedCost) / priceIncVat) * 100) : 0;
  const floor = getMarginFloorConfig()[priceLine] ?? 4.0;
  const status = classifyMarginStatus(marginPercent, floor);

  if (status === 'blocked') {
    throw new Error(`Override price KES ${priceNum} is below landed cost KES ${landedCost} — refusing to save a loss-making price`);
  }

  await query(
    `INSERT INTO trade_price_overrides (product_id, tier_key, price_inc_vat, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (product_id, tier_key) DO UPDATE SET price_inc_vat = $3, updated_by = $4, updated_at = NOW()`,
    [productId, tierKey, priceNum, updatedBy || 'Admin']
  );

  return { marginPercent, status };
}

export async function clearPriceOverride({ productId, tierKey }) {
  await query('DELETE FROM trade_price_overrides WHERE product_id = $1 AND tier_key = $2', [productId, tierKey]);
}

/**
 * Records a goods-received batch: computes each line's landed cost
 * (product cost + this batch's share of freight/clearing/handling,
 * allocated by value — see allocateLogisticsByValue), rolls each product's
 * running weighted-average landed cost forward, and increases stock. All in
 * one transaction alongside the audit rows (trade_stock_receipts /
 * _lines / inventory_logs), matching the pattern already used by
 * createTradeOrder in trade-store.js.
 */
export async function recordStockReceipt({
  supplierName = '',
  reference = '',
  freightCost = 0,
  clearingCost = 0,
  handlingCost = 0,
  notes = '',
  lines,
  createdBy = 'Admin',
}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('A stock receipt needs at least one line');
  }
  for (const line of lines) {
    if (!(Number(line.cases) > 0)) {
      throw new Error(`Receipt line for SKU "${line.sku}" must have a positive case quantity`);
    }
  }

  return withTransaction(async (client) => {
    const products = [];
    for (const line of lines) {
      const res = await client.query(
        'SELECT * FROM trade_products WHERE sku = $1 FOR UPDATE',
        [line.sku]
      );
      if (res.rows.length === 0) throw new Error(`Unknown SKU in receipt: ${line.sku}`);
      products.push(res.rows[0]);
    }

    const caseSizedLines = lines.map((line, idx) => ({
      ...line,
      bottles: Math.round(line.cases * (products[idx].case_size || 12)),
      unitProductCost: Number(line.unitProductCost),
    }));

    const totalLogistics = Number(freightCost) + Number(clearingCost) + Number(handlingCost);
    const allocated = allocateLogisticsByValue(caseSizedLines, totalLogistics);

    const seqRes = await client.query("SELECT nextval('trade_receipt_seq') as seq");
    const seq = seqRes.rows[0].seq;
    const receiptNumber = `SR-${String(seq).padStart(4, '0')}`;
    const receiptId = `sr_${Date.now()}`;

    await client.query(
      `INSERT INTO trade_stock_receipts
        (id, receipt_number, supplier_name, reference, freight_cost, clearing_cost, handling_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [receiptId, receiptNumber, supplierName, reference, freightCost, clearingCost, handlingCost, notes, createdBy]
    );

    const resultLines = [];
    for (let i = 0; i < allocated.length; i++) {
      const line = allocated[i];
      const product = products[i];
      const landedUnitCost = roundCent(line.unitProductCost + line.allocatedLogisticsPerUnit);

      await client.query(
        `INSERT INTO trade_stock_receipt_lines
          (receipt_id, product_id, sku, cases, bottles, unit_product_cost_inc_vat, allocated_logistics_per_unit, landed_unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [receiptId, product.id, product.sku, line.cases, line.bottles, line.unitProductCost, line.allocatedLogisticsPerUnit, landedUnitCost]
      );

      const existingQty = Number(product.stock_quantity);
      const existingCost = Number(product.prk_cost_inc_vat) || 0;
      const newAvg = computeWeightedAverageCost({
        existingQty, existingCost,
        newQty: line.bottles, newCost: landedUnitCost,
      });
      const newQty = existingQty + line.bottles;
      const newProductCost = roundCent(
        (existingQty * (Number(product.product_cost_inc_vat) || existingCost) + line.bottles * line.unitProductCost) / newQty
      );
      const newLogisticsCost = roundCent(newAvg - newProductCost);

      await client.query(
        `UPDATE trade_products
         SET stock_quantity = $1, prk_cost_inc_vat = $2, product_cost_inc_vat = $3,
             logistics_cost_inc_vat = $4, in_stock = true, updated_at = NOW()
         WHERE id = $5`,
        [newQty, newAvg, newProductCost, newLogisticsCost, product.id]
      );

      await client.query(
        `INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id)
         VALUES ($1, $2, $3, $4, 'stock_receipt', $5)`,
        [product.id, product.sku, line.bottles, newQty, receiptId]
      );

      resultLines.push({
        sku: product.sku,
        cases: line.cases,
        bottles: line.bottles,
        unitProductCost: line.unitProductCost,
        allocatedLogisticsPerUnit: line.allocatedLogisticsPerUnit,
        landedUnitCost,
        newLandedCost: newAvg,
      });
    }

    return { id: receiptId, receiptNumber, supplierName, reference, lines: resultLines };
  });
}
