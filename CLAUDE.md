@AGENTS.md

# Fast Cart

Two storefronts in one Next.js 16 app (App Router, JS not TS, Tailwind 4, `@/` alias):

- **Retail** (`app/page.js`, `/api/checkout`, `/api/orders`, `/api/auth/*`): WooCommerce is the system of record. Customers log in by OTP. Paystack settles retail orders via `lib/order-payment.js`.
- **Trade / B2B** (`app/trade/*`, `/api/trade/*`, `app/admin/trade/*`): the Happy Hour wholesale portal. Its own data model, auth and pricing. Spec: `Happy_Hour__B2B_Trade_Portal_Dev_Brief.md`; later specs/plans in `docs/superpowers/`.

**Current focus is the trade side.** Retail is out of scope unless stated.

## Commands

- `npm run dev` / `build` / `start` / `lint`
- `npm test` (`node --test "tests/**/*.test.js"`) — retail and trade tests. Network-free; never point tests at the real WooCommerce store (`WOOCOMMERCE_STORE_URL` in `.env.local` is live).
- Browser checks: Playwright/Chrome-DevTools MCP tools do not work here (no Google Chrome). Drive the local Playwright Chromium from a node script (see `check-browser.mjs`, `take-screenshot.mjs`).
- Dev on WSL2: if the page is stuck on a spinner with an empty log, check `allowedDevOrigins` in `next.config.mjs` (Next 16 blocks cross-origin `/_next` resources).

## Trade architecture

- **Storage is dual**: Postgres (`lib/trade/trade-pg.js`, `DATABASE_URL`, tables created by `ensureTradeDb()`) plus a JSON store (`lib/trade/trade-store.js`, 3000 lines, mirrored on writes). Keep both in sync when changing order/account state. Payment settlement does this in `lib/trade/trade-payment.js`.
- **Auth**: `lib/trade/trade-auth.js` (cookie `trade_token`, audience-scoped JWT via `lib/crypto-tokens.js`); admin uses `admin_token`. `proxy.js` is only a defence-in-depth gate (Next 16 "proxy" replaced middleware and is not an authorisation boundary). Every route handler must run its own guard. `PRE_AUTH_PATHS` in `proxy.js` lists the public trade endpoints (`/api/trade/auth`, `apply`, `catalog`, `checkout`). A new admin or trade route fails closed by default.
- **Pricing is server-authoritative**: `lib/trade/pricing-engine.js`, `trade-catalog.js#resolveTradeLineItems`. The client sends only identifier + quantity; never trust prices, costs or tiers from the request body. `pricing-visibility.js#stripEconomics` removes cost/margin from responses. Spirits margins are thin: a pricing bug is a loss-making order.
- **Accounts** (`buildTradeAccount`): have `status` (pending/approved…), `creditEnabled`, `creditLimit`, `creditUsed`, `creditTerms` (days), `cleanOrders`, addresses, users with `seatType` (`viewer` cannot order). The UI calls these "Business Accounts" (the old "Credit Account" name was renamed in commit 6e37c7d).
- **Guest trade checkout is allowed**: `/api/trade/checkout` is public; guests are find-or-created as lightweight accounts (`findOrCreateGuestTradeAccount`). Guests may not use credit.
- **Orders**: `createTradeOrder` (trade-store.js) validates minimums, credit limit and age confirmation; status changes go through `updateTradeOrderStatus`. Documents (quote/invoice/delivery note PDFs, email) in `trade-documents.js`, `trade-pdf.js`, `trade-email.js`.

## Payments (trade) — as of 2026-10-16

Methods accepted by `/api/trade/checkout` (`ALLOWED_METHODS`): `pay_on_account`, `mpesa_paybill`, `bank_transfer`, `paystack`.

- **Paystack**: `lib/paystack.js` (init/verify, CSPRNG reference, raw-body HMAC-SHA512 webhook check). Flow: checkout creates the order, initialises Paystack, stores `paystack_reference`, sets `pending_payment`. `/api/paystack/callback` (browser) and `/api/paystack/webhook` (server) both settle through `settleTradeOrderFromPayment` (idempotent, reference-, amount- and currency-checked) when metadata has `trade_order_id`; otherwise retail settlement. Needs `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` — **not present in `.env.local` as of this date**, so it cannot work locally until set.
- **Pay on account** (`pay_on_account`): only for logged-in, `creditEnabled` accounts; enforced in the checkout route and again in `createTradeOrder`. Limit check is `creditUsed + total <= creditLimit`.

### Planned (agreed in brainstorming, not built)

1. Real-browser test of trade checkout as guest and as logged-in user; patch any security gaps found.
2. Make Paystack the "pay now" option and prove it works end to end.
3. **Nirvana Africa logbook-loan** option: trade only. Manual process with no API. Visible to guests with a notice that an account is required; selecting it takes no payment up front. Only logged-in, admin-approved businesses can place it; order is held pending until staff mark it paid/cancelled after Nirvana funds. Show Nirvana's eligibility requirements (original logbook, ID copy, KRA PIN, valuation, passport photo) for information only — no link to Nirvana's application; a dedicated contact handles these.
4. **Credit** option (was called "LPO"): same mechanism as `pay_on_account`; shown only to credit-approved businesses, hidden from everyone else.

Update this section as each item ships.

## Gotchas

- Past commits shipped truncated JSX that caused 500s. After any UI edit, smoke-test the route.
- Don't `pkill` by pattern: check for an existing dev server first.
- A "broken" browser API (geolocation etc.) may be blocked by `Permissions-Policy` in `next.config.mjs`.
- Never import `lib/shipping.js` (Node `fs`) from client components. Use `lib/zone-match-client.js`.
- Geocoding goes through `/api/geo/*` proxies because the CSP blocks direct Nominatim calls.
- Manually-priced tables need an explicit, mandatory selection in the UI that shows the resulting price. Don't rely on fuzzy auto-match.

## Keeping this file current

When you change trade payments, account/credit rules, auth guards, storage or env vars, update the matching section in the same change. Move items out of "Planned" when they ship, and date the section header.
