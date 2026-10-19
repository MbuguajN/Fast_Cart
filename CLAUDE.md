@AGENTS.md

# Fast Cart

Two storefronts in one Next.js 16 app (App Router, JS not TS, Tailwind 4, `@/` alias):

- **Retail** (`app/page.js`, `/api/checkout`, `/api/orders`, `/api/auth/*`): WooCommerce is the system of record. Customers log in by OTP. Paystack settles retail orders via `lib/order-payment.js`.
- **Trade / B2B** (`app/trade/*`, `/api/trade/*`, `app/admin/trade/*`): the Happy Hour wholesale portal. Its own data model, auth and pricing. Spec: `Happy_Hour__B2B_Trade_Portal_Dev_Brief.md`; later specs/plans in `docs/superpowers/`.

**Current focus is the trade side.** Retail is out of scope unless stated.

## Commands

- `npm run dev` / `build` / `start` / `lint`
- `npm run migrate` (`node scripts/migrate.mjs`) — runs standalone Postgres schema migrations via `ensureTradeDb()` and closes the connection pool.
- `npm run cache-images` (`node scripts/cache-images.mjs`) — downloads remote WooCommerce product/brand images to `public/uploads/products/` and updates store paths so images load instantly from local disk.
- `./update.sh` — production update script: pulls `chrisupdates`, runs `npm install`, runs `npm run migrate`, runs `npm run build`, restarts Fastpanel systemd service, and verifies port 3061.
- `npm test` (`node --test "tests/**/*.test.js"`) — retail and trade tests. Network-free; never point tests at the real WooCommerce store (`WOOCOMMERCE_STORE_URL` in `.env.local` is live).
- Browser checks: Playwright/Chrome-DevTools MCP tools do not work here (no Google Chrome). Drive the local Playwright Chromium from a node script (see `check-browser.mjs`, `take-screenshot.mjs`).
- Dev on WSL2: if the page is stuck on a spinner with an empty log, check `allowedDevOrigins` in `next.config.mjs` (Next 16 blocks cross-origin `/_next` resources).

## Trade architecture

- **Database (PostgreSQL) is the authoritative system of record**: PostgreSQL (`lib/trade/trade-pg.js`, `DATABASE_URL`, managed by `ensureTradeDb()`) is the primary database for all accounts, users, credentials, orders, quotes, inventory, pricing, and config. **Never store application state, users, or credentials in files on disk (`data/*.json`).** Do not introduce dual-mirroring or file-based stores.
- **Auth**: `lib/trade/trade-auth.js` (cookie `trade_token`, audience-scoped JWT via `lib/crypto-tokens.js`); admin uses `admin_token`. `proxy.js` is only a defence-in-depth gate (Next 16 "proxy" replaced middleware and is not an authorisation boundary). Every route handler must run its own guard. `PRE_AUTH_PATHS` in `proxy.js` lists the public trade endpoints (`/api/trade/auth`, `apply`, `catalog`, `checkout`, `checkout-options`). A new admin or trade route fails closed by default.
- **Pricing is server-authoritative**: `lib/trade/pricing-engine.js`, `trade-catalog.js#resolveTradeLineItems`. The client sends only identifier + quantity; never trust prices, costs or tiers from the request body. `pricing-visibility.js#stripEconomics` removes cost/margin from responses. Spirits margins are thin: a pricing bug is a loss-making order.
- **Accounts** (`buildTradeAccount`): have `status` (pending/approved…), `creditEnabled`, `creditLimit`, `creditUsed`, `creditTerms` (days), `cleanOrders`, addresses, users with `seatType` (`viewer` cannot order). The UI calls these "Business Accounts" (the old "Credit Account" name was renamed in commit 6e37c7d).
- **Guest trade checkout is allowed**: `/api/trade/checkout` is public; guests are find-or-created as lightweight accounts (`findOrCreateGuestTradeAccount`). Guests may not use credit.
- **Orders**: `createTradeOrder` (trade-store.js) validates minimums, credit limit and age confirmation; status changes go through `updateTradeOrderStatus`. Documents (quote/invoice/delivery note PDFs, email) in `trade-documents.js`, `trade-pdf.js`, `trade-email.js`.

## Payments (trade) — as of 2026-10-16

