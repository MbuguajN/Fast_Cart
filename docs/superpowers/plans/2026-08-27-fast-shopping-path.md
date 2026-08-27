# Fast Shopping Path Implementation Plan (Stages 3–5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every WooCommerce round trip from the shopping path, keep the cached catalogue fresh enough to rely on, and cut checkout to four fields.

**Architecture:** Webhooks push stock changes into the cache within seconds; an externally-triggered reconcile job repairs anything the webhooks dropped. The cart becomes pure client state in `localStorage` with no network calls at all. Checkout captures phone, name, address and an optional email, then makes the single WooCommerce call of the whole session.

**Tech Stack:** Next.js 16.2.11 (App Router), React 19.2.4, Node 22, `node:test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-27-fast-storefront-design.md` (§1 freshness, §4 cart, §5 checkout)

## Global Constraints

- Node's built-in test runner. `npm test` runs `node --test "tests/**/*.test.js"`. All 61 existing tests must stay green.
- `lib/data-store.js` is CommonJS; other `lib/*.js` is ESM. Modules under `lib/` import each other by relative path, never the `@/` alias — the alias breaks `node --test`.
- All `data/store.json` writes go through `mutateStore` or `writeStore`.
- Admin routes call `adminGuard(request)` first. The reconcile route is machine-triggered and uses a shared secret instead.
- Never log credentials, full addresses or emails.
- WooCommerce calls go through `lib/wc-config.js` helpers.
- The cart's public context API must not change: `cart, setCart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity, upsellPopup, setUpsellPopup, products, setProducts`. Four files consume it (`app/page.js`, `app/product/[slug]/ProductView.js`, `app/brands/[slug]/BrandView.js`, `app/brands/jaba/JabaView.js`) and must keep working untouched.
- Cart line shape stays `{ id, variantId, quantity }`.

---

### Task 1: Webhook stock deltas

**Files:**
- Modify: `app/api/webhook/route.js`
- Test: `tests/webhook-delta.test.js`

**Interfaces:**
- Produces: `applyProductDelta(payload) -> { wcId, changed }` exported from `lib/catalog-delta.js`.
- Consumes: `recordEvent`, `EVENT_KINDS`, `OUTCOMES` from `lib/event-log.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/webhook-delta.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { extractStockDelta, isDeletion } = await import('../lib/catalog-delta.js');

test('a WooCommerce product payload reduces to the fields the cache holds', () => {
  const delta = extractStockDelta({
    id: 42,
    name: 'Jameson',
    price: '2600',
    regular_price: '2800',
    sale_price: '2600',
    stock_status: 'outofstock',
    stock_quantity: 0,
    sku: 'JAM-750',
  });

  assert.equal(delta.wcId, 42);
  assert.equal(delta.stockStatus, 'outofstock');
  assert.equal(delta.stockQuantity, 0);
  assert.equal(delta.price, '2600');
});

test('a missing stock quantity stays null rather than becoming zero', () => {
  const delta = extractStockDelta({ id: 7, stock_status: 'instock', stock_quantity: null });
  assert.equal(delta.stockQuantity, null, 'null means untracked, not sold out');
});

test('a payload without an id yields nothing to apply', () => {
  assert.equal(extractStockDelta({}), null);
  assert.equal(extractStockDelta(null), null);
});

test('deletion is recognised from the topic', () => {
  assert.equal(isDeletion('product.deleted'), true);
  assert.equal(isDeletion('product.updated'), false);
  assert.equal(isDeletion(''), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/webhook-delta.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/catalog-delta.js`**

```js
/**
 * Turning a WooCommerce webhook payload into a cache update.
 *
 * Kept out of the route so the mapping is testable without a signed request,
 * and so the reconcile job applies exactly the same transformation as the
 * webhook — two paths that disagree would be worse than one that is late.
 */

/**
 * @returns {{ wcId, price, regularPrice, salePrice, stockStatus, stockQuantity, name, sku } | null}
 */
export function extractStockDelta(payload) {
  if (!payload || !payload.id) return null;

  // stock_quantity null means WooCommerce is not tracking quantity for this
  // product. Coercing it to 0 would read as "sold out" and hide the product.
  const qty = payload.stock_quantity;

  return {
    wcId: payload.id,
    name: payload.name,
    price: payload.price ?? payload.regular_price,
    regularPrice: payload.regular_price,
    salePrice: payload.sale_price,
    stockStatus: payload.stock_status,
    stockQuantity: qty === null || qty === undefined ? null : Number(qty),
    sku: payload.sku || '',
  };
}

export function isDeletion(topic) {
  return topic === 'product.deleted';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/webhook-delta.test.js`
