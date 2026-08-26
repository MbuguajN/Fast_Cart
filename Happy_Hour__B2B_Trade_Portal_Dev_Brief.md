# Happy Hour — B2B Trade Portal

## Development Brief

|  |  |
| :---- | :---- |
| **Prepared for** | Happy Hour development team |
| **Product owner** | Paulette Chege — [paulette@myhappyhour.co.ke](mailto:paulette@myhappyhour.co.ke) |
| **Platform** | WordPress \+ WooCommerce \+ Elementor — myhappyhour.co.ke |
| **Date** | 5 August 2026 |
| **Status** | For scoping, estimation and technical sign-off |
| **Companion brief** | *Happy Hour — Creator Storefront Dev Brief* (same install; read both before estimating) |

---

## 1\. Purpose

Happy Hour sells to consumers. The B2B Growth Strategy commits the business to also becoming the beverage procurement partner for Kenyan trade buyers — hotels, restaurants, bars, corporates, event companies, retail stockists and premium residences — with a target of **75 active B2B accounts and 30–40% of company revenue from B2B within 12 months**.

Today that trade is transacted over email, WhatsApp and a PDF catalogue with a printed order form. It works, and it does not scale. Every order is manually priced against a three- or five-band tier table, manually checked against a minimum-order rule, manually VAT-treated differently depending on whether the line is a spirit or a Jaba juice, and manually invoiced.

This brief specifies the **B2B trade portal**: a licensed, credit-aware, tier-priced ordering channel that lives inside the existing myhappyhour.co.ke WooCommerce install. It covers architecture, the pricing engine, the data model, account lifecycle, credit and invoicing, the UI surfaces, QA criteria and a phased delivery plan.

### 1.1 Success criteria for Phase 1

A vetted trade buyer can log in, see their own tier-correct wholesale prices, build an order from a saved list or a template, have the minimum-order and licence rules enforced automatically, submit it, receive a compliant VAT invoice, pay by M-Pesa or bank transfer (or on approved credit terms), and track delivery — with no manual price calculation by the Happy Hour team at any point.

### 1.2 The commercial constraint that shapes every decision below

The value chain analysis puts Nordic's own gross margin on the Drink Experience (spirits) line at **9.1% at Tier 1, 6.5% at Tier 2 and 3.8% at Tier 3**. Pernod Ricard Kenya sets the input cost; Happy Hour sets a thin markup on top. Jaba, being own-production, runs at **58–69%**.

The consequence for the build is blunt: **on the spirits line, a pricing bug is a loss-making order.** A stacked coupon, a mis-applied tier, a discount field left open to an account manager, or a delivery fee silently absorbed can wipe out the entire margin on a basket. The pricing engine must be closed by default — no discount can be applied to a spirits line except through a tier, and tiers are derived from quantity, never typed in.

---

## 2\. Scope: what this is, and what it is not

**This IS:**

- A **gated pricing layer** — the same product catalogue, priced differently, and visible only to approved trade accounts.  
- A **trade ordering layer** — bulk entry, order templates, saved lists, repeat ordering, subscriptions, quote-to-order.  
- A **credit and compliance layer** — credit terms, limits, VAT-compliant invoices, licence verification, statements.  
- An **account management layer** — each account mapped to an account manager, with spend reporting on both sides.

**This is NOT:**

- A second website or subdomain. The portal is a role-gated experience inside the existing install, sharing catalogue, stock, media and delivery infrastructure. One product, one stock figure, two price books.  
- A replacement for the sales CRM. Prospecting, the 11-stage pipeline, proposals and negotiation live in the CRM. The portal picks the customer up at **Account Opening** and hands back structured data. See Section 12\.  
- A public wholesale price list. Wholesale pricing is contractually confidential (Catalogue T\&C 8). It must never be reachable by an unauthenticated request, a search engine, a cached page, a REST endpoint, a product feed or a sitemap.  
- A marketplace. Stockists resell Happy Hour stock; they do not list, price or fulfil on the platform.

### 2.1 Critical consequence of the above

Because B2C and B2B share one catalogue and one checkout, **price is a function of who is asking**. Every surface that renders a price — product page, category grid, cart, mini-cart, checkout, order confirmation email, invoice, REST response, structured data, Google Merchant feed, GA4 event — must resolve through a single pricing service. If any surface computes price independently, the two price books will diverge and the divergence will be discovered by a customer, not by us.

---

## 3\. Recommended technical approach

The team owns the final stack decision. The brief's recommendation is a **hybrid**: a mature B2B plugin for the role-and-price-book plumbing, plus a custom plugin for the tier engine and Happy Hour-specific trade rules.

### 3.1 Option comparison

