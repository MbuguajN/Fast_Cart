# Trade Checkout: Payments, Testing & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trade checkout launch-ready: Paystack proven on test keys, unpaid-order stock holds that expire (default 15 min, admin-adjustable), M-Pesa removed, bank transfer gated behind an admin setting, credit restricted to approved accounts, and the guest and account paths verified in a real browser with security gaps patched.

**Architecture:** A small pure module decides which payment methods are allowed for a buyer; the checkout route and `createTradeOrder` both call it. Stock-hold expiry is a function plus a cron route, reusing `updateTradeOrderStatus` for cancel+restock. The checkout page reads non-secret options (bank details, hold minutes) from a public route. Browser verification is a node script that drives the local Chromium.

**Tech Stack:** Next.js 16.2 App Router (JS, `@/` alias), Postgres via `lib/trade/trade-pg.js` + mirrored JSON store, Paystack REST, `node --test`, local Chromium via Playwright/puppeteer.

**Spec:** `docs/superpowers/specs/2026-10-16-trade-checkout-payments-design.md` (§9 supersedes earlier Nirvana text).

## Global Constraints

- Read `node_modules/next/dist/docs/` for any Next API you touch before writing it (AGENTS.md): Next 16 has breaking changes.
- Trade side only. Do not change retail (`/api/checkout`, `lib/order-payment.js`, `app/page.js`).
- Stock-hold default is **15** minutes, admin-adjustable. Config key `stockHoldMinutes`.
- Currency KES; Paystack amount check = order `grand_total` incl. VAT and delivery, 1 KES tolerance (existing).
- M-Pesa paybill is removed: UI and API reject `mpesa_paybill`. Default method for missing/unknown input becomes rejection, not a fallback.
- Bank transfer is off until an admin enables it, and cannot be enabled until bank details are saved. No bank details in source code.
- Credit (`pay_on_account`) only for logged-in, `creditEnabled` accounts; hidden for everyone else.
- Never commit or print Paystack keys. Keys live in `.env.local`, added by the owner.
- Never point tests at the real WooCommerce store. Test data lives in the local Postgres/JSON store, named `TEST_`-prefixed, and is removed afterwards.
- Both stores (Postgres `trade_orders`, JSON `store.orders`) must stay consistent on every order/stock change.
- After any UI edit, smoke-test the route (past commits shipped truncated JSX that 500'd).

## Review Focus

- Payment arrives for an order the hold already expired/cancelled → must NOT re-confirm it silently; flag for staff refund. (Task 3)
- Double-clicking "Pay & Place" or replaying the POST → must not create two orders / double-deduct stock. (Task 6)
- Tampered body: prices/costs, another account's address id, `paymentMethod` of `mpesa_paybill`, `pay_on_account` as guest, huge strings. (Tasks 1, 6)
- Wrong-amount, wrong-currency, wrong-reference and replayed Paystack events. (Task 3, 6)
- Guest email+phone of an existing guest account → matches that account, never a KYC'd/credit account. Suspect: `findOrCreateGuestTradeAccount` calls async `getTradeAccountById` without `await`. (Task 6)

---

### Task 1: Payment-method policy

**Files:**
- Create: `lib/trade/payment-methods.js`
- Create: `tests/trade-payment-methods.test.js`
- Modify: `app/api/trade/checkout/route.js` (replace `ALLOWED_METHODS`/default and the guest `pay_on_account` check)
- Modify: `lib/trade/trade-store.js` `createTradeOrder` (default `paymentMethod` param, validate via the module)

**Interfaces:**
- Produces: `export const PAYMENT_METHODS = ['paystack','pay_on_account','bank_transfer']`
- Produces: `export function assertPaymentMethodAllowed({ method, account, isGuest, config }) -> string` returns the method or throws `Error` with a buyer-readable message. Rules: unknown/missing/`mpesa_paybill` → throw; `pay_on_account` needs `!isGuest && account.creditEnabled`; `bank_transfer` needs `config.bankTransfer?.enabled === true`; `paystack` always allowed.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write failing tests** in `tests/trade-payment-methods.test.js`: `mpesa_paybill` throws; `undefined` throws; guest + `pay_on_account` throws; account with `creditEnabled:false` + `pay_on_account` throws; credit account passes; `bank_transfer` throws when `config.bankTransfer.enabled` is false/absent, passes when true; `paystack` passes for a guest.
- [ ] **Step 2: Run** `node --test tests/trade-payment-methods.test.js` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `lib/trade/payment-methods.js` per the interface.
- [ ] **Step 4: Run** the test file — expect PASS.
- [ ] **Step 5: Wire in.** In the route call `assertPaymentMethodAllowed` (catch → 400, or 403 for the guest-credit case) with `config` from `readTradeStore().config`; remove `mpesa_paybill` default. In `createTradeOrder` change the default param to `paymentMethod = 'paystack'` and keep the existing credit backstop.
- [ ] **Step 6: Run** `npm test` — expect all pass. Commit: `feat(trade): payment-method policy, drop M-Pesa paybill`.

### Task 2: Admin-controlled trade config + public checkout options

**Files:**
- Create: `lib/trade/trade-config.js`, `tests/trade-config.test.js`
- Modify: `app/api/admin/trade/config/route.js` (PUT uses the sanitiser)
- Create: `app/api/trade/checkout-options/route.js`
- Modify: `proxy.js` (add `/api/trade/checkout-options` to `PRE_AUTH_PATHS`)
- Modify: `lib/trade/trade-store.js` `INITIAL_TRADE_DATA.config` (add `stockHoldMinutes: 15`, `bankTransfer: { enabled: false }`)
- Modify: `app/admin/trade/page.js` (settings card: hold minutes input; bank-transfer toggle + bank name/account name/account number/branch fields; follow the existing account-manager card at ~line 3250)

**Interfaces:**
- Produces: `export const CONFIG_ALLOW_LIST` (all keys currently in config incl. `accountManager`, `priceBands`, `minOrderBottles`, `minOrderGoodsExVat`, `nairobiFreeDeliveryThreshold`, `nairobiDeliveryFee`, `gmFloorPercent`, `termsVersion`, `deliveryCutoffHour`, `referralBonusKes`, plus `stockHoldMinutes`, `bankTransfer`)
- Produces: `export function sanitizeConfigPatch(patch, currentConfig) -> object` drops unknown keys; `stockHoldMinutes` must be an integer 1–1440 else throws; `bankTransfer.enabled === true` throws unless bankName, accountName and accountNumber are non-empty strings in the merged result.
- Produces: `GET /api/trade/checkout-options` → `{ stockHoldMinutes, bankTransfer: { enabled, bankName, accountName, accountNumber, branch } | { enabled:false } }` (details only when enabled; nothing else from config).

- [ ] **Step 1: Failing tests** for `sanitizeConfigPatch`: unknown key dropped; `stockHoldMinutes: 0`, `1.5`, `'abc'`, `5000` throw; `15` ok; enabling bank transfer without details throws; with details ok; `accountManager` passes through.
- [ ] **Step 2: Run** `node --test tests/trade-config.test.js` — FAIL.
- [ ] **Step 3: Implement** module, route changes, defaults, options route, proxy entry, admin UI card.
- [ ] **Step 4: Run** tests — PASS. Smoke: `curl -s localhost:3000/api/trade/checkout-options` returns the shape with bank transfer disabled and no details; `PUT /api/admin/trade/config` without an admin cookie → 401.
- [ ] **Step 5: Commit** `feat(trade): admin-controlled hold minutes and bank-transfer gate`.

### Task 3: Stock hold, expiry, and late-payment safety

**Files:**
- Create: `lib/trade/trade-hold.js`, `tests/trade-hold.test.js`, `app/api/cron/trade-holds/route.js` (model on `app/api/cron/reconcile/route.js` + `lib/cron-auth.js`, secret `CRON_SECRET`)
- Modify: `lib/trade/trade-pg.js` (`ALTER TABLE trade_orders ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;` beside the existing paystack ALTERs)
- Modify: `app/api/trade/checkout/route.js` (set `hold_expires_at = now + stockHoldMinutes` when Paystack is initialised; on Paystack init failure cancel + restock and return an error telling the buyer to try again — remove the "retry payment from your order page" message)
- Modify: `lib/trade/trade-payment.js` (late-payment rule)
- Modify: `lib/trade/trade-store.js` `updateTradeOrderStatus` only if needed so cancelling an unpaid Paystack order restocks (it already restocks on `cancelled`)

**Interfaces:**
- Produces: `export async function expireUnpaidHolds(now = new Date()) -> { expired: string[] }` — for each `trade_orders` row with `payment_method='paystack'`, `status='pending_payment'`, `payment_status='unpaid'`, `hold_expires_at < now`: call `updateTradeOrderStatus(id, 'cancelled')` then set `payment_status='expired'`; idempotent; one failing order must not stop the rest.
- Produces: `settleTradeOrderFromPayment` returns `{ settled:false, reason:'order_expired' }` and sets `payment_status='paid_after_expiry'` (flag for staff refund; stock not re-deducted) when the order is `cancelled`/`expired`.
- Cron route: `GET/POST` with the cron secret → runs `expireUnpaidHolds`, returns `{ expired }`; refuses without the secret. Also call `expireUnpaidHolds()` best-effort at the start of the admin trade orders list so an unscheduled deployment still converges.
- Consumes: Task 2 `stockHoldMinutes`.

- [ ] **Step 1: Failing tests** (`tests/trade-hold.test.js`, DB-backed like `tests/trade-hub-e2e.test.js`, `TEST_` data, cleaned up): create a Paystack order with 2 bottles, assert stock decreased; set `hold_expires_at` in the past; `expireUnpaidHolds()` → order `cancelled`, `payment_status='expired'`, stock restored, one `inventory_logs` row `order_cancelled`; a second call changes nothing; an order with a future expiry is untouched; a `paid` order is untouched. Settlement: verified success payload against an expired order → `reason:'order_expired'`, order stays cancelled, `payment_status='paid_after_expiry'`, stock unchanged.
- [ ] **Step 2: Run** `node --test tests/trade-hold.test.js` — FAIL.
- [ ] **Step 3: Implement** module, column, cron route, route changes, settlement rule.
- [ ] **Step 4: Run** the file and `npm test` — PASS. Smoke the cron route with and without `Authorization`/secret per `cron-auth`.
- [ ] **Step 5: Commit** `feat(trade): expiring Paystack stock holds with late-payment flag`.

### Task 4: Checkout UI — options, credit visibility, no hardcoded bank details

**Files:**
- Modify: `app/trade/checkout/page.js`
- Modify: `app/trade/orders/[id]/page.js` (show a clear message for `pending_payment`, `payment_status` `expired` and `paid_after_expiry`; do not style `expired` green)

**Interfaces:**
- Consumes: `GET /api/trade/checkout-options` (Task 2); Task 1 method names.

- [ ] **Step 1: Implement.** Remove the M-Pesa paybill block (and the hardcoded Paybill 400200). Replace the hardcoded Standard Chartered account block with a bank-transfer block rendered only when options say `enabled`, showing the admin-entered details. Keep the credit block only when `account?.creditEnabled`. Default selected method: `pay_on_account` if credit enabled else `paystack`. Fix the credit-exceeded error copy, which currently says "choose M-Pesa or Bank Transfer" — say "choose Pay Now". Show "Reserved for N minutes while you pay" next to Paystack using `stockHoldMinutes`.
- [ ] **Step 2: Smoke-test** `curl -s -o /dev/null -w '%{http_code}' localhost:3000/trade/checkout` → 200, and load the page in the browser script (Task 5) — no hydration errors in console.
- [ ] **Step 3: Commit** `feat(trade): checkout shows only valid payment options`.

### Task 5: Real-browser checkout script (guest + account)

**Files:**
- Create: `scripts/e2e-trade-checkout.mjs`
- Create: `scripts/seed-test-trade-accounts.mjs` (creates/removes `TEST_` accounts: credit-enabled, non-credit, viewer seat, order-ceiling buyer; reuse patterns from `scripts/seed-trade.mjs`)

**Interfaces:**
- Produces: `node scripts/e2e-trade-checkout.mjs [--base http://localhost:3000]` prints PASS/FAIL per scenario, exits non-zero on any failure, writes screenshots to the scratchpad directory.
- Precondition: dev server running (check for an existing one first — do not pkill by pattern), `PAYSTACK_SECRET_KEY` (test) and `PAYSTACK_WEBHOOK_SECRET` set in `.env.local` by the owner, and `allowedDevOrigins` correct if the page hangs. Use the local Playwright Chromium (see memory `reference_playwright_local_chromium`); `puppeteer` is also a dependency.

- [ ] **Step 1: Write the scenarios**, one function each, asserting visible UI and resulting DB/API state: (a) guest sees Paystack, no credit, no M-Pesa, bank transfer hidden; (b) guest validation errors (missing name/phone/email/address, below minimum, spirits without age confirmation); (c) guest places a Paystack order and is redirected to the Paystack URL; (d) account with credit sees credit, sees shortfall error when over limit, can place an on-account order; (e) non-credit account does not see credit; (f) viewer seat gets 403; (g) Paystack test payment end to end (test card from Paystack docs on the hosted page) → lands on `/trade/orders/<id>?payment=success` and the order is paid/confirmed; if the hosted page can't be automated reliably, complete (g) by POSTing a correctly signed `charge.success` to the local webhook and driving the browser callback with the real reference — record which route was used; (h) abandon a Paystack payment, force `hold_expires_at` into the past, run the cron route, confirm cancelled + stock restored.
- [ ] **Step 2: Run** against dev server; capture failures as a list in the task's commit message body. Fix bugs found in the owning code (each fix its own commit with a regression test in `tests/`).
- [ ] **Step 3: Commit** `test(trade): real-browser checkout script`.

### Task 6: Security sweep of trade checkout/payment

**Files:**
- Create: `tests/trade-checkout-security.test.js`; extend `scripts/e2e-trade-checkout.mjs` with an `--attacks` section that sends raw HTTP to the running server
- Modify: whichever files the findings land in

**Interfaces:** consumes everything above; produces a findings list in the commit message.

- [ ] **Step 1: Attack cases (HTTP against dev server):** guest + `pay_on_account` → 403; non-credit account + `pay_on_account` → 400/403; `mpesa_paybill` and arbitrary strings → 400; body `items[].prkCostIncVat`/`priceLine` tampering has no effect on the stored price; another account's `deliveryAddress.id` → 400; strings of 1MB and `<script>` values are trimmed/sanitised; rapid-fire >20/min → 429; same POST sent twice concurrently → two distinct, independently valid orders OR one (decide and test the actual behaviour; if a double-click can create duplicate unpaid Paystack orders, add an idempotency guard keyed on account + cart hash within 30 s); callback replay for a paid order is a no-op; webhook with a bad signature → 401, wrong amount → `underpaid` not confirmed, wrong currency/reference → not settled; `GET /api/paystack/callback?reference=` of a foreign reference does not settle someone else's order into success for the wrong buyer.
- [ ] **Step 2: Confirm or dismiss each suspect** and write the outcome in the commit message: guest matching bug (missing `await` on `getTradeAccountById` in `findOrCreateGuestTradeAccount` — add `await` and a test that a repeat guest reuses the account and a KYC'd account is never matched); `pending`-status accounts ordering (policy: only `suspended` blocked — keep, add a test); orders on `pending_payment` forever (fixed by Task 3); `/api/trade/*` routes missing guards (every route handler must call a guard — grep and list any that don't).
- [ ] **Step 3: Fix each real finding test-first.** Run `npm test` and the script `--attacks` — all pass.
- [ ] **Step 4: Commit** per fix; final `chore(trade): security sweep results`.

### Task 7: Nirvana option

Owner decisions: anyone may use it but **an account (login) is required first**; guests see the option with a notice to create an account and cannot select it. No stock hold, no order, no payment. Designer's call (owner did not pick between (a)/(b)): **(a) information only** — selecting it shows the instructions and the dedicated-contact details, creates nothing, and "Place order" is disabled while it is selected.

**Files:** Modify `app/trade/checkout/page.js`; add a `nirvanaContact` field (`name`, `phone`, `email`) to the allow-listed config and admin settings card (Task 2 files), exposed via `checkout-options`.

- [ ] **Step 1:** Add `nirvana` as a UI-only choice (NOT in `PAYMENT_METHODS`; the API keeps rejecting it). Logged-in: panel lists the requirements (original logbook, copy of national ID, KRA PIN, valuation by Nirvana's assessors, colour passport-size photo), explains that Nirvana vets and funds the purchase, shows the contact from options, and states nothing is charged or reserved. Guest: same label with a "Create an account first" notice linking to `/trade/apply`, no selectable panel. No link to Nirvana's application.
- [ ] **Step 2:** Extend the browser script: guest sees notice and cannot select; account sees instructions; a direct POST with `paymentMethod: 'nirvana'` → 400.
- [ ] **Step 3: Commit** `feat(trade): Nirvana logbook-loan information option`.

### Task 8: Docs and go-live checklist

**Files:** Modify `CLAUDE.md` (Payments section: methods, hold behaviour, cron route, options route, new test commands; move shipped items out of "Planned"), add `docs/go-live-trade-payments.md`.

- [ ] **Step 1:** Update `CLAUDE.md`. Write the checklist: swap to live Paystack keys, set live `PAYSTACK_WEBHOOK_SECRET`, register the webhook URL `…/api/paystack/webhook` in the Paystack dashboard, set `NEXT_PUBLIC_SITE_URL`, schedule the `trade-holds` cron with `CRON_SECRET` (every minute), enter bank details and enable bank transfer only when confirmed.
- [ ] **Step 2: Commit** `docs: trade payments go-live checklist`.
