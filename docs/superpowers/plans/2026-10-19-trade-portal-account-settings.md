# Trade Portal Account & Business Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide authenticated B2B Trade Portal (`/trade`) users with a self-service settings interface (`/trade/settings`) to view and update their business registration details (including KRA PIN corrections and primary delivery address), personal contact details, security credentials, and view registered team seats.

**Architecture:** A RESTful backend API endpoint (`/api/trade/profile`) with strict role-based authorization: non-owners can edit their own personal profile (`name`, `phone`, `role`), while business and tax compliance fields (`trading_name`, `legal_name`, `kra_pin`, `licence_no`, `licence_expiry`, `licence_doc_url`, `addresses`) strictly require account owner privileges (`seatType === 'owner'`). All mutations persist directly to PostgreSQL via parameterized queries in `lib/trade/trade-pg.js`. A responsive Next.js frontend page (`app/trade/settings/page.js`) provides a tabbed UI (Business & Tax, Personal Profile, Security & Password, Team Seats) consistent with the portal design system.

**Tech Stack:** Next.js 16 (App Router), PostgreSQL (`pg`), React 19, Tailwind CSS, crypto tokens (`lib/crypto-tokens.js`), scrypt password hashing.

**Spec:** `docs/superpowers/specs/2026-10-19-trade-portal-account-settings-design.md`

## Global Constraints

- **Database Storage Rule (CRITICAL & MANDATORY):** PostgreSQL is the sole authoritative system of record (`trade_accounts`, `trade_users`). Never use or sync mutations to local JSON files (`data/trade-store.json`). Direct parameterised queries via `lib/trade/trade-pg.js` must be used.
- **Owner-Only Edits:** Only account owners (`seatType === 'owner'`) can edit business details and KRA PIN; non-owners are blocked with `403 Forbidden`.
- **KRA PIN Format:** Strictly validated against Kenyan format `/^[A-Z]\d{9}[A-Z]$/i` (e.g. `P051234567Z`) and uppercase-normalized.
- **Address Integrity:** Delivery address updates must preserve secondary addresses, their IDs, and default flags in the `addresses` JSONB array to safeguard checkout and fee calculation rules.
- **Passwords:** Self-service password changes require verifying current password and 12+ character strength policy via `POST /api/trade/password`.

## Review Focus

1. **Non-owner privilege escalation attempt on business data:** Caller with `seatType: 'buyer'` sends business update payload — must be rejected with `403 Forbidden` and no database rows altered.
2. **KRA PIN format malformation:** Invalid input like `12345` or lowercase unformatted string — must be rejected with `400 Bad Request` or cleanly normalized.
3. **Multi-address corruption:** Account with multiple registered delivery bays updates primary address on Tab 1 — must update the designated primary address in-place and retain secondary branch addresses untouched.
4. **Independent tab submission:** Submitting Personal profile does not require or corrupt Business fields; submitting Business profile does not overwrite or wipe Personal fields.
5. **Team Seats leakage:** Non-owner calling `GET /api/trade/profile` must not receive other seats' contact and credential status data.

---

### Task 1: Backend Profile API (`GET` and `PUT /api/trade/profile`) with PostgreSQL Persistence

**Files:**
- Create: `app/api/trade/profile/route.js`
- Test: `tests/trade-profile-settings.test.js`

- [ ] **Step 1: Write automated tests in `tests/trade-profile-settings.test.js`**
  - Test unauthenticated request returns `401 Unauthorized`.
  - Test `GET /api/trade/profile` as account owner returns `user`, `account`, `isOwner: true`, and `seats` roster.
  - Test `GET /api/trade/profile` as non-owner (buyer) returns `user`, `account`, `isOwner: false`, and omits/empties `seats`.
  - Test `PUT /api/trade/profile` with `personal: { name, phone, role }` succeeds for any seat and updates `trade_users`.
  - Test `PUT /api/trade/profile` with `business` fields by a buyer seat returns `403 Forbidden`.
  - Test `PUT /api/trade/profile` with invalid KRA PIN returns `400 Bad Request`.
  - Test `PUT /api/trade/profile` with valid `business` fields by an owner updates `trading_name`, `legal_name`, `kra_pin`, and preserves existing address array while updating primary delivery address.

