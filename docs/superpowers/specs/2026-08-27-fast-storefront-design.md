# Fast storefront: cache, checkout, identity and address capture

**Date:** 2026-08-27
**Status:** approved, pending implementation
**Branch:** `chrisupdates`

## Why

WooCommerce's origin costs ~1,550 ms per request, measured against
`myhappyhour.co.ke`. The local JSON cache answers in ~30 ms. That 50×
gap is the whole problem: browsing is already cache-backed and fast,
but every cart operation, customer lookup and order step pays the full
origin cost.

The goal is to reach WooCommerce **once per order**, at order creation,
and serve everything else from cache — without ever selling something
that is out of stock.

## Measurements

| Path | Latency |
| --- | --- |
| `/api/products` (local cache, 120 KB) | 30 ms |
| `/api/zones`, `/api/brands`, `/api/settings` | 23–30 ms |
| WooCommerce origin TTFB | 1,516–1,681 ms |
| TLS handshake to origin | 403–443 ms |

## Defects this work must fix

These were found while surveying the current implementation. Each one
blocks a stated goal.

1. **Sync silently truncates at 100 products.** `app/api/admin/sync/route.js`
   calls `wcFetch('products', { per_page: '100' })` with no pagination.
   The cache holds 106 products, so the ceiling is already reached.
   `wcFetchAll` exists and is unused.

2. **Admin product edits are destroyed by sync and never reach
   WooCommerce.** `upsertProduct` spreads incoming WooCommerce values
   over the stored row, so a locally-set `stockStatus` is overwritten on
   the next sync. Admin's stock edits are therefore both non-durable and
   invisible to WooCommerce.

3. **Nominatim calls are blocked by our own CSP.** `connect-src` in
   `next.config.mjs` omits `nominatim.openstreetmap.org`, so every
   browser-side reverse-geocode in `CheckoutModal`, `LocationPrompt` and
   `ProfileSetup` fails silently. GPS detection is currently dead in
   production.

4. **Phone-only customers cannot log in.** `findOrCreateCustomer` invents
   `liquor_<phone>@liquordash.local`; `send-otp` correctly refuses to mail
   placeholder addresses. Those customers are pushed to a WooCommerce
   password they never set.

## Non-goals

- SMS OTP. No budget; email is the only delivery channel.
- Google Maps or any paid geocoding.
- Replacing WooCommerce. It remains the system of record for products,
  stock, customers and orders.
- Migrating the JSON stores to a database. Tracked separately; required
  before multi-instance deploy.

## Architecture

```
Browse / cart / address        Order creation only
        │                              │
        ▼                              ▼
  ┌───────────┐                 ┌──────────────┐
  │ JSON cache│◀── webhook ─────│ WooCommerce  │
  │  ~30 ms   │◀── reconcile ───│  ~1,550 ms   │
  └───────────┘                 └──────────────┘
        ▲                              ▲
        │                              │
   client cart                  single POST /orders
   (localStorage)               (stock revalidated here)
```

Reads are served from cache. The only synchronous customer-facing
WooCommerce call is order creation.

---

## 1. Catalogue cache and freshness

**Primary: webhook push.** `product.updated` and `product.deleted`
already reach `/api/webhook`. Extend the handler to update price, stock
status and quantity on receipt. Latency: seconds.

**Safety net: reconcile job.** A scheduled route pulls
`products?modified_after=<lastSync>` and applies anything the webhooks
missed. Webhooks fail quietly; this is what makes depending on them safe.

The route is triggered externally, not by an in-process timer — an
in-process interval dies with the process and silently stops reconciling.
It authenticates on a `x-cron-secret` header (`CRON_SECRET`), so it works
with system cron, a Vercel cron entry, or an uptime pinger without
depending on which. Default cadence 120 s; the route is idempotent, so a
double-fire is harmless.

**Repair: full sync.** The existing admin button, fixed to use
`wcFetchAll` so it pages past 100.

Freshness contract: cache may lag by seconds. That is acceptable
everywhere except order creation, where WooCommerce arbitrates (§2).

### Files

- `lib/catalog-cache.js` — new. `getCatalog()`, `applyProductDelta()`,
  `reconcile()`, `isStale()`.
- `app/api/admin/sync/route.js` — use `wcFetchAll`; record outcome to the
  event log.
- `app/api/cron/reconcile/route.js` — new, secured by a shared secret
  header, not the admin cookie.
- `app/api/webhook/route.js` — handle stock/price fields on
  `product.updated`.

## 2. Stock integrity — never sell what isn't there

Three gates, cheapest first:

1. **Hidden from listings.** `/api/products` filters out
   `stockStatus !== 'instock'` unless `settings.showOutOfStock` is true.
   Applies to search, category, brand and upsell surfaces — currently the
   filter is applied inconsistently.
