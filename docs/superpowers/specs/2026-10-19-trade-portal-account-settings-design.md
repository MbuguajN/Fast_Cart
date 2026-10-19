# Trade Portal Account & Business Settings Design Spec

**Date:** 2026-10-19  
**Status:** Draft / Review  
**Audience:** B2B Trade Portal (`/trade`)  

---

## 1. Intent & Context

B2B wholesale portal seats (business owners, beverage directors, procurement officers, auditors) currently lack an in-portal self-service settings interface. When a business signs up with an incorrect or typo-ridden KRA PIN, or needs to update legal names, liquor licence details, contact phone numbers, or passwords, they currently have no direct way to do so within the portal.

This feature introduces a dedicated, tabbed **Account & Settings** view (`/trade/settings`) within the B2B portal, backed by a secure API endpoint (`/api/trade/profile`), with role-based field authorization.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
1. **Business Profile & Tax Compliance:** Provide account owners (`seatType === 'owner'`) the ability to correct or update the business KRA PIN (crucial for compliant VAT tax invoices), legal entity name, trading name, liquor licence number & expiry date, and delivery locations.
2. **Personal Profile Management:** Allow any authenticated trade seat to update their personal contact name and mobile phone number.
3. **In-App Password Updates:** Enable self-service credential updates using the existing backend verification flow (`POST /api/trade/password`), requiring current password verification and 12+ character strength enforcement.
4. **Team Seats Visibility:** Allow business owners to view all active seats (Owner, Buyer, Viewer) operating under their business account.
5. **Role-Based Authorization:** Strict server-side enforcement: company tax/legal fields can only be mutated by account owners (`seatType === 'owner'`). Non-owner seats (buyers, viewers) have read-only access to company compliance data.
6. **Authoritative Persistence:** All updates write directly to PostgreSQL (`trade_accounts` and `trade_users`) via `lib/trade/trade-pg.js` in compliance with database rules.

### Non-Goals
- Adding new seats or altering seat permission types from this self-service view (seat invitations, deletion, and role elevation remain managed in `/admin/trade`).
- Modifying financial terms, credit limits, or pricing tiers (strictly controlled by company admin/operations).

### Anti-Goals
- Allowing non-owner seats (buyers/viewers) to tamper with company tax credentials, KRA PIN, legal names, or invoice billing addresses.
- Storing or syncing persistent mutations to flat JSON files.

---

## 3. UI/UX Architecture: Tabbed Settings (Option A)

Located at `/trade/settings` and linked from the B2B portal sidebar and top header account card.

### Navigation & Layout
The page follows the existing Happy Hour B2B styling: dark stone accents (`#1c1917`), brand burgundy (`#840038`), clean Montserrat typography, responsive card containers, and toast notifications.

