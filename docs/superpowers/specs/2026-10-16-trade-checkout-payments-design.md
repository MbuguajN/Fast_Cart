# Trade Checkout: Payments, Testing & Hardening — Design

Status: approved by owner 2026-10-16 ("proceed with the rest"), except Nirvana handling, see §9
Scope: **trade (B2B) side only.** Retail checkout is out of scope.

## 1. Intent

Happy Hour is preparing to go live. Before launch the trade checkout must be
(a) proven working in a real browser for both guests and logged-in business
accounts, (b) free of security gaps, and (c) offer the right payment options
for a B2B buyer:

1. **Paystack** for pay-now (card / mobile money).
2. **Nirvana Africa logbook loan** — a third-party lender helps a business fund
   stock (e.g. for a big event). Manual, no API.
3. **Credit** — an existing credit line/agreement with the business, offered
   only to businesses that have been approved for it.
4. **Bank transfer** — kept, but off until the banking details are confirmed.

M-Pesa paybill is removed (no paybill exists).

## 2. Goals / non-goals / anti-goals

**Goals**
- Every trade checkout path works end to end, verified in a real browser
  (guest and account), including a full Paystack payment on **test keys**.
- No security gap in the trade checkout/payment path that a guest or another
  tenant could exploit.
- Admin staff can handle Nirvana orders and toggle bank transfer without code
  changes.

**Non-goals**
- Any integration with Nirvana (no API, no webhook, no application link).
- Retail-side checkout changes.
- Automating credit approval (stays a human decision, per the existing brief).
- Production Paystack keys (switched in at go-live by the owner).

**Anti-goals (would make this a failure even if it "works")**
- A guest or unapproved account getting Nirvana-held or credit orders accepted
  by posting directly to the API.
- An order marked paid without a verified Paystack payment of the right amount.
- Stock permanently lost to abandoned/failed payment orders.
- Secrets (Paystack keys) committed to the repo or sent to the client.

## 3. Constraints and current state (verified in code 2026-10-16)

- Next.js 16 (breaking changes vs. older Next): read `node_modules/next/dist/docs/`
  before writing code, per `AGENTS.md`.
- Checkout API: `app/api/trade/checkout/route.js`; UI `app/trade/checkout/page.js`;
  order creation `createTradeOrder` in `lib/trade/trade-store.js`;
  Paystack `lib/paystack.js`, `lib/trade/trade-payment.js`,
  `app/api/paystack/{callback,webhook}/route.js`.
- Accepted methods today: `pay_on_account`, `mpesa_paybill`, `bank_transfer`,
  `paystack`. Default for unknown/missing is `mpesa_paybill`.
- `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` are **not** in `.env.local`.
  The owner has a working Paystack account (used on the retail side) and wants
  test keys used now. The owner supplies keys; they must never be pasted into
  chat or committed.
- Order storage is PostgreSQL (`trade_orders`). PostgreSQL is the sole authoritative system of record; do not rely on or require JSON files on disk.
- Stock is deducted at order creation. Cancel/reject restocks
  (`updateTradeOrderStatus`). A Paystack order that is never paid is not
  currently restocked (suspected gap — verify, see §5.1).
- Credit: only enabled accounts, checked in the route and in `createTradeOrder`.
  Staff enable credit by hand; the system only suggests after 3 clean orders.
- The browser cannot be driven with the Playwright/Chrome-DevTools MCP tools in
  this environment; use the local Playwright Chromium from a node script
  (see `check-browser.mjs`). Dev server on WSL2 may need `allowedDevOrigins`.
- The Paystack webhook needs a public URL to reach a local dev server (tunnel)
  or a deployed preview; the browser callback does not.

## 4. Payment options — behaviour

| Option | Who sees it | Money | Resulting order |
|---|---|---|---|
| Paystack | Everyone | Taken now via Paystack | `pending_payment` → `confirmed`/paid on verified payment |
| Nirvana | Everyone. Guests see a notice that an account is required and cannot submit it. | None up front | Held for Nirvana funding (see §4.1) |
| Credit | Only logged-in, credit-enabled accounts; hidden from everyone else | None up front | Existing `pay_on_account` behaviour (limit check, invoice with due date) |
| Bank transfer | Only when an admin setting enables it | Customer pays offline | Unpaid until staff confirm |
| M-Pesa paybill | Nobody | — | Removed from UI; the API must reject it |

Label for the credit option: owner called it "LPO" and then said it is really
"credit that needs approval". **Builder's call** on exact wording; suggestion
"Pay on Credit (Net N days)", reusing existing `pay_on_account`.

### 4.1 Nirvana (the least certain piece)

Decided by the owner:
- Trade only; manual backend process; no API; Nirvana vets and funds.
- Guests can see it but get an "account required" notice; no payment up front.
- Eligibility requirements are displayed for information so businesses know what
  to expect: original logbook, copy of national ID, KRA PIN, valuation by
  Nirvana's assessors, colour passport-size photo. **No link to Nirvana's
  application** — a dedicated contact handles these.
- Nirvana funds the purchase (the business is not paid a general loan that
  they then spend).
- Only businesses with **prior approval** can use it, and they must log in.

Owner's call still to confirm (marked as my guess in conversation, not yet
confirmed): how "prior approval" is recorded — suggested as a per-account
`nirvanaEnabled`-style flag set by staff in the admin account page, mirroring
how credit is enabled; and order handling — order held as "awaiting Nirvana
funding", staff mark it paid (or cancel, which restocks) once Nirvana funds.
Whether stock is reserved while waiting: suggested yes (the existing
stock-deduction behaviour), with cancel restocking.