2. **Blocked at add-to-cart.** The cart refuses lines whose cached
   `stockStatus` is not `instock`, or whose quantity exceeds
   `stockQuantity` when it is tracked.
3. **Revalidated at order creation.** Before building the WooCommerce
   payload, `/api/checkout` re-reads the cached rows and rejects the
   order with a per-line reason if anything went out of stock. If
   WooCommerce itself then refuses a line, that error is surfaced
   verbatim rather than as a generic failure.

Gate 3 is the authoritative one; 1 and 2 exist so customers rarely reach
it.

### Files

- `lib/stock.js` — new. `isPurchasable(product)`,
  `validateCartLines(lines)` returning `{ ok, rejected[] }`.
- `app/api/products/route.js`, `app/api/checkout/route.js`,
  `lib/cart-context.js`.

## 3. Admin product ownership

Split the product row so sync and admin stop fighting:

- **WooCommerce-owned** (`price`, `regularPrice`, `salePrice`,
  `stockStatus`, `stockQuantity`, `sku`, `name`, `slug`): overwritten by
  sync, never edited locally.
- **Locally-owned** (`overrides: { hidden, featured, sortWeight,
  displayName, badge }`): sync never touches these.

`upsertProduct` preserves `overrides` across sync, the way it already
preserves `variations`.

Admin edits to a WooCommerce-owned field **write through**: `PUT
/api/admin/products` pushes to WooCommerce first, and only updates the
cache once WooCommerce confirms. A write-through failure surfaces as an
error rather than a silently divergent local value.

### Files

- `lib/data-store.js` — `upsertProduct` preserves `overrides`.
- `app/api/admin/products/route.js` — write-through via `wcPut`.

## 4. Cart — client-owned, zero origin calls

The cart moves entirely client-side. CoCart is removed from the shopping
path; `lib/cocart.js` remains only for password login.

- State in `localStorage` under one key, shape
  `{ lines: [{ wcId, variationId, qty, addedAt }], updatedAt }`.
- Adds are optimistic — the badge updates on tap, no network.
- On load and on checkout open, lines are re-hydrated against the cache:
  prices refreshed, unpurchasable lines flagged for the customer to
  confirm removal.
- Cart totals are display-only. WooCommerce prices the order.

### Files

- `lib/cart-context.js` — rewrite.
- `app/api/cart/route.js` — deleted.

## 5. Checkout — guest-first

Buying never requires an account.

**Captured fields, in order:** phone → name → delivery address →
optional email. Nothing else. KRA PIN moves behind a "need a VAT
receipt?" disclosure; it is not a default field.

Flow:

1. Cart lines validated against cache (§2 gate 2).
2. Address resolved (§6); delivery fee priced server-side from the zone
   catalogue as already implemented.
3. Single `POST /api/checkout` → revalidate stock → find-or-create
   customer → create order → initialise Paystack. These are sequential
   because each depends on the last; the win is that this is now the
   *only* origin round trip in the session.
4. Redirect to Paystack.

A returning customer with a session skips phone, name and address
entirely — they are read from the session and saved addresses.

The phone number is the customer key. Placing an order attaches it to
that customer record. **Order history remains behind the email-verified
session**, so this creates a write path without a read path — an
attacker can place a nuisance order but cannot read anyone's data. This
is a deliberate, accepted trade, recorded here because it partially
relaxes the ownership model introduced in the security remediation.

### Files

- `components/CheckoutModal.js` — reduce to the four fields.
- `app/api/checkout/route.js` — stock revalidation.

## 6. Identity — email-based, phone-keyed

Sign-in accepts **phone, email or username** in one field. The server
resolves it to a customer, then sends a **magic link** to that customer's
real email. Email OTP remains as the fallback for customers who prefer
typing a code.

Customers whose only address is `@liquordash.local` cannot receive
anything. They are handled progressively, not by migration: checkout
offers an optional email field, and each order that captures one
upgrades that customer from unreachable to reachable. Existing customers
with real emails work immediately.

Magic links are single-use, 15-minute, signed with the customer audience
secret, and consumed through the existing OTP store so replay protection
is shared.

CoCart password sign-in is **retained, demoted to a last resort**: some
existing customers do have a real WooCommerce password, and removing it
would lock them out. It is offered only when the identifier resolves to a
customer with no reachable email, and it is never the first thing
offered. `lib/cocart.js` exists for this and nothing else once the cart
moves client-side.

### Files

- `app/api/auth/identify/route.js` — new. Resolves phone/email/username
  to a customer without disclosing whether one matched.
- `app/api/auth/magic-link/route.js` — new. Issue and consume.
- `lib/auth-context.js`, `components/AccountModal.js`.