| Option | Approach | Pros | Cons | Verdict |
| :---- | :---- | :---- | :---- | :---- |
| **A. B2B plugin \+ custom trade plugin** | B2BKing, Wholesale Suite or WooCommerce B2B handles roles, gated pricing, tax display rules, credit/purchase-order gateway, quote requests and account registration. Custom `hh-trade` plugin handles the quantity-band tier engine, the mixed-VAT presentation, minimum-order rules, licence gating and trade reporting. | Role/price-book/tax-display code is solved and battle-tested. Quote request and purchase-order gateway come free. Fast to Phase 1\. | Licence cost. Most B2B plugins model tiers as *per-role fixed prices* or simple percentage rules — our tier is **per-SKU quantity band, evaluated per order line**, which will need custom code regardless. Template overriding needed. | **Recommended** |
| **B. Fully custom** | Build roles, price books, tier engine, credit, invoicing and quoting natively. | Exact data model; no licence fee; nothing to fight. | Tax display, quote flows and payment-on-account gateways are more work than they look, and the tax rules are the part you cannot get 90% right. Materially longer. | Not recommended for Phase 1 |
| **C. Separate B2B site** | Second WooCommerce install at b2b.myhappyhour.co.ke, syncing stock. | Clean separation; no risk of leaking wholesale prices to consumers. | Two catalogues, two stock truths, two deployments, sync lag on stock — the exact failure the strategy's "live stock availability" requirement is meant to eliminate. | Reject |

> **Decision needed from the dev team before build starts:** confirm Option A and nominate the B2B plugin. Verify specifically that the candidate supports (a) per-customer-group price visibility gating, (b) per-customer tax display mode, and (c) a payment-on-account gateway. Price the licence and confirm before procurement.

### 3.2 Custom plugin

All bespoke code ships as a single plugin — working name `hh-trade` — **not** as theme functions, and **not** inside `hh-creator-shop`. The two programmes must be independently disableable.

- Namespaced, PSR-4 autoloaded.  
- Versioned migration routine on activation.  
- All strings translatable.  
- No direct SQL against Woo tables. **Confirm whether High-Performance Order Storage is enabled on production** — if it is, `wc_get_orders()` and the order CRUD APIs are mandatory.  
- Feature-flagged, so the whole trade programme can be switched off without affecting B2C.  
- The pricing engine ships as a pure, unit-testable class with **no WordPress dependencies in its core method**. Given Section 1.2, this is the one part of the codebase that must have automated test coverage — see Section 11\.

---

## 4\. Data model

### 4.1 Trade account — custom post type `hh_trade_account`

The account is the billing entity. Multiple users can transact on one account.

| Field | Key | Type | Notes |
| :---- | :---- | :---- | :---- |
| Trading name | `post_title` | string | As it appears on the invoice |
| Registered name | `_hh_legal_name` | string | If different from trading name |
| Status | `post_status` | enum | `draft` (applied), `pending` (in vetting), `publish` (active), `private` (suspended) |
| Segment | `_hh_segment` | enum | `horeca` | `corporate` | `events` | `retail` | `residences` — drives catalogue defaults, reporting and campaign segmentation |
| KRA PIN | `_hh_kra_pin` | string | Mandatory. Validated against format `[A-Z]\d{9}[A-Z]`. Prints on the invoice |
| Liquor licence number | `_hh_licence_no` | string | Mandatory for any account ordering spirits |
| Licence document | `_hh_licence_doc` | int | Attachment ID, private storage — **must not be web-reachable** |
| Licence expiry | `_hh_licence_expiry` | date | Drives the expiry-block rule in 5.6 |
| Price book | `_hh_price_book` | enum | `standard` for now. Present from day one so a negotiated key-account book can be added without a schema change |
| Tier override | `_hh_tier_override` | enum|null | Admin-only. Pins an account to a tier regardless of quantity — for contracted key accounts. Null by default. Every use is logged |
| Credit enabled | `_hh_credit_enabled` | bool | Default false |
| Credit limit | `_hh_credit_limit` | decimal | KES. Default 0 |
| Credit terms | `_hh_credit_terms` | int | Days. Default 14 |
| Credit balance | `_hh_credit_used` | decimal | Derived, cached; rebuildable from invoices |
| Clean-order counter | `_hh_clean_orders` | int | Consecutive on-time paid cash orders. Gates credit eligibility (5.5) |
| Account manager | `_hh_account_manager` | int | WP user ID, role `hh_trade_manager` |
| Delivery addresses | `_hh_addresses` | array | Multiple; each with label, contact, phone, geo note, delivery window |
| Default address | `_hh_default_address` | string | Address UUID |
| Purchase limit | `_hh_order_ceiling` | decimal | Optional per-order value ceiling above which approval is required (4.3) |
| Loyalty points | `_hh_points` | int | See 5.8 |
| Referral credit | `_hh_referral_credit` | decimal | See 5.9 |
| Terms accepted | `_hh_terms_version`, `_hh_terms_at` | string, datetime | Catalogue T\&Cs are versioned and effective-dated; acceptance must be provable |
| Onboarding state | `_hh_onboard_step` | int | Resumable application |

### 4.2 Users on an account — role `hh_trade_buyer`

A user belongs to exactly one trade account (`_hh_account_id`) and carries a seat type:

- `owner` — can invite users, change addresses, view credit and invoices, approve orders.  
- `buyer` — can build and submit orders, subject to the approval rule.  
- `viewer` — read-only; sees order history and reports, cannot transact.