```
+-------------------------------------------------------------------------------+
| Account & Business Settings                                                   |
| Manage business registration, personal contact details, and portal security.  |
|                                                                               |
| [ 🏢 Business & Tax ]  [ 👤 Personal Profile ]  [ 🔒 Security ]  [ 👥 Team ]  |
+-------------------------------------------------------------------------------+
| TAB CONTENT AREA                                                              |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Tab 1: Business & Tax Details (Owner Only)
- **Status Indicator:** Shows an "Owner Control" badge for owners, or "Read-Only (Owner Access Required)" banner for non-owners.
- **Fields:**
  - **Trading Name:** Business trading name (e.g. `The Alchemist Westlands`).
  - **Legal Entity Name:** Registered business entity (e.g. `Alchemist Hospitality Ltd`).
  - **KRA PIN:** Kenya Revenue Authority PIN (e.g. `P051234567Z`). Strictly validated against standard format `/^[A-Z]\d{9}[A-Z]$/i`. Crucial for automated VAT invoice generation.
  - **Liquor Licence Number:** Current county liquor licence reference.
  - **Liquor Licence Expiry:** Date picker.
  - **Licence Document (Optional Renewal Upload):** Supports uploading updated certificate PDF/image via `/api/trade/apply/upload`. Shows download link if certificate is on file.
  - **Primary Delivery Location & Receiving Bay:**
    - Updates the account's designated primary address in-place within `trade_accounts.addresses` (preserving all secondary delivery branches/bays and their IDs).
    - Sub-fields:
      - Location Label (e.g. `Main Receiving Dock` or `Bar Cellar`) -> `label`
      - Physical Street & Landmark -> `addressLine`
      - Town / City (e.g. `Nairobi`) -> `city` (directly referenced by checkout delivery fee calculation)
      - Delivery Receiving Hours (e.g. `08:00 - 14:00 EAT`) -> `deliveryWindow`
      - Receiving Contact Name -> `contactName`
      - Receiving Contact Phone -> `phone`
- **Action:** `Save Business Details` button (disabled for non-owners).

### Tab 2: Personal Profile (All Seats)
- **Fields:**
  - **Full Name:** User's contact person name.
  - **Email Address:** Read-only / authenticated seat identity.
  - **Phone Number:** Mobile number for dispatch / delivery driver coordination.
  - **Role / Job Title:** User's operational title (e.g. `Head Bartender`, `Procurement Officer`).
  - **Seat Type Badge:** Informational badge (`Owner / Director`, `Buyer`, or `Viewer / Auditor`).
- **Action:** `Save Personal Details` button.

### Tab 3: Security & Credentials (Self-Service)
- **In-App Password Change:**
  - **Current Password:** Required for security verification.
  - **New Password:** Must satisfy the 12+ character policy with visible strength meter.
  - **Confirm New Password:** Real-time matching validation.
  - **Action:** `Update Password` (calls `POST /api/trade/password`).
- **Alternative Reset Link:**
  - "Need to reset without your current password? We can send a secure reset link to your registered email."
  - **Action:** `Send Password Reset Link` button (calls `POST /api/trade/password/reset-request`).

### Tab 4: Team Seats Overview (Owner View)
- Visible in tab navigation for owners (`seatType === 'owner'`).
- **Fields Displayed per Seat:**
  - Name, Email, Phone, Role / Title.
  - Seat Type Badge (`Owner`, `Buyer`, `Viewer`).
  - Status Indicator (`Active`, `Password Change Required`, or `Locked`).
  - Created Date.
- Informative guidance: "To add or remove seats, contact your dedicated Account Manager."

---

## 4. Backend API Design

### `GET /api/trade/profile`
- **Auth:** `requireTradeOr401(request)`
- **Response:**
  - `user`: Public profile (`id`, `name`, `email`, `phone`, `role`, `seatType`, `createdAt`)
  - `account`: Full account details (`id`, `tradingName`, `legalName`, `kraPin`, `licenceNo`, `licenceExpiry`, `licenceDocUrl`, `addresses`, `defaultAddressId`, `creditEnabled`, `creditLimit`, `creditTerms`, `creditUsed`)
  - `seats`: (If owner) List of all users where `account_id = auth.account.id`
  - `isOwner`: Boolean (`auth.user.seatType === 'owner'`)

### `PUT /api/trade/profile`
- **Auth:** `requireTradeOr401(request)`
- **Decoupled Payload Contract:** Supports independent tab submissions:
  - `personal`: `{ name, phone, role }` (optional)
  - `business`: `{ tradingName, legalName, kraPin, licenceNo, licenceExpiry, licenceDocUrl, primaryAddress }` (optional)
- **Logic:**
  1. If `personal` is present:
     - Permitted for all seats.
     - Validates `name` is non-empty. Sanitizes phone.
     - Updates `trade_users` in PostgreSQL for `auth.user.id`.
  2. If `business` is present:
     - Check `auth.user.seatType === 'owner'`. If not owner, reject with `403 Forbidden ("Only account owners can modify company tax and registration details")`.
     - Validates `tradingName` is non-empty string.
     - Validate KRA PIN format (if supplied, uppercase alphanumeric, 11 characters e.g. `P051234567Z`).
     - If `primaryAddress` is provided: updates primary address in-place in `trade_accounts.addresses` (or appends if none exist), preserving secondary addresses and IDs.
     - Update `trade_accounts` in PostgreSQL (`trading_name`, `legal_name`, `kra_pin`, `licence_no`, `licence_expiry`, `licence_doc_url`, `addresses`, `default_address_id`, `updated_at`).
  3. Re-read updated records from PostgreSQL and return updated `user` and `account`.

### `POST /api/trade/password` (Existing)
- Verified and ready. Takes `{ currentPassword, newPassword }`, checks scrypt hash, validates 12+ characters, updates PostgreSQL hash, and clears `must_change_password`.

---

## 5. Security & Data Integrity Controls

1. **Authorization Boundary:** Edge proxy (`proxy.js`) gates `/api/trade/*` ensuring valid `trade_token` session. In-handler guard (`requireTradeOr401`) provides authoritative cryptographic verification.
2. **Strict Role Checks:** Non-owner seats cannot mutate `trade_accounts` columns. Attempted tampering returns `403 Forbidden`.
3. **Database Integrity:** Direct parameterized SQL queries to PostgreSQL using `lib/trade/trade-pg.js`. No flat-file persistence.
4. **Input Sanitization:** KRA PIN trimmed and converted to uppercase. Phone numbers normalized.

---

## 6. Verification Plan

1. **Automated Unit Tests (`tests/trade-profile-settings.test.js`):**
   - Test `GET /api/trade/profile` as owner (returns account, user, seats roster).
   - Test `GET /api/trade/profile` as non-owner (omits seats roster).
   - Test `PUT /api/trade/profile` with `personal` update (allowed for any seat).
   - Test `PUT /api/trade/profile` with `business` update as owner (updates KRA PIN and primary address in PostgreSQL).
   - Test `PUT /api/trade/profile` with `business` update as non-owner (returns 403 Forbidden).
   - Test KRA PIN format validation (rejects invalid syntax like `12345`, accepts `P051234567Z`).
2. **Browser End-to-End Verification:**
   - Log into `/trade/settings` as an owner: update KRA PIN and personal phone, verify success toast and persisted values.
   - Verify tab navigation between Business, Personal, Security, and Team Seats.
   - Change password and verify subsequent sign-in with the updated password.