## 5. Work packages (in this order)

### 5.1 Real-browser test + security hardening of trade checkout
- Script a real-browser run (local Chromium) covering: guest checkout (valid,
  invalid fields, below minimum order, out of stock, age gate), logged-in
  account checkout (registered address, credit allowed/exceeded, viewer seat
  blocked, order ceiling approval), and each payment option's UI states.
- Test the API directly for what the UI hides: guest posting `pay_on_account`
  or Nirvana, tampered prices/costs, other-account IDs, oversized/odd inputs,
  rate limiting, replayed Paystack callbacks, wrong-amount and wrong-reference
  payments, forged webhook signature.
- Known suspects to confirm or dismiss: unpaid Paystack orders keep stock
  deducted indefinitely; Paystack-init failure leaves a `confirmed`, unpaid
  order; the "retry payment from your order page" message may promise a
  feature that does not exist; unknown payment methods fall through to a
  default; any account that is not `suspended` can order (status `pending`
  accounts?); config PUT accepts arbitrary keys (admin-only).
- Fix what is real. Add regression tests under `tests/`.

### 5.2 Paystack working end to end (test keys)
- Owner adds test keys to `.env.local` (and the webhook secret). Confirm
  `NEXT_PUBLIC_SITE_URL` is correct for the callback.
- Prove in a real browser: guest and account Paystack payments succeed and the
  order becomes paid/confirmed; abandoned or failed payment is handled
  (order not left silently unpaid with stock stuck); callback and webhook both
  tolerated (idempotent); retry payment works if offered.
- Webhook: test with a tunnel/preview URL, or by posting a correctly signed
  event locally; the owner decides which. Live-key switch at go-live is a
  documented checklist item, not code.

### 5.3 Credit option
- Mostly exists. Ensure it is hidden (not just disabled) for guests and
  non-credit accounts, wording updated, covered by tests.

### 5.4 Nirvana option
- New payment method, server-enforced (guest and unapproved account rejected in
  the route and in `createTradeOrder`), UI with eligibility information and
  guest notice, new order state and admin controls to mark funded/cancelled,
  customer-facing order page messaging, tests.

### 5.5 Remove M-Pesa; gate bank transfer
- Remove M-Pesa paybill from the UI and reject it server-side (also change the
  default method, which is currently `mpesa_paybill`).
- Bank transfer shown only when an admin setting is on; off by default; banking
  details entered by the admin when known.

## 6. Left to the builder
Exact state names and admin UI layout, the migration approach for new columns
(follow `ensureTradeDb()`), exact copy, test structure, tunnel vs. signed-event
approach (after asking the owner), and the order of fixes within 5.1.

## 7. Open items needing the owner
- Paystack test keys + webhook secret placed in `.env.local` by the owner.
- Confirm the Nirvana approval/handling guess in §4.1.
- Banking details for bank transfer (later).
- Webhook testing route (tunnel/preview vs. signed local event).

## 8. Calls made by the designer (not by the owner) — check these
- **Pending accounts**: keep current behaviour. Only `suspended` accounts are
  blocked from ordering (guests create lightweight accounts and may order with
  Paystack/bank transfer). Credit and Nirvana need an explicitly approved flag.
- **Paystack init failure**: cancel the order and restock, tell the buyer to try
  again. Do not leave a `confirmed` unpaid order.
- **Paystack amount**: expected amount is the order grand total in KES incl. VAT
  and delivery (existing check, one-shilling tolerance). Underpayment is flagged
  `underpaid` for staff, not confirmed. Order-ceiling approval and Paystack:
  pay first, then it goes to approval.
- **Bank-transfer toggle**: stored in the existing trade config, with config
  updates restricted to an allow-list of keys, admin-only. It cannot be enabled
  until bank details are saved.
- **Test data**: the local Postgres/JSON store is dev; test accounts are
  clearly named and removed afterwards. Never the real WooCommerce store.
- **Order-page copy**: designer's call, kept short and plain.

## 9. Owner decisions after review (these SUPERSEDE earlier text in §2, §4, §4.1, §7)
- **Stock hold is dynamic**: an unpaid Paystack order holds stock for a
  configurable number of minutes, default **15**, adjustable by an admin in the
  admin UI. After expiry the order is cancelled and stock released (mechanism
  is the builder's call; must work without relying on a page being viewed).
- **Nirvana is a lengthier process**: **no stock hold and no hold on the
  order** (so it must not deduct stock). The earlier idea of "pending
  Nirvana funding order + staff mark paid" and the per-account "prior approval"
  flag are **dropped**. **Anyone can use the Nirvana option** provided the
  instructions are clear (eligibility requirements from §4.1, no application
  link, dedicated contact handles it).
- **STILL TO CONFIRM (blocks work package 5.4 only)**: what choosing Nirvana
  actually does. Options: (a) shows the instructions and contact details and
  records nothing; (b) records an enquiry/lead for the dedicated contact with
  the cart and buyer details, but no order and no stock movement; (c) something
  else. Also whether guests are included now ("anyone") or still need an
  account first. Work packages 5.1, 5.2, 5.3, 5.5 proceed without this.
- Credit stays restricted to credit-approved logged-in accounts (unchanged).

## 10. Nirvana resolved (2026-10-16)
Guests must create an account first to use Nirvana. Handling is information only (designer's call): instructions + dedicated contact, no order, no enquiry record, no stock effect. Supersedes the "STILL TO CONFIRM" bullet in §9.