## 7. Address capture

Three layers, in the order a customer meets them.

**D — Saved addresses.** A signed-in customer picks a previous delivery
address. Stored on the customer's WooCommerce `meta_data` so they
survive independently of our cache. Handles the repeat-order majority.

**A — Self-seeding building directory.** Every completed delivery
contributes its building to a directory keyed by zone. Typing three
characters autocompletes against buildings we have actually delivered
to. Starts thin, compounds weekly, costs nothing, and needs no
maintenance. Backfilled from historical WooCommerce orders once the REST
API is reachable.

Directory entry: `{ id, name, zoneId, area, deliveryCount, lastUsedAt,
verified }`. `verified` is set once a rider completes a delivery there.
Free-text entries that never reach a completed delivery expire after 90
days so typos do not accumulate.

**B — GPS zone detection.** Reverse geocoding moves **server-side** to
`/api/geo/reverse`, which fixes the CSP block, respects Nominatim's
1 req/s policy behind our own queue, and caches by coordinate rounded to
4 decimals (~11 m). Its only job is answering *which delivery zone* —
that is what sets the fee. Building-level results are treated as a
suggestion, never as truth.

Fallback is always free text plus a landmark hint. No flow dead-ends.

### Files

- `lib/address-directory.js` — new.
- `app/api/addresses/suggest/route.js` — new, autocomplete.
- `app/api/geo/reverse/route.js` — new, proxied and cached.
- `next.config.mjs` — Nominatim is no longer called from the browser, so
  no CSP change is needed; the existing client calls are removed.

## 8. Observability

Every integration boundary records an event: WooCommerce calls, webhook
receipts, geocode attempts, order creation, payment settlement, sync and
reconcile runs.

Event: `{ ts, kind, outcome, durationMs, detail, correlationId }`.
Stored in a ring buffer capped at 2,000 entries, written atomically.
Never contains credentials, full addresses or customer emails.

Surfaced at `/admin/health`: last sync, cache age, webhook receipts in
the last 24 h, geocode success rate, failed orders, WooCommerce error
rate. A red state on this page is what would have exposed the
CSP-blocked geocoder and the firewalled REST API, both of which are
failing silently today.

### Files

- `lib/event-log.js` — new.
- `app/api/admin/health/route.js`, `app/admin/health/page.js` — new.

## Data model changes

`data/store.json`:

- `products[].overrides` — new, locally-owned, preserved across sync.
- `buildings[]` — new, the address directory.
- `events[]` — new, capped ring buffer.
- `lastReconcile` — new.

All additive. No migration required; absent fields default.

## Error handling

- Cache miss or empty catalogue → serve stale with a warning banner,
  never an empty shop.
- Reconcile failure → logged, retried next tick, surfaced on the health
  page after two consecutive failures.
- Geocode failure → silent fallback to manual zone selection. Logged.
- Stock rejection at checkout → per-line message naming the product, with
  the option to remove and continue.
- WooCommerce unreachable at order creation → the order is not created
  and the customer is told plainly. No optimistic order records; a
  cached order that WooCommerce never received would be worse than a
  failed checkout.

## Testing

- `lib/stock.js` — purchasability and quantity limits, including
  untracked stock (`stockQuantity: null`).
- `lib/catalog-cache.js` — delta application, staleness, reconcile
  merge, `overrides` preservation across sync.
- `lib/address-directory.js` — matching, ranking by `deliveryCount`,
  expiry of unverified entries.
- Checkout — stock revalidation rejects an order whose cached line went
  out of stock between add and pay.
- Identity — an identifier that resolves to no customer is
  indistinguishable in the response from one that does.
- Existing 30 tests must stay green.

## Rollout

1. Defects 1–3, plus the event log. Independently useful, no behaviour
   change.
2. Stock integrity. Enforces the "never sell out of stock" rule on the
   current architecture.
3. Cache freshness (webhook + reconcile).
4. Client cart.
5. Guest checkout and the reduced field set.
6. Address capture.
7. Identity.

Each stage ships green — tests passing and a clean production build —
and each gets its own implementation plan rather than one plan spanning
all seven. Stages 1 and 2 are the ones that change customer-visible
behaviour least while removing the most risk, so they go first.

## Requires operator action

- **Open the WooCommerce REST API** to the app server. Currently
  `nfw_rest_api_access_restricted` (NinjaFirewall). Sync, reconcile and
  the directory backfill all depend on it.
- **Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET`.** Absent, so
  payment confirmation cannot work.
- **Register `product.updated` / `product.deleted` webhooks** in
  WooCommerce pointing at `/api/webhook`, with
  `WOOCOMMERCE_WEBHOOK_SECRET`.
- **Rotate the exposed credentials** before going live, as agreed.