A hotel F\&B manager who orders and a finance controller who approves are two seats on one account. Do not model them as two customers.

### 4.3 Approval workflow

If `_hh_order_ceiling` is set and a `buyer` submits an order above it, the order is created with status `hh-awaiting-approval` and is **not** sent to fulfilment. Every `owner` on the account is notified. Approval or rejection is recorded with user, timestamp and optional note. Rejection returns the basket to the buyer intact, not to an empty cart.

### 4.4 Tier configuration — the pricing spine

Tiers are **data, not code**. Store as an option set, editable in admin, versioned on change:

```
price_bands = {
  spirits: {
    basis: 'per_sku_per_order',
    vat_mode: 'inclusive',
    bands: [
      { key: 'T1', min: 6,  max: 24,   markup_on_prk_incvat: 0.10 },
      { key: 'T2', min: 25, max: 72,   markup_on_prk_incvat: 0.07 },
      { key: 'T3', min: 73, max: null, markup_on_prk_incvat: 0.04 },
    ]
  },
  jaba: {
    basis: 'per_sku_per_order',
    vat_mode: 'exclusive',
    bands: [
      { key: 'T0', min: 1,   max: 10,   price_ex_vat: 800 },
      { key: 'T1', min: 11,  max: 50,   price_ex_vat: 750 },
      { key: 'T2', min: 51,  max: 100,  price_ex_vat: 700 },
      { key: 'T3', min: 101, max: 200,  price_ex_vat: 650 },
      { key: 'T4', min: 201, max: null, price_ex_vat: 600 },
    ]
  }
}
```

Each product carries `_hh_price_line` (`spirits` | `jaba` | `excluded`) and, for spirits, `_hh_prk_cost_incvat` — the Pernod Ricard input cost the markup is applied to. **Spirits wholesale prices are computed from cost, not stored as three static prices.** A PRK price-list update then requires one cost import, not 52 × 3 manual edits.

Provide a **CSV cost importer** with a dry-run diff screen showing old cost, new cost, and resulting T1/T2/T3 prices per SKU before anything is written. Never let a cost update apply silently.

### 4.5 Order meta

Every trade order carries: `_hh_account_id`, `_hh_price_book`, `_hh_segment`, `_hh_payment_terms` (`cash` | `credit_14`), `_hh_due_date`, `_hh_invoice_no`, `_hh_account_manager`, `_hh_approved_by`, `_hh_approved_at`, `_hh_source` (`portal` | `whatsapp` | `rep` | `subscription`).

Every order **line** carries `_hh_tier_key`, `_hh_unit_price`, `_hh_price_line`, `_hh_prk_cost_snapshot` and `_hh_margin_snapshot`. Snapshot the cost at order time. Margin reporting must reflect what the economics were the day the order was placed, not what the cost file says today.

---

## 5\. Commerce rules — the specification the engine implements

### 5.1 Tier resolution

**Tier is evaluated per SKU, per order — not aggregated across SKUs, and not accumulated across a month.** This is Catalogue T\&C 1 and it is the single most misunderstood rule in the model. 12 bottles of Jameson and 12 of Chivas is Tier 1 on each, not Tier 2 on both.

Bottles, not cases, are the unit of measurement. Case size is packaging information shown to the buyer; it does not enter the tier calculation.

Prices must re-resolve **live in the cart as quantity changes**, and the UI must show the buyer what is happening — see 8.3.

### 5.2 Spirits pricing

`unit_price_inc_vat = round(prk_cost_inc_vat × (1 + band_markup))`

Displayed and charged VAT-inclusive. Rounding rule to be confirmed with finance — assume round to whole KES, half up, and state it in code and in the T\&Cs. Do not leave rounding implicit; on a 3.8% Tier 3 margin, per-line rounding drift is real money.

### 5.3 Jaba pricing

Flat per-band price, **exclusive of 16% VAT**. VAT is added at invoice. The catalogue is explicit about this and buyers will read it.

### 5.4 Mixed-VAT presentation — read this before configuring tax

A single basket can contain spirits quoted inclusive of VAT and Jaba quoted exclusive of VAT. WooCommerce has one tax display mode per shop and one per customer — **not one per line**. Configure it deliberately:

- Store all prices in Woo **exclusive of tax** internally; let Woo compute VAT. Do not store inc-VAT figures as the base price for spirits — that leads to the classic 0.01–0.05 KES per-line drift where the invoice does not foot.  
- Present spirits lines with an inc-VAT unit price label and Jaba lines with an ex-VAT unit price label, using custom column rendering — not Woo's global display setting.  
- The cart and checkout totals block must show, unambiguously: goods ex-VAT, VAT at 16%, delivery, grand total inc-VAT.  
- The invoice is the legal document and must foot exactly. **Reconcile the sum of line ex-VAT values, the VAT line, and the grand total to the cent on every invoice** — add this as an automated assertion, not a QA hope.  
- Confirm the current KRA eTIMS obligation with the tax advisor before building the invoice numbering scheme. If eTIMS integration is required, the invoice number must come from that system, and retrofitting that later is painful.

### 5.5 Minimum order

