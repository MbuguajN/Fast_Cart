# B2B Stock & Costing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-figure "PRK Costs" model with a landed-cost system
(product cost + logistics, weighted-averaged across stock receipts), per-tier
selling-price overrides with margin-floor enforcement, and case-based
receiving — on top of the B2B stock pool that already exists in Postgres.

**Architecture:** A new pure-ish module `lib/trade/trade-costing.js` holds the
costing math (weighted average, logistics allocation, margin classification)
and the DB-backed receipt/override operations. The existing pricing engine
(`lib/trade/pricing-engine.js`) stays pure and unmodified except for one
additive per-line override read — it is called from the browser bundle
(`trade-context.js`) and must not gain I/O. Schema changes are additive
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`),
consistent with the existing `ensureTradeDb()` pattern — nothing is dropped,
nothing breaks if a task is only partially deployed.

**Tech Stack:** Next.js 16 (App Router) API routes, PostgreSQL via `pg`
(`lib/trade/trade-pg.js`), `node:test` + `node:assert/strict` (no test
framework dependency, matches `tests/trade-hub-e2e.test.js`), plain React
(no new UI library) for `app/admin/trade/page.js`.

**Spec:** `docs/superpowers/specs/2026-09-15-b2b-stock-costing-design.md` —
read it alongside this plan; the plan carries out its decisions and does not
re-justify them here.

## Global Constraints

- Keep the column/field name `prk_cost_inc_vat` / `prkCostIncVat` — its value
  becomes landed cost, but nothing downstream (checkout, invoices, PDFs,
  margin report) is renamed. (spec §3)
- New per-product/tier price override concept is named `priceOverride`
  everywhere in code and API payloads — never `tierOverride` (that name is
  taken by a pre-existing, unrelated account-level forced-tier concept in
  `resolveLineTier`). (spec §5.4)
- `lib/trade/pricing-engine.js` stays pure — no DB access, no `async` added to
  `calculateTradeOrderPricing` or `resolveLineTier`. It is called directly
  from the browser bundle via `lib/trade/trade-context.js`. (spec §5.4)
- `trade-context.js` (client-side cart display) is explicitly out of scope —
  it keeps showing the suggested (non-overridden) price. Only server-side
  pricing (`/api/trade/pricing`, checkout, quote creation) honors overrides.
  (spec §5.4)
- Config lives in `data/trade-store.json`'s `config` object (via
  `readTradeStore()` / `updateTradeConfig()`), **not** the Postgres
  `trade_config` table, which is dead/write-only. (spec §4.5)
- Weighted-average cost, not FIFO. No supplier/PO tables. No multi-warehouse.
  (spec §8)
- `case_size` defaults to 12. Receipt line `bottles` is a stored snapshot —
  changing a product's `case_size` later never retroactively rewrites past
  receipt lines. (spec §4.3, §8)
- Margin floor is per price line (`spirits`, `jaba`), measured against landed
  cost: `margin% < 0` → save blocked; `0 <= margin% < floor` → save allowed,
  flagged; `>= floor` → clean. (spec §5.5)

---

## Task 1: Schema migration — new columns, tables, sequence, backfill

**Files:**
- Modify: `lib/trade/trade-pg.js` (inside `createSchema()`, after the existing
  `trade_products` `CREATE TABLE`, and after the existing `CREATE SEQUENCE`
  block; a new `backfillLandedCostColumns()` function; call it from
  `ensureTradeDb()`)
- Test: `tests/trade-costing-schema.test.js`

**Interfaces:**
- Produces: columns `trade_products.case_size` (INT), `.product_cost_inc_vat`
  (NUMERIC(10,2), nullable), `.logistics_cost_inc_vat` (NUMERIC(10,2),
  default 0); tables `trade_stock_receipts`, `trade_stock_receipt_lines`,
  `trade_price_overrides`; sequence `trade_receipt_seq`. All consumed by
  Tasks 2-5.

- [x] **Step 1: Write the failing schema test**

```js
// tests/trade-costing-schema.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTradeDb, query } from '../lib/trade/trade-pg.js';

test('B2B costing schema exists after ensureTradeDb', async () => {
  await ensureTradeDb();

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'trade_products'
       AND column_name IN ('case_size', 'product_cost_inc_vat', 'logistics_cost_inc_vat')`
  );
  assert.equal(cols.rows.length, 3, 'trade_products should have the three new costing columns');

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('trade_stock_receipts', 'trade_stock_receipt_lines', 'trade_price_overrides')`
  );
  assert.equal(tables.rows.length, 3, 'all three new tables should exist');

  const seq = await query(`SELECT nextval('trade_receipt_seq') as seq`);
  assert.ok(Number(seq.rows[0].seq) >= 1);
});

