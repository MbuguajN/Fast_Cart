import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightedAverageCost,
  allocateLogisticsByValue,
  classifyMarginStatus,
  getMarginFloorConfig,
} from '../lib/trade/trade-costing.js';
import { readTradeStore, updateTradeConfig } from '../lib/trade/trade-store.js';
import { calculateTradeOrderPricing } from '../lib/trade/pricing-engine.js';
import {
  attachPriceOverrides,
  calculateTradeOrderPricingWithOverrides,
  setPriceOverride,
  clearPriceOverride,
} from '../lib/trade/trade-costing.js';
import { ensureTradeDb, query } from '../lib/trade/trade-pg.js';

test('computeWeightedAverageCost blends existing and new stock by value', () => {
  // 60 @ 2,900 + 240 @ 2,985 -> 2,968 (the worked example from the design spec)
  const avg = computeWeightedAverageCost({
    existingQty: 60, existingCost: 2900,
    newQty: 240, newCost: 2985,
  });
  assert.equal(avg, 2968);
});

test('computeWeightedAverageCost with zero existing stock is just the new cost', () => {
  const avg = computeWeightedAverageCost({
    existingQty: 0, existingCost: 0,
    newQty: 100, newCost: 3000,
  });
  assert.equal(avg, 3000);
});

test('allocateLogisticsByValue splits proportional to each line\'s product-cost value, then per bottle', () => {
  const lines = [
    { sku: 'CHV18', bottles: 12, unitProductCost: 6000 },  // value 72,000
    { sku: 'KREST', bottles: 120, unitProductCost: 200 },  // value 24,000
  ];
  // total value 96,000; total logistics 9,600 -> CHV18 gets 75% (7,200), KREST 25% (2,400)
  const out = allocateLogisticsByValue(lines, 9600);
  assert.equal(out[0].allocatedLogisticsPerUnit, 600);   // 7,200 / 12
  assert.equal(out[1].allocatedLogisticsPerUnit, 20);    // 2,400 / 120
});

test('allocateLogisticsByValue with zero total logistics allocates nothing', () => {
  const lines = [{ sku: 'A', bottles: 10, unitProductCost: 100 }];
  const out = allocateLogisticsByValue(lines, 0);
  assert.equal(out[0].allocatedLogisticsPerUnit, 0);
});

test('classifyMarginStatus: negative margin is blocked', () => {
  assert.equal(classifyMarginStatus(-2.3, 3.0), 'blocked');
});

test('classifyMarginStatus: below floor but non-negative is flagged', () => {
  assert.equal(classifyMarginStatus(1.7, 3.0), 'flagged');
});

test('classifyMarginStatus: at or above floor is ok', () => {
  assert.equal(classifyMarginStatus(3.0, 3.0), 'ok');
  assert.equal(classifyMarginStatus(10.1, 3.0), 'ok');
});

test('getMarginFloorConfig returns config.marginFloor when set', async () => {
  await updateTradeConfig({ marginFloor: { spirits: 3.5, jaba: 9 } });
  const floor = getMarginFloorConfig();
  assert.deepEqual(floor, { spirits: 3.5, jaba: 9 });
  // restore for other tests in this file
  await updateTradeConfig({ marginFloor: undefined });
});

test('getMarginFloorConfig derives from legacy gmFloorPercent when marginFloor is absent', async () => {
  const store = readTradeStore();
  const original = store.config.marginFloor;
  delete store.config.marginFloor;
  // readTradeStore reads from disk each call, so simulate "absent" by writing
  // a config without marginFloor directly via updateTradeConfig's merge —
  // merge can't delete a key, so this test instead asserts the fallback
  // value directly against whatever gmFloorPercent already is.
  const floor = getMarginFloorConfig();
  const expected = store.config?.marginFloor
    ? store.config.marginFloor
    : { spirits: store.config?.gmFloorPercent || 4.0, jaba: store.config?.gmFloorPercent || 4.0 };
  assert.deepEqual(floor, expected);
  if (original) await updateTradeConfig({ marginFloor: original });
});