Methods accepted by `/api/trade/checkout` (`PAYMENT_METHODS` in `lib/trade/payment-methods.js`): `paystack`, `pay_on_account`, `bank_transfer`. Anything else (including the removed `mpesa_paybill`) is rejected with 400. `assertPaymentMethodAllowed` is the single rule set, used by the route; `createTradeOrder` keeps its own credit backstop.

- **Paystack** (`lib/paystack.js`): checkout creates the order, initialises Paystack, then `markAwaitingPayment` (`lib/trade/trade-hold.js`) sets `pending_payment`, stores the reference and starts the **stock hold** (`stockHoldMinutes`, default 15, admin-editable in Admin → Trade settings). `/api/paystack/callback` (browser) and `/api/paystack/webhook` (server) settle via `settleTradeOrderFromPayment` (idempotent; reference/amount/currency checked; the final UPDATE is conditional so it cannot race the expiry sweep). Needs `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` in `.env.local`.
- **Hold expiry**: `expireUnpaidHolds()` cancels (and restocks) unpaid Paystack orders past `hold_expires_at`. Triggered by `GET/POST /api/cron/trade-holds` (header `x-cron-secret` = `CRON_SECRET`; schedule every minute) and lazily on the admin orders list. A payment that arrives after expiry is **not** confirmed: the order gets `payment_status = 'paid_after_expiry'` for staff to refund (cancelled orders cannot be reopened). If Paystack init fails, the order is cancelled and restocked.
- **Pay on account**: only logged-in, `creditEnabled` accounts; hidden from everyone else; limit check `creditUsed + total <= creditLimit`.
- **Bank transfer**: off by default; admin switch + details stored in trade config (`bankTransfer`), cannot be enabled without bank name/account name/account number. No bank details in source.
- **Nirvana Africa logbook loan**: UI-only information option on the checkout page (never sent to the API). Guests see it with a "create an account" notice; logged-in users see the requirements and the dedicated contact (`nirvanaContact` in config). No order, no payment, no stock effect.
- **Config**: `PUT /api/admin/trade/config` goes through `sanitizeConfigPatch` (allow-list in `lib/trade/trade-config.js`). Public, non-secret slice for the checkout page: `GET /api/trade/checkout-options`.
- **Public application** (`/api/trade/apply`): rate-limited; `cleanApplication` is an allow-list so applicants cannot set credit/tier/id fields.
- **Trade hero slides**: promotions managed at Admin → Trade Hero (`/admin/trade/hero`, API `/api/admin/trade/hero-slides`, stored in PostgreSQL `trade_config` table, logic in `lib/trade/hero-slides.js`). Public list at `/api/trade/hero-slides` (live slides only, max 8). No live slides = standard hero; the message strip under the hero is always shown.
- **Schema init** (`ensureTradeDb`) skips the DDL when `SCHEMA_SENTINEL` (last added column) exists; **move the sentinel when you append to the schema script**, or new DDL will not run on existing databases.

### Testing the trade checkout

- `npm test` (about 60 s; the retail OTP test is occasionally flaky).
- Real browser: `node scripts/seed-test-trade-accounts.mjs seed`, `node scripts/e2e-trade-checkout.mjs [--attacks]`, then `... cleanup`. Needs a running dev server. Paystack scenarios are skipped unless `PAYSTACK_SECRET_KEY` is set (use the **test** key).
- Go-live steps: `docs/go-live-trade-payments.md`.

## Gotchas

- **Never name the supplier (Pernod Ricard) on any public page.** The partnership is confidential. The catalog API blanks it via `lib/trade/public-brand.js`; the landing page features products via `lib/trade/landing-featured.js`. Say "100% original" instead. Admin screens may still use internal names.
- Past commits shipped truncated JSX that caused 500s. After any UI edit, smoke-test the route.
- Don't `pkill` by pattern: check for an existing dev server first.
- A "broken" browser API (geolocation etc.) may be blocked by `Permissions-Policy` in `next.config.mjs`.
- Never import `lib/shipping.js` (Node `fs`) from client components. Use `lib/zone-match-client.js`.
- Geocoding goes through `/api/geo/*` proxies because the CSP blocks direct Nominatim calls.
- Manually-priced tables need an explicit, mandatory selection in the UI that shows the resulting price. Don't rely on fuzzy auto-match.

## Keeping this file current

When you change trade payments, account/credit rules, auth guards, storage or env vars, update the matching section in the same change. Date the section header.