Expected: PASS, 4/4.

- [ ] **Step 5: Apply deltas in the webhook route**

In `app/api/webhook/route.js`, add to the imports:

```js
import { extractStockDelta, isDeletion } from '@/lib/catalog-delta';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
```

Replace the whole `if (topic.startsWith('product.')) { ... }` block with:

```js
    if (topic.startsWith('product.')) {
      const productId = body.id;
      if (!productId) return NextResponse.json({ received: true });

      if (isDeletion(topic)) {
        await mutateStore((store) => {
          store.products = (store.products || []).filter((p) => p.wcId !== productId);
        });
        recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.OK, detail: `product ${productId} deleted` });
        return NextResponse.json({ received: true });
      }

      // The webhook payload already carries price and stock, so a stock
      // change lands in the cache without a round trip back to the origin.
      // Only fall back to fetching when the payload is too thin to use.
      const delta = extractStockDelta(body);

      if (delta && delta.stockStatus) {
        upsertProduct(delta);
        recordEvent({
          kind: EVENT_KINDS.WEBHOOK,
          outcome: OUTCOMES.OK,
          detail: `product ${productId} -> ${delta.stockStatus}`,
        });
        updateStore({ lastSync: new Date().toISOString() });
        return NextResponse.json({ received: true });
      }

      const wcProduct = await fetchProduct(productId);
      if (!wcProduct) {
        recordEvent({
          kind: EVENT_KINDS.WEBHOOK,
          outcome: OUTCOMES.FAIL,
          detail: `product ${productId} refetch failed`,
        });
        return NextResponse.json({ received: true });
      }

      const primaryImage = wcProduct.images?.[0]?.src || '';
      const brandAttr = wcProduct.attributes?.find(
        (a) => a.name.toLowerCase() === 'brand' || a.name.toLowerCase() === 'manufacturer'
      );
      const brandName = brandAttr?.options?.[0] || '';

      upsertProduct({
        wcId: wcProduct.id,
        name: wcProduct.name,
        slug: wcProduct.slug,
        price: wcProduct.price || wcProduct.regular_price,
        regularPrice: wcProduct.regular_price,
        salePrice: wcProduct.sale_price,
        stockStatus: wcProduct.stock_status,
        stockQuantity: wcProduct.stock_quantity,
        image: primaryImage,
        images: (wcProduct.images || []).map((img) => img.src),
        categoryId: wcProduct.categories?.[0]?.id || null,
        categoryName: wcProduct.categories?.[0]?.name || '',
        brandId: brandName ? `brand_${brandName.toLowerCase().replace(/\s+/g, '_')}` : null,
        brandName,
        description: wcProduct.description || '',
        shortDescription: wcProduct.short_description || '',
        sku: wcProduct.sku || '',
        weight: wcProduct.weight || '',
      });

      recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.OK, detail: `product ${productId} refetched` });
      updateStore({ lastSync: new Date().toISOString() });
    }
```

Also record the signature rejection. Replace:

```js
  if (!verifyWebhook(request, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
```

with:

```js
  if (!verifyWebhook(request, rawBody)) {
    recordEvent({
      kind: EVENT_KINDS.WEBHOOK,
      outcome: OUTCOMES.FAIL,
      detail: 'signature verification failed',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
```

- [ ] **Step 6: Verify and commit**

Run: `npm test && npx next build`
Expected: 65 passing, build clean.

```bash
git add app/api/webhook/route.js lib/catalog-delta.js tests/webhook-delta.test.js
git commit -m "Apply stock changes from the webhook payload directly

A product.updated webhook already carries price and stock, so applying
it needs no round trip back to the origin. Handles product.deleted,
and records signature failures so an unverifiable webhook stops being
invisible."
```

---

### Task 2: Reconcile job

**Files:**
- Create: `app/api/cron/reconcile/route.js`
- Test: `tests/reconcile-auth.test.js`