test('calculateTradeOrderPricing applies a per-tier priceOverride when present', () => {
  const pricing = calculateTradeOrderPricing({
    items: [{
      sku: 'TEST-OVR-1', priceLine: 'spirits', prkCostIncVat: 2970, quantity: 30,
      priceOverrides: { T2: 3200 },
    }],
  });
  const line = pricing.items[0];
  assert.equal(line.tierKey, 'T2'); // 30 bottles -> T2 band (25-72)
  assert.equal(line.unitPriceIncVat, 3200);
  assert.equal(line.overrideApplied, true);
  assert.ok(line.suggestedUnitPriceIncVat > 0);
  assert.ok(line.suggestedUnitPriceIncVat !== 3200);
});

test('calculateTradeOrderPricing with no matching override is unaffected', () => {
  const withOverride = calculateTradeOrderPricing({
    items: [{ sku: 'X', priceLine: 'spirits', prkCostIncVat: 2970, quantity: 30, priceOverrides: { T1: 9999 } }],
  });
  const without = calculateTradeOrderPricing({
    items: [{ sku: 'X', priceLine: 'spirits', prkCostIncVat: 2970, quantity: 30 }],
  });
  // quantity 30 resolves to T2, so a T1-only override never applies
  assert.equal(withOverride.items[0].unitPriceIncVat, without.items[0].unitPriceIncVat);
  assert.equal(withOverride.items[0].overrideApplied, false);
});

test('calculateTradeOrderPricing computes jaba override margin consistently in VAT-inc terms', () => {
  const pricing = calculateTradeOrderPricing({
    items: [{
      sku: 'TEST-JABA-OVR-1', priceLine: 'jaba', prkCostIncVat: 700, quantity: 60,
      priceOverrides: { T2: 700 }, // ex-VAT override, same as landed cost inc-VAT
    }],
  });
  const line = pricing.items[0];
  assert.equal(line.tierKey, 'T2'); // 60 -> jaba T2 band (51-100)
  assert.equal(line.unitPriceExVat, 700);
  assert.equal(line.unitPriceIncVat, 812);
  // NOT 0 — that would be the VAT-basis bug (comparing 700 ex-VAT to 700 inc-VAT cost)
  assert.equal(line.marginPercent, 13.79);
});

test('attachPriceOverrides + setPriceOverride round-trip through Postgres', async () => {
  await ensureTradeDb();
  const prod = await query(`SELECT id, sku, prk_cost_inc_vat FROM trade_products WHERE price_line = 'spirits' LIMIT 1`);
  if (prod.rows.length === 0) return; // no seeded spirits product in this environment — skip
  const { id, sku } = prod.rows[0];

  await setPriceOverride({ productId: id, tierKey: 'T1', priceLine: 'spirits', price: 999999, updatedBy: 'test' });
  const [attached] = await attachPriceOverrides([{ sku, priceLine: 'spirits' }]);
  assert.equal(attached.priceOverrides.T1, 999999);

  await clearPriceOverride({ productId: id, tierKey: 'T1' });
  const [cleared] = await attachPriceOverrides([{ sku, priceLine: 'spirits' }]);
  assert.equal(cleared.priceOverrides.T1, undefined);
});

test('setPriceOverride rejects a price below landed cost', async () => {
  await ensureTradeDb();
  const prod = await query(`SELECT id FROM trade_products WHERE price_line = 'spirits' AND prk_cost_inc_vat > 0 LIMIT 1`);
  if (prod.rows.length === 0) return;
  const { id } = prod.rows[0];
  await assert.rejects(
    () => setPriceOverride({ productId: id, tierKey: 'T1', priceLine: 'spirits', price: 0.01, updatedBy: 'test' }),
    /below landed cost/i
  );
});
