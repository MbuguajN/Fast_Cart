# Unified Bulk Checkout & Trade Account Deduplication Design Spec

**Date:** 2026-10-19  
**Status:** Draft / Review  
**Audience:** B2B Trade Portal (`/trade`), Customer Checkout (`/trade/checkout`), Admin Trade Hub (`/admin/trade`)  

---

## 1. Intent & Context

During live operations and testing of the B2B Trade Portal, two operational issues emerged:

1. **Account Duplication in Admin Trade Hub:**
   - Accounts like **Datamuse Ltd** appear duplicated in the Admin Trade Hub (`/admin/trade`). This happens because `/api/trade/apply` only checks whether the applicant's single *email* address already exists in `trade_users`. If colleagues apply separately, or if an applicant re-applies with an alternate email, the system fails to match on **KRA PIN**, **Liquor Licence Number**, or **Business Name**, resulting in duplicate company records in `trade_accounts`.
   - Furthermore, guest checkouts (`findOrCreateGuestTradeAccount`) generate standalone rows in `trade_accounts` with `tradingName: buyerName` (e.g., *Chris Onyi*, *Chris Okoth*, *James Njoroge*) marked as "No Licence", which clutter the commercial compliance vetting pipeline.

2. **Friction for Non-Business Bulk Buyers:**
   - The wholesale pricing engine already grants bulk/wholesale pricing once an order meets the minimum threshold (KES 10,000 goods value or volume threshold).
   - However, individuals buying in bulk for private events, weddings, parties, or home cellars do not have—and do not need—county liquor licences, corporate tax filings, or commercial credit terms. Forcing them through a commercial onboarding flow creates unnecessary drop-off and clogs the admin queue with individual shoppers.

This design introduces a **two-phase onboarding & checkout architecture**: frictionless email-verified user signup, instant individual bulk purchasing, an optional "Purchase as a Business" upgrade at checkout and account settings, and automated company deduplication.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Frictionless Entry for All Bulk Buyers:** Allow any individual or company representative to sign up with basic details (Name, Email, Phone, Password), verify their email, and immediately buy at wholesale rates when meeting the cart minimum (KES 10,000 or volume threshold).
2. **Seamless "Purchase as a Business" Flow:** Provide a clear, optional trigger during checkout (*"Purchasing for a registered business / Need VAT tax invoice or Net 14 credit?"*) and an account portal CTA for buyers to supply company tax details (KRA PIN, Legal Name, Trading Name, Liquor Licence).
3. **Automated Company Deduplication:** When a business profile is submitted, detect existing accounts by KRA PIN, Licence Number, or Company Name. Automatically link new users to the existing company account as team seats rather than spawning duplicate company entities.
4. **Clean Admin Trade Hub:** Segregate commercial business accounts (requiring compliance review and credit approval) from individual bulk buyers, so guest and individual accounts never appear as "No Licence" commercial entities in the vetting queue.
5. **Database Deduplication:** Provide an automated migration/cleanup for existing duplicate accounts in PostgreSQL (merging duplicate Datamuse Ltd records and cleaning test guest accounts).

### Non-Goals
- Changing the minimum order pricing rules (the KES 10,000 / volume threshold remains authoritative in `lib/trade/pricing-engine.js`).
- Eliminating KYC and liquor licence compliance for commercial credit accounts (bars, restaurants, and hotels requesting Net 14 terms still undergo full compliance review).

### Anti-Goals
- Never block an individual bulk buyer from completing an order because they lack a liquor licence or corporate KRA PIN.
- Never write or mirror trade state, accounts, or user mutations to disk JSON files (`data/trade-store.json`), per the project's strict PostgreSQL storage rule.

---

## 3. End-to-End User Experience

```
+-----------------------------------------------------------------------------------+
| 1. UNIVERSAL REGISTRATION & VERIFICATION                                          |
| User signs up (Name, Email, Phone, Password) -> Verifies Email -> Active User     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 2. WHOLESALE CART & CHECKOUT                                                      |
| Browses wholesale catalogue. Reaches KES 10k or bottle minimum.                   |
| Proceed to checkout.                                                              |
+-----------------------------------------------------------------------------------+
                       /                                    \
      [ Individual / Event Buyer ]             [ "Purchase as a Business" ]
                     |                                      |
                     v                                      v
+-----------------------------------------+  +--------------------------------------+
| Standard Checkout                       |  | Business Details Panel               |
| - Delivery address & contact            |  | - Company Trading Name & Legal Name  |
| - M-Pesa, Card, Prepayment              |  | - KRA PIN (VAT ETR invoice)          |
| - Immediate dispatch order              |  | - Optional Liquor Licence            |
|                                         |  | - Option to request Net 14 Credit    |
+-----------------------------------------+  +--------------------------------------+
                                                            |
                                                            v
                                             +--------------------------------------+
                                             | DEDUPLICATION CHECK                  |
                                             | KRA PIN or Name match existing?      |
                                             | YES -> Link as Seat to Existing Co.  |
                                             | NO  -> Create New Business Account   |
                                             +--------------------------------------+
```