**Interfaces:**
- Produces: `GET|POST /api/cron/reconcile`, authenticated by an `x-cron-secret` header matching `CRON_SECRET`.
- Consumes: `wcFetchAll`, `upsertProduct`, `updateStore`, event log.

- [ ] **Step 1: Write the failing test**

Create `tests/reconcile-auth.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { isAuthorisedCron, sinceParam } = await import('../lib/cron-auth.js');

test('a request without the secret is refused', () => {
  assert.equal(isAuthorisedCron('', 'expected-secret'), false);
  assert.equal(isAuthorisedCron(null, 'expected-secret'), false);
  assert.equal(isAuthorisedCron('wrong', 'expected-secret'), false);
});

test('a matching secret is accepted', () => {
  assert.equal(isAuthorisedCron('expected-secret', 'expected-secret'), true);
});

test('an unconfigured secret refuses everything rather than allowing everything', () => {
  assert.equal(isAuthorisedCron('anything', ''), false);
  assert.equal(isAuthorisedCron('', ''), false);
  assert.equal(isAuthorisedCron('anything', undefined), false);
});

test('the since window overlaps the last sync so nothing falls between runs', () => {
  const last = '2026-08-27T12:00:00.000Z';
  const since = sinceParam(last, 120000);
  assert.ok(since < last, 'the window starts before the last sync');
  assert.equal(new Date(last) - new Date(since), 120000);
});

test('with no previous sync the window falls back to a fixed lookback', () => {
  const since = sinceParam(null, 120000);
  assert.ok(since, 'always returns something usable');
  assert.ok(new Date(since) < new Date());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/reconcile-auth.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/cron-auth.js`**

```js
/**
 * Authentication for machine-triggered routes.
 *
 * Separate from the admin cookie because the caller is system cron, a Vercel
 * cron entry or an uptime pinger — none of which can hold a session.
 */

import { timingSafeEquals } from './crypto-tokens.js';

/**
 * An absent or empty configured secret refuses every request. Treating
 * "unconfigured" as "open" would leave the reconcile endpoint public.
 */
export function isAuthorisedCron(provided, expected) {
  if (!expected || typeof expected !== 'string') return false;
  if (!provided || typeof provided !== 'string') return false;
  return timingSafeEquals(provided, expected);
}

/**
 * The `modified_after` value for the next pull.
 *
 * Deliberately overlaps the previous run by `overlapMs`: a product modified
 * during the last request would otherwise fall between two windows and never
 * be picked up. Re-applying an unchanged product is harmless.
 */
export function sinceParam(lastSyncIso, overlapMs = 120000) {
  const base = lastSyncIso ? new Date(lastSyncIso).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  return new Date(base - overlapMs).toISOString();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/reconcile-auth.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Write the reconcile route**

Create `app/api/cron/reconcile/route.js`:

```js
import { NextResponse } from 'next/server';
import { wcFetchAll } from '@/lib/wc-config';
import { getSyncStatus, upsertProduct, updateStore } from '@/lib/data-store';
import { extractStockDelta } from '@/lib/catalog-delta';
import { isAuthorisedCron, sinceParam } from '@/lib/cron-auth';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';

/**
 * Reconcile the cache against WooCommerce.
 *
 * Webhooks are the primary path for stock changes; they also fail quietly.
 * This pulls everything modified since the last sync and re-applies it, so
 * a dropped or mis-signed webhook costs freshness for one interval instead
 * of indefinitely.
 *
 * Triggered externally rather than by an in-process timer, which would die
 * with the process and stop reconciling without saying so.
 */

const OVERLAP_MS = 120000;

async function reconcile() {
  const status = getSyncStatus();
  const since = sinceParam(status.lastSync, OVERLAP_MS);

  const changed = await wcFetchAll('products', { status: 'publish', modified_after: since });

  let applied = 0;
  for (const product of changed) {
    const delta = extractStockDelta(product);
    if (!delta) continue;
    upsertProduct(delta);
    applied += 1;
  }

  if (applied > 0) updateStore({ lastSync: new Date().toISOString() });

  return { since, applied, examined: changed.length };
}