**12 bottles total across all SKUs, OR KES 10,000 invoice value — whichever is higher.** Both conditions are evaluated; the order must satisfy the binding one.

Enforce in the cart with a live, friendly indicator ("4 more bottles to reach the minimum"), and again server-side at order creation. Never allow a client-side-only check.

Delivery fees do not count toward the KES 10,000. Confirm with ops whether VAT counts toward it — **assume the threshold is measured on goods value excluding VAT and excluding delivery**, and state it in the T\&Cs.

### 5.6 Licence and compliance gating

- An account with no verified liquor licence **cannot add spirits to a cart at all** — the add-to-cart control is disabled with an explanatory message, not an error on submit. Jaba (non-alcoholic) remains orderable.  
- Licence within 30 days of expiry: warning banner on every portal page and an email to the account owner and account manager.  
- Licence expired: spirits blocked. Order attempts create an admin task, not a silent failure.  
- The existing consumer age-gate behaviour still applies to any public-facing page. The portal itself is behind login.  
- Wholesale prices are confidential (T\&C 8). Add a portal-wide `noindex`, exclude every trade endpoint from caching and from the sitemap, exclude trade-priced responses from any product feed, and **write an integration test that fetches a product page logged-out and asserts no wholesale figure appears in the HTML or in the JSON-LD**.

### 5.7 Payment and credit

- Default: full payment on order, M-Pesa Paybill or bank transfer. Reuse the existing gateways.  
- Credit terms (net 14\) are available only to accounts where `_hh_credit_enabled` is true. Eligibility rule from the catalogue T\&Cs: **3 consecutive on-time cash orders**. The system tracks `_hh_clean_orders` and *suggests* eligibility to the account manager — enabling credit stays a human decision.  
- Payment-on-account gateway is offered at checkout only if credit is enabled **and** `order_total + credit_used ≤ credit_limit`. If the order breaches the limit, the buyer sees the shortfall and can either reduce the order or pay the difference up front — do not simply hide the option.  
- Overdue: 2% per month late interest per T\&C 3\. **Build the interest as a computed, displayable figure on the statement; do not auto-post it to the ledger without a human action.** Recovering a customer relationship is harder than raising a credit note.  
- An account with any invoice more than 30 days overdue is auto-flagged `credit_hold`: it can still order, but only on prepayment. Surfaced to the account manager immediately.

### 5.8 Delivery

- Free within Nairobi above KES 25,000 (goods value, ex-delivery). Below: KES 500 within Nairobi.  
- Outside Nairobi: "at cost" — meaning the portal **cannot quote it automatically**. Present the order as *delivery to be confirmed*, notify the account manager, and support adding a delivery line before payment is taken. Do not invent a number.  
- Delivery promise displayed at checkout: Nairobi metro same-day for orders placed before 12:00 EAT, next-day after; rest of Kenya 2–3 business days. Drive this from a configurable cut-off, not a hard-coded string, and respect a configurable non-delivery-day list.  
- Multi-address: a buyer selects one of the account's saved addresses per order. Splitting a single order across several addresses is **Phase 3** — model the address as a per-order field now so a per-line field can be added later without migration.

### 5.9 Loyalty and referrals

- Loyalty points accrue on monthly spend, referral activity, early payment and annual contract, per the strategy. Phase 2\. Build the ledger table in Phase 1 so accrual can be backdated when the rules are signed off.  
- Referral: **KES 5,000 credit per successful referral.** A referral is "successful" when the referred account's first order is paid, not when it registers. Credit applies to the next invoice as a discount line and is **never** applied to a spirits line item — it is an invoice-level credit, for the margin reason in Section 1.2.

### 5.10 Subscriptions

Recurring orders — weekly, monthly or quarterly — for stock replenishment. Phase 2\.

- A subscription is a saved basket plus a cadence plus a delivery address. **It generates a draft order 72 hours before the delivery date and notifies the buyer to confirm or amend.** It does not silently charge and dispatch. Trade buyers change their minds about volumes constantly, and an unwanted auto-shipped case of Martell is a relationship-ending event.  
- Tier is re-resolved on each generated order at the then-current cost. Price changes between cycles are shown in the confirmation notice.  
- Out-of-stock lines in a generated subscription order are flagged for substitution, per T\&C 6 — never silently dropped.

---

## 6\. WordPress and WooCommerce backend setup

### 6.1 Roles and capabilities

| Role | Purpose |
| :---- | :---- |
| `hh_trade_buyer` | Trade user. Seat type in account meta governs what they can do. Cloned from `customer`. Explicitly denied `edit_products`, `manage_woocommerce`, `list_users`, wp-admin access |
| `hh_trade_manager` | Account manager. Views and manages assigned accounts, raises quotes, adds delivery lines, cannot change tier configuration, cannot change credit limits |
| `hh_trade_admin` | Ops/finance. All accounts, credit limits, tier configuration, cost imports, invoice reissue, statements |

**Tier configuration, cost import and credit limits are `hh_trade_admin` only.** An account manager under target must not be able to move a customer to a better tier.

### 6.2 Product configuration