- [ ] **Step 2: Run the automated tests to verify they fail**
  - Execute `node tests/trade-profile-settings.test.js`.
  - Confirm failure due to missing route `app/api/trade/profile/route.js`.

- [ ] **Step 3: Implement `app/api/trade/profile/route.js`**
  - Guard with `requireTradeOr401(request)`.
  - In `GET`:
    - Ensure database schema via `ensureTradeDb()`.
    - Fetch current user and account from PostgreSQL (`trade_users`, `trade_accounts`).
    - If `auth.user.seatType === 'owner'`, query `trade_users` for all seats belonging to `auth.account.id` (selecting `id`, `name`, `email`, `phone`, `role`, `seat_type`, `must_change_password`, `locked_until`, `created_at`).
    - Format and return public user, account, `isOwner`, and `seats`.
  - In `PUT`:
    - Parse request JSON.
    - If `personal` is provided:
      - Validate `name` is non-empty string.
      - Update `trade_users` (`name = $1, phone = $2, role = $3 WHERE id = $4`) via `query()`.
    - If `business` is provided:
      - Verify `auth.user.seatType === 'owner'`. If not, return `403 Forbidden` (`{ error: 'Only account owners can modify business and tax details' }`).
      - Validate `tradingName` is non-empty.
      - Validate `kraPin` if provided against `/^[A-Z]\d{9}[A-Z]$/i`. Normalize to uppercase.
      - If `primaryAddress` is provided:
        - Read current `addresses` JSONB and `default_address_id` from `trade_accounts`.
        - If an address matches `default_address_id` (or index 0), update its `label`, `addressLine`, `city`, `deliveryWindow`, `contactName`, and `phone` in-place.
        - If no addresses exist, create one with `id: 'addr_' + Date.now()` and set `isDefault: true`.
      - Update `trade_accounts` (`trading_name = $1, legal_name = $2, kra_pin = $3, licence_no = $4, licence_expiry = $5, licence_doc_url = $6, addresses = $7, updated_at = NOW() WHERE id = $8`) via `query()`.
    - Fetch and return freshly updated `user` and `account`.

- [ ] **Step 4: Run the automated tests and verify all pass**
  - Execute `node tests/trade-profile-settings.test.js`.
  - Verify all assertions pass (GET, PUT personal, PUT business by owner, 403 by buyer, KRA PIN validation, address preservation).

- [ ] **Step 5: Commit changes**
  - Git commit: `feat(trade): implement GET and PUT /api/trade/profile with role authorization and Postgres persistence`.

---

### Task 2: Build the Settings Page UI (`app/trade/settings/page.js`)

**Files:**
- Create: `app/trade/settings/page.js`

- [ ] **Step 1: Scaffold tabbed container and state management**
  - Create client component with `useTrade()` context.
  - Tab state: `'business' | 'personal' | 'security' | 'team'`.
  - Default to `'business'` for owners, `'personal'` for non-owners.
  - Fetch full profile and account details on mount via `GET /api/trade/profile`.

- [ ] **Step 2: Build Tab 1 (Business & Tax Details)**
  - Owner control badge (`"Owner Control"`) vs read-only banner for non-owners (`"Read-Only: Contact an account owner to modify company registration details"`).
  - Form fields:
    - Trading Name (input)
    - Legal Entity Name (input)
    - KRA PIN (input with format hint `P051234567Z` and uppercase auto-formatting)
    - County Liquor Licence Number (input)
    - Licence Expiry Date (date input)
    - Licence Document Upload: File upload button integrating with `/api/trade/apply/upload`, showing link to uploaded certificate if present.
    - Primary Delivery Address & Receiving Bay (Label, Address Line, City, Delivery Window, Contact Name, Contact Phone).
  - Save button with loading spinner; disabled for non-owners.
  - On save: calls `PUT /api/trade/profile` with `business` payload, calls `refreshAuth()` in trade context, and displays success toast.