async function handle(request) {
  const provided = request.headers.get('x-cron-secret');

  if (!isAuthorisedCron(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  try {
    const result = await reconcile();
    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.OK,
      durationMs: Date.now() - started,
      detail: `reconcile applied ${result.applied} of ${result.examined}`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: `reconcile failed: ${error.message}`,
    });
    return NextResponse.json({ ok: false, error: 'Reconcile failed' }, { status: 502 });
  }
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
```

- [ ] **Step 6: Document the new env var**

Append to `.env.example`, under the shared-state section:

```
# ------------------------------------------
# Scheduled jobs
# ------------------------------------------
# Shared secret for /api/cron/reconcile, which re-pulls anything the
# WooCommerce webhooks missed. Unset means the endpoint refuses every
# request — it is never open by default.
#   */2 * * * * curl -sS -H "x-cron-secret: $CRON_SECRET" https://site/api/cron/reconcile
CRON_SECRET=
```

- [ ] **Step 7: Verify and commit**

Run: `npm test && npx next build`
Expected: 70 passing, build clean. Then, with the dev server up:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/reconcile
curl -s -o /dev/null -w '%{http_code}\n' -H 'x-cron-secret: wrong' http://localhost:3000/api/cron/reconcile
```

Expected: `401` for both.

```bash
git add app/api/cron/reconcile/route.js lib/cron-auth.js tests/reconcile-auth.test.js .env.example
git commit -m "Add reconcile job to repair missed webhook deltas

Pulls everything modified since the last sync, with a deliberate window
overlap so a product changed mid-request cannot fall between two runs.
Externally triggered on a shared secret, and refuses every request when
that secret is unconfigured."
```

---

### Task 3: Client-side cart storage

**Files:**
- Create: `lib/cart-storage.js`
- Test: `tests/cart-storage.test.js`

**Interfaces:**
- Produces: `readCart(storage)`, `writeCart(storage, lines)`, `addLine(lines, id, variantId)`, `changeQty(lines, id, delta)`, `removeLine(lines, id)`, `hydrate(lines, catalog)` returning `{ lines, removed }`.
- All functions are pure except `readCart`/`writeCart`, which take a storage object so they are testable without a browser.

- [ ] **Step 1: Write the failing test**

Create `tests/cart-storage.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { readCart, writeCart, addLine, changeQty, removeLine, hydrate } =
  await import('../lib/cart-storage.js');

/** Minimal in-memory stand-in for localStorage. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('an empty or absent store reads as an empty cart', () => {
  assert.deepEqual(readCart(fakeStorage()), []);
  assert.deepEqual(readCart(fakeStorage({ liquordash_cart: 'not json' })), []);
  assert.deepEqual(readCart(null), []);
});

test('a written cart reads back identically', () => {
  const storage = fakeStorage();
  writeCart(storage, [{ id: 1, variantId: null, quantity: 2 }]);
  assert.deepEqual(readCart(storage), [{ id: 1, variantId: null, quantity: 2 }]);
});

test('malformed lines are discarded on read', () => {
  const storage = fakeStorage({
    liquordash_cart: JSON.stringify({ lines: [{ id: 1, quantity: 2 }, { quantity: 3 }, null] }),
  });
  const lines = readCart(storage);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 1);
});

test('adding the same product twice increments rather than duplicating', () => {
  let lines = addLine([], 1, null);
  lines = addLine(lines, 1, null);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
});

test('changeQty removes a line when it reaches zero', () => {
  let lines = addLine([], 1, null);
  lines = changeQty(lines, 1, -1);
  assert.deepEqual(lines, []);
});

test('changeQty never produces a negative quantity', () => {
  const lines = changeQty([{ id: 1, variantId: null, quantity: 1 }], 1, -5);
  assert.deepEqual(lines, []);
});

test('removeLine drops only the named product', () => {
  const lines = removeLine(
    [{ id: 1, variantId: null, quantity: 1 }, { id: 2, variantId: null, quantity: 1 }],
    1
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 2);
});

test('hydrate drops lines that are no longer purchasable and reports them', () => {
  const catalog = [
    { wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null },
    { wcId: 2, name: 'Gin', stockStatus: 'outofstock', stockQuantity: 0 },
  ];
  const result = hydrate(
    [{ id: 1, variantId: null, quantity: 1 }, { id: 2, variantId: null, quantity: 1 }],
    catalog
  );

  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].id, 1);
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].name, 'Gin');
});

test('hydrate caps a line at the available quantity instead of dropping it', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 2 }];
  const result = hydrate([{ id: 1, variantId: null, quantity: 9 }], catalog);

  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.removed.length, 0);
  assert.equal(result.capped.length, 1);
  assert.equal(result.capped[0].name, 'Jameson');
});

test('hydrate leaves a valid cart untouched', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null }];
  const lines = [{ id: 1, variantId: null, quantity: 3 }];
  const result = hydrate(lines, catalog);
  assert.deepEqual(result.lines, lines);
  assert.equal(result.removed.length, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/cart-storage.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/cart-storage.js`**

```js
/**
 * Cart state, owned entirely by the client.
 *
 * The cart previously round-tripped to CoCart on every add, increment,
 * decrement and remove — about 1.5s to the WooCommerce origin per tap. None
 * of that was necessary: WooCommerce prices and validates the order at
 * creation, so the cart before that point is a local list of intentions.
 *
 * These functions are pure and take storage as an argument, so the rules are
 * testable without a browser.
 */

import { isPurchasable, maxOrderableQty } from './stock.js';

export const CART_KEY = 'liquordash_cart';

function isValidLine(line) {
  return Boolean(line) && Number.isFinite(Number(line.id)) && Number(line.quantity) > 0;
}

export function readCart(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const lines = Array.isArray(parsed) ? parsed : parsed?.lines;
    if (!Array.isArray(lines)) return [];
    return lines.filter(isValidLine).map((l) => ({
      id: Number(l.id),
      variantId: l.variantId ?? null,
      quantity: Number(l.quantity),
    }));
  } catch {
    return [];
  }
}

export function writeCart(storage, lines) {
  if (!storage) return;
  try {
    storage.setItem(CART_KEY, JSON.stringify({ lines, updatedAt: new Date().toISOString() }));
  } catch {
    // Private browsing or a full quota. The in-memory cart still works for
    // this session; losing it on reload is better than breaking the page.
  }
}

export function addLine(lines, id, variantId = null) {
  const existing = lines.find((l) => l.id === id);
  if (existing) {
    return lines.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1, variantId: variantId ?? l.variantId } : l));
  }
  return [...lines, { id, variantId, quantity: 1 }];
}

export function changeQty(lines, id, delta) {
  return lines
    .map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
}

export function removeLine(lines, id) {
  return lines.filter((l) => l.id !== id);
}

/**
 * Reconcile a stored cart against the current catalogue.
 *
 * A cart can sit in localStorage for days. Lines that went out of stock are
 * removed and reported so the customer is told rather than discovering it at
 * payment; lines that exceed remaining stock are capped rather than dropped.
 *
 * @returns {{ lines, removed: Array<{id,name}>, capped: Array<{id,name,quantity}> }}
 */
export function hydrate(lines, catalog) {
  const byId = new Map(catalog.map((p) => [Number(p.wcId), p]));
  const kept = [];
  const removed = [];
  const capped = [];

  for (const line of lines) {
    const product = byId.get(Number(line.id));

    if (!product || !isPurchasable(product)) {
      removed.push({ id: line.id, name: product?.name || 'An item' });
      continue;
    }

    const max = maxOrderableQty(product);
    if (line.quantity > max) {
      kept.push({ ...line, quantity: max });
      capped.push({ id: line.id, name: product.name, quantity: max });
      continue;
    }

    kept.push(line);
  }

  return { lines: kept, removed, capped };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/cart-storage.test.js`
Expected: PASS, 10/10.

- [ ] **Step 5: Commit**

```bash
git add lib/cart-storage.js tests/cart-storage.test.js
git commit -m "Add pure client-side cart storage rules

Pure functions over a storage object, so cart behaviour is testable
without a browser. Hydration reconciles a stored cart against the
catalogue: out-of-stock lines are removed and reported, over-quantity
lines are capped rather than dropped."
```

---

### Task 4: Rewrite the cart context with no network calls

**Files:**
- Modify: `lib/cart-context.js`
- Delete: `app/api/cart/route.js`

**Interfaces:**
- Consumes: everything from Task 3.
- Produces: the same context value as before, plus `cartNotice` and `dismissCartNotice`.

- [ ] **Step 1: Rewrite `lib/cart-context.js`**

```jsx
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readCart, writeCart, addLine, changeQty, removeLine, hydrate } from './cart-storage.js';

const CartContext = createContext(null);

/**
 * Cart state.
 *
 * Every mutation is local and synchronous — no network call, so the badge
 * updates on the tap rather than after a ~1.5s round trip to WooCommerce.
 * The order is priced and validated by WooCommerce at creation, which is the
 * only place that check has to happen.
 */
export function CartProvider({ children, initialProducts = [] }) {
  const [cart, setCart] = useState([]);
  const [upsellPopup, setUpsellPopup] = useState(null);
  const [products, setProducts] = useState(initialProducts);

  // What hydration changed, so the customer can be told.
  const [cartNotice, setCartNotice] = useState(null);

  const loaded = useRef(false);

  // Restore once on mount. Nothing is fetched.
  useEffect(() => {
    const stored = readCart(typeof window === 'undefined' ? null : window.localStorage);
    setCart(stored);
    loaded.current = true;
  }, []);

  // Persist after every change, but not before the initial read has run —
  // otherwise the empty starting state overwrites a stored cart.
  useEffect(() => {
    if (!loaded.current) return;
    writeCart(typeof window === 'undefined' ? null : window.localStorage, cart);
  }, [cart]);

  // Reconcile against the catalogue once products are available.
  useEffect(() => {
    if (!loaded.current || products.length === 0 || cart.length === 0) return;

    const { lines, removed, capped } = hydrate(cart, products);
    if (removed.length === 0 && capped.length === 0) return;

    setCart(lines);
    setCartNotice({ removed, capped });
  }, [products, cart]);

  const buzz = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  const addToCart = useCallback((productId, variantId = null) => {
    buzz();
    setCart((prev) => addLine(prev, productId, variantId));

    const product = products.find((p) => p.id === productId);
    if (!product?.upsellIds?.length) return;

    const upsellProducts = product.upsellIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p) => p && p.purchasable !== false && p.inStock !== false);

    if (upsellProducts.length > 0) {
      setTimeout(() => {
        queueMicrotask(() => setUpsellPopup({ product, upsellProducts }));
      }, 300);
    }
  }, [products]);

  const incrementItem = useCallback((productId) => {
    buzz();
    setCart((prev) => changeQty(prev, productId, 1));
  }, []);

  const decrementItem = useCallback((productId) => {
    buzz();
    setCart((prev) => changeQty(prev, productId, -1));
  }, []);

  const removeItem = useCallback((productId) => {
    buzz();
    setCart((prev) => removeLine(prev, productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const getQuantity = useCallback(
    (productId) => cart.find((i) => i.id === productId)?.quantity || 0,
    [cart]
  );

  const dismissCartNotice = useCallback(() => setCartNotice(null), []);

  return (
    <CartContext.Provider value={{
      cart, setCart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity,
      upsellPopup, setUpsellPopup,
      products, setProducts,
      cartNotice, dismissCartNotice,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
```

- [ ] **Step 2: Delete the cart API route**

```bash
rm -rf app/api/cart
```

Nothing else references it — the only two callers were in `lib/cart-context.js`, both removed in Step 1.

- [ ] **Step 3: Verify**

Run: `npm test && npx next build`
Expected: 80 passing, build clean.

With the dev server up, confirm the route is gone:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cart
```

Expected: `404`.

- [ ] **Step 4: Commit**

```bash
git add lib/cart-context.js
git rm -r --cached app/api/cart 2>/dev/null || true
git add -A app/api
git commit -m "Make the cart pure client state

Every add, increment, decrement and remove round-tripped to CoCart —
about 1.5s to the WooCommerce origin per tap. The cart is now local and
synchronous, reconciled against the catalogue on load so a stale cart
is corrected before checkout rather than at payment."
```

---

### Task 5: Cut checkout to four fields

**Files:**
- Modify: `components/CheckoutModal.js`

**Interfaces:**
- Consumes: `cartNotice` from Task 4.

Background: the modal currently manages 18 pieces of state and shows KRA PIN as a default field. The spec's captured set is phone, name, delivery address, optional email — with KRA PIN behind a disclosure.

- [ ] **Step 1: Put the KRA PIN behind a disclosure**

In `components/CheckoutModal.js`, add alongside the other `useState` declarations:

```js
  // KRA PIN is only needed for a VAT receipt, which most customers do not
  // want. A always-visible tax field on a liquor delivery checkout reads as
  // bureaucratic and costs conversions.
  const [wantsVatReceipt, setWantsVatReceipt] = useState(false);
```

Find the KRA PIN input block (the `<input>` whose placeholder is `e.g. A123456789B`, with its surrounding label wrapper) and wrap it:

```jsx
                  <div>
                    <button
                      type="button"
                      onClick={() => setWantsVatReceipt((v) => !v)}
                      className="text-xs font-semibold text-[#840037] underline underline-offset-2"
                    >
                      {wantsVatReceipt ? 'Skip VAT receipt' : 'Need a VAT receipt?'}
                    </button>
                  </div>

                  {wantsVatReceipt && (
                    /* the existing KRA PIN label + input block goes here, unchanged */
                  )}
```

Then make the submit stop sending an unused PIN — find where the body is assembled and change:

```js
          kraPin: kraPin.trim(),
```

to:

```js
          kraPin: wantsVatReceipt ? kraPin.trim() : '',
```

- [ ] **Step 2: Surface the stock notice**

Add near the top of the modal body, above the item list:

```jsx
      {cartNotice && (
        <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          {cartNotice.removed.map((r) => (
            <div key={`r-${r.id}`}>{r.name} sold out and was removed from your cart.</div>
          ))}
          {cartNotice.capped.map((c) => (
            <div key={`c-${c.id}`}>Only {c.quantity} of {c.name} left — we adjusted your cart.</div>
          ))}
          <button
            type="button"
            onClick={dismissCartNotice}
            className="mt-1 font-bold underline underline-offset-2"
          >
            Got it
          </button>
        </div>
      )}
```

Destructure `cartNotice` and `dismissCartNotice` from `useCart()` at the top of the component. If the modal does not already call `useCart`, add:

```js
  const { cartNotice, dismissCartNotice } = useCart();
```

and import it: `import { useCart } from '@/lib/cart-context';`

- [ ] **Step 3: Handle a 409 from checkout**

Find where the checkout response is handled and replace the error branch:

```js
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Order failed (${res.status})`);
```

with:

```js
      const data = await res.json();

      // 409 means stock moved while the customer was checking out. The
      // response names each affected product; show that rather than a
      // generic failure the customer cannot act on.
      if (res.status === 409) {
        setError(data.message || data.error || 'Some items are no longer available');
        setStep('confirm');
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || `Order failed (${res.status})`);
```

- [ ] **Step 4: Verify and commit**

Run: `npm test && npx next build`
Expected: 80 passing, build clean.

```bash
git add components/CheckoutModal.js
git commit -m "Reduce checkout to four fields and surface stock changes

KRA PIN moves behind a 'need a VAT receipt?' disclosure rather than
sitting on the default path. A 409 from checkout now names the products
that sold out instead of showing a generic failure."
```

---

## Self-Review

**Spec coverage.** §1 freshness — Task 1 (webhook deltas), Task 2 (reconcile). §4 cart — Tasks 3, 4. §5 checkout fields — Task 5. Defect: webhook signature failures invisible — Task 1 Step 5. Not in this plan: §6 identity and §7 address capture (stage 6–7), and the guest-checkout identity change, which depends on §6.

**Placeholder scan.** One deliberate structural instruction in Task 5 Step 1 (`the existing KRA PIN label + input block goes here, unchanged`) — the block must be moved rather than retyped, and its exact markup is in the file. Every other step carries complete code.

**Type consistency.** `extractStockDelta` returns a shape `upsertProduct` accepts (Task 1, reused in Task 2). `isAuthorisedCron(provided, expected)` argument order is the same in `lib/cron-auth.js` and the route. `hydrate` returns `{ lines, removed, capped }` in Task 3 and is destructured that way in Task 4; `cartNotice` carries `{ removed, capped }` in Task 4 and is read as such in Task 5. Cart line shape `{ id, variantId, quantity }` is unchanged from the existing context, so the four consuming files need no edit.

**Test counts.** Baseline 61. Task 1 +4 = 65; Task 2 +5 = 70; Task 3 +10 = 80. Tasks 4 and 5 add no tests (UI wiring, covered by build plus manual verification).