- Every product needs `_hh_price_line` set. A product with it unset is **excluded from the trade catalogue entirely** — fail closed, never fall back to the retail price.  
- Trade catalogue visibility per segment: a retail stockist and a corporate office see different default category sets. This is a display default, not a restriction — all products remain orderable.  
- "Coming soon" lines (Organic Juices, Kyro) render as catalogue placeholders with a register-interest action. Capture the interest; it is a warm list for launch.

### 6.3 Coupons and discounts — locked down

- Woo coupons are **disabled for trade orders by default**. A global filter rejects coupon application when the cart is in trade context.  
- Any exception (a launch promotion, an event deal) is created as a named, dated, admin-only trade promotion with an explicit price line scope, and is blocked from applying to spirits lines unless `hh_trade_admin` has ticked an override with a reason recorded.  
- No free-text discount field anywhere in the account manager UI. Ever.

### 6.4 Caching

- Exclude the entire portal (`/trade/*`, my-account, cart, checkout) from full-page caching.  
- Product and category pages are cached for consumers and must **vary by trade role**, or be excluded for logged-in users entirely. A cached page rendered for a trade user and served to a consumer leaks confidential pricing; the reverse breaks the portal. Verify with the cache warm.  
- Ensure the CDN does not serve a cached trade response to an anonymous request. This is the highest-severity caching bug available in this build — test it explicitly.

### 6.5 WhatsApp ordering

WhatsApp is how this trade already buys and the strategy commits to WhatsApp Business automation. Phase 2, and scoped tightly:

- WhatsApp Business API (or the existing Business app \+ a bridge — confirm which is live) with a catalogue-request and reorder-last-order flow.  
- An inbound WhatsApp order creates a **draft** portal order attributed to the account with `_hh_source = whatsapp`; a human confirms it. Do not attempt conversational free-text order parsing in Phase 2\.  
- The value is that the order lands in the same ledger with the same pricing, not that it is unattended.

---

## 7\. Quote-to-order

The strategy's sales process runs Proposal → Quotation → Negotiation before Account Opening. The portal must close that loop.

- An account manager (or a prospect via a public "request a quote" form) creates a quote: line items, quantities, tier-resolved prices, optional validity period (default 14 days), notes.  
- The quote renders as a branded PDF and as a portal link.  
- **Accepting a quote converts it to an order at the quoted prices**, even if the cost file has changed since — validity date governs. After expiry, acceptance re-prices and shows the buyer the delta before they confirm.  
- Quote status: `draft` → `sent` → `accepted` | `expired` | `declined`. Declined quotes capture a reason code; that field is the beginning of a real win/loss dataset.

---

## 8\. UI/UX brief

### 8.1 Design language

Inherit the existing Happy Hour brand system. Do not invent a B2B sub-brand.

| Token | Value |
| :---- | :---- |
| Primary maroon | `#840038` |
| Deep card maroon | `#781436` |
| Brand pink | `#E8BEC2` |
| Pale pink surface | `#F5E0E3` |
| Ink / near-black | `#231F20` |
| Surface | `#FFFFFF` |
| Display type | Unbounded, Bold |
| Numerals / stat display | Bebas Neue |
| Body type | Montserrat — 400, 600, 700 |

Hard-edged rectangles, no rounded cards. `#231F20` on pink, never white.

**One deliberate departure from the consumer shop:** trade users are working, not browsing. Density is a feature. Tables over cards, numbers over imagery, keyboard-navigable quantity entry, and no decorative full-bleed photography inside the ordering surfaces.

### 8.2 Device reality

The consumer shop is mobile-first because traffic arrives from social apps. The trade portal is different: **a bar manager reorders from a phone; a hotel procurement officer or finance controller works on a desktop.** Both are first-class.

- Order entry, the dashboard and reports are designed desktop-first at 1440px, and must remain fully usable at 390px.  
- The reorder and order-tracking flows are designed **mobile-first** — those are the phone-in-a-stockroom jobs.  
- The bulk order pad is desktop-primary with an honest, simplified mobile variant. Do not cram a 6-column grid onto a phone.

### 8.3 Surface inventory

---

#### Surface 1 — Trade landing page (public, `/trade/`)

The destination for the strategy's LinkedIn, email and direct-sales campaigns.

- Hero: proposition and a primary "Open a trade account" CTA.  
- What you get: tier pricing, credit terms, same-day Nairobi delivery, dedicated account manager, VAT invoices.  
- Segment strips — Hospitality, Corporate, Events, Retail, Premium Residences — each with its own proof points and a segment-tagged CTA, so campaign traffic lands somewhere specific.  
- How ordering works — four steps mirroring the catalogue: Browse, Order, Pay, Receive.  
- **No prices anywhere on this page.** Tier *structure* may be described qualitatively ("volume tiers reward larger orders per SKU"); actual figures never appear.  
- Downloadable catalogue gated behind a short form — that form is a lead source and should post to the CRM.

---

#### Surface 2 — Account application

Multi-step, resumable, progress-indicated:

1. **Business** — trading name, registered name, segment, physical address.  
2. **Contact** — name, role, email, phone.  
3. **Compliance** — KRA PIN, liquor licence number, licence upload, expiry date.  
4. **Trading profile** — estimated monthly volume, categories of interest, current suppliers (optional). Feeds segmentation and the account manager's first call.  
5. **Terms** — versioned catalogue T\&Cs, explicit checkbox, no pre-tick.  
6. **Submitted** — clear statement of the vetting step and expected turnaround.

Save on every step. State the review SLA and hold to it — the strategy's whole acquisition motion depends on prospects not going cold in a queue.

---

#### Surface 3 — Trade dashboard (`/trade/`, logged in)

- Four stat tiles in Bebas Neue: *Spend this month*, *Open orders*, *Credit available*, *Next delivery*. Period-over-period delta on spend.  
- Reorder block: last order with a one-click "Order again" that lands in an editable cart, never straight to checkout.  
- Credit status: limit, used, available, next due date, and any overdue amount stated plainly.  
- Account manager card: name, photo, phone, WhatsApp, email — one tap to reach a human. This is the single most-used element on the page; do not bury it.  
- Licence expiry warning when applicable.

---

#### Surface 4 — Trade catalogue and the order pad

Two ways in, same engine.

**Browse** — the standard catalogue with trade pricing. Each product card shows the full tier ladder for that SKU, with the band the current cart quantity qualifies for highlighted, and an explicit nudge: *"Add 4 more to reach Tier 2 — save KES 51/bottle."* This is the feature that grows average order value, which is the strategy's \+150% AOV target. Build it properly.

**Order pad** — a dense, keyboard-driven grid for buyers who know their SKUs. Columns: SKU, product, size, case, tier ladder, quantity in, unit price, line total. Type-ahead on SKU code and product name. Paste a column of quantities from a spreadsheet. Running totals for bottles, goods value, VAT, delivery and grand total pinned to the bottom.

Both surfaces show, always visible:

- Live stock availability — in stock / low / out. If a SKU is out, offer the substitution route from T\&C 6 rather than a dead end.  
- Minimum-order progress against both the 12-bottle and KES 10,000 conditions.  
- Free-delivery progress against KES 25,000, where the address is in Nairobi.

**Saved lists** ("My usual bar stock", "Christmas hampers") and **order templates** per segment, both editable and shareable across seats on the account.

---

#### Surface 5 — Cart, checkout and confirmation

- The cart is the tier-transparency surface: unit price, band applied, and what the next band would save, per line.  
- Checkout collects delivery address (from saved), requested delivery date, buyer PO reference (free text, prints on the invoice — procurement teams need this), and payment method.  
- Payment options: M-Pesa, bank transfer, and pay-on-account where eligible.  
- Confirmation states the delivery promise, the invoice number and, for credit orders, the due date.  
- Out-of-Nairobi orders confirm as *delivery cost to be confirmed by your account manager* and are not charged a guessed fee.

---

#### Surface 6 — Orders, invoices and statements

- Order history: filter by date, status, address, ordered-by. Export CSV.  
- Order detail with live delivery tracking states: Confirmed → Picking → Dispatched → Delivered, with a driver contact once dispatched.  
- **VAT invoice PDF** per order — Happy Hour/Nordic legal name, PIN, address; buyer legal name and PIN; invoice number and date; line items with tier-resolved unit prices; goods ex-VAT; VAT at 16%; delivery; grand total; payment terms and due date. Downloadable and emailed.  
- Statement of account: opening balance, invoices, payments, closing balance, ageing buckets (current, 1–30, 31–60, 60+). Downloadable as PDF.  
- Credit notes for returns and damages per T\&C 5, referencing the original invoice.

---

#### Surface 7 — Spend reporting

The strategy's reporting dashboard, and a genuine retention feature: a hotel that runs its beverage budget in the portal does not casually switch supplier.

- Monthly spend trend, 12 months.  
- Category split — whisky, gin, vodka, rum, tequila, cognac, liqueur, sparkling, Jaba.  
- Top SKUs by volume and by value.  
- Order frequency and average order value.  
- Budget tracking: the account sets a monthly budget and sees consumption against it.  
- Export everything to CSV and PDF.

---

### 8.4 Admin surfaces (wp-admin)

- **Accounts list** — status, segment, account manager, licence expiry, MTD spend, credit used/limit, days since last order. Sortable, and this list is the account manager's daily worklist, so make "days since last order" prominent.  
- **Application review** — one screen: business details, compliance documents, trading profile, with approve / reject-with-reason / request-more-info, all three sending templated email.  
- **Tier configuration** — bands, markups, Jaba prices, minimum-order values, delivery thresholds. Versioned, with an audit trail of who changed what.  
- **Cost import** — CSV upload with the dry-run diff described in 4.4.  
- **Credit management** — limits, terms, holds, and an ageing report across all accounts.  
- **Quotes** — list, create, send, track.  
- **Margin report** — per order, per account, per SKU, per segment: revenue, cost snapshot, gross margin, GM%. Given Section 1.2, **finance needs to see a loss-making or sub-target-margin order the day it happens**, not at month end. Add a configurable GM% floor that flags an order for review.  
- **Trade settings** — segments, reserved terms, catalogue visibility defaults, T\&Cs version.