- [ ] **Step 3: Build Tab 2 (Personal Profile)**
  - Form fields:
    - Full Name (input)
    - Email Address (disabled/read-only input with note: "Email is your secure seat login and cannot be altered directly")
    - Phone Number (input for dispatch/delivery driver coordination)
    - Role / Job Title (input)
    - Seat Type Badge (`Owner / Director`, `Buyer`, or `Viewer / Auditor`)
  - Save button with loading spinner.
  - On save: calls `PUT /api/trade/profile` with `personal` payload, calls `refreshAuth()` in trade context, and displays success toast.

- [ ] **Step 4: Build Tab 3 (Security & Password)**
  - In-app password change card:
    - Current Password input (with toggle show/hide)
    - New Password input with real-time 12+ character strength indicator
    - Confirm New Password input with match indicator
    - Update Password button calling `POST /api/trade/password`
  - Password reset link card:
    - "Lost your current password or prefer an emailed reset link?"
    - Send Password Reset Link button calling `POST /api/trade/password/reset-request` with current user's email.
    - Success notification confirming email dispatched.

- [ ] **Step 5: Build Tab 4 (Team Seats Overview)**
  - Conditionally visible in tab bar only for owners (`isOwner === true`).
  - Roster card showing all users in `seats`:
    - User avatar initial, Name, Role, Seat Type badge (`bg-purple-100 text-purple-700` for owner, `bg-blue-100 text-blue-700` for buyer, `bg-gray-100 text-gray-700` for viewer).
    - Status badge: Active (`bg-emerald-100 text-emerald-800`), Password Change Required (`bg-amber-100 text-amber-800`), Locked (`bg-red-100 text-red-800`).
    - Contact email & phone.
  - Informational box: "Need to invite a new buyer or auditor? Contact your dedicated Account Manager to provision new seats."

- [ ] **Step 6: Commit changes**
  - Git commit: `feat(trade): add tabbed settings page for business, personal, security, and team management`.

---

### Task 3: Navigation Integration & Shell Header Links

**Files:**
- Modify: `app/trade/layout.js`

- [ ] **Step 1: Add "Account & Settings" to sidebar navigation**
  - In `app/trade/layout.js`, locate `navigation` array.
  - Add `{ name: 'Account & Settings', href: '/trade/settings', icon: SettingsIcon }`.

- [ ] **Step 2: Link active account identity card in sidebar to `/trade/settings`**
  - Update the sidebar Account Card (`account.tradingName`) to wrap in `<Link href="/trade/settings">` with hover transition and settings icon.

- [ ] **Step 3: Link top app bar account pill to `/trade/settings`**
  - In header (`account.tradingName · Wholesale Portal`), wrap in `<Link href="/trade/settings">` for quick access.

- [ ] **Step 4: Commit changes**
  - Git commit: `feat(trade): link settings in portal sidebar navigation and top header`.

---

### Task 4: End-to-End Verification & Regression Testing

**Files:**
- Test: `tests/trade-profile-settings.test.js`
- Test: `tests/trade-password-reset.test.js`

- [ ] **Step 1: Run all automated unit and integration tests**
  - Run `node tests/trade-profile-settings.test.js`.
  - Run `node tests/trade-password-reset.test.js`.
  - Ensure 100% pass rate.

- [ ] **Step 2: End-to-end browser / HTTP verification**
  - Verify login as owner, navigate to `/trade/settings`.
  - Update KRA PIN to fix a typo and verify updated value in PostgreSQL database and invoices.
  - Update personal contact details and verify persistence.
  - Test password change in Security tab and verify login with new password.
  - Verify non-owner cannot edit business details.

- [ ] **Step 3: Final commit and summary**
  - Git commit: `docs(trade): record settings verification and integration test results`.

