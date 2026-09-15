# B2B Stock & Costing System — Design Spec

Status: approved by user 2026-09-15 ("Sure, proceed with implementation")
Replaces: the "PRK Costs" admin tab and its single-figure cost model.

## 1. Problem

The trade hub currently has:

- One cost figure per product (`trade_products.prk_cost_inc_vat`), hand-typed via
  a CSV importer (the "PRK Costs" tab). It captures neither logistics cost nor a
  history of what stock actually cost to bring in.
- B2B stock (`trade_products.stock_quantity`) that is already a separate
  PostgreSQL-backed pool from WordPress retail stock — this part is *already
  built* (`lib/trade/trade-pg.js`, `inventory_logs`). What's missing is a proper
  way to *receive* stock (currently only ad-hoc quantity edits) and no case/bulk
  handling.
- Selling price fully auto-derived from cost via fixed markup tiers
  (`lib/trade/pricing-engine.js`), with no per-product/tier override and no
  guardrail against a low-margin override.

Goal: a single "Stock & Costing" system where receiving stock is how cost enters
the system (product cost + logistics, weighted-averaged into a landed cost),
where the tier engine still suggests a price but admins can override it per
product/tier, and where an override that erodes margin too far is visibly
flagged (or blocked, if it's below cost).

## 2. Decisions carried from brainstorming

1. **Pricing**: suggested price (from landed cost × existing markup tiers) +
   admin override per product/tier. Show suggested vs actual, flag when actual
   is below the configured margin floor.
2. **Stock**: fully independent B2B pool (already true). WordPress/WooCommerce
   sync continues to supply product metadata only (name, image, category,
   brand) and never writes `stock_quantity`.
3. **Units**: track **cases** at receiving and on the product record
   (`case_size`), convert to bottles for the existing bottle-based tier bands,
   minimum-order rule, and per-bottle pricing — no changes to the pricing
   engine's units.
4. **Logistics**: captured per **Stock Receipt** (a batch: product cost total +
   freight/clearing/handling), allocated across the units received, rolled into
   a running **weighted-average landed cost** per product.
5. **Margin floor**: a configured minimum margin % per price line (spirits,
   jaba), measured against landed cost. Below floor → save allowed but flagged.
   Below landed cost (negative margin) → save blocked.

## 3. Naming decision (reduces blast radius)

`prk_cost_inc_vat` / `prkCostIncVat` is threaded through
`pricing-engine.js` (`resolveLineTier`'s parameter name), `trade-catalog.js`,
checkout, invoices, delivery notes, PDFs, and the margin report — over a dozen
call sites, none of which care *how* the cost was derived, only that it's "the
cost basis the markup is applied to."

**Decision: keep the column and field name `prk_cost_inc_vat` /
`prkCostIncVat`.** Its value becomes the computed landed cost instead of a
hand-typed figure. This means:

- The pricing engine, checkout, invoicing, PDFs, and margin report are
  **unchanged** — they keep reading the same field, now populated from receipts
  instead of a CSV import.
- Only the admin-facing **labels** change ("PRK Cost" → "Landed Cost"), not the
  underlying field.
- New columns (`product_cost_inc_vat`, `logistics_cost_inc_vat`) exist
  alongside it purely as the components that produce it, for display/audit.

This is the single biggest scope-reduction in this design: it turns what could
be a cost-field rename across ~15 files into an additive schema change.

## 4. Data model

All new tables/columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and
`CREATE TABLE IF NOT EXISTS` in `ensureTradeDb()` (`lib/trade/trade-pg.js`),
consistent with the existing pattern. Nothing is dropped.

### 4.1 `trade_products` — new columns

| Column | Type | Meaning |
|---|---|---|
| `case_size` | INT, default 12 | Bottles per case for receiving/display. Doesn't change pricing units. |
| `product_cost_inc_vat` | NUMERIC(10,2), nullable | Weighted-average per-bottle product cost component. |
| `logistics_cost_inc_vat` | NUMERIC(10,2), default 0 | Weighted-average per-bottle logistics component. |
| `prk_cost_inc_vat` | *(existing)* | Becomes `product_cost_inc_vat + logistics_cost_inc_vat` (landed cost), recomputed on each stock receipt. Kept as-is so nothing downstream changes. |

`hasExplicitCost` (already computed as `cost > 0` in `getTradeProducts`) keeps
its meaning: a product with no receipts yet has `prk_cost_inc_vat = 0` /
`NULL` and is flagged as missing cost, same as today.

### 4.2 `trade_stock_receipts` (new)

One row per goods-received batch ("Stock Receipt" — deliberately not "GRN",
which `trade-documents.js` already uses for the outbound customer delivery
note).

| Column | Type |
|---|---|
| `id` | VARCHAR(64) PK |
| `receipt_number` | VARCHAR(64) UNIQUE — `SR-0001` style, own sequence |
| `received_at` | TIMESTAMPTZ |
| `supplier_name` | VARCHAR(255), nullable free text (no supplier table — out of scope, see §8) |
| `reference` | VARCHAR(128), nullable — supplier invoice/PO number, free text |
| `freight_cost` | NUMERIC(12,2) default 0 |
| `clearing_cost` | NUMERIC(12,2) default 0 |
| `handling_cost` | NUMERIC(12,2) default 0 |
| `notes` | TEXT |
| `created_by` | VARCHAR(255) — admin identifier |
| `created_at` | TIMESTAMPTZ |

### 4.3 `trade_stock_receipt_lines` (new)

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `receipt_id` | VARCHAR(64) REFERENCES trade_stock_receipts(id) ON DELETE CASCADE |
| `product_id` | VARCHAR(64) REFERENCES trade_products(id) |
| `sku` | VARCHAR(128) |
| `cases` | NUMERIC(10,2) — allows part-cases |
| `bottles` | INT — `cases * case_size`, stored so a later `case_size` edit doesn't retroactively change history |
| `unit_product_cost_inc_vat` | NUMERIC(10,2) — this batch's product cost per bottle |
| `allocated_logistics_per_unit` | NUMERIC(10,2) — this line's share of the receipt's freight+clearing+handling, allocated by value (see §5.2) |
| `landed_unit_cost` | NUMERIC(10,2) — `unit_product_cost_inc_vat + allocated_logistics_per_unit`, this batch only (not the running average) |

### 4.4 `trade_price_overrides` (new)

Per-product, per-tier selling-price overrides. Absence of a row = use the
suggested (auto) price for that tier.

| Column | Type |
|---|---|
| `id` | SERIAL PK |
| `product_id` | VARCHAR(64) REFERENCES trade_products(id) ON DELETE CASCADE |
| `tier_key` | VARCHAR(8) — `T0`..`T4` per price line's band keys |
| `price_inc_vat` | NUMERIC(10,2) — spirits stores inc-VAT to match the tier engine; jaba stores **ex-VAT** to match `price_ex_vat`'s existing convention (see §5.4) |
| `updated_by` | VARCHAR(255) |
| `updated_at` | TIMESTAMPTZ |

UNIQUE (`product_id`, `tier_key`).

### 4.5 Config — new key

**Correction from an earlier draft of this spec**: the Postgres `trade_config`
table (`lib/trade/trade-pg.js`) is write-only dead code — it's populated once
by `migrateFromJsonIfEmpty` and never read back anywhere. The actual,
authoritative config store is `data/trade-store.json`'s `config` object,
read synchronously via `readTradeStore()` and written via
`updateTradeConfig()` (a shallow merge — `lib/trade/trade-store.js:2544`),
already exposed at `GET/PUT /api/admin/trade/config`. `config.marginFloor` is
a new key in that same JSON object, patched through the existing route — no
new table, no new endpoint.

Existing `config.priceBands` is untouched. New key `config.marginFloor`:

```json
{ "spirits": 3.0, "jaba": 8.0 }
```

Percent, measured against landed cost, per §5.5.

**Resolves a pre-existing floor**: `config.gmFloorPercent` (a single flat
number, default 4.0) already exists and drives the Margin Audit tab's
sub-floor flag on *realized order margin* (`trade-store.js:2416,2433`). This
is being unified with the new per-price-line floor rather than left as a
second, disconnected concept — a flat 4% is a poor fit once jaba's real
margin becomes visible (currently hardcoded to a fictional 62.5%, so 4% never
mattered for it; spirits typically run 4-10% per the existing tier markups,
so 4% is barely a floor at all there). Migration: if `config.marginFloor` is
absent, it's derived once as `{ spirits: gmFloorPercent, jaba: gmFloorPercent
}` from the legacy flat value, so the Margin Audit tab's behavior doesn't
silently change on deploy — an admin then adjusts the two lines independently
going forward. `gmFloorPercent` itself is left in place (unread after
migration) rather than deleted, same rationale as §10.3.

`inventory_logs` needs no schema change — a stock receipt writes one row per
line with `reason = 'stock_receipt'` and `reference_id = receipt.id`, same
shape as existing adjustment/order rows.

## 5. Cost & pricing engine

New module `lib/trade/trade-costing.js` (pure functions, unit-testable —
mirrors how `pricing-engine.js` is already separated from the store).

### 5.1 Recording a receipt

`recordStockReceipt({ supplierName, reference, freightCost, clearingCost,
handlingCost, notes, lines, createdBy })` where `lines` is
`[{ sku, cases }, ...]`:

1. Look up each product, compute `bottles = cases * case_size`.
2. Ask the admin for this batch's **product cost per bottle** for each line —
   this is manual entry (that's the actual invoice cost from the supplier),
   not derived. See §7 for the entry form.
3. Allocate the receipt's `freight_cost + clearing_cost + handling_cost`
   across lines **by value** (each line's share of total product cost in the
   batch), then per bottle within the line. Value-based allocation is more
   defensible than per-bottle or per-case for mixed shipments (a case of
   Chivas 18 and a case of Krest tonic don't cost the same to insure/clear).
4. Insert one `trade_stock_receipt_lines` row per line with the batch's own
   landed cost (§4.3), for audit — this is never overwritten.
5. Recompute the running weighted average (§5.2) and update
   `trade_products.product_cost_inc_vat`, `logistics_cost_inc_vat`,
   `prk_cost_inc_vat`, `case_size` (if changed), `stock_quantity += bottles`.
6. Write `inventory_logs` rows (existing table) and `trade_stock_receipts` /
   `_lines`, all inside one `withTransaction` (existing helper).

### 5.2 Weighted average

```
existing_value = stock_quantity_before * prk_cost_inc_vat_before
new_value      = bottles_received * landed_unit_cost_this_batch
new_avg        = (existing_value + new_value) / (stock_quantity_before + bottles_received)
```

If `stock_quantity_before` is 0 (new product or fully sold out), the new
average is just this batch's landed cost — no special-casing needed, the
formula degenerates correctly.

This mirrors the worked example approved in brainstorming (60 @ 2,900 + 240 @
2,985 → 2,968).

### 5.3 Suggested price

Unchanged pricing engine, called with the updated `prk_cost_inc_vat`
(landed cost) exactly as it is today — `resolveLineTier` needs no changes.
"Suggested" = what that function already returns.

### 5.4 Overrides — verified integration point

**Correction from an earlier draft**: this spec originally named
`trade-catalog.js`'s `resolveTradeLineItems` as "the one real integration
point." That's wrong — `resolveTradeLineItems` never calls `resolveLineTier`;
it only resolves catalog data (sku, cost, stock). The actual choke point for
tier pricing is `calculateTradeOrderPricing` in `pricing-engine.js`, which
calls `resolveLineTier` per line and is the single function every
order-pricing path funnels through — confirmed 5 call sites:
`app/api/trade/pricing/route.js`, `lib/trade/trade-context.js` (client-side
cart display), and three in `lib/trade/trade-store.js`
(`createTradeOrder`, `createTradeQuote`, plus the admin quote route passing
straight through).

Also: `resolveLineTier` already has a `tierOverride` parameter — that's a
**different, pre-existing concept** (an account-level forced tier key, e.g.
"this account always prices at T2"), unrelated to a per-product selling-price
override. To avoid collision, the new per-product/tier price override is
named `priceOverride` everywhere in code and API payloads — never
`tierOverride`.

**`pricing-engine.js` must stay pure** — its own docblock says "zero external
dependencies," and `trade-context.js` calls `calculateTradeOrderPricing`
directly from the browser bundle for live cart display. It cannot do a DB
fetch. So:

- `calculateTradeOrderPricing` gains a small, pure addition to its per-line
  loop: after computing `res` from `resolveLineTier`, check
  `item.priceOverrides?.[res.tierKey]` (a plain object already attached to
  the item — not fetched by this function). If present and `res.eligible`,
  override `unitPriceIncVat` / `unitPriceExVat` / `vatAmountPerUnit` /
  `marginPercent` (recomputed against the override), and set
  `overrideApplied: true` plus `suggestedUnitPriceIncVat: res.unitPriceIncVat`
  on the returned line so the UI can show suggested-vs-actual. Line totals
  are computed from the (possibly overridden) unit price, same as today.
  `resolveLineTier` itself is unchanged — it stays the "what would this cost
  with no override" oracle.
- New `lib/trade/trade-costing.js` exports `attachPriceOverrides(items)`
  (async, batch-queries `trade_price_overrides` joined to `trade_products` on
  `sku` — every caller's items reliably carry `.sku`, confirmed from
  `resolveLineTier({ sku: item.sku || item.id, ... })`) and
  `calculateTradeOrderPricingWithOverrides(args)`, a thin async wrapper that
  awaits `attachPriceOverrides(args.items)` then calls the pure
  `calculateTradeOrderPricing` with the result.
- The **server-side** call sites switch to the wrapper: `createTradeOrder`,
  `createTradeQuote` (both in `trade-store.js`), and
  `app/api/trade/pricing/route.js`. `createTradeOrder`'s items are already
  documented as "must have been resolved through trade-catalog.js" — that
  invariant is unchanged, this just adds one more resolved field.
- **`trade-context.js` (client-side) is explicitly out of scope** — it keeps
  calling the pure function directly and will keep showing the suggested
  (non-overridden) price as its live estimate. This is fine: the pricing
  route's own docblock already documents it as the authoritative live quote
  ("so a quote here matches what /api/trade/checkout will actually charge"),
  which *does* get the wrapper. The client estimate has never been
  authoritative; it just becomes "estimate may differ from an overridden
  price," same as it already can differ slightly from server rounding today.
- Quotes are a price **snapshot at creation time** (already true for cost —
  `acceptTradeQuote` replays the quote's stored line items rather than
  re-pricing). Overrides follow the same rule: applied when the quote is
  created, not re-applied at acceptance if the override changes in between.
  No new code needed for this — it falls out of `acceptTradeQuote` already
  not re-invoking the pricing engine.

Jaba's override price is stored **ex-VAT** to match `price_ex_vat`'s existing
convention in `DEFAULT_PRICE_BANDS.jaba` — an admin typing a jaba override sees
the same "ex-VAT" framing the flat bands already use, and the override
short-circuits the *unit_price_ex_vat* before the existing inc-VAT derivation
(`unitPriceIncVat = unitPriceExVat + vatAmountPerUnit`) — so VAT math is still
computed once, in one place, not duplicated per override.

### 5.5 Margin floor enforcement

On override save (`PUT /api/admin/trade/products` or a new dedicated
endpoint, see §7):

```
margin% = (effectivePrice - landedCost) / effectivePrice * 100   // spirits, inc-VAT basis
margin% = (effectivePriceExVat - landedCost) / effectivePriceExVat * 100  // jaba, ex-VAT basis (landed cost has no VAT component to net out — see §8 note)
```

- `margin% < 0` (selling below landed cost) → **reject**, 400 with a clear
  message. No silent loss-making prices.
- `0 <= margin% < config.marginFloor[priceLine]` → **save, but flag**. The
  Margin Audit tab and the product table both show a warning badge.
- `margin% >= floor` → save clean.

Jaba currently has no landed cost tracked at all (`prkCostIncVat: 0` for jaba
in the pricing engine, margin hardcoded to 62.5%). Stock receipts apply to
jaba products the same as spirits — once a jaba product has a receipt, its
landed cost and real margin become known and this hardcoded 62.5% is replaced
by the computed figure. Jaba products with zero receipts keep displaying
"cost unknown" (same treatment as spirits with no cost) rather than a fake
number.

## 6. Stock adjustments (non-receipt)

The existing ad-hoc "edit stock_quantity" path in `updateTradeProduct` stays,
for damage/loss/correction — it already writes `inventory_logs`. No change
needed there; it's orthogonal to receipts (receipts always *increase* stock
and *set* cost; adjustments can move stock either way and never touch cost).

## 7. Admin UI changes (`app/admin/trade/page.js`)

- **Remove** the "PRK Costs" tab (CSV importer) entirely — its function is
  superseded by receipts. (No CSV import equivalent is being rebuilt; if a
  bulk supplier price list needs importing later, it becomes "bulk receipt
  entry," which is out of scope for this pass — see §8.)
- **Rename** "Live Stock & Catalog" tab to **"Stock & Costing"**. Its existing
  table (Product / Price Line / Live Stock / Cost / T1-T3) gains:
  - A landed-cost breakdown on hover/expand: product cost + logistics = landed.
  - Suggested vs. actual (override) price per tier, with a distinct visual
    treatment when a tier is overridden.
  - The sub-floor warning badge from §5.5.
  - A **"Receive Stock"** button opening a form: pick product(s), cases,
    product cost/bottle, then a batch-level freight/clearing/handling entry —
    i.e., §5.1 as a UI. Supports multiple product lines per receipt (one
    delivery, many SKUs).
  - An inline **override** control per tier cell (click to type a price,
    clear to revert to suggested).
- **Margin Audit tab**: unchanged structure (it already reports realized
  order-level margin against `config.priceBands`-derived cost, and already has
  a floor concept — `gmFloorPercent`, `isSubMarginFloor`). Confirm/align its
  existing floor source with the new `config.marginFloor` rather than
  introducing a second floor concept — see open question in §9.

## 8. Explicitly out of scope

- Supplier records / purchase orders / any procurement workflow beyond a free-
  text supplier name and reference per receipt.
- FIFO or lot-level costing — weighted average only.
- Multi-warehouse stock.
- A bulk CSV import for receipts (receipts are entered one batch at a time
  through the form). Can be added later without a data model change.
- Changing `case_size` does not retroactively touch past receipt lines
  (`trade_stock_receipt_lines.bottles` is a stored snapshot).

## 9. Margin Audit tab and the new floor

`isSubMarginFloor` (`trade-store.js:2416`) keeps its existing logic — compare
a realized order's margin% to a floor — but reads the per-price-line
`config.marginFloor[order's dominant price line]` instead of the flat
`gmFloorPercent`. An order can mix spirits and jaba lines; the report already
computes margin at the order level, so it uses the **lower** of the two
configured floors for a mixed order (the stricter one), rather than adding
per-line floor logic to an order-level report — simplest rule that doesn't
regress any existing single-price-line order.

## 10. Migration plan

1. `ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS ...` for the four new
   columns (§4.1), `CREATE TABLE IF NOT EXISTS` for the three new tables
   (§4.2–4.4), added to `createSchema()` in `trade-pg.js` — runs automatically
   via `ensureTradeDb()`, same as every existing table.
2. One-time backfill (separate from the existing `migrateFromJsonIfEmpty`,
   which only fires when `trade_accounts` is empty and has therefore already
   run on this environment): for every `trade_products` row where
   `product_cost_inc_vat IS NULL` and `prk_cost_inc_vat > 0`, set
   `product_cost_inc_vat = prk_cost_inc_vat`, `logistics_cost_inc_vat = 0`,
   `case_size = 12` (Kenyan spirits-industry default). This treats "whatever
   cost was already on file" as the opening landed cost with zero logistics,
   so nothing regresses to "missing cost" on migration. Gated by the `IS NULL`
   check, so it's safe to run on every `ensureTradeDb()` call (idempotent,
   only touches unmigrated rows).
3. `data/trade-store.json`'s `prkCosts` map and `lastCostImport` field become
   dead after migration — leave them in place (harmless) rather than deleting,
   since `trade-store.json` is also a DB-down fallback path elsewhere in the
   codebase.

## 11. API surface (new/changed routes)

- `POST /api/admin/trade/stock-receipts` — create a receipt (§5.1). Returns
  the receipt with computed landed costs per line.
- `GET /api/admin/trade/stock-receipts` — list, for an audit view (optional
  for v1; not required by the brainstorming conversation, cut if time-boxed).
- `PUT /api/admin/trade/products` (existing route) currently accepts
  `{ sku, stockQuantity, prkCostIncVat, reason }` and patches both fields
  directly. Its `stockQuantity` handling is **unchanged** — this is the §6
  ad-hoc adjustment path (damage/loss/correction) and stays exactly as-is.
  Its `prkCostIncVat` handling is **removed** — direct cost editing no longer
  exists; cost is receipt-derived (§5.1) only. The route gains a new field,
  `priceOverride: { tierKey, price } | null` (null clears the override for
  that tier), to set/clear a `trade_price_overrides` row, going through the
  §5.5 floor check. Named `priceOverride`, not `tierOverride`, to avoid
  colliding with the pre-existing account-level `tierOverride` concept
  (§5.4).
- `DELETE /api/admin/trade/costs/route.js` — this route (the CSV importer
  backend) is removed along with the tab.

## 12. Testing plan

- Unit tests for `trade-costing.js`: weighted-average math (incl. zero-stock
  case), value-based logistics allocation, margin-floor classification
  (clean/flagged/blocked boundaries).
- Extend `tests/trade-hub-e2e.test.js` with a receipt → landed cost → tier
  price → checkout flow, and an override → margin-floor-blocked case.
- Manual smoke test of the new admin UI (Stock & Costing tab, receipt form)
  per this session's established pattern (headless Puppeteer probe +
  `/admin/trade` route check), since admin routes require authenticated
  session and can't be fully driven headlessly without credentials.