---

## 9\. Notifications

Transactional email, plus SMS/WhatsApp where the number is verified:

Application received · approved · rejected · account activated · order received · order approved/rejected (approval workflow) · order confirmed · dispatched · delivered · invoice issued · payment received · **invoice due in 3 days** · invoice overdue · statement (monthly) · licence expiring in 30/7 days · subscription order generated, confirm within 72 hours · quote sent · quote expiring · back-in-stock for a SKU on a saved list.

All branded to the Happy Hour system. **The invoice-due-in-3-days notice is the highest-value message in the set** — it is the difference between net 14 working and net 14 becoming net 45\.

---

## 10\. Analytics and events

Fire to the existing analytics stack (confirm GA4 vs alternative), with `account_id`, `segment` and `account_manager` as custom dimensions on every event:

`trade_application_started`, `trade_application_submitted`, `trade_account_approved`, `trade_first_order`, `trade_catalogue_view`, `trade_order_pad_used`, `trade_tier_upgrade_prompt_shown`, `trade_tier_upgrade_taken`, `trade_order_placed` (value, bottles, tier mix, margin), `trade_reorder_used`, `trade_template_used`, `trade_subscription_created`, `trade_quote_sent`, `trade_quote_accepted`, `trade_credit_used`, `trade_invoice_paid`, `trade_invoice_overdue`.

`trade_tier_upgrade_prompt_shown` versus `trade_tier_upgrade_taken` is the direct measurement of the \+150% AOV target. Instrument it from day one.

**Never send wholesale unit prices to a third-party analytics platform as product-level price data.** Order value and margin, aggregated, only.

---

## 11\. Non-functional requirements

| Area | Requirement |
| :---- | :---- |
| **Pricing correctness** | The tier engine ships with automated unit tests covering: every band boundary (5/6, 24/25, 72/73 bottles; 10/11, 50/51, 100/101, 200/201 for Jaba), mixed-line baskets, tier override accounts, rounding, VAT footing on both price lines, and referral-credit application. **This test suite is a release gate — no deploy touching pricing ships without it green.** |
| Performance | Catalogue and order pad usable with the full SKU set on a mid-range Android over 4G; order pad interactions under 100 ms; cart re-price under 500 ms |
| Scale | 75 accounts and \~300 seats in year one, growing to 500 accounts. Order and ledger volume design target: 10,000 trade orders/year |
| Browser support | Latest 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 16+; Android Chrome |
| Security | Nonces on every state-changing action; server-side capability checks on every endpoint; a trade user must not be able to read another account's orders, invoices, addresses or credit by ID manipulation — **test this explicitly by enumerating order IDs as a logged-in trade user** |
| Confidentiality | Automated test asserting no wholesale price appears in any anonymous response, feed, sitemap or JSON-LD |
| Data protection | Licence documents and KRA PINs are personal/commercially sensitive data under the Kenya Data Protection Act. Private storage, access logged, retention period agreed with legal |
| Financial integrity | Invoice numbers are sequential, gapless and immutable once issued. Corrections are credit notes, never edits |
| Backups | Invoices, credit ledger and cost history included in the backup routine and independently restorable |
| Environments | Build and test on staging with a catalogue clone. **Do not test payment or invoice runs against live M-Pesa or live invoice numbering** |

---

## 12\. Integration boundary with the CRM

The portal is not the CRM, and the seam needs to be explicit before anyone builds either side.

- **CRM owns:** prospects, the 11-stage pipeline, activities, calls, visits, meetings, proposals, negotiation.  
- **Portal owns:** approved accounts, orders, invoices, credit, delivery, spend.  
- **Handover in:** an approved application, or a CRM-side "won" deal, creates the trade account. One direction, one trigger.  
- **Feed back:** order events, spend and credit status push to the CRM contact record so the account manager sees commercial reality without a second login.  
- Phase 1 may implement this as a nightly export plus a webhook on `trade_order_placed`. Do not build a bidirectional real-time sync before the CRM is even chosen.

>   
> **Decision needed:** the CRM has not been named. Nominate it before Phase 1 ends so the export format targets something real.

---

## 13\. QA and acceptance criteria

Phase 1 is accepted when all of the following pass on staging and are re-verified on production.

**Pricing**

1. 6, 24, 25, 72, 73 and 200 bottles of a single spirits SKU price at T1, T1, T2, T2, T3, T3 respectively, and the unit price matches a hand calculation from PRK cost × band markup.  
2. 10, 11, 50, 51, 100, 101, 200, 201 bottles of a single Jaba flavour price at 800, 750, 750, 700, 700, 650, 650, 600 ex-VAT.  
3. 12 bottles each of two different spirits SKUs price **both** at Tier 1 — not Tier 2\.  
4. A basket of spirits and Jaba produces an invoice where line values, VAT and grand total foot exactly, with spirits VAT-inclusive and Jaba VAT-added.  
5. A Woo coupon cannot be applied to a trade cart.  
6. A tier-override account prices at its pinned tier regardless of quantity, and the override is visible in the order record.  
7. Changing a PRK cost via import updates T1/T2/T3 prices on the next cart re-price, and does **not** alter the price on any already-placed order.