### Flow 1: Universal Sign Up & Email Verification
1. User visits `/trade/signup` (or `/signup`).
2. Inputs: Full Name, Email, Mobile Phone, Password.
3. System sends a secure, single-use 6-digit verification code or token link to the user's email via Brevo (`lib/trade/trade-email.js`).
4. Upon verification, the user session is issued with active status.

### Flow 2: Individual Bulk Buyer Checkout
1. User adds wholesale products to cart. Cart pricing engine validates minimum wholesale criteria (KES 10,000 goods value or volume threshold).
2. At checkout:
   - Personal details (Name, Phone, Email) are pre-filled from authenticated user session.
   - Delivery address selected or entered.
   - Payment method: M-Pesa Paybill, Credit/Debit Card, or Bank Prepayment.
   - No business documents, KRA PIN, or liquor licence required.
   - Order is placed with `account.isGuest = true` or `account.segment = 'individual'`, keeping them out of the commercial business review pipeline.

### Flow 3: "Purchase as a Business" (Checkout & Account CTA)
1. At checkout or via the Account Settings page (`/trade/settings`), an expandable toggle is presented:
   - *"Purchasing on behalf of a registered business / Need official VAT Tax Invoice or Credit Terms?"*
2. Expanding the toggle collects:
   - **Company Trading Name** (e.g. `Datamuse Ltd`)
   - **Registered Legal Entity Name**
   - **Business KRA PIN** (e.g. `P023343559Z`)
   - **County Liquor Licence Number** (Optional for corporate offices; required for HORECA/liquor retailers)
   - **Licence Expiry Date & Certificate Upload** (Optional for cash buyers; required for Net 14 credit applications)
3. **Deduplication Engine Execution:**
   - System queries PostgreSQL `trade_accounts` for:
     a) Exact case-insensitive match on `kra_pin = $1`
     b) Exact match on `licence_no = $1`
     c) Fuzzy/exact match on `trading_name ILIKE $1`
   - **If Match Found (e.g. Datamuse Ltd already on file):**
     - User is attached as a team seat (`trade_users`) under the existing `account_id` with `seatType: 'buyer'`.
     - No second company row is created in `trade_accounts`.
     - Owner of the existing account receives an email notification: *"New purchasing seat requested by [Name] for [Company]"*.
   - **If No Match Found:**
     - Creates new commercial `trade_accounts` record with status `pending` (if credit requested) or `active` (if cash/prepayment).

---

## 4. Backend & Database Architecture

### Database Schema Adjustments (`lib/trade/trade-pg.js`)
1. **Deduplication Indices:**
   - Add partial unique index on `trade_accounts (kra_pin)` where `kra_pin IS NOT NULL AND kra_pin <> ''`.
   - Add index on `trade_accounts (LOWER(trading_name))`.
2. **Account Segregation:**
   - Ensure `is_guest BOOLEAN DEFAULT FALSE` or `account_type VARCHAR(32) DEFAULT 'business'` distinguishes commercial wholesale entities (`'business'`) from individual bulk buyers (`'individual'`).
3. **Deduplication Script (`scripts/deduplicate-trade-accounts.js`):**
   - Scans PostgreSQL `trade_accounts` for identical `kra_pin` (e.g. Datamuse Ltd `P023343559Z`).
   - Keeps the primary account record, re-assigns all related `trade_users`, `trade_orders`, and `trade_quotes` to the primary account ID.
   - Safely removes the duplicate secondary account rows.

### Admin Trade Hub Segregation (`app/admin/trade/page.js`)
- The Accounts table query defaults to commercial business accounts (`is_guest = FALSE` or `account_type = 'business'`).
- A dedicated filter pill or tab: `Commercial Accounts` vs `Individual Bulk Buyers` allows staff to view retail bulk customers without confusing them for compliance-pending bars or hotels.

---

## 5. Security & Data Integrity Controls

1. **PostgreSQL Authoritative Storage:** All queries, migrations, and deduplications operate directly against PostgreSQL via `lib/trade/trade-pg.js`. No JSON file persistence.
2. **Access Control:** Linking to an existing business account provides `seatType = 'buyer'`, preventing a new applicant from gaining owner privileges or modifying existing bank/credit settings.
3. **Email Verification:** Ensures applicant identities are genuine before joining team rosters.

---

## 6. Verification Plan

1. **Automated Unit Tests:**
   - Test signup & email verification workflow.
   - Test deduplication logic: submitting a business application with an existing KRA PIN links the user to the existing account and creates 0 duplicate account rows.
   - Test checkout with individual path: completes without demanding KRA PIN or liquor licence.
   - Test checkout with business toggle: successfully associates order with commercial account and generates VAT invoice.
2. **Database Migration Verification:**
   - Run deduplication script against PostgreSQL. Confirm Datamuse Ltd rows are consolidated into 1 authoritative account with all seats preserved.
3. **Live UI Verification:**
   - Verify `/trade/checkout` toggle and `/admin/trade` accounts table view.

