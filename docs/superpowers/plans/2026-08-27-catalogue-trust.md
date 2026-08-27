# Catalogue Trust Implementation Plan (Stages 1–2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cached catalogue trustworthy — never display or sell an out-of-stock item — and make every integration failure visible instead of silent.

**Architecture:** WooCommerce stays the source of truth. The local JSON cache serves reads. Three stock gates (hide from listings, block at add-to-cart, revalidate at order creation) mean a stale cache can never complete a sale it shouldn't. An append-only event log records every integration boundary so failures surface on an admin health page rather than disappearing.

**Tech Stack:** Next.js 16.2.11 (App Router, Turbopack), React 19.2.4, Node 22, `node:test`, Tailwind v4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-27-fast-storefront-design.md`

## Global Constraints

- Node's built-in test runner only. Tests live in `tests/*.test.js`, run with `npm test` (`node --test "tests/**/*.test.js"`). All 30 existing tests must stay green.
- `lib/data-store.js` is **CommonJS** (`require` / `module.exports`). `lib/*.js` elsewhere is ESM. A module imported by both must be CommonJS — see `lib/atomic-json.js` for the precedent.
- Modules under `lib/` import each other by **relative path** (`./foo.js`), never the `@/` alias — the alias is webpack-only and breaks `node --test`. Route handlers under `app/` may use `@/`.
- All writes to `data/store.json` go through `mutateStore` or `writeStore` (atomic, locked). Never `fs.writeFileSync` directly.
- Every admin route calls `adminGuard(request)` as its first statement and returns the denial before anything else.
- Never log credentials, full customer addresses, or email addresses.
- WooCommerce calls go through `lib/wc-config.js` helpers (`wcFetch`, `wcFetchAll`, `wcPut`), which carry Basic auth. Never build a WooCommerce URL with credentials in the query string.
- Read `node_modules/next/dist/docs/` before using a Next.js API you have not used in this repo. This version renamed Middleware to Proxy; other APIs may differ from training data.

---

### Task 1: Integration event log

**Files:**
- Create: `lib/event-log.js`
- Test: `tests/event-log.test.js`

**Interfaces:**
- Produces: `recordEvent({ kind, outcome, durationMs, detail, correlationId }) -> void`, `readEvents({ limit, kind, outcome }) -> Event[]`, `summarise(events) -> { byKind, failureRate, lastFailureAt }`, `timed(kind, fn, detail) -> Promise<any>`, and the constants `EVENT_KINDS` and `OUTCOMES`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/event-log.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { recordEvent, readEvents, summarise, timed, EVENT_KINDS, OUTCOMES, __resetForTests } =
  await import('../lib/event-log.js');

test('records an event and reads it back newest first', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK, durationMs: 12, detail: 'products' });
  recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.FAIL, durationMs: 3, detail: 'bad signature' });

  const events = readEvents({ limit: 10 });
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, EVENT_KINDS.WEBHOOK, 'newest first');
  assert.equal(events[1].detail, 'products');
  assert.ok(events[0].ts, 'every event is timestamped');
});

test('filters by kind and outcome', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK });

  assert.equal(readEvents({ kind: EVENT_KINDS.GEOCODE }).length, 2);
  assert.equal(readEvents({ outcome: OUTCOMES.FAIL }).length, 1);
});

test('is capped so it cannot grow without bound', () => {
  __resetForTests();
  for (let i = 0; i < 2500; i++) {
    recordEvent({ kind: EVENT_KINDS.WC_CALL, outcome: OUTCOMES.OK, detail: `call-${i}` });
  }
  const events = readEvents({ limit: 5000 });
  assert.ok(events.length <= 2000, `expected cap at 2000, got ${events.length}`);
  assert.equal(events[0].detail, 'call-2499', 'the newest event survives');
});

test('never stores credentials or email addresses', () => {
  __resetForTests();
  recordEvent({
    kind: EVENT_KINDS.WC_CALL,
    outcome: OUTCOMES.FAIL,
    detail: 'failed for chris@5dm.africa with consumer_secret=cs_abc123',
  });
  const [event] = readEvents({});
  assert.ok(!event.detail.includes('chris@5dm.africa'), 'email redacted');
  assert.ok(!event.detail.includes('cs_abc123'), 'secret redacted');
  assert.match(event.detail, /\[redacted\]/);
});

test('summarise reports failure rate per kind', () => {
  __resetForTests();
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });
  recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.FAIL });

  const s = summarise(readEvents({}));
  assert.equal(s.byKind[EVENT_KINDS.GEOCODE].total, 3);
  assert.equal(s.byKind[EVENT_KINDS.GEOCODE].failed, 2);
  assert.ok(s.lastFailureAt, 'the most recent failure is reported');
});