**Rules**

8. An 11-bottle, KES 14,000 order is rejected on the bottle rule; a 20-bottle, KES 8,000 order is rejected on the value rule; a 20-bottle, KES 14,000 order passes. All three fail or pass server-side, not only in the UI.  
9. An account with no verified licence cannot add a spirits SKU to the cart, and can add Jaba.  
10. An account with an expired licence is blocked from spirits and the account manager is notified.  
11. A Nairobi order above KES 25,000 has no delivery fee; below has KES 500; an out-of-Nairobi order completes with delivery marked to be confirmed and no guessed fee charged.  
12. A buyer submitting above the account's order ceiling creates an awaiting-approval order that does not reach fulfilment until an owner approves.

**Credit**

13. Pay-on-account is unavailable to an account without credit enabled.  
14. An order that would breach the credit limit shows the shortfall and offers a part-payment path rather than silently hiding the option.  
15. Credit used, available and ageing on the statement reconcile exactly against the invoice ledger for the same period.  
16. Three consecutive on-time cash orders raise a credit-eligibility suggestion to the account manager and do **not** auto-enable credit.

**Confidentiality and access**

17. A logged-out request to any product page, REST endpoint, sitemap, product feed or JSON-LD block returns no wholesale price. Verified with page caching warm.  
18. A trade user cannot retrieve another account's order, invoice, statement or address by changing an ID in the URL or an API call.  
19. A trade user cannot reach wp-admin.  
20. An account manager cannot alter tier configuration, costs or credit limits.

**Experience**

21. A buyer completes a 15-line order from the order pad, on desktop, in under three minutes, including pasting quantities from a spreadsheet.  
22. A bar manager reorders the previous order and tracks delivery, start to finish, on a 390px phone.  
23. The tier-upgrade prompt appears when a line is within 20% of the next band and fires `trade_tier_upgrade_prompt_shown`.  
24. A generated subscription order notifies the buyer 72 hours ahead and is not dispatched without confirmation.  
25. Spend reporting figures reconcile exactly against the admin margin report for the same account and period.

---

## 14\. Phasing

| Phase | Scope | Outcome |
| :---- | :---- | :---- |
| **0 — Discovery (1 week)** | Confirm stack and licence, audit HPOS/caching/gateways/tax configuration, confirm eTIMS obligation with the tax advisor, confirm rounding and minimum-order VAT treatment with finance, agree invoice numbering, nominate the CRM | Signed-off technical approach and a firm estimate |
| **1 — Trade MVP** | Account model, roles and seats, application and vetting, tier pricing engine with test suite, gated catalogue, order pad, cart and checkout, minimum-order and licence rules, VAT invoices, order history and tracking, admin accounts list, cost importer, margin report, core notifications | First cohort of stockists ordering without manual pricing |
| **2 — Trade Scale** | Credit terms and statements, quote-to-order, saved lists and templates, approval workflow, spend reporting dashboard, subscriptions, WhatsApp reorder, referral credit, segment landing pages | Ordering runs without the sales team in the loop |
| **3 — Trade Depth** | Loyalty programme, negotiated key-account price books, multi-address order splitting, automated statements and dunning, deeper CRM sync, gifting and event-solution configurators, supplier/brand co-marketing surfaces | Differentiated from a supplier with a WhatsApp number |

*Deliberately not estimated in days — the dev team should attach effort after Phase 0\.*

---

## 15\. Decisions and inputs needed before build

1. **Dev team:** confirm the plugin stack (Section 3.1) and licence cost; verify per-customer tax display and payment-on-account support.  
2. **Dev team:** confirm HPOS status, live caching layer, and the M-Pesa gateway plugin — as per the creator brief, these answers serve both programmes.  
3. **Finance/tax:** confirm the KRA eTIMS obligation and whether invoice numbers must originate there. **This is the highest-risk open item — it can change the invoicing architecture.**  
4. **Finance:** confirm the rounding rule on spirits unit prices, and whether the KES 10,000 minimum is measured inclusive or exclusive of VAT.  
5. **Finance:** confirm the gross-margin floor below which an order is flagged for review.  
6. **Ops:** confirm delivery cut-off times, non-delivery days, and the out-of-Nairobi delivery-cost process.  
7. **Ops:** confirm the substitution process for out-of-stock lines (T\&C 6\) and who approves it.  
8. **Legal:** confirm the trade T\&Cs version to launch against, licence-document retention period, and the credit agreement wording.  
9. **Business:** confirm whether `tier_override` (negotiated key-account pricing) is in scope for Phase 1 or deferred — it changes the price-book model.  
10. **Business:** nominate the CRM (Section 12).  
11. **Brand:** confirm the trade portal sits inside the existing My Account shell or as a distinct `/trade/` area.

---

*Questions on scope or commercial terms to Paulette Chege — [paulette@myhappyhour.co.ke](mailto:paulette@myhappyhour.co.ke)*  
