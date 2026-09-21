import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightedAverageCost,
  allocateLogisticsByValue,
  classifyMarginStatus,
  getMarginFloorConfig,
} from '../lib/trade/trade-costing.js';
import { readTradeStore, updateTradeConfig } from '../lib/trade/trade-store.js';
import { calculateTradeOrderPricing, roundKes, roundCent } from '../lib/trade/pricing-engine.js';
import {
  attachPriceOverrides,
  calculateTradeOrderPricingWithOverrides,
  setPriceOverride,
  clearPriceOverride,
} from '../lib/trade/trade-costing.js';
import { ensureTradeDb, query } from '../lib/trade/trade-pg.js';
import { recordStockReceipt } from '../lib/trade/trade-costing.js';

/**
 * Creates a disposable trade_products row so receipt/override tests can
 * mutate stock and cost without touching real seeded data (Finding 3b of
 * the 2026-09-15 final review: a prior version of this suite ran
 * `SELECT ... LIMIT 1` with no ORDER BY against whatever product happened
 * to be first, and permanently ratcheted its stock/cost on every run).
 */
let fixtureCounter = 0;
async function createTestProduct({ priceLine = 'spirits', prkCostIncVat = 3000, stockQuantity = 50 } = {}) {
  fixtureCounter += 1;
  const suffix = `${Date.now()}-${process.pid}-${fixtureCounter}`;
  const id = `test_fixture_${suffix}`;
  const sku = `TEST-FIXTURE-${suffix}`;
  await query(
    `INSERT INTO trade_products (id, sku, name, slug, price_line, prk_cost_inc_vat, stock_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, sku, 'Test Fixture Product', sku.toLowerCase(), priceLine, prkCostIncVat, stockQuantity]
  );
  return { id, sku };
}

/**
 * Deletes a fixture product and anything a test wrote that references it.
 * trade_stock_receipt_lines.product_id has no ON DELETE CASCADE, but
 * deleting the receipt header first cascades its lines, so receipts must
 * be deleted before the product they reference.
 */
async function deleteTestProduct(productId, { receiptIds = [] } = {}) {
  for (const receiptId of receiptIds) {
    await query('DELETE FROM trade_stock_receipts WHERE id = $1', [receiptId]);
  }
  await query('DELETE FROM trade_products WHERE id = $1', [productId]);
}

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
  const original = readTradeStore().config?.marginFloor;
  try {
    await updateTradeConfig({ marginFloor: { spirits: 3.5, jaba: 9 } });
    const floor = getMarginFloorConfig();
    assert.deepEqual(floor, { spirits: 3.5, jaba: 9 });
  } finally {
    // Restore the *exact* original value (not `undefined`) inside a
    // finally, so a failed assertion above can never leave
    // data/trade-store.json's real config permanently mutated (Finding 3a
    // of the 2026-09-15 final review). Merging `{ marginFloor: undefined }`
    // does make writeJsonAtomic's `JSON.stringify` drop the key on the next
    // write (JSON.stringify omits undefined-valued keys), which happens to
    // correctly restore an originally-absent key — but only if this line
    // actually runs, which the old bare-assertion version did not guarantee.
    await updateTradeConfig({ marginFloor: original });
  }
});

test('getMarginFloorConfig fills in a missing key from the legacy default when marginFloor is partial', async () => {
  // Regression for Finding 2: a partial marginFloor (e.g. from a shallow-
  // merged admin write that only touched one key) must not leave the other
  // key undefined/NaN — every consumer computing Math.min(floors.spirits,
  // floors.jaba) or `marginPercent < floors.jaba` would silently break.
  const original = readTradeStore().config?.marginFloor;
  try {
    await updateTradeConfig({ marginFloor: { spirits: 5 } }); // no jaba key
    const legacy = Number(readTradeStore().config?.gmFloorPercent) || 4.0;
    const floor = getMarginFloorConfig();
    assert.equal(floor.spirits, 5);
    assert.ok(Number.isFinite(floor.jaba), 'jaba must be a finite number, not undefined/NaN');
    assert.equal(floor.jaba, legacy);
  } finally {
    await updateTradeConfig({ marginFloor: original });
  }
});

test('getMarginFloorConfig derives from legacy gmFloorPercent when marginFloor is absent', (t) => {
  const store = readTradeStore();
  if (store.config?.marginFloor) {
    // Someone (a real admin, or another test run that didn't clean up)
    // has already set marginFloor on the shared data/trade-store.json
    // config, so this run cannot exercise the legacy-fallback branch on a
    // clean slate. Document rather than silently pass — see Finding 3a.
    t.skip('config.marginFloor is already set on the shared store — legacy fallback path not exercised this run');
    return;
  }
  const legacy = Number(store.config?.gmFloorPercent) || 4.0;
  const floor = getMarginFloorConfig();
  assert.deepEqual(floor, { spirits: legacy, jaba: legacy });
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

test('calculateTradeOrderPricing computes jaba override margin correctly (standardized to inc-VAT, same as spirits)', () => {
  const pricing = calculateTradeOrderPricing({
    items: [{
      sku: 'TEST-JABA-OVR-1', priceLine: 'jaba', prkCostIncVat: 600, quantity: 60,
      priceOverrides: { T2: 700 }, // inc-VAT override — same convention as spirits now, no ex-VAT conversion
    }],
  });
  const line = pricing.items[0];
  assert.equal(line.tierKey, 'T2'); // 60 -> jaba T2 band (51-100)
  assert.equal(line.unitPriceIncVat, 700);
  assert.equal(line.unitPriceExVat, 603.45); // roundCent(700 / 1.16)
  assert.equal(line.marginPercent, 14.29); // (700-600)/700*100
});

test('jaba price override agrees between setPriceOverride and calculateTradeOrderPricing, same as spirits (Finding 4, updated for the inc-VAT standardization)', async () => {
  await ensureTradeDb();
  // A low landed cost keeps every override comfortably above the margin
  // floor, so setPriceOverride never throws 'blocked' for any of the
  // inputs exercised here.
  const landedCost = 50;
  const product = await createTestProduct({ priceLine: 'jaba', prkCostIncVat: landedCost, stockQuantity: 10 });
  try {
    // 700 is a plain whole-KES value. 100.013 is a fractional-cent (3-decimal)
    // input: setPriceOverride and calculateTradeOrderPricing's override
    // branch must round it to the same whole-KES figure (roundKes), or the
    // margin setPriceOverride reports and the price an order is actually
    // charged would silently disagree — this was Finding 4's original
    // failure mode, now against the standardized inc-VAT-for-both-price-
    // lines convention instead of jaba's old separate ex-VAT conversion.
    for (const overrideIncVat of [700, 100.013]) {
      const expectedIncVat = roundKes(overrideIncVat);
      const expectedMargin = expectedIncVat > 0
        ? roundCent(((expectedIncVat - landedCost) / expectedIncVat) * 100)
        : 0;

      const { marginPercent: overrideMargin, status } = await setPriceOverride({
        productId: product.id,
        tierKey: 'T2',
        priceLine: 'jaba',
        price: overrideIncVat,
        updatedBy: 'test',
      });
      assert.notEqual(status, 'blocked', `override ${overrideIncVat} unexpectedly blocked`);
      assert.equal(overrideMargin, expectedMargin, `setPriceOverride margin mismatch for override ${overrideIncVat}`);

      const pricing = calculateTradeOrderPricing({
        items: [{
          sku: product.sku, priceLine: 'jaba', prkCostIncVat: landedCost, quantity: 60,
          priceOverrides: { T2: overrideIncVat },
        }],
      });
      const line = pricing.items[0];
      assert.equal(line.unitPriceIncVat, expectedIncVat, `pricing-engine unitPriceIncVat mismatch for override ${overrideIncVat}`);
      assert.equal(line.marginPercent, expectedMargin, `pricing-engine margin mismatch for override ${overrideIncVat}`);

      // The two call sites must agree with each other directly, not merely
      // with our independently-computed expectation.
      assert.equal(overrideMargin, line.marginPercent, `the two call sites disagree for override ${overrideIncVat}`);

      await clearPriceOverride({ productId: product.id, tierKey: 'T2' });
    }
  } finally {
    await deleteTestProduct(product.id);
  }
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

test('recordStockReceipt updates stock, landed cost, and writes an inventory log', async () => {
  await ensureTradeDb();
  const beforeQty = 60;
  const beforeCost = 2900;
  const product = await createTestProduct({ priceLine: 'spirits', prkCostIncVat: beforeCost, stockQuantity: beforeQty });
  let receiptId;
  try {
    const receipt = await recordStockReceipt({
      supplierName: 'Test Distributor Ltd',
      reference: 'INV-TEST-001',
      freightCost: 1000,
      clearingCost: 500,
      handlingCost: 0,
      notes: 'Automated test receipt',
      lines: [{ sku: product.sku, cases: 2, unitProductCost: 3000 }],
      createdBy: 'test',
    });
    receiptId = receipt.id;

    assert.ok(receipt.receiptNumber.startsWith('SR-'));
    assert.equal(receipt.lines[0].bottles, 24); // 2 cases * default case_size 12
    assert.ok(receipt.lines[0].landedUnitCost > 3000); // product cost + allocated logistics

    const after = await query('SELECT stock_quantity, prk_cost_inc_vat FROM trade_products WHERE id = $1', [product.id]);
    assert.equal(Number(after.rows[0].stock_quantity), beforeQty + 24);
    // new landed cost is the weighted average, strictly between the two batch costs
    const newCost = Number(after.rows[0].prk_cost_inc_vat);
    const lo = Math.min(beforeCost, receipt.lines[0].landedUnitCost);
    const hi = Math.max(beforeCost, receipt.lines[0].landedUnitCost);
    assert.ok(newCost >= lo - 0.01 && newCost <= hi + 0.01);

    const log = await query(
      `SELECT * FROM inventory_logs WHERE reference_id = $1 AND reason = 'stock_receipt'`,
      [receipt.id]
    );
    assert.equal(log.rows.length, 1);
    assert.equal(Number(log.rows[0].change_qty), 24);
  } finally {
    await deleteTestProduct(product.id, { receiptIds: receiptId ? [receiptId] : [] });
  }
});

test('recordStockReceipt rejects an invalid unitProductCost before writing anything', async () => {
  await ensureTradeDb();
  const beforeQty = 60;
  const beforeCost = 2900;
  const product = await createTestProduct({ priceLine: 'spirits', prkCostIncVat: beforeCost, stockQuantity: beforeQty });
  try {
    // Negative cost
    await assert.rejects(
      () => recordStockReceipt({
        supplierName: 'Test Distributor Ltd',
        reference: 'INV-TEST-BAD-1',
        freightCost: 1000,
        clearingCost: 500,
        handlingCost: 0,
        lines: [{ sku: product.sku, cases: 2, unitProductCost: -100 }],
        createdBy: 'test',
      }),
      /positive product cost/i
    );

    // Missing / NaN cost
    await assert.rejects(
      () => recordStockReceipt({
        supplierName: 'Test Distributor Ltd',
        reference: 'INV-TEST-BAD-2',
        freightCost: 1000,
        clearingCost: 500,
        handlingCost: 0,
        lines: [{ sku: product.sku, cases: 2 }], // unitProductCost missing -> NaN
        createdBy: 'test',
      }),
      /positive product cost/i
    );

    const after = await query('SELECT stock_quantity, prk_cost_inc_vat FROM trade_products WHERE id = $1', [product.id]);
    assert.equal(Number(after.rows[0].stock_quantity), beforeQty);
    assert.equal(Number(after.rows[0].prk_cost_inc_vat), beforeCost);
  } finally {
    await deleteTestProduct(product.id);
  }
});

test('recordStockReceipt rejects a receipt with two lines for the same SKU before writing anything (Finding 1)', async () => {
  await ensureTradeDb();
  const beforeQty = 60;
  const beforeCost = 2900;
  const product = await createTestProduct({ priceLine: 'spirits', prkCostIncVat: beforeCost, stockQuantity: beforeQty });
  try {
    await assert.rejects(
      () => recordStockReceipt({
        supplierName: 'Test Distributor Ltd',
        reference: 'INV-TEST-DUP-1',
        freightCost: 1000,
        clearingCost: 500,
        handlingCost: 0,
        lines: [
          { sku: product.sku, cases: 2, unitProductCost: 3000 },
          { sku: product.sku, cases: 1, unitProductCost: 3000 },
        ],
        createdBy: 'test',
      }),
      /same SKU/i
    );

    // No partial write: stock and cost must be exactly what they were
    // before the (rejected) receipt — the bug this guards against was two
    // silently-overwriting UPDATEs, not a thrown error, so this assertion
    // is the real regression check, not the rejection itself.
    const after = await query('SELECT stock_quantity, prk_cost_inc_vat FROM trade_products WHERE id = $1', [product.id]);
    assert.equal(Number(after.rows[0].stock_quantity), beforeQty);
    assert.equal(Number(after.rows[0].prk_cost_inc_vat), beforeCost);
  } finally {
    await deleteTestProduct(product.id);
  }
});