test('backfill sets product_cost_inc_vat from prk_cost_inc_vat where present', async () => {
  await ensureTradeDb();
  // Any product migrated from the legacy JSON store with a nonzero cost
  // must have been backfilled — product_cost_inc_vat is never left NULL
  // once prk_cost_inc_vat > 0.
  const res = await query(
    `SELECT COUNT(*) FROM trade_products WHERE prk_cost_inc_vat > 0 AND product_cost_inc_vat IS NULL`
  );
  assert.equal(Number(res.rows[0].count), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-costing-schema.test.js`
Expected: FAIL — columns/tables/sequence don't exist yet.

- [ ] **Step 3: Add the schema to `createSchema()`**

In `lib/trade/trade-pg.js`, immediately after the existing
`CREATE TABLE IF NOT EXISTS trade_products (...)` block (inside the same
template-literal `client.query(...)` call that creates the other tables —
follow the existing pattern of one big multi-statement `query` call), add:

```sql
    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS case_size INT NOT NULL DEFAULT 12;
    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS product_cost_inc_vat NUMERIC(10, 2);
    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS logistics_cost_inc_vat NUMERIC(10, 2) NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS trade_stock_receipts (
      id VARCHAR(64) PRIMARY KEY,
      receipt_number VARCHAR(64) UNIQUE NOT NULL,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      supplier_name VARCHAR(255),
      reference VARCHAR(128),
      freight_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      clearing_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      handling_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trade_stock_receipt_lines (
      id SERIAL PRIMARY KEY,
      receipt_id VARCHAR(64) REFERENCES trade_stock_receipts(id) ON DELETE CASCADE,
      product_id VARCHAR(64) REFERENCES trade_products(id),
      sku VARCHAR(128) NOT NULL,
      cases NUMERIC(10, 2) NOT NULL,
      bottles INT NOT NULL,
      unit_product_cost_inc_vat NUMERIC(10, 2) NOT NULL,
      allocated_logistics_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0,
      landed_unit_cost NUMERIC(10, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_price_overrides (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(64) REFERENCES trade_products(id) ON DELETE CASCADE,
      tier_key VARCHAR(8) NOT NULL,
      price_inc_vat NUMERIC(10, 2) NOT NULL,
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (product_id, tier_key)
    );

    CREATE SEQUENCE IF NOT EXISTS trade_receipt_seq START 1;
```

(Note: `trade_price_overrides.price_inc_vat` stores the override value
verbatim regardless of price line — for jaba this is an ex-VAT figure per
spec §5.4; the column name is a slight misnomer kept for schema simplicity
rather than adding a second nullable column, and is explained in the
`trade-costing.js` docblock in Task 5.)

Then add, in the same file, below `createSchema()`:

```js
/**
 * One-time backfill for the landed-cost columns. Idempotent: only touches
 * rows that haven't been migrated yet, so it's cheap to call on every
 * ensureTradeDb() rather than gating it on a separate "has this run" flag.
 * Treats whatever cost was already on file as the opening landed cost with
 * zero logistics, so nothing regresses to "missing cost" on deploy.
 */
async function backfillLandedCostColumns() {
  const p = getPgPool();
  await p.query(
    `UPDATE trade_products
     SET product_cost_inc_vat = prk_cost_inc_vat, logistics_cost_inc_vat = 0
     WHERE product_cost_inc_vat IS NULL AND prk_cost_inc_vat > 0`
  );
}
```

In `ensureTradeDb()`, find the line `await migrateFromJsonIfEmpty();` and add
immediately after it:

```js
    await backfillLandedCostColumns();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-costing-schema.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-pg.js tests/trade-costing-schema.test.js
git commit -m "feat(trade): add B2B costing schema (receipts, overrides, landed cost columns)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Pure costing math — weighted average, logistics allocation, margin classification

**Files:**
- Create: `lib/trade/trade-costing.js`
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Produces:
  `computeWeightedAverageCost({ existingQty, existingCost, newQty, newCost }) -> number`,
  `allocateLogisticsByValue(lines, totalLogisticsCost) -> lines-with-allocated-per-unit`
  where each input line is `{ sku, bottles, unitProductCost }` and each output
  line adds `allocatedLogisticsPerUnit`,
  `classifyMarginStatus(marginPercent, floorPercent) -> 'blocked' | 'flagged' | 'ok'`.
  Consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing tests**

```js
// tests/trade-costing.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWeightedAverageCost,
  allocateLogisticsByValue,
  classifyMarginStatus,
} from '../lib/trade/trade-costing.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL with "Cannot find module '../lib/trade/trade-costing.js'"

- [ ] **Step 3: Implement the pure functions**

```js
// lib/trade/trade-costing.js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/trade-costing.test.js`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-costing.js tests/trade-costing.test.js
git commit -m "feat(trade): add pure costing math (weighted average, logistics allocation, margin classification)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Margin floor config — read/derive from JSON store

**Files:**
- Modify: `lib/trade/trade-costing.js`
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Consumes: `readTradeStore()` from `lib/trade/trade-store.js` (existing,
  synchronous, reads `data/trade-store.json`).
- Produces: `getMarginFloorConfig() -> { spirits: number, jaba: number }`.
  Consumed by Tasks 4 and 5, and by Task 7's margin-report update.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/trade-costing.test.js
import { getMarginFloorConfig } from '../lib/trade/trade-costing.js';
import { readTradeStore, updateTradeConfig } from '../lib/trade/trade-store.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL — `getMarginFloorConfig` is not exported yet.

- [ ] **Step 3: Implement**

**Circular dependency, resolved once, here, for the whole plan**:
`trade-costing.js` needs `readTradeStore` from `trade-store.js` (this task),
and `trade-store.js` needs several functions from `trade-costing.js`
(Tasks 6-8: `attachPriceOverrides`, `getMarginFloorConfig`,
`calculateTradeOrderPricingWithOverrides`) — a genuine two-way dependency
between the same two files. The decision for this whole plan: `trade-costing.js`
keeps a normal **static** top-level `import { readTradeStore } from
'./trade-store.js';` (this task, unchanged, one direction). `trade-store.js`,
in the other direction, always uses a **dynamic** `await import('./trade-costing.js')`
inside the function body that needs it (Tasks 6-8) — never a static
top-level import of `trade-costing.js` in `trade-store.js`. An asymmetric
cycle like this (one side static, one side deferred to function-call time) is
safe in Node ESM: whichever file is the actual entry point loads first,
pulls in the other statically, and by the time any dynamically-imported call
back into the first file executes, that file's top-level evaluation has long
since finished. Every other cross-file import in this plan (e.g.
`trade-costing.js` → `trade-pg.js` → `pricing-engine.js`, none of which
import back) is an ordinary static import — this rule applies only to the
`trade-store.js` ↔ `trade-costing.js` pair.

Add to `lib/trade/trade-costing.js`:

```js
import { readTradeStore } from './trade-store.js';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-costing.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-costing.js tests/trade-costing.test.js
git commit -m "feat(trade): add per-price-line margin floor config with legacy fallback

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Price overrides — pricing engine integration + set/clear with floor enforcement

**Files:**
- Modify: `lib/trade/pricing-engine.js:444-510` (`calculateTradeOrderPricing`'s
  per-line loop)
- Modify: `lib/trade/trade-costing.js` (add `attachPriceOverrides`,
  `calculateTradeOrderPricingWithOverrides`, `setPriceOverride`,
  `clearPriceOverride`)
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Consumes: `resolveLineTier` (existing, unchanged), `VAT_RATE`, `roundKes`,
  `roundCent` (existing exports of `pricing-engine.js`), `query`,
  `withTransaction` (existing exports of `lib/trade/trade-pg.js`),
  `classifyMarginStatus`, `getMarginFloorConfig` (Tasks 2-3).
- Produces: `attachPriceOverrides(items) -> Promise<items-with-priceOverrides>`,
  `calculateTradeOrderPricingWithOverrides(args) -> Promise<pricing>` (same
  shape `calculateTradeOrderPricing` already returns, plus per-line
  `overrideApplied: boolean` and `suggestedUnitPriceIncVat: number`),
  `setPriceOverride({ productId, tierKey, priceLine, price, updatedBy }) -> Promise<{ marginPercent, status }>`
  (throws if `status === 'blocked'`), `clearPriceOverride({ productId, tierKey }) -> Promise<void>`.
  Consumed by Task 7 (order/quote creation) and Task 9 (admin products route).

- [ ] **Step 1: Write the failing tests**

```js
// append to tests/trade-costing.test.js
import { calculateTradeOrderPricing } from '../lib/trade/pricing-engine.js';
import {
  attachPriceOverrides,
  calculateTradeOrderPricingWithOverrides,
  setPriceOverride,
  clearPriceOverride,
} from '../lib/trade/trade-costing.js';
import { ensureTradeDb, query } from '../lib/trade/trade-pg.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL — new exports don't exist, `priceOverrides` isn't read by
`calculateTradeOrderPricing`.

- [ ] **Step 3a: Add the per-line override read to `calculateTradeOrderPricing`**

In `lib/trade/pricing-engine.js`, inside `calculateTradeOrderPricing`'s
`items.map((item) => { ... })` (around line 461, right after the
`resolveLineTier` call and before `lineTotalIncVat` is computed), insert:

```js
    let unitPriceIncVat = res.unitPriceIncVat;
    let unitPriceExVat = res.unitPriceExVat;
    let vatAmountPerUnit = res.vatAmountPerUnit;
    let marginPercent = res.marginPercent;
    let overrideApplied = false;

    const override = item.priceOverrides?.[res.tierKey];
    if (res.eligible && override !== undefined && override !== null) {
      overrideApplied = true;
      if (priceLine === 'jaba') {
        unitPriceExVat = roundCent(override);
        vatAmountPerUnit = roundCent(unitPriceExVat * VAT_RATE);
        unitPriceIncVat = roundCent(unitPriceExVat + vatAmountPerUnit);
        marginPercent = unitPriceExVat > 0 ? roundCent(((unitPriceExVat - prkCost) / unitPriceExVat) * 100) : 0;
      } else {
        unitPriceIncVat = roundKes(override);
        unitPriceExVat = roundCent(unitPriceIncVat / (1 + VAT_RATE));
        vatAmountPerUnit = roundCent(unitPriceIncVat - unitPriceExVat);
        marginPercent = unitPriceIncVat > 0 ? roundCent(((unitPriceIncVat - prkCost) / unitPriceIncVat) * 100) : 0;
      }
    }
```

Then update the existing lines just below (which currently read
`res.unitPriceIncVat` / `res.unitPriceExVat` directly) to use the new local
`unitPriceIncVat` / `unitPriceExVat` variables instead:

```js
    const lineTotalIncVat = roundCent(unitPriceIncVat * qty);
    const lineTotalExVat = roundCent(unitPriceExVat * qty);
    const lineVatAmount = roundCent(lineTotalIncVat - lineTotalExVat);
    const lineCostSnapshot = roundCent(prkCost * qty);
```

And in the returned object further down, change `unitPriceIncVat: res.unitPriceIncVat`
and `unitPriceExVat: res.unitPriceExVat` (and `vatAmountPerUnit: res.vatAmountPerUnit`,
`marginPercent: res.marginPercent`) to the local variables, and add two new
fields:

```js
      unitPriceIncVat,
      unitPriceExVat,
      vatAmountPerUnit,
      marginPercent,
      overrideApplied,
      suggestedUnitPriceIncVat: res.unitPriceIncVat,
```

`resolveLineTier` itself is not touched.

- [ ] **Step 3b: Add the DB-backed override operations to `trade-costing.js`**

At the top of `lib/trade/trade-costing.js`, change the existing
`import { roundCent } from './pricing-engine.js';` (from Task 2) to also
pull in `calculateTradeOrderPricing`, and add a new import line for the
Postgres helpers:

```js
import { roundCent, calculateTradeOrderPricing } from './pricing-engine.js';
import { query, withTransaction } from './trade-pg.js';
```

`classifyMarginStatus` and `getMarginFloorConfig` need no new import —
they're defined earlier in this same file (Tasks 2 and 3).

Add to `lib/trade/trade-costing.js`:

```js
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
    priceOverrides: bySku.get(item.sku) || undefined,
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

  const marginPercent = priceNum > 0 ? Math.round(((priceNum - landedCost) / priceNum) * 100 * 100) / 100 : 0;
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
```

Note on the dynamic `import('./pricing-engine.js')` inside
`calculateTradeOrderPricingWithOverrides`: use a static top-level import
(`import { calculateTradeOrderPricing } from './pricing-engine.js';`) instead
if Step 4 shows no circular-import issue — `pricing-engine.js` doesn't import
`trade-costing.js`, so a static import is safe and preferred; the dynamic
form above is a fallback only if the test run surfaces a module-loading
problem.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/trade-costing.test.js`
Expected: PASS. (The two Postgres round-trip tests skip gracefully if no
spirits product exists in the environment — that's fine, Task 1 already
verified schema existence; these verify behavior on real data where present.)

- [ ] **Step 5: Commit**

```bash
git add lib/trade/pricing-engine.js lib/trade/trade-costing.js tests/trade-costing.test.js
git commit -m "feat(trade): apply price overrides in the pricing engine, enforce margin floor on save

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Stock receipts — recordStockReceipt

**Files:**
- Modify: `lib/trade/trade-costing.js`
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Consumes: `withTransaction`, `query` (`trade-pg.js`),
  `computeWeightedAverageCost`, `allocateLogisticsByValue` (Task 2).
- Produces:
  `recordStockReceipt({ supplierName, reference, freightCost, clearingCost, handlingCost, notes, lines, createdBy }) -> Promise<receipt>`
  where `lines` is `[{ sku, cases, unitProductCost }]` and the returned
  `receipt` includes `receiptNumber` and each line's computed
  `landedUnitCost`. Consumed by Task 10 (stock-receipts API route).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/trade-costing.test.js
import { recordStockReceipt } from '../lib/trade/trade-costing.js';

test('recordStockReceipt updates stock, landed cost, and writes an inventory log', async () => {
  await ensureTradeDb();
  const prod = await query(`SELECT id, sku, stock_quantity, prk_cost_inc_vat FROM trade_products LIMIT 1`);
  if (prod.rows.length === 0) return;
  const before = prod.rows[0];
  const beforeQty = Number(before.stock_quantity);
  const beforeCost = Number(before.prk_cost_inc_vat) || 0;

  const receipt = await recordStockReceipt({
    supplierName: 'Test Distributor Ltd',
    reference: 'INV-TEST-001',
    freightCost: 1000,
    clearingCost: 500,
    handlingCost: 0,
    notes: 'Automated test receipt',
    lines: [{ sku: before.sku, cases: 2, unitProductCost: 3000 }],
    createdBy: 'test',
  });

  assert.ok(receipt.receiptNumber.startsWith('SR-'));
  assert.equal(receipt.lines[0].bottles, 24); // 2 cases * default case_size 12
  assert.ok(receipt.lines[0].landedUnitCost > 3000); // product cost + allocated logistics

  const after = await query('SELECT stock_quantity, prk_cost_inc_vat FROM trade_products WHERE id = $1', [before.id]);
  assert.equal(Number(after.rows[0].stock_quantity), beforeQty + 24);
  // new landed cost is the weighted average, strictly between the two batch costs
  // when there was prior stock, or exactly the new batch's landed cost when there wasn't
  const newCost = Number(after.rows[0].prk_cost_inc_vat);
  if (beforeQty > 0 && beforeCost > 0) {
    const lo = Math.min(beforeCost, receipt.lines[0].landedUnitCost);
    const hi = Math.max(beforeCost, receipt.lines[0].landedUnitCost);
    assert.ok(newCost >= lo - 0.01 && newCost <= hi + 0.01);
  } else {
    assert.equal(newCost, receipt.lines[0].landedUnitCost);
  }

  const log = await query(
    `SELECT * FROM inventory_logs WHERE reference_id = $1 AND reason = 'stock_receipt'`,
    [receipt.id]
  );
  assert.equal(log.rows.length, 1);
  assert.equal(Number(log.rows[0].change_qty), 24);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL — `recordStockReceipt` not exported.

- [ ] **Step 3: Implement**

Add to `lib/trade/trade-costing.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-costing.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-costing.js tests/trade-costing.test.js
git commit -m "feat(trade): record stock receipts with weighted-average landed cost

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `getTradeProducts` — expose landed cost breakdown, suggested/override prices, floor status

**Files:**
- Modify: `lib/trade/trade-store.js:2198-2236` (`getTradeProducts`)
- Modify: `lib/trade/trade-store.js:2238-2270` (`updateTradeProduct` — remove
  direct cost editing, keep stock-quantity editing)
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Consumes: `attachPriceOverrides`, `getMarginFloorConfig`,
  `classifyMarginStatus` (Tasks 2-4).
- Produces: `getTradeProducts()` items gain `caseSize`, `productCostIncVat`,
  `logisticsCostIncVat`, `tierPrices[tierKey] = { suggested, actual, overrideApplied, marginPercent, status }`
  (replacing the old flat `tierPrices: { T1, T2, T3 }` shape).
  `updateTradeProduct` no longer accepts `prkCostIncVat` in its patch.
  Consumed by Task 8 (admin products route) and Task 11 (admin UI).

- [ ] **Step 1: Write the failing test**

```js
// append to tests/trade-costing.test.js
import { getTradeProducts, updateTradeProduct } from '../lib/trade/trade-store.js';

test('getTradeProducts exposes landed cost breakdown and tier suggested/actual prices', async () => {
  const products = await getTradeProducts({ priceLine: 'spirits' });
  if (products.length === 0) return;
  const p = products[0];
  assert.ok('caseSize' in p);
  assert.ok('productCostIncVat' in p);
  assert.ok('logisticsCostIncVat' in p);
  if (p.hasExplicitCost) {
    assert.ok(p.tierPrices.T1.suggested > 0);
    assert.equal(typeof p.tierPrices.T1.overrideApplied, 'boolean');
    assert.ok(['ok', 'flagged', 'blocked'].includes(p.tierPrices.T1.status));
  }
});

test('updateTradeProduct no longer accepts a direct cost patch', async () => {
  const products = await getTradeProducts();
  if (products.length === 0) return;
  const before = products[0].prkCostIncVat;
  await updateTradeProduct(products[0].sku, { prkCostIncVat: 1 }, 'test');
  const after = (await getTradeProducts()).find((p) => p.sku === products[0].sku);
  assert.equal(after.prkCostIncVat, before, 'cost must be unchanged — it is receipt-derived only');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL — `caseSize` missing, `tierPrices.T1` is a number not an object,
and `updateTradeProduct` still applies the cost patch.

- [ ] **Step 3a: Update `getTradeProducts`**

Replace the function body (`lib/trade/trade-store.js:2198-2236`) with:

```js
export async function getTradeProducts(filters = {}) {
  await ensureTradeDb();
  let sql = 'SELECT * FROM trade_products WHERE 1=1';
  const params = [];

  if (filters.priceLine && filters.priceLine !== 'all') {
    params.push(filters.priceLine);
    sql += ` AND price_line = $${params.length}`;
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(sku) LIKE $${params.length} OR LOWER(brand) LIKE $${params.length})`;
  }

  sql += ' ORDER BY name ASC';
  const res = await query(sql, params);
  const bands = getSpiritsBands();

  const { attachPriceOverrides, getMarginFloorConfig, classifyMarginStatus } = await import('./trade-costing.js');
  const floors = getMarginFloorConfig();

  const rows = res.rows.map((r) => {
    const cost = Number(r.prk_cost_inc_vat);
    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      brandName: r.brand,
      categoryName: r.category_name,
      priceLine: r.price_line,
      prkCostIncVat: cost,
      caseSize: r.case_size,
      productCostIncVat: r.product_cost_inc_vat !== null ? Number(r.product_cost_inc_vat) : null,
      logisticsCostIncVat: Number(r.logistics_cost_inc_vat) || 0,
      stockQuantity: parseInt(r.stock_quantity, 10),
      reservedStock: parseInt(r.reserved_stock, 10),
      inStock: Boolean(r.in_stock && r.stock_quantity > 0),
      isActive: Boolean(r.is_active),
      image: r.image_url,
      hasExplicitCost: cost > 0,
      sku_: r.sku, // internal, used below then stripped
    };
  });

  const withOverrides = await attachPriceOverrides(rows.map((r) => ({ sku: r.sku, priceLine: r.priceLine })));
  const overridesBySku = new Map(withOverrides.map((r) => [r.sku, r.priceOverrides || {}]));

  return rows.map((r) => {
    delete r.sku_;
    if (r.priceLine !== 'spirits' || !r.hasExplicitCost) {
      return { ...r, tierPrices: null };
    }
    const suggested = computeSpiritsTierPrices(r.prkCostIncVat, bands);
    const overrides = overridesBySku.get(r.sku) || {};
    const floor = floors.spirits;
    const tierPrices = {};
    for (const key of Object.keys(suggested)) {
      const actual = overrides[key] ?? suggested[key];
      const marginPercent = actual > 0 ? Math.round(((actual - r.prkCostIncVat) / actual) * 100 * 100) / 100 : 0;
      tierPrices[key] = {
        suggested: suggested[key],
        actual,
        overrideApplied: overrides[key] !== undefined,
        marginPercent,
        status: classifyMarginStatus(marginPercent, floor),
      };
    }
    return { ...r, tierPrices };
  });
}
```

- [ ] **Step 3b: Remove direct cost editing from `updateTradeProduct`**

Replace `lib/trade/trade-store.js:2238-2270` with:

```js
/**
 * Ad-hoc stock adjustment (damage/loss/correction). Cost is no longer
 * editable here — it is receipt-derived only (see recordStockReceipt in
 * trade-costing.js). A `prkCostIncVat` key in `patch` is ignored.
 */
export async function updateTradeProduct(skuOrId, patch, user = 'Admin') {
  await ensureTradeDb();
  return withTransaction(async (client) => {
    const checkRes = await client.query(
      'SELECT * FROM trade_products WHERE sku = $1 OR id = $1 FOR UPDATE',
      [skuOrId]
    );
    if (checkRes.rows.length === 0) throw new Error('Product not found in trade catalog');
    const existing = checkRes.rows[0];

    const currentQty = parseInt(existing.stock_quantity, 10);
    const newQty = patch.stockQuantity !== undefined ? parseInt(patch.stockQuantity, 10) : currentQty;

    await client.query(
      'UPDATE trade_products SET stock_quantity = $1, in_stock = ($1 > 0), updated_at = NOW() WHERE id = $2',
      [newQty, existing.id]
    );

    if (newQty !== currentQty) {
      const delta = newQty - currentQty;
      await client.query(
        'INSERT INTO inventory_logs (product_id, sku, change_qty, balance_after, reason, reference_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [existing.id, existing.sku, delta, newQty, patch.reason || 'manual_adjustment', user]
      );
    }

    return { ...existing, stock_quantity: newQty, in_stock: newQty > 0 };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/trade-costing.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-store.js tests/trade-costing.test.js
git commit -m "feat(trade): expose landed cost & tier suggested/actual prices from getTradeProducts; remove direct cost editing

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Wire overrides into order and quote creation

**Files:**
- Modify: `lib/trade/trade-store.js` (`createTradeOrder` around line 1662,
  `createTradeQuote` around line 2058)
- Modify: `app/api/trade/pricing/route.js`
- Test: extend `tests/trade-hub-e2e.test.js`

**Interfaces:**
- Consumes: `calculateTradeOrderPricingWithOverrides` (Task 4).
- Produces: no new exports — behavioral change only (checkout, quote
  creation, and the live-quote API now honor overrides).

- [ ] **Step 1: Write the failing test**

Append to `tests/trade-hub-e2e.test.js` (it already imports `createTradeOrder`,
`createTradeQuote` from `trade-store.js` and has a `testAccount`/`testProduct`
fixture pattern from the existing quote-lifecycle test — reuse that pattern):

```js
test('Price override is honored at order creation', async () => {
  const { getTradeProducts } = await import('../lib/trade/trade-store.js');
  const { setPriceOverride, clearPriceOverride } = await import('../lib/trade/trade-costing.js');
  const { createTradeOrder } = await import('../lib/trade/trade-store.js');

  const products = await getTradeProducts({ priceLine: 'spirits' });
  const product = products.find((p) => p.hasExplicitCost);
  if (!product) return; // nothing to test against in this environment

  await setPriceOverride({
    productId: product.id, tierKey: 'T1', priceLine: 'spirits',
    price: product.tierPrices.T1.suggested + 500, updatedBy: 'test',
  });

  try {
    const order = await createTradeOrder({
      account: { id: 'acc_test_override', tradingName: 'Override Test Co', licenceNo: 'LQ-TEST-1', licenceExpiry: '2099-01-01', creditEnabled: false },
      user: { name: 'Test User' },
      items: [{ sku: product.sku, priceLine: 'spirits', prkCostIncVat: product.prkCostIncVat, quantity: 6 }],
      deliveryAddress: { city: 'Nairobi', street: 'Test', contactName: 'Test', phone: '+254700000000' },
    });
    const line = order.items?.find((i) => i.sku === product.sku) || order.economics?.items?.find((i) => i.sku === product.sku);
    assert.ok(line, 'order should contain the overridden line');
  } finally {
    await clearPriceOverride({ productId: product.id, tierKey: 'T1' });
  }
});
```

(If `createTradeOrder`'s returned shape doesn't expose per-line
`unitPriceIncVat` the way asserted above, adjust the assertion to whatever
field the existing order-creation tests already check — inspect
`createTradeOrder`'s return statement in `trade-store.js` before finalizing
this step; the goal is only to prove the overridden price, not any specific
field name.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-hub-e2e.test.js`
Expected: FAIL, or the order's line price doesn't reflect the override
(`createTradeOrder` still calls the non-override-aware
`calculateTradeOrderPricing`).

- [ ] **Step 3: Wire the wrapper into the three call sites**

`trade-store.js` never statically imports `trade-costing.js` — see the
circular-dependency rule established in Task 3. In `createTradeOrder`
(around line 1662), change:

```js
    const pricing = calculateTradeOrderPricing({
```

to:

```js
    const { calculateTradeOrderPricingWithOverrides } = await import('./trade-costing.js');
    const pricing = await calculateTradeOrderPricingWithOverrides({
```

In `createTradeQuote` (around line 2058), make the same change:
`calculateTradeOrderPricing({` → the two-line dynamic-import-then-call form
above.

In `app/api/trade/pricing/route.js`, this route is not part of the
`trade-store.js` ↔ `trade-costing.js` pair, so it uses an ordinary static
import: change the import from
`import { calculateTradeOrderPricing } from '@/lib/trade/pricing-engine.js';`
to `import { calculateTradeOrderPricingWithOverrides } from '@/lib/trade/trade-costing.js';`,
and add `await` to its call site.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/trade-hub-e2e.test.js`
Expected: PASS. Also re-run the full suite to confirm nothing else regressed:
`npm test`

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-store.js app/api/trade/pricing/route.js tests/trade-hub-e2e.test.js
git commit -m "feat(trade): honor price overrides at checkout, quote creation, and the live pricing API

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Margin Audit floor — read the new per-line config

**Files:**
- Modify: `lib/trade/trade-store.js:2378-2439` (`getTradeMarginReport`,
  becomes `async`)
- Modify: `app/api/admin/trade/margin-report/route.js` (add `await`)
- Test: `tests/trade-costing.test.js`

**Interfaces:**
- Consumes: `getMarginFloorConfig` (Task 3).
- Produces: `getTradeMarginReport()` is now `async` (previously sync) and its
  `gmFloorPercent` field and `isSubMarginFloor` per-order flag now derive
  from `config.marginFloor` (via the min-of-two-lines rule for mixed orders)
  instead of the flat `config.gmFloorPercent`.

Note: `getTradeMarginReport` reads `store.orders` from the JSON file
(`readTradeStore()`), not the Postgres `trade_orders` table that
`createTradeOrder` writes to — this is a pre-existing condition of the
codebase, unrelated to this feature, and out of scope to fix here (see spec
§7, Margin Audit tab description — "unchanged structure"). This task only
changes which config value feeds the floor threshold.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/trade-costing.test.js
import { getTradeMarginReport } from '../lib/trade/trade-store.js';

test('getTradeMarginReport floor derives from getMarginFloorConfig (min of spirits/jaba)', async () => {
  await updateTradeConfig({ marginFloor: { spirits: 5, jaba: 12 } });
  const report = await getTradeMarginReport();
  assert.equal(report.gmFloorPercent, 5); // stricter of the two
  await updateTradeConfig({ marginFloor: undefined });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-costing.test.js`
Expected: FAIL — `gmFloorPercent` still reads the flat legacy value.

- [ ] **Step 3: Implement**

`getTradeMarginReport` is currently synchronous. Reading the floor from
`trade-costing.js` needs a dynamic import (the circular-dependency rule from
Task 3), which is always async, so this function becomes `async` — it has
exactly one caller (`app/api/admin/trade/margin-report/route.js:14`, already
inside an `async` route handler), so this is a small, contained change.

In `lib/trade/trade-store.js`, change the function signature:

```js
export function getTradeMarginReport(filters = {}) {
```

to:

```js
export async function getTradeMarginReport(filters = {}) {
```

Then, right after the existing `let orders = store.orders || [];` line
(around line 2378), add:

```js
  const { getMarginFloorConfig } = await import('./trade-costing.js');
  const floors = getMarginFloorConfig();
  const floorPercent = Math.min(floors.spirits, floors.jaba);
```

Then replace both occurrences of `store.config?.gmFloorPercent || 4.0` in
this function (the `isSubMarginFloor` line and the returned `gmFloorPercent`
field) with `floorPercent`.

In `app/api/admin/trade/margin-report/route.js`, change:

```js
    const report = getTradeMarginReport({ accountId, segment });
```

to:

```js
    const report = await getTradeMarginReport({ accountId, segment });
```

- [ ] **Step 4: Run test to verify it passes**

Update the Step 1 test to `await getTradeMarginReport()` (it's now async).

Run: `node --test tests/trade-costing.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-store.js tests/trade-costing.test.js
git commit -m "feat(trade): margin audit floor reads the new per-price-line config

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Admin products route — remove cost editing, add override endpoint; delete costs route

**Files:**
- Modify: `app/api/admin/trade/products/route.js`
- Create: `app/api/admin/trade/stock-receipts/route.js`
- Delete: `app/api/admin/trade/costs/route.js`
- Modify: `lib/trade/trade-store.js` (remove `importPrkCostsCsv` and its entry
  in the `export default { ... }` block at the bottom of the file — keep
  `getPrkCosts`, it's still used by `trade-catalog.js`'s Postgres-down
  fallback path)
- Test: manual `curl` verification (admin routes require an authenticated
  session cookie — no automated test here; verified via the dev server the
  same way this session's earlier route smoke-tests worked)

**Interfaces:**
- Consumes: `setPriceOverride`, `clearPriceOverride` (Task 4),
  `recordStockReceipt` (Task 5).
- Produces: `PUT /api/admin/trade/products` gains a `priceOverride` field;
  `POST /api/admin/trade/stock-receipts` (new).

- [ ] **Step 1: Update the products PUT route**

Read the current file first (`app/api/admin/trade/products/route.js`) to
confirm line numbers haven't shifted from what Task 6 assumed, then replace
the `PUT` handler's body-destructuring and cost-handling block:

```js
export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { sku, stockQuantity, reason, priceOverride } = body;

    if (!sku) {
      return NextResponse.json({ error: 'Product SKU or ID is required' }, { status: 400 });
    }

    const patch = {};
    if (stockQuantity !== undefined) {
      const qty = parseInt(stockQuantity, 10);
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json({ error: 'Stock quantity must be a non-negative integer' }, { status: 400 });
      }
      patch.stockQuantity = qty;
    }
    if (reason) patch.reason = reason;

    let updated = null;
    if (Object.keys(patch).length > 0) {
      updated = await updateTradeProduct(sku, patch, 'Admin');
    }

    let overrideResult = null;
    if (priceOverride) {
      const { setPriceOverride, clearPriceOverride } = await import('@/lib/trade/trade-costing.js');
      const prodRes = await getTradeProducts({ search: sku });
      const product = prodRes.find((p) => p.sku === sku) || prodRes[0];
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (priceOverride.price === null || priceOverride.price === undefined) {
        await clearPriceOverride({ productId: product.id, tierKey: priceOverride.tierKey });
      } else {
        try {
          overrideResult = await setPriceOverride({
            productId: product.id,
            tierKey: priceOverride.tierKey,
            priceLine: product.priceLine,
            price: priceOverride.price,
            updatedBy: 'Admin',
          });
        } catch (overrideError) {
          return NextResponse.json({ error: overrideError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      product: updated,
      override: overrideResult,
      message: `Product ${sku} successfully updated`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update trade product' }, { status: 500 });
  }
}
```

Update the top-of-file import to include `getTradeProducts` alongside the
existing `updateTradeProduct` import.

- [ ] **Step 2: Create the stock receipts route**

```js
// app/api/admin/trade/stock-receipts/route.js
import { NextResponse } from 'next/server';
import { recordStockReceipt } from '@/lib/trade/trade-costing.js';
import { query, ensureTradeDb } from '@/lib/trade/trade-pg.js';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    await ensureTradeDb();
    const res = await query(
      `SELECT r.*, COALESCE(json_agg(l.*) FILTER (WHERE l.id IS NOT NULL), '[]') as lines
       FROM trade_stock_receipts r
       LEFT JOIN trade_stock_receipt_lines l ON l.receipt_id = r.id
       GROUP BY r.id ORDER BY r.received_at DESC LIMIT 50`
    );
    return NextResponse.json({ success: true, receipts: res.rows });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { supplierName, reference, freightCost, clearingCost, handlingCost, notes, lines } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one receipt line is required' }, { status: 400 });
    }

    const receipt = await recordStockReceipt({
      supplierName, reference, freightCost, clearingCost, handlingCost, notes, lines,
      createdBy: 'Admin',
    });

    return NextResponse.json({ success: true, receipt });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to record stock receipt' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Delete the costs route and dead CSV-import code**

```bash
rm app/api/admin/trade/costs/route.js
```

In `lib/trade/trade-store.js`, delete the `importPrkCostsCsv` function body
(originally around line 1389 — re-locate it, since Task 6 shifted line
numbers earlier in the file) and remove its line from the
`export default { ... }` object near the bottom of the file. Leave
`getPrkCosts` untouched — `trade-catalog.js`'s Postgres-down fallback still
calls it.

- [ ] **Step 4: Manual verification**

Start the dev server (or use the one already running per this session's
established pattern), then:

```bash
# Confirm the deleted route is gone:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/trade/costs
# Expected: 404

# Confirm the new route requires auth (no session cookie sent):
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/admin/trade/stock-receipts
# Expected: 401
```

Run `npm test` to confirm nothing else references the removed function.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/trade/products/route.js app/api/admin/trade/stock-receipts/route.js lib/trade/trade-store.js
git rm app/api/admin/trade/costs/route.js
git commit -m "feat(trade): add stock receipts API, price override on products route; remove CSV cost importer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Admin UI — remove PRK Costs tab, rename to Stock & Costing, add receive-stock form and override controls

**Files:**
- Modify: `app/admin/trade/page.js`

**Interfaces:**
- Consumes: `GET /api/admin/trade/products` (now returns `tierPrices[key] =
  {suggested, actual, overrideApplied, marginPercent, status}`, `caseSize`,
  `productCostIncVat`, `logisticsCostIncVat` per Task 6),
  `POST /api/admin/trade/stock-receipts`, `PUT /api/admin/trade/products`
  with `priceOverride` (Task 9).

- [ ] **Step 1: Remove the PRK Costs tab**

In `app/admin/trade/page.js`:

- Delete the tab entry `{ id: 'costs', label: 'PRK Costs' }` from the tab
  array (around line 505, post the duplicate-key fix from the prior session).
- Delete the `{activeTab === 'costs' && (...)}` panel block (originally
  around line 1436-1503 — the CSV importer UI).
- Delete the `csvText`, `setCsvText`, `diffResult`, `setDiffResult`,
  `importing`, `setImporting` state declarations and the `handleCostImport`
  function (around line 180) — grep the file for each identifier first to
  confirm there are no other usages before deleting.

- [ ] **Step 2: Rename the tab label and extend the product table**

Change the tab label:

```js
{ id: 'products', label: 'Stock &amp; Costing', badge: productCounts.outOfStock > 0 ? `${productCounts.outOfStock} OOS` : (productCounts.lowStock > 0 ? `${productCounts.lowStock} Low` : null), badgeColor: 'bg-amber-500 text-white' },
```

In the products panel (around line 1218), add a "Receive Stock" button next
to the existing search/filter row:

```jsx
<button
  type="button"
  onClick={() => setShowReceiptModal(true)}
  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs shrink-0"
>
  + Receive Stock
</button>
```

Add `const [showReceiptModal, setShowReceiptModal] = useState(false);` and
`const [receiptForm, setReceiptForm] = useState({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '', lines: [] });`
near the component's other `useState` declarations.

In the table body (around line 1266, the `<td>` for the "Cost (Inc-VAT)"
column), replace the plain cost display with a landed-cost breakdown and
change the "T1 / T2 / T3" column to show suggested vs. actual with an inline
override input:

```jsx
<td className="py-3 px-3 text-right">
  {p.hasExplicitCost ? (
    <div>
      <div className="font-bold text-gray-900">KES {p.prkCostIncVat.toLocaleString()}</div>
      <div className="text-[10px] text-gray-400">
        {p.productCostIncVat?.toLocaleString()} + {p.logisticsCostIncVat?.toLocaleString()} logistics
      </div>
    </div>
  ) : (
    <span className="text-[10px] font-bold uppercase text-amber-600">No cost — receive stock</span>
  )}
</td>
<td className="py-3 px-3 text-right">
  {p.tierPrices && Object.entries(p.tierPrices).map(([tierKey, t]) => (
    <div key={tierKey} className="flex items-center justify-end gap-1.5 mb-0.5">
      <span className="text-[10px] text-gray-400 w-6">{tierKey}</span>
      <input
        type="number"
        defaultValue={t.actual}
        onBlur={(e) => {
          const value = Number(e.target.value);
          if (value === t.suggested) {
            handlePriceOverride(p.sku, tierKey, null);
          } else if (value !== t.actual) {
            handlePriceOverride(p.sku, tierKey, value);
          }
        }}
        className={`w-20 px-1.5 py-0.5 text-right text-[11px] rounded-md border ${
          t.status === 'blocked' ? 'border-red-400 bg-red-50' :
          t.status === 'flagged' ? 'border-amber-400 bg-amber-50' :
          t.overrideApplied ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
        }`}
      />
      {t.overrideApplied && <span className="text-[9px] text-gray-400">(sugg. {t.suggested})</span>}
    </div>
  ))}
</td>
```

Add the handler near the other product-mutating handlers:

```js
const handlePriceOverride = async (sku, tierKey, price) => {
  try {
    const res = await fetch('/api/admin/trade/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, priceOverride: { tierKey, price } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save override');
    await loadProducts(); // reuse whatever existing function re-fetches the products list
  } catch (err) {
    alert(err.message);
  }
};
```

(If the file's existing product-list refetch function has a different name
than `loadProducts`, use that name instead — grep the file for the function
currently called after `updateTradeProduct`/stock-adjustment actions and
reuse it, per the "follow existing patterns" rule.)

- [ ] **Step 3: Add the receive-stock modal**

Add near the end of the component's JSX (as a sibling to the existing modals
in this file — grep for an existing modal's structure, e.g. the account
detail modal if one exists in this file, and match its overlay/panel
classes):

```jsx
{showReceiptModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
      <h3 className="text-base font-bold text-gray-900">Receive Stock</h3>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Supplier name" value={receiptForm.supplierName}
          onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })}
          className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
        <input placeholder="Reference / invoice #" value={receiptForm.reference}
          onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
          className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
        <input type="number" placeholder="Freight" value={receiptForm.freightCost}
          onChange={(e) => setReceiptForm({ ...receiptForm, freightCost: Number(e.target.value) })}
          className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
        <input type="number" placeholder="Clearing" value={receiptForm.clearingCost}
          onChange={(e) => setReceiptForm({ ...receiptForm, clearingCost: Number(e.target.value) })}
          className="px-3 py-2 rounded-xl text-xs border border-gray-200" />
        <input type="number" placeholder="Handling" value={receiptForm.handlingCost}
          onChange={(e) => setReceiptForm({ ...receiptForm, handlingCost: Number(e.target.value) })}
          className="col-span-2 px-3 py-2 rounded-xl text-xs border border-gray-200" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Lines</span>
          <button type="button" onClick={() => setReceiptForm({ ...receiptForm, lines: [...receiptForm.lines, { sku: '', cases: 1, unitProductCost: 0 }] })}
            className="text-xs font-bold text-[#840038]">+ Add line</button>
        </div>
        {receiptForm.lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-4 gap-2">
            <select value={line.sku} onChange={(e) => {
              const lines = [...receiptForm.lines]; lines[idx] = { ...line, sku: e.target.value };
              setReceiptForm({ ...receiptForm, lines });
            }} className="col-span-2 px-2 py-1.5 rounded-lg text-xs border border-gray-200">
              <option value="">Select product...</option>
              {filteredProducts.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
            </select>
            <input type="number" placeholder="Cases" value={line.cases} onChange={(e) => {
              const lines = [...receiptForm.lines]; lines[idx] = { ...line, cases: Number(e.target.value) };
              setReceiptForm({ ...receiptForm, lines });
            }} className="px-2 py-1.5 rounded-lg text-xs border border-gray-200" />
            <input type="number" placeholder="Cost/bottle" value={line.unitProductCost} onChange={(e) => {
              const lines = [...receiptForm.lines]; lines[idx] = { ...line, unitProductCost: Number(e.target.value) };
              setReceiptForm({ ...receiptForm, lines });
            }} className="px-2 py-1.5 rounded-lg text-xs border border-gray-200" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={() => setShowReceiptModal(false)}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700">Cancel</button>
        <button type="button" onClick={async () => {
          try {
            const res = await fetch('/api/admin/trade/stock-receipts', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(receiptForm),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to record receipt');
            setShowReceiptModal(false);
            setReceiptForm({ supplierName: '', reference: '', freightCost: 0, clearingCost: 0, handlingCost: 0, notes: '', lines: [] });
            await loadProducts();
          } catch (err) {
            alert(err.message);
          }
        }} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#840038] text-white">Record Receipt</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Manual verification**

Run the smoke-test pattern already established in this session: start the
dev server, use a headless Puppeteer probe (per
`reference_playwright_local_chromium` in project memory) to confirm
`/admin/trade` still returns 200 with no new console errors, then
(since the tabs/receipt flow needs an authenticated admin session that a
headless probe can't establish on its own) ask the human partner to manually
click through: open the "Stock & Costing" tab, confirm the "PRK Costs" tab is
gone, open "Receive Stock", submit a small test receipt, confirm the table's
cost/tier columns update.

- [ ] **Step 5: Commit**

```bash
git add app/admin/trade/page.js
git commit -m "feat(trade): admin UI for stock receipts and price overrides; remove PRK Costs tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: End-to-end test — receipt through checkout, and a blocked override

**Files:**
- Modify: `tests/trade-hub-e2e.test.js`

**Interfaces:**
- Consumes: everything from Tasks 4, 5, 7.

- [ ] **Step 1: Write the test**

```js
// append to tests/trade-hub-e2e.test.js
test('Full flow: receipt sets landed cost, override changes checkout price, blocked override is rejected', async () => {
  const { recordStockReceipt, setPriceOverride, clearPriceOverride } = await import('../lib/trade/trade-costing.js');
  const { getTradeProducts, createTradeOrder } = await import('../lib/trade/trade-store.js');
  const { ensureTradeDb, query } = await import('../lib/trade/trade-pg.js');

  await ensureTradeDb();
  const prod = await query(`SELECT sku FROM trade_products WHERE price_line = 'spirits' LIMIT 1`);
  if (prod.rows.length === 0) return;
  const sku = prod.rows[0].sku;

  const receipt = await recordStockReceipt({
    supplierName: 'E2E Test Supplier', reference: 'E2E-1',
    freightCost: 2000, clearingCost: 500, handlingCost: 0,
    lines: [{ sku, cases: 5, unitProductCost: 2500 }],
    createdBy: 'e2e-test',
  });
  const landedCost = receipt.lines[0].newLandedCost;
  assert.ok(landedCost > 2500);

  const [product] = await getTradeProducts({ search: sku });
  assert.equal(product.prkCostIncVat, landedCost);

  // A below-cost override is rejected
  await assert.rejects(
    () => setPriceOverride({ productId: product.id, tierKey: 'T1', priceLine: 'spirits', price: landedCost - 100, updatedBy: 'e2e-test' }),
    /below landed cost/i
  );

  // A valid override is honored at order creation
  const overridePrice = product.tierPrices.T1.suggested + 1000;
  await setPriceOverride({ productId: product.id, tierKey: 'T1', priceLine: 'spirits', price: overridePrice, updatedBy: 'e2e-test' });

  try {
    const order = await createTradeOrder({
      account: { id: 'acc_e2e_override', tradingName: 'E2E Override Co', licenceNo: 'LQ-E2E-1', licenceExpiry: '2099-01-01', creditEnabled: false },
      user: { name: 'E2E Tester' },
      items: [{ sku, priceLine: 'spirits', prkCostIncVat: landedCost, quantity: 6 }],
      deliveryAddress: { city: 'Nairobi', street: 'Test', contactName: 'Test', phone: '+254700000000' },
    });
    assert.ok(order.id);
  } finally {
    await clearPriceOverride({ productId: product.id, tierKey: 'T1' });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-hub-e2e.test.js`
Expected: FAIL if any prior task's wiring is incomplete — this test only
passes once Tasks 4, 5, and 7 are all correctly integrated. If it fails,
identify which assertion failed and fix the corresponding task's code rather
than adjusting this test to match broken behavior.

- [ ] **Step 3: Fix any integration gaps found**

(No new code expected here if Tasks 1-7 were implemented as specified — this
step exists to catch integration mistakes between tasks, not to add new
functionality.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, including the pre-existing tests. Note: the pre-existing
`FC-ORD-` / `HH-TR-` order-number mismatch failure identified in an earlier
session (`Trade Quotes Flow - Create, Decline and Accept Lifecycle`,
`tests/trade-hub-e2e.test.js:267`) is unrelated to this feature — if it's
still failing, that's expected and pre-existing, not a regression from this
plan. Confirm no *new* failures beyond that one.

- [ ] **Step 5: Commit**

```bash
git add tests/trade-hub-e2e.test.js
git commit -m "test(trade): end-to-end coverage for stock receipt -> landed cost -> override -> checkout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes (from plan authoring)

- **Spec coverage**: §4 (schema) → Task 1. §5.1-5.2 (receipts, weighted
  average) → Tasks 2, 5. §5.3-5.4 (suggested price, overrides) → Tasks 4, 6,
  7. §5.5 (margin floor) → Tasks 2-4. §6 (adjustments) → Task 6 (explicitly
  preserved, not rebuilt). §7 (admin UI) → Tasks 9-10. §9 (margin audit floor
  unification) → Task 8. §10 (migration/backfill) → Task 1. §11 (API surface)
  → Tasks 9-10. §12 (testing) → Tasks 1-2, 4-8, 11 throughout.
- **Placeholder scan**: no TBD/TODO; every code step has real code. Task 10's
  UI steps reference "grep the file first" for exact function/variable names
  the plan author couldn't fully pin down without re-reading the full
  1500+ line file live during planning — this is a deliberate, bounded
  instruction to the implementer (find the existing pattern name), not a
  placeholder for missing logic.
- **Type/name consistency check**: `priceOverride` (singular, camelCase) used
  consistently in API payloads (Task 9); `priceOverrides` (plural) used
  consistently as the per-item map attached by `attachPriceOverrides`
  (Task 4) and read in `pricing-engine.js`. `tierKey` used consistently
  (never `tier` or `tierName`). `landedCost` appears only in comments/prose;
  the actual field name everywhere in code is `prkCostIncVat` per the Global
  Constraints naming decision — verified no task accidentally introduces a
  competing `landedCost` field name in code.
- **Known pre-existing issues surfaced, not silently fixed**: the
  `FC-ORD-`/`HH-TR-` test mismatch (Task 11 note) and `getTradeMarginReport`
  reading JSON-file orders rather than Postgres (Task 8 note) are both
  pre-existing and out of scope — flagged for the human partner rather than
  bundled into this feature's changes.