test('timed records duration and re-throws on failure', async () => {
  __resetForTests();

  const value = await timed(EVENT_KINDS.WC_CALL, async () => 'ok', 'products');
  assert.equal(value, 'ok');
  assert.equal(readEvents({})[0].outcome, OUTCOMES.OK);

  await assert.rejects(
    () => timed(EVENT_KINDS.WC_CALL, async () => { throw new Error('origin down'); }, 'orders'),
    /origin down/
  );
  const [failure] = readEvents({});
  assert.equal(failure.outcome, OUTCOMES.FAIL);
  assert.match(failure.detail, /origin down/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/event-log.test.js`
Expected: FAIL — `Cannot find module '../lib/event-log.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/event-log.js`. In-memory ring buffer, not the JSON store — this records failures *of* the store, so it must not depend on it.

```js
/**
 * Integration event log.
 *
 * Records the outcome of every crossing into an external system —
 * WooCommerce, Paystack, the geocoder, webhooks — so a failure surfaces on
 * the admin health page instead of vanishing into a console nobody reads.
 * Two live examples this exists to catch: the browser-side geocoder blocked
 * by our own CSP, and the WooCommerce REST API refused by NinjaFirewall.
 *
 * Deliberately in-memory: it records failures OF the JSON store, so writing
 * to that store would lose exactly the events that matter most. It resets on
 * restart, which is acceptable for an operational dashboard.
 */

export const EVENT_KINDS = {
  WC_CALL: 'wc_call',
  WEBHOOK: 'webhook',
  GEOCODE: 'geocode',
  ORDER: 'order',
  PAYMENT: 'payment',
  SYNC: 'sync',
};

export const OUTCOMES = { OK: 'ok', FAIL: 'fail', SKIPPED: 'skipped' };

const MAX_EVENTS = 2000;
const MAX_DETAIL = 300;

/** Newest last; readEvents reverses. Survives module reload via globalThis. */
function buffer() {
  if (!globalThis.__eventLog) globalThis.__eventLog = [];
  return globalThis.__eventLog;
}

/**
 * Strip anything that must never be persisted. Applied to every detail
 * string rather than trusting each call site to remember.
 */
function redact(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[redacted]')
    .replace(/\b(consumer_secret|consumer_key|password|secret|token|api[_-]?key)\b\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(ck|cs|sk|pk)_[A-Za-z0-9]{8,}/g, '[redacted]')
    .slice(0, MAX_DETAIL);
}

export function recordEvent({ kind, outcome, durationMs = null, detail = '', correlationId = null }) {
  const events = buffer();
  events.push({
    ts: new Date().toISOString(),
    kind: kind || 'unknown',
    outcome: outcome || OUTCOMES.OK,
    durationMs,
    detail: redact(detail),
    correlationId,
  });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function readEvents({ limit = 200, kind = null, outcome = null } = {}) {
  let events = buffer();
  if (kind) events = events.filter((e) => e.kind === kind);
  if (outcome) events = events.filter((e) => e.outcome === outcome);
  return events.slice(-limit).reverse();
}

export function summarise(events = []) {
  const byKind = {};
  let lastFailureAt = null;
  let failed = 0;

  for (const e of events) {
    const bucket = (byKind[e.kind] ||= { total: 0, failed: 0, avgMs: 0, _sum: 0, _timed: 0 });
    bucket.total += 1;
    if (typeof e.durationMs === 'number') {
      bucket._sum += e.durationMs;
      bucket._timed += 1;
      bucket.avgMs = Math.round(bucket._sum / bucket._timed);
    }
    if (e.outcome === OUTCOMES.FAIL) {
      bucket.failed += 1;
      failed += 1;
      if (!lastFailureAt || e.ts > lastFailureAt) lastFailureAt = e.ts;
    }
  }

  for (const bucket of Object.values(byKind)) {
    delete bucket._sum;
    delete bucket._timed;
  }

  return {
    byKind,
    total: events.length,
    failureRate: events.length ? failed / events.length : 0,
    lastFailureAt,
  };
}

/**
 * Run `fn`, record how it went, and let its result or error through
 * unchanged. Wrapping a call must never alter its behaviour.
 */
export async function timed(kind, fn, detail = '', correlationId = null) {
  const started = Date.now();
  try {
    const result = await fn();
    recordEvent({ kind, outcome: OUTCOMES.OK, durationMs: Date.now() - started, detail, correlationId });
    return result;
  } catch (error) {
    recordEvent({
      kind,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: `${detail}: ${error.message}`,
      correlationId,
    });
    throw error;
  }
}

/** Test-only. */
export function __resetForTests() {
  globalThis.__eventLog = [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/event-log.test.js`
Expected: PASS, 6/6.

- [ ] **Step 5: Confirm nothing else broke, then commit**

Run: `npm test`
Expected: 36 passing.

```bash
git add lib/event-log.js tests/event-log.test.js
git commit -m "Add integration event log

Records the outcome of every crossing into WooCommerce, Paystack, the
geocoder and webhooks, with credentials and emails redacted. In-memory
by design: it records failures of the JSON store, so persisting there
would lose the events that matter most."
```

---

### Task 2: Fix sync truncation at 100 products

**Files:**
- Modify: `app/api/admin/sync/route.js`
- Test: `tests/sync-pagination.test.js`

**Interfaces:**
- Consumes: `wcFetchAll(endpoint, params)` from `lib/wc-config.js`; `timed`, `EVENT_KINDS` from Task 1.
- Produces: nothing new.

Background: the route calls `wcFetch('products', { per_page: '100' })`, which returns one page. The cache already holds 106 products, so growth past 100 is silently dropped. `wcFetchAll` pages until `x-wp-totalpages` is exhausted.

- [ ] **Step 1: Write the failing test**

Create `tests/sync-pagination.test.js`. This tests `wcFetchAll`'s paging contract directly by stubbing `fetch`, because the route itself needs a live WooCommerce.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.WOOCOMMERCE_STORE_URL ||= 'https://example.test';
process.env.WOOCOMMERCE_CONSUMER_KEY ||= 'ck_test';
process.env.WOOCOMMERCE_CONSUMER_SECRET ||= 'cs_test';

const { wcFetchAll } = await import('../lib/wc-config.js');

test('wcFetchAll pages past the 100-item ceiling', async () => {
  const realFetch = globalThis.fetch;
  const pagesRequested = [];

  globalThis.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get('page') || '1');
    pagesRequested.push(page);
    const items = Array.from({ length: page < 3 ? 50 : 6 }, (_, i) => ({ id: (page - 1) * 50 + i }));
    return {
      ok: true,
      headers: { get: (h) => (h === 'x-wp-totalpages' ? '3' : '106') },
      json: async () => items,
      text: async () => '',
    };
  };

  try {
    const all = await wcFetchAll('products', { status: 'publish' });
    assert.equal(all.length, 106, 'every page is collected, not just the first');
    assert.deepEqual(pagesRequested, [1, 2, 3]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('wcFetchAll sends credentials in the header, never the query string', async () => {
  const realFetch = globalThis.fetch;
  let seenUrl = '';
  let seenAuth = '';

  globalThis.fetch = async (url, opts) => {
    seenUrl = url;
    seenAuth = opts?.headers?.Authorization || '';
    return {
      ok: true,
      headers: { get: (h) => (h === 'x-wp-totalpages' ? '1' : '0') },
      json: async () => [],
      text: async () => '',
    };
  };

  try {
    await wcFetchAll('products');
    assert.ok(!seenUrl.includes('consumer_key'), 'no credentials in the URL');
    assert.ok(!seenUrl.includes('consumer_secret'), 'no credentials in the URL');
    assert.match(seenAuth, /^Basic /);
  } finally {
    globalThis.fetch = realFetch;
  }
});
```

- [ ] **Step 2: Run the test to verify it passes or fails**

Run: `node --test tests/sync-pagination.test.js`
Expected: PASS — `wcFetchAll` is already correct. This test pins the contract that Step 3 depends on. If it fails, fix `wcFetchAll` before continuing.

- [ ] **Step 3: Switch the sync route to `wcFetchAll` and record the outcome**

In `app/api/admin/sync/route.js`, change the import line:

```js
import { wcFetch, wcFetchAll, wcUrl, wcAuthHeaders, WC_URL, WC_KEY, WC_SECRET } from '@/lib/wc-config';
import { recordEvent, timed, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
```

Replace the `Promise.all` block that fetches products, categories and brands:

```js
    // wcFetchAll pages until the server says there are no more. wcFetch
    // returns only the first page, which silently capped the catalogue at
    // 100 products — the cache was already at 106.
    const [wcProducts, wcCategories, wcBrands] = await Promise.all([
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products', { status: 'publish' }), 'products').catch(() => []),
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products/categories'), 'categories').catch(() => []),
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products/brands'), 'brands').catch(() => []),
    ]);

    if (wcProducts.length === 0) {
      recordEvent({
        kind: EVENT_KINDS.SYNC,
        outcome: OUTCOMES.FAIL,
        detail: 'sync returned zero products — cache left untouched',
      });
      updateStore({ syncStatus: 'idle', syncError: 'WooCommerce returned no products' });
      return NextResponse.json(
        { error: 'WooCommerce returned no products. Check REST API access and try again.' },
        { status: 502 }
      );
    }
```

The zero-product guard matters: WooCommerce currently answers `nfw_rest_api_access_restricted` from non-allowlisted IPs, and `.catch(() => [])` would otherwise turn that into a successful sync that quietly empties the shop.

Then, just before the final `return NextResponse.json({ success: true, ... })`, add:

```js
    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.OK,
      detail: `${productCount} products, ${categoryCount} categories, ${brandCount} brands, ${zoneCount} zones`,
    });
```

- [ ] **Step 4: Verify the build and tests**

Run: `npm test && npx next build`
Expected: 38 tests passing; build compiles clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/sync/route.js tests/sync-pagination.test.js
git commit -m "Fix sync truncating the catalogue at 100 products

wcFetch returns a single page, so any catalogue past 100 items was
silently dropped — the cache was already at 106. Use wcFetchAll, and
refuse to complete a sync that returned zero products so a firewalled
REST API cannot empty the shop."
```

---

### Task 3: Stop sync from destroying admin product edits

**Files:**
- Modify: `lib/data-store.js` (`upsertProduct`)
- Modify: `app/api/admin/products/route.js`
- Test: `tests/product-ownership.test.js`

**Interfaces:**
- Consumes: `wcPut` from `lib/wc-config.js`.
- Produces: `products[].overrides` — `{ hidden?, featured?, sortWeight?, displayName?, badge? }`, preserved across sync.

Background: `upsertProduct` does `{ ...store.products[idx], ...entry }`, so a WooCommerce sync overwrites locally-set `stockStatus`. Admin's stock edit is neither durable nor visible to WooCommerce. Commerce fields become write-through; presentation fields become locally owned.

- [ ] **Step 1: Write the failing test**

Create `tests/product-ownership.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// data-store resolves its path from cwd, so point cwd at a scratch dir.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fastcart-store-'));
fs.mkdirSync(path.join(scratch, 'data'), { recursive: true });
const originalCwd = process.cwd();
process.chdir(scratch);

const store = await import('../lib/data-store.js');
const { upsertProduct, getProducts, WOOCOMMERCE_OWNED_FIELDS } = store.default || store;

process.chdir(originalCwd);

test('sync preserves locally-owned overrides', () => {
  process.chdir(scratch);
  try {
    upsertProduct({ wcId: 1, name: 'Jameson', price: '2500', stockStatus: 'instock' });

    // Admin hides it from the storefront.
    upsertProduct({ wcId: 1, overrides: { hidden: true, badge: 'Staff pick' } });

    // A later sync brings fresh WooCommerce values.
    upsertProduct({ wcId: 1, name: 'Jameson Irish Whiskey', price: '2600', stockStatus: 'outofstock' });

    const p = getProducts().find((x) => x.wcId === 1);
    assert.equal(p.price, '2600', 'WooCommerce owns price');
    assert.equal(p.stockStatus, 'outofstock', 'WooCommerce owns stock');
    assert.equal(p.overrides.hidden, true, 'local override survives sync');
    assert.equal(p.overrides.badge, 'Staff pick');
  } finally {
    process.chdir(originalCwd);
  }
});

test('overrides merge rather than replace', () => {
  process.chdir(scratch);
  try {
    upsertProduct({ wcId: 2, name: 'Gin', price: '1000' });
    upsertProduct({ wcId: 2, overrides: { hidden: true } });
    upsertProduct({ wcId: 2, overrides: { featured: true } });

    const p = getProducts().find((x) => x.wcId === 2);
    assert.equal(p.overrides.hidden, true, 'earlier override not clobbered');
    assert.equal(p.overrides.featured, true);
  } finally {
    process.chdir(originalCwd);
  }
});

test('the WooCommerce-owned field list is explicit', () => {
  for (const field of ['price', 'stockStatus', 'stockQuantity', 'sku', 'name']) {
    assert.ok(WOOCOMMERCE_OWNED_FIELDS.includes(field), `${field} must be WooCommerce-owned`);
  }
  assert.ok(!WOOCOMMERCE_OWNED_FIELDS.includes('overrides'));
});

test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/product-ownership.test.js`
Expected: FAIL — `WOOCOMMERCE_OWNED_FIELDS` is undefined and overrides are not preserved.

- [ ] **Step 3: Preserve overrides in `upsertProduct`**

In `lib/data-store.js`, add above `upsertProduct`:

```js
/**
 * Fields WooCommerce owns. Sync overwrites these; admin never edits them
 * locally — an admin change to any of them is written through to
 * WooCommerce first (see app/api/admin/products/route.js) so the cache and
 * the source of truth cannot diverge.
 */
const WOOCOMMERCE_OWNED_FIELDS = [
  'name', 'slug', 'type', 'price', 'regularPrice', 'salePrice',
  'stockStatus', 'stockQuantity', 'sku', 'weight', 'image', 'images',
  'categoryId', 'categoryName', 'brandId', 'brandName',
  'description', 'shortDescription', 'attributes', 'upsellIds',
];
```

Inside `upsertProduct`, change the `entry` object's tail and the merge. Replace:

```js
    variations: existing?.variations || wcProduct.variations || [],
    lastSynced: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.products[idx] = { ...store.products[idx], ...entry };
```

with:

```js
    variations: existing?.variations || wcProduct.variations || [],
    lastSynced: new Date().toISOString(),
  };

  // Locally-owned presentation state. Sync never carries these, so they
  // must be merged forward explicitly or an admin edit dies on next sync.
  const overrides = { ...(existing?.overrides || {}), ...(wcProduct.overrides || {}) };
  if (Object.keys(overrides).length > 0) entry.overrides = overrides;

  // A caller that only sets overrides must not blank the commerce fields.
  if (wcProduct.overrides && Object.keys(wcProduct).length <= 2) {
    for (const field of WOOCOMMERCE_OWNED_FIELDS) delete entry[field];
  }

  if (idx >= 0) {
    store.products[idx] = { ...store.products[idx], ...entry };
```

Export it — add `WOOCOMMERCE_OWNED_FIELDS,` to the `module.exports` object next to `upsertProduct`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/product-ownership.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Make admin edits write through to WooCommerce**

Replace the `PUT` handler in `app/api/admin/products/route.js`:

```js
import { NextResponse } from 'next/server';
import { getProducts, upsertProduct, WOOCOMMERCE_OWNED_FIELDS } from '@/lib/data-store';
import { wcPut } from '@/lib/wc-config';
import { adminGuard } from '@/lib/api-guard';
import { timed, EVENT_KINDS } from '@/lib/event-log';

/** Local field name -> WooCommerce REST field name. */
const WC_FIELD_MAP = {
  name: 'name',
  price: 'regular_price',
  regularPrice: 'regular_price',
  salePrice: 'sale_price',
  stockStatus: 'stock_status',
  stockQuantity: 'stock_quantity',
  sku: 'sku',
};

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const data = await request.json();
    const { wcId, overrides, ...updates } = data;

    if (!wcId) {
      return NextResponse.json({ error: 'wcId is required' }, { status: 400 });
    }

    // Presentation-only edits stay local; nothing to push.
    if (overrides && Object.keys(updates).length === 0) {
      return NextResponse.json(upsertProduct({ wcId, overrides }));
    }

    const wcPayload = {};
    for (const [local, remote] of Object.entries(WC_FIELD_MAP)) {
      if (updates[local] !== undefined) wcPayload[remote] = updates[local];
    }
    if (wcPayload.stock_quantity !== undefined) {
      wcPayload.stock_quantity = Number(wcPayload.stock_quantity);
      wcPayload.manage_stock = true;
    }

    const rejected = Object.keys(updates).filter(
      (k) => WOOCOMMERCE_OWNED_FIELDS.includes(k) && WC_FIELD_MAP[k] === undefined
    );
    if (rejected.length) {
      return NextResponse.json(
        { error: `Edit these in WooCommerce: ${rejected.join(', ')}` },
        { status: 400 }
      );
    }

    // Write through first. Updating the cache before WooCommerce confirms
    // would show admin a value the source of truth never accepted.
    if (Object.keys(wcPayload).length > 0) {
      try {
        const confirmed = await timed(
          EVENT_KINDS.WC_CALL,
          () => wcPut(`products/${wcId}`, wcPayload),
          `product ${wcId} write-through`
        );
        const saved = upsertProduct({
          wcId,
          price: confirmed.price ?? confirmed.regular_price,
          regularPrice: confirmed.regular_price,
          salePrice: confirmed.sale_price,
          stockStatus: confirmed.stock_status,
          stockQuantity: confirmed.stock_quantity,
          name: confirmed.name,
          sku: confirmed.sku,
          ...(overrides ? { overrides } : {}),
        });
        return NextResponse.json(saved);
      } catch (err) {
        console.error('Product write-through failed:', err.message);
        return NextResponse.json(
          { error: 'WooCommerce rejected the change. Nothing was saved.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(upsertProduct({ wcId, ...(overrides ? { overrides } : {}) }));
  } catch (error) {
    console.error('Admin product update failed:', error.message);
    return NextResponse.json({ error: 'Could not update the product' }, { status: 500 });
  }
}
```

Leave the existing `GET` handler unchanged.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx next build`
Expected: 41 tests passing; build clean.

```bash
git add lib/data-store.js app/api/admin/products/route.js tests/product-ownership.test.js
git commit -m "Make WooCommerce own commerce fields, admin own presentation

upsertProduct spread sync values over the stored row, so an admin stock
edit was overwritten on the next sync and never reached WooCommerce.
Commerce fields now write through to WooCommerce and only update the
cache once it confirms; presentation overrides are locally owned and
survive sync."
```

---

### Task 4: Stock purchasability rules

**Files:**
- Create: `lib/stock.js`
- Test: `tests/stock.test.js`

**Interfaces:**
- Produces: `isPurchasable(product) -> boolean`, `maxOrderableQty(product) -> number`, `validateCartLines(lines, catalog) -> { ok, accepted, rejected }` where `rejected` entries are `{ wcId, name, reason, availableQty }`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/stock.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { isPurchasable, maxOrderableQty, validateCartLines } = await import('../lib/stock.js');

test('only in-stock products are purchasable', () => {
  assert.equal(isPurchasable({ stockStatus: 'instock' }), true);
  assert.equal(isPurchasable({ stockStatus: 'outofstock' }), false);
  assert.equal(isPurchasable({ stockStatus: 'onbackorder' }), false);
  assert.equal(isPurchasable({}), false, 'unknown status is not purchasable');
  assert.equal(isPurchasable(null), false);
});

test('a hidden override makes a product unpurchasable regardless of stock', () => {
  assert.equal(isPurchasable({ stockStatus: 'instock', overrides: { hidden: true } }), false);
});

test('untracked stock has no quantity ceiling', () => {
  assert.equal(maxOrderableQty({ stockStatus: 'instock', stockQuantity: null }), Infinity);
  assert.equal(maxOrderableQty({ stockStatus: 'instock', stockQuantity: 7 }), 7);
  assert.equal(maxOrderableQty({ stockStatus: 'outofstock', stockQuantity: 7 }), 0);
});

test('validateCartLines rejects out-of-stock lines with a reason', () => {
  const catalog = [
    { wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 5 },
    { wcId: 2, name: 'Gin', stockStatus: 'outofstock', stockQuantity: 0 },
  ];

  const result = validateCartLines([{ wcId: 1, qty: 2 }, { wcId: 2, qty: 1 }], catalog);

  assert.equal(result.ok, false);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].wcId, 2);
  assert.equal(result.rejected[0].name, 'Gin');
  assert.match(result.rejected[0].reason, /out of stock/i);
});

test('validateCartLines caps a line at the available quantity', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 3 }];
  const result = validateCartLines([{ wcId: 1, qty: 10 }], catalog);

  assert.equal(result.ok, false);
  assert.equal(result.rejected[0].availableQty, 3);
  assert.match(result.rejected[0].reason, /only 3/i);
});

test('validateCartLines rejects a product missing from the catalogue', () => {
  const result = validateCartLines([{ wcId: 999, qty: 1 }], []);
  assert.equal(result.ok, false);
  assert.match(result.rejected[0].reason, /no longer available/i);
});

test('a fully valid cart passes', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null }];
  const result = validateCartLines([{ wcId: 1, qty: 99 }], catalog);
  assert.equal(result.ok, true);
  assert.equal(result.rejected.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/stock.test.js`
Expected: FAIL — `Cannot find module '../lib/stock.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/stock.js`:

```js
/**
 * Stock purchasability.
 *
 * One place decides whether something can be sold, so the storefront
 * listing, the cart and order creation cannot disagree. WooCommerce is
 * still the final arbiter at order creation — these rules exist so a
 * customer almost never reaches that rejection.
 */

/** Backorders are treated as unsellable: we deliver from stock on hand. */
const SELLABLE_STATUSES = new Set(['instock']);

export function isPurchasable(product) {
  if (!product) return false;
  if (product.overrides?.hidden) return false;
  return SELLABLE_STATUSES.has(product.stockStatus);
}

/**
 * How many units may be ordered. `stockQuantity: null` means WooCommerce is
 * not tracking quantity for this product, which is not the same as zero.
 */
export function maxOrderableQty(product) {
  if (!isPurchasable(product)) return 0;
  const qty = product.stockQuantity;
  if (qty === null || qty === undefined) return Infinity;
  const n = Number(qty);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Check cart lines against the catalogue.
 * @returns {{ ok: boolean, accepted: Array, rejected: Array }}
 */
export function validateCartLines(lines = [], catalog = []) {
  const byId = new Map(catalog.map((p) => [Number(p.wcId), p]));
  const accepted = [];
  const rejected = [];

  for (const line of lines) {
    const product = byId.get(Number(line.wcId));
    const qty = Number(line.qty);

    if (!product) {
      rejected.push({
        wcId: line.wcId,
        name: line.name || 'That item',
        reason: 'is no longer available',
        availableQty: 0,
      });
      continue;
    }

    if (!isPurchasable(product)) {
      rejected.push({
        wcId: product.wcId,
        name: product.name,
        reason: 'is out of stock',
        availableQty: 0,
      });
      continue;
    }

    const max = maxOrderableQty(product);
    if (qty > max) {
      rejected.push({
        wcId: product.wcId,
        name: product.name,
        reason: `has only ${max} left`,
        availableQty: max,
      });
      continue;
    }

    accepted.push({ ...line, name: product.name, price: product.price });
  }

  return { ok: rejected.length === 0, accepted, rejected };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/stock.test.js`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add lib/stock.js tests/stock.test.js
git commit -m "Add single source of stock purchasability rules

One module decides what can be sold so listings, cart and checkout
cannot disagree. Treats stockQuantity null as untracked rather than
zero, and backorders as unsellable."
```

---

### Task 5: Hide out-of-stock products from the storefront

**Files:**
- Modify: `app/api/products/route.js`
- Test: `tests/products-api.test.js`

**Interfaces:**
- Consumes: `isPurchasable` from Task 4.

- [ ] **Step 1: Write the failing test**

Create `tests/products-api.test.js`. Test the filter as a pure function so it needs no server:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { visibleProducts } = await import('../lib/storefront-catalog.js');

const CATALOG = [
  { wcId: 1, name: 'In stock', stockStatus: 'instock' },
  { wcId: 2, name: 'Out of stock', stockStatus: 'outofstock' },
  { wcId: 3, name: 'Hidden by admin', stockStatus: 'instock', overrides: { hidden: true } },
  { wcId: 4, name: 'Backordered', stockStatus: 'onbackorder' },
];

test('out-of-stock and hidden products are excluded by default', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: false });
  assert.deepEqual(visible.map((p) => p.wcId), [1]);
});

test('showOutOfStock reveals out-of-stock but never admin-hidden products', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: true });
  const ids = visible.map((p) => p.wcId);
  assert.ok(ids.includes(2), 'out-of-stock shown when the setting allows');
  assert.ok(!ids.includes(3), 'an admin-hidden product stays hidden regardless');
});

test('every returned product carries a purchasable flag for the client', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: true });
  const outOfStock = visible.find((p) => p.wcId === 2);
  assert.equal(outOfStock.purchasable, false, 'client can disable the add button');
  assert.equal(visible.find((p) => p.wcId === 1).purchasable, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/products-api.test.js`
Expected: FAIL — `Cannot find module '../lib/storefront-catalog.js'`

- [ ] **Step 3: Write the filter module**

Create `lib/storefront-catalog.js`:

```js
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
    .map((p) => ({
      ...p,
      purchasable: isPurchasable(p),
      maxQty: maxOrderableQty(p) === Infinity ? null : maxOrderableQty(p),
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/products-api.test.js`
Expected: PASS, 3/3.

- [ ] **Step 5: Apply the filter in the products route**

Replace `app/api/products/route.js` entirely:

```js
import { NextResponse } from 'next/server';
import { getProducts, getBrands, getCategories, getSettings } from '@/lib/data-store';
import { visibleProducts } from '@/lib/storefront-catalog';

/**
 * GET /api/products — the storefront catalogue.
 *
 * Filtering happens here rather than in each client surface, so search,
 * category, brand and upsell listings cannot drift apart on what counts as
 * sellable.
 */
export async function GET() {
  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock === true;

  const products = visibleProducts(getProducts(), { showOutOfStock });

  return NextResponse.json({
    products,
    brands: getBrands(),
    categories: getCategories(),
    settings,
    showOutOfStock,
    count: products.length,
  });
}
```

Note the changed default: the previous code used `!== false`, which showed out-of-stock items whenever the setting was absent. It is now opt-in.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx next build`
Expected: 51 tests passing; build clean.

```bash
git add app/api/products/route.js lib/storefront-catalog.js tests/products-api.test.js
git commit -m "Hide out-of-stock and admin-hidden products from the storefront

Filtering moves into one module so every listing surface agrees, and
out-of-stock display becomes opt-in rather than the default when the
setting is absent. Each product carries a purchasable flag so the
client can disable its add button."
```

---

### Task 6: Refuse to create an order for out-of-stock lines

**Files:**
- Modify: `app/api/checkout/route.js`
- Test: `tests/checkout-stock.test.js`

**Interfaces:**
- Consumes: `validateCartLines` from Task 4.

- [ ] **Step 1: Write the failing test**

Create `tests/checkout-stock.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStockRejection } = await import('../lib/checkout-guards.js');

test('a rejection message names every affected product', () => {
  const rejected = [
    { wcId: 2, name: 'Gin', reason: 'is out of stock', availableQty: 0 },
    { wcId: 3, name: 'Jameson', reason: 'has only 2 left', availableQty: 2 },
  ];

  const body = buildStockRejection(rejected);

  assert.equal(body.error, 'Some items are no longer available');
  assert.equal(body.rejected.length, 2);
  assert.match(body.message, /Gin is out of stock/);
  assert.match(body.message, /Jameson has only 2 left/);
});

test('a single rejection reads naturally', () => {
  const body = buildStockRejection([{ wcId: 2, name: 'Gin', reason: 'is out of stock', availableQty: 0 }]);
  assert.equal(body.message, 'Gin is out of stock.');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/checkout-stock.test.js`
Expected: FAIL — `Cannot find module '../lib/checkout-guards.js'`

- [ ] **Step 3: Write the guard module**

Create `lib/checkout-guards.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/checkout-stock.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Revalidate stock in the checkout route**

In `app/api/checkout/route.js`, add to the imports:

```js
import { getProducts } from '@/lib/data-store';
import { validateCartLines } from '@/lib/stock';
import { buildStockRejection } from '@/lib/checkout-guards';
import { timed, recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
```

Immediately after the existing per-item validation loop and before `const lineItems = cart.map(...)`, insert:

```js
    // Last cache-side gate before we spend a WooCommerce round trip. The
    // cart may have been sitting open while stock moved.
    const stockCheck = validateCartLines(
      cart.map((item) => ({ wcId: item.id, qty: item.quantity, name: item.name })),
      getProducts()
    );

    if (!stockCheck.ok) {
      recordEvent({
        kind: EVENT_KINDS.ORDER,
        outcome: OUTCOMES.SKIPPED,
        detail: `stock rejection: ${stockCheck.rejected.map((r) => r.wcId).join(',')}`,
      });
      return NextResponse.json(buildStockRejection(stockCheck.rejected), { status: 409 });
    }
```

Then wrap the WooCommerce order creation so its outcome is recorded. Replace:

```js
    let order;
    try {
      order = await wcPost('orders', orderPayload);
    } catch (err) {
      console.error('WC order creation failed:', err.message);
      return NextResponse.json({ error: 'Could not create your order. Please try again.' }, { status: 502 });
    }
```

with:

```js
    let order;
    try {
      order = await timed(EVENT_KINDS.ORDER, () => wcPost('orders', orderPayload), 'create order');
    } catch (err) {
      console.error('WC order creation failed:', err.message);

      // WooCommerce is the final arbiter on stock. If it refused a line,
      // say so plainly instead of a generic failure the customer cannot act on.
      const isStockError = /stock|out of stock|not enough/i.test(err.message || '');
      if (isStockError) {
        return NextResponse.json(
          { error: 'Some items sold out while you were checking out', message: err.message },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Could not create your order. Please try again.' },
        { status: 502 }
      );
    }
```

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx next build`
Expected: 53 tests passing; build clean.

```bash
git add app/api/checkout/route.js lib/checkout-guards.js tests/checkout-stock.test.js
git commit -m "Refuse checkout for out-of-stock lines, naming the product

Revalidates the cart against the cache before spending a WooCommerce
round trip, and surfaces WooCommerce's own stock refusal verbatim
rather than as a generic failure."
```

---

### Task 7: Move reverse geocoding server-side

**Files:**
- Create: `app/api/geo/reverse/route.js`
- Modify: `components/CheckoutModal.js:24`, `components/LocationPrompt.js:22`, `components/ProfileSetup.js:115`
- Test: `tests/geo-reverse.test.js`

**Interfaces:**
- Produces: `GET /api/geo/reverse?lat=<n>&lon=<n>` returning `{ ok, address: { road, neighbourhood, suburb, city }, cached }`.
- Consumes: `recordEvent`, `EVENT_KINDS` from Task 1.

Background: all three components call `nominatim.openstreetmap.org` from the browser, and `connect-src` in `next.config.mjs` does not allow that host — every call fails silently in production. Moving it server-side fixes the CSP block, honours Nominatim's 1 req/sec policy from one place, and lets results be cached.

- [ ] **Step 1: Write the failing test**

Create `tests/geo-reverse.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { coordinateKey, parseNominatim } = await import('../lib/geocode.js');

test('coordinates are rounded so nearby requests share a cache entry', () => {
  // 4 decimal places is about 11 m — same building, same key.
  assert.equal(coordinateKey(-1.2920659, 36.8219462), coordinateKey(-1.2920712, 36.8219501));
  assert.notEqual(coordinateKey(-1.2920659, 36.8219462), coordinateKey(-1.3020659, 36.8219462));
});

test('invalid coordinates are rejected', () => {
  assert.equal(coordinateKey(NaN, 36), null);
  assert.equal(coordinateKey(-91, 36), null, 'latitude out of range');
  assert.equal(coordinateKey(-1.29, 181), null, 'longitude out of range');
});

test('a Nominatim response is reduced to the fields we use', () => {
  const parsed = parseNominatim({
    address: {
      road: 'Ngong Road',
      neighbourhood: 'Kilimani',
      suburb: 'Dagoretti North',
      city: 'Nairobi',
      country: 'Kenya',
      postcode: '00100',
    },
  });

  assert.deepEqual(parsed, {
    road: 'Ngong Road',
    neighbourhood: 'Kilimani',
    suburb: 'Dagoretti North',
    city: 'Nairobi',
  });
});

test('a malformed response yields empty fields rather than throwing', () => {
  assert.deepEqual(parseNominatim(null), { road: '', neighbourhood: '', suburb: '', city: '' });
  assert.deepEqual(parseNominatim({}), { road: '', neighbourhood: '', suburb: '', city: '' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/geo-reverse.test.js`
Expected: FAIL — `Cannot find module '../lib/geocode.js'`

- [ ] **Step 3: Write the geocode helper**

Create `lib/geocode.js`:

```js
/**
 * Reverse-geocoding helpers.
 *
 * Nominatim's usage policy caps callers at roughly one request per second
 * and requires an identifying User-Agent. Calling it from the browser broke
 * both — and was blocked by our own CSP besides. These helpers support the
 * server-side proxy that replaces it.
 *
 * The only question we need answered is which delivery zone a customer is
 * in, because that sets the fee. Building-level results are a suggestion.
 */

/** ~11 m at 4 decimal places: the same building shares a cache entry. */
const PRECISION = 4;

export function coordinateKey(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
  if (latNum < -90 || latNum > 90) return null;
  if (lonNum < -180 || lonNum > 180) return null;

  return `${latNum.toFixed(PRECISION)},${lonNum.toFixed(PRECISION)}`;
}

export function parseNominatim(payload) {
  const a = payload?.address || {};
  return {
    road: a.road || '',
    neighbourhood: a.neighbourhood || a.quarter || '',
    suburb: a.suburb || a.city_district || '',
    city: a.city || a.town || a.county || '',
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/geo-reverse.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Write the proxy route**

Create `app/api/geo/reverse/route.js`:

```js
import { NextResponse } from 'next/server';
import { coordinateKey, parseNominatim } from '@/lib/geocode';
import { kvGet, kvSet } from '@/lib/kv-store';
import { rateLimitRequest } from '@/lib/rate-limit';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';

/**
 * GET /api/geo/reverse?lat=&lon=
 *
 * Server-side reverse geocoding. Previously called from the browser, where
 * it was blocked by our own CSP and could not honour Nominatim's rate limit
 * or User-Agent requirement.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // addresses do not move
const UPSTREAM_TIMEOUT_MS = 4000;

/** Nominatim requires a real identifying User-Agent. */
const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || 'FastCart/1.0 (+https://myhappyhour.co.ke)';

export async function GET(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const key = coordinateKey(searchParams.get('lat'), searchParams.get('lon'));

  if (!key) {
    return NextResponse.json({ ok: false, error: 'Valid lat and lon are required' }, { status: 400 });
  }

  const cacheKey = `geo:${key}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK, durationMs: 0, detail: 'cache hit' });
    return NextResponse.json({ ok: true, address: cached, cached: true });
  }

  const [lat, lon] = key.split(',');
  const started = Date.now();

  try {
    const url = `${NOMINATIM}?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const address = parseNominatim(await res.json());
    await kvSet(cacheKey, address, CACHE_TTL_MS);

    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.OK,
      durationMs: Date.now() - started,
      detail: 'upstream hit',
    });

    return NextResponse.json({ ok: true, address, cached: false });
  } catch (error) {
    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: error.message,
    });

    // The caller falls back to manual zone selection. A failed geocode must
    // never block checkout.
    return NextResponse.json({ ok: false, error: 'Could not determine your area' }, { status: 502 });
  }
}
```

- [ ] **Step 6: Point the three components at the proxy**

In `components/CheckoutModal.js`, replace the `fetch` inside the reverse-geocode helper at line 24 so the whole function reads:

```js
async function reverseGeocode(lat, lon) {
  // Server-side proxy: the browser cannot reach Nominatim (CSP), and the
  // proxy caches results and honours the upstream rate limit.
  const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lon}`, { credentials: 'same-origin' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.ok ? data.address : null;
}
```

Apply the same substitution in `components/LocationPrompt.js` (line 22) and `components/ProfileSetup.js` (line 115), keeping each file's existing surrounding logic and callback shape. Each of those call sites currently reads `data.address.road` and similar off the raw Nominatim payload; the proxy returns the same field names, so the consuming code does not change.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npx next build`
Expected: 57 tests passing; build clean.

Then confirm the route answers, with the dev server running:

```bash
curl -s 'http://localhost:3000/api/geo/reverse?lat=-1.2921&lon=36.8219' | head -c 200
curl -s 'http://localhost:3000/api/geo/reverse?lat=999&lon=0' -o /dev/null -w '%{http_code}\n'
```

Expected: the first returns `{"ok":true,...}` (or `{"ok":false}` if the machine has no outbound access — either is a pass, since the failure is now *logged* rather than silent); the second returns `400`.

```bash
git add app/api/geo/reverse/route.js lib/geocode.js tests/geo-reverse.test.js \
        components/CheckoutModal.js components/LocationPrompt.js components/ProfileSetup.js
git commit -m "Move reverse geocoding server-side

Browser calls to Nominatim were blocked by our own CSP, so GPS
detection was silently dead in production. The proxy fixes that,
honours the upstream rate limit and User-Agent policy from one place,
caches by coordinate rounded to ~11m, and logs every failure."
```

---

### Task 8: Admin health page

**Files:**
- Create: `app/api/admin/health/route.js`
- Create: `app/admin/health/page.js`
- Modify: `app/admin/layout.js` (add the nav entry)

**Interfaces:**
- Consumes: `readEvents`, `summarise`, `EVENT_KINDS` from Task 1; `getSyncStatus` from `lib/data-store.js`.

- [ ] **Step 1: Write the health route**

Create `app/api/admin/health/route.js`:

```js
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { readEvents, summarise, EVENT_KINDS } from '@/lib/event-log';
import { getSyncStatus, getProducts } from '@/lib/data-store';
import { isDistributed } from '@/lib/kv-store';

/**
 * GET /api/admin/health — operational state at a glance.
 *
 * Exists because the failures that hurt most are the quiet ones: a
 * firewalled REST API, a geocoder blocked by CSP, a webhook whose
 * signature never matches. None of those raise anything a user would see.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const events = readEvents({ limit: 2000 });
  const sync = getSyncStatus();
  const cacheAgeMs = sync.lastSync ? Date.now() - new Date(sync.lastSync).getTime() : null;

  const configured = {
    woocommerce: Boolean(process.env.WOOCOMMERCE_STORE_URL && process.env.WOOCOMMERCE_CONSUMER_KEY),
    wcWebhookSecret: Boolean(process.env.WOOCOMMERCE_WEBHOOK_SECRET),
    paystackKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
    paystackWebhookSecret: Boolean(process.env.PAYSTACK_WEBHOOK_SECRET),
    sharedStateBackend: isDistributed ? 'redis' : 'in-process',
  };

  return NextResponse.json({
    sync: { ...sync, cacheAgeMs },
    catalogue: {
      total: getProducts().length,
      purchasable: getProducts().filter((p) => p.stockStatus === 'instock' && !p.overrides?.hidden).length,
    },
    configured,
    summary: summarise(events),
    recentFailures: readEvents({ limit: 25, outcome: 'fail' }),
    kinds: Object.values(EVENT_KINDS),
  });
}
```

- [ ] **Step 2: Write the health page**

Create `app/admin/health/page.js`:

```jsx
'use client';

import { useEffect, useState, useCallback } from 'react';

const FRESH_LIMIT_MS = 10 * 60 * 1000;

function Pill({ ok, children }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {children}
    </span>
  );
}

export default function HealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/health', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Could not load health data');
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  const cacheFresh = data.sync.cacheAgeMs !== null && data.sync.cacheAgeMs < FRESH_LIMIT_MS;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-extrabold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        System Health
      </h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-extrabold">{data.catalogue.purchasable}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Sellable products</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-extrabold">{data.catalogue.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">In cache</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-extrabold">
            {data.sync.cacheAgeMs === null ? '—' : `${Math.round(data.sync.cacheAgeMs / 60000)}m`}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Cache age</div>
          <div className="mt-1"><Pill ok={cacheFresh}>{cacheFresh ? 'Fresh' : 'Stale'}</Pill></div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-2xl font-extrabold">{Math.round(data.summary.failureRate * 100)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Failure rate</div>
        </div>
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-bold">Configuration</h2>
        {Object.entries(data.configured).map(([key, value]) => (
          <div key={key} className="flex justify-between items-center text-xs">
            <span className="text-gray-700">{key}</span>
            {typeof value === 'boolean'
              ? <Pill ok={value}>{value ? 'Set' : 'Missing'}</Pill>
              : <span className="font-mono text-[11px]">{value}</span>}
          </div>
        ))}
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-bold">By integration</h2>
        {Object.keys(data.summary.byKind).length === 0 && (
          <p className="text-xs text-gray-500">No activity recorded since the last restart.</p>
        )}
        {Object.entries(data.summary.byKind).map(([kind, stats]) => (
          <div key={kind} className="flex justify-between items-center text-xs">
            <span className="font-mono">{kind}</span>
            <span className="text-gray-600">
              {stats.total} calls · {stats.failed} failed · {stats.avgMs}ms avg
            </span>
          </div>
        ))}
      </section>

      <section className="rounded-xl border p-4 space-y-2">
        <h2 className="text-sm font-bold">Recent failures</h2>
        {data.recentFailures.length === 0 && <p className="text-xs text-gray-500">None. </p>}
        {data.recentFailures.map((e, i) => (
          <div key={i} className="text-xs border-l-2 border-red-400 pl-2">
            <div className="font-mono text-[11px] text-gray-500">
              {new Date(e.ts).toLocaleString()} · {e.kind}
            </div>
            <div className="text-gray-800">{e.detail}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav entry**

In `app/admin/layout.js`, find the array of nav items (each entry has a `href` and a label) and add an entry pointing at `/admin/health` labelled `Health`, following the exact shape of the entries already there.

- [ ] **Step 4: Verify**

Run: `npm test && npx next build`
Expected: 57 tests passing; build clean.

With the dev server running and an admin session, visit `/admin/health`. Without a session:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/admin/health
```

Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/health/route.js app/admin/health/page.js app/admin/layout.js
git commit -m "Add admin health page

Surfaces cache age, sellable product count, per-integration failure
rates, missing configuration and recent failures. The quiet failures
are the expensive ones: a firewalled REST API, a CSP-blocked geocoder
and an unverifiable webhook all currently fail without surfacing."
```

---

## Self-Review

**Spec coverage.** Spec §1 freshness — partial by design: sync pagination (Task 2) is in scope; webhook deltas and the reconcile job are stage 3 and get their own plan. §2 stock integrity — Tasks 4, 5, 6 cover all three gates. §3 admin ownership — Task 3. §8 observability — Tasks 1, 8. Defect 1 — Task 2. Defect 2 — Task 3. Defect 3 — Task 7. Defect 4 (phone-only login) — stage 7, not this plan. §§4–7 (cart, checkout fields, identity, address directory) — later stages, not this plan.

**Placeholder scan.** No TBD/TODO. Every code step carries complete code. Task 8 Step 3 describes a nav edit rather than showing it, because the surrounding array shape must be read from the file; the instruction names the exact file, target route and label.

**Type consistency.** `isPurchasable`/`maxOrderableQty` are defined in Task 4 and consumed with the same signatures in Tasks 5 and 6. `validateCartLines` returns `{ ok, accepted, rejected }` in Task 4 and is destructured that way in Task 6. `rejected` entries carry `{ wcId, name, reason, availableQty }` in both Task 4 and Task 6's `buildStockRejection`. `recordEvent`/`timed`/`EVENT_KINDS`/`OUTCOMES` are defined in Task 1 and imported unchanged in Tasks 2, 3, 6, 7, 8. `coordinateKey`/`parseNominatim` are defined in Task 7 and used only there. `WOOCOMMERCE_OWNED_FIELDS` is exported in Task 3 and consumed in the same task's route change.

**Test counts.** Baseline 30. Task 1 +6 = 36; Task 2 +2 = 38; Task 3 +3 = 41; Task 4 +7 = 48; Task 5 +3 = 51; Task 6 +2 = 53; Task 7 +4 = 57. Task 8 adds no tests.
