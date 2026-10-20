# Unified Bulk Checkout & Trade Account Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement universal user signup with email verification, individual bulk checkout with zero licence/PIN friction, a "Purchase as a Business" upgrade at checkout and settings with automated account deduplication, and segregation in the Admin Trade Hub.

**Architecture:** PostgreSQL serves as the sole authoritative system of record (`lib/trade/trade-pg.js`). Deduplication matches against existing company KRA PIN, licence, or trading name to attach users as team seats (`buyer`) rather than creating duplicate company accounts. Admin accounts table segregates commercial accounts from guest/individual bulk accounts.

**Tech Stack:** Next.js (App Router), PostgreSQL (`pg`), Node.js native test runner (`node:test`, `node:assert/strict`), Brevo SMTP via `lib/trade/trade-email.js` and `lib/email.js`, Tailwind CSS.

**Spec:** docs/superpowers/specs/2026-10-19-unified-checkout-and-account-deduplication-design.md

## Global Constraints

- Never use JSON files on disk (`data/*.json`, `trade-store.json`, etc.) to store or manage persistent application data, users, orders, credentials, or state. PostgreSQL is the sole authoritative system of record.
- All reads, writes, mutations, and authentications must query PostgreSQL directly via `lib/trade/trade-pg.js`.
- Never block an individual bulk buyer from completing an order because they lack a liquor licence or corporate KRA PIN.
- Never grant automatic `owner` permissions when attaching an applicant to an existing business account (`seatType: 'buyer'`).
- Node native ESM requirement: Node test runner requires explicit extensions (e.g. `import ... from './file.js'`) and relative path imports.

## Review Focus

- **Case-insensitive & whitespace-trimmed KRA PIN / Licence match:** An input like ` p023343559z ` matches existing `P023343559Z` and never creates a duplicate company account.
- **Seat privilege escalation prevention:** When linking to an existing business, user seat must be `seatType: 'buyer'` and `role: 'Buyer'` or `'Staff'`, never `owner`.
- **Frictionless individual bulk checkout:** An individual buyer purchasing over KES 10,000 can complete checkout without entering any KRA PIN, licence number, or business name.
- **Admin Trade Hub segregation:** Guest and individual bulk accounts (`is_guest: true` or `segment: 'individual'`) do not appear in the commercial compliance vetting queue or count in the pending compliance badge.
- **Atomic migration script safety:** Deduplication script must run in a PostgreSQL transaction (`BEGIN ... COMMIT`), reassigning all users, orders, and quotes to the surviving primary account before deleting duplicate rows.

---

### Task 1: Database Deduplication Engine & Migration Script

**Files:**
- Create: `scripts/deduplicate-trade-accounts.mjs`
- Modify: `lib/trade/trade-pg.js:315-330`
- Modify: `lib/trade/trade-store.js:1340-1370`
- Test: `tests/trade-deduplication-db.test.js`

**Interfaces:**
- Consumes: `query`, `ensureTradeDb` from `lib/trade/trade-pg.js`
- Produces: `findMatchingTradeAccount({ kraPin, licenceNo, tradingName }) -> Promise<AccountRecord | null>` in `lib/trade/trade-store.js`

- [ ] **Step 1: Write the failing test**

Create `tests/trade-deduplication-db.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { findMatchingTradeAccount, upsertTradeAccount, buildTradeAccount } from '../lib/trade/trade-store.js';

test('findMatchingTradeAccount matches exact and case-insensitive KRA PIN, licence, or trading name', async () => {
  await ensureTradeDb();

  const testKra = 'P099988877Z';
  const testLic = 'LQ-TEST-2026-999';
  const testName = 'Test Deduplication Primary Entity Ltd';

  const account = buildTradeAccount({
    tradingName: testName,
    legalName: testName,
    kraPin: testKra,
    licenceNo: testLic,
    segment: 'horeca',
  }, { status: 'active' });

  await upsertTradeAccount(account);

  // 1. Match by lowercase KRA PIN with spaces
  const matchKra = await findMatchingTradeAccount({ kraPin: '  p099988877z  ' });
  assert.ok(matchKra, 'Should match by KRA PIN');
  assert.equal(matchKra.id, account.id);

  // 2. Match by licence number with spaces
  const matchLic = await findMatchingTradeAccount({ licenceNo: '  lq-test-2026-999  ' });
  assert.ok(matchLic, 'Should match by licence number');
  assert.equal(matchLic.id, account.id);

  // 3. Match by trading name
  const matchName = await findMatchingTradeAccount({ tradingName: 'test deduplication primary entity ltd' });
  assert.ok(matchName, 'Should match by trading name');
  assert.equal(matchName.id, account.id);

  // Cleanup test account
  await query('DELETE FROM trade_accounts WHERE id = $1', [account.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-deduplication-db.test.js`  
Expected: FAIL with `findMatchingTradeAccount is not a function`

- [ ] **Step 3: Implement `findMatchingTradeAccount` and database indices**

In `lib/trade/trade-pg.js`:
Add indices in `ensureTradeDb()`:
```javascript
CREATE INDEX IF NOT EXISTS idx_trade_accounts_kra_pin ON trade_accounts (LOWER(kra_pin)) WHERE kra_pin IS NOT NULL AND kra_pin <> '';
CREATE INDEX IF NOT EXISTS idx_trade_accounts_trading_name_lower ON trade_accounts (LOWER(trading_name));
```

In `lib/trade/trade-store.js`:
Implement `findMatchingTradeAccount({ kraPin, licenceNo, tradingName })`:
```javascript
export async function findMatchingTradeAccount({ kraPin, licenceNo, tradingName }) {
  await ensureTradeDb();
  const cleanPin = typeof kraPin === 'string' ? kraPin.trim().toLowerCase() : '';
  const cleanLic = typeof licenceNo === 'string' ? licenceNo.trim().toLowerCase() : '';
  const cleanName = typeof tradingName === 'string' ? tradingName.trim().toLowerCase() : '';

  if (cleanPin) {
    const res = await query(
      `SELECT * FROM trade_accounts
       WHERE LOWER(kra_pin) = $1
         AND kra_pin IS NOT NULL
         AND kra_pin <> ''
       LIMIT 1`,
      [cleanPin]
    );
    if (res.rows.length > 0) return pgAccountRowToRecord(res.rows[0]);
  }

  if (cleanLic) {
    const res = await query(
      `SELECT * FROM trade_accounts
       WHERE LOWER(licence_no) = $1
         AND licence_no IS NOT NULL
         AND licence_no <> ''
       LIMIT 1`,
      [cleanLic]
    );
    if (res.rows.length > 0) return pgAccountRowToRecord(res.rows[0]);
  }

  if (cleanName) {
    const res = await query(
      `SELECT * FROM trade_accounts
       WHERE LOWER(trading_name) = $1
         AND (is_guest IS FALSE OR is_guest IS NULL)
       LIMIT 1`,
      [cleanName]
    );
    if (res.rows.length > 0) return pgAccountRowToRecord(res.rows[0]);
  }

  return null;
}
```

Create `scripts/deduplicate-trade-accounts.mjs` to scan for duplicate KRA PINs and names in `trade_accounts`, reassign users, orders, and quotes to the surviving primary ID, and delete duplicate rows in a transaction.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-deduplication-db.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-pg.js lib/trade/trade-store.js scripts/deduplicate-trade-accounts.mjs tests/trade-deduplication-db.test.js
git commit -m "feat(trade): add database deduplication engine and migration script"
```

---

### Task 2: Commercial Account Onboarding Deduplication (`/api/trade/apply`)

**Files:**
- Modify: `app/api/trade/apply/route.js:30-100`
- Test: `tests/trade-deduplication-apply.test.js`

**Interfaces:**
- Consumes: `findMatchingTradeAccount`, `findTradeUserByIdentifier`, `addTradeUser` from `lib/trade/trade-store.js`
- Produces: `POST /api/trade/apply` returns `{ success: true, attachedToExisting: boolean, account: AccountRecord }`

- [ ] **Step 1: Write the failing test**

Create `tests/trade-deduplication-apply.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { upsertTradeAccount, buildTradeAccount, findTradeUserByIdentifier } from '../lib/trade/trade-store.js';
import { POST } from '../app/api/trade/apply/route.js';

test('POST /api/trade/apply attaches user to existing account when KRA PIN matches rather than creating duplicate', async () => {
  await ensureTradeDb();

  const testKra = 'P088877766Y';
  const existingAccount = buildTradeAccount({
    tradingName: 'Datamuse Ltd',
    legalName: 'Datamuse Kenya Limited',
    kraPin: testKra,
    licenceNo: 'LQ-NRB-2203949',
    segment: 'horeca',
  }, { status: 'active' });

  await upsertTradeAccount(existingAccount);

  const applyBody = {
    tradingName: 'Datamuse Ltd',
    legalName: 'Datamuse Kenya Limited',
    segment: 'horeca',
    contactName: 'Brian Kip',
    role: 'Procurement Specialist',
    email: 'brian.kip@datamuse.co.ke',
    phone: '0711998877',
    kraPin: testKra,
    licenceNo: 'LQ-NRB-2203949',
    deliveryAddress: 'Riverside Drive, Nairobi',
    city: 'Nairobi',
    termsAccepted: true,
  };

  const req = new Request('http://localhost:3000/api/trade/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(applyBody),
  });

  const res = await POST(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.attachedToExisting, true);
  assert.equal(data.account.id, existingAccount.id);

  // Verify user was created under existing account with seatType 'buyer'
  const user = await findTradeUserByIdentifier('brian.kip@datamuse.co.ke');
  assert.ok(user, 'User seat should be created');
  assert.equal(user.accountId, existingAccount.id);
  assert.equal(user.seatType, 'buyer');

  // Verify NO duplicate trade_accounts row was spawned
  const countRes = await query('SELECT count(*) FROM trade_accounts WHERE UPPER(kra_pin) = $1', [testKra]);
  assert.equal(Number(countRes.rows[0].count), 1);

  // Cleanup
  await query('DELETE FROM trade_users WHERE account_id = $1', [existingAccount.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [existingAccount.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-deduplication-apply.test.js`  
Expected: FAIL with `data.attachedToExisting !== true` or duplicate created

- [ ] **Step 3: Implement deduplication in `app/api/trade/apply/route.js`**

In `app/api/trade/apply/route.js`:
1. Remove broken line 49 query (`SELECT id, status FROM trade_accounts WHERE LOWER(email) = $1`).
2. After checking `findTradeUserByIdentifier(email)`:
   Check `const existingAccount = await findMatchingTradeAccount({ kraPin: data.kraPin, licenceNo: data.licenceNo, tradingName: data.tradingName })`.
3. If `existingAccount`:
   - Add new `trade_users` record:
     ```javascript
     const userId = `usr_${Date.now()}`;
     await addTradeUser({
       id: userId,
       accountId: existingAccount.id,
       name: data.contactName,
       role: data.role || 'Staff Buyer',
       seatType: 'buyer', // always buyer, never owner
       email,
       phone: data.phone.trim(),
     });
     ```
   - Send application alert to account contacts.
   - Return response:
     ```javascript
     return NextResponse.json({
       success: true,
       attachedToExisting: true,
       message: `You have been added as a purchasing seat to ${existingAccount.tradingName}. Our compliance team will confirm your access shortly.`,
       account: existingAccount,
     });
     ```
4. If no match: proceed with creating a new commercial account record in `trade_accounts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-deduplication-apply.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/trade/apply/route.js tests/trade-deduplication-apply.test.js
git commit -m "feat(trade): deduplicate commercial applications by KRA PIN, licence and trading name"
```

---

### Task 3: Universal Signup & Instant Email Verification API and UI

**Files:**
- Create: `app/api/trade/signup/route.js`
- Create: `app/api/trade/signup/verify/route.js`
- Create: `app/trade/signup/page.js`
- Modify: `app/trade/login/page.js:100-140`
- Test: `tests/trade-signup-verification.test.js`

**Interfaces:**
- Consumes: `kvSet`, `kvGet`, `kvDelete` from `lib/kv-store.js`, `hashPassword` from `lib/trade/trade-password.js`, `sendOtpEmail` from `lib/email.js`, `signTradeToken` from `lib/trade/trade-auth.js`
- Produces: `POST /api/trade/signup` (sends OTP), `POST /api/trade/signup/verify` (verifies OTP, creates individual account + user, sets auth cookie)

- [ ] **Step 1: Write the failing test**

Create `tests/trade-signup-verification.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { kvGet } from '../lib/kv-store.js';
import { POST as signupPOST } from '../app/api/trade/signup/route.js';
import { POST as verifyPOST } from '../app/api/trade/signup/verify/route.js';

test('Universal Signup flow: initiates OTP, verifies code, creates active individual trade account', async () => {
  await ensureTradeDb();

  const testEmail = 'test.signup.user@example.test';
  const testPhone = '0712999888';
  const testPass = 'SecurePassword123!';

  // 1. Initiate signup
  const signupReq = new Request('http://localhost:3000/api/trade/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Signup Buyer',
      email: testEmail,
      phone: testPhone,
      password: testPass,
    }),
  });

  const signupRes = await signupPOST(signupReq);
  const signupData = await signupRes.json();
  assert.equal(signupRes.status, 200);
  assert.equal(signupData.success, true);

  // Retrieve OTP code from kv_store
  const storedOtp = await kvGet(`trade_signup_otp:${testEmail}`);
  assert.ok(storedOtp, 'OTP payload should be stored in kv_store');
  assert.equal(typeof storedOtp.code, 'string');
  assert.equal(storedOtp.code.length, 6);

  // 2. Verify with invalid code -> should fail
  const badVerifyReq = new Request('http://localhost:3000/api/trade/signup/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '000000',
    }),
  });
  const badVerifyRes = await verifyPOST(badVerifyReq);
  assert.equal(badVerifyRes.status, 400);

  // 3. Verify with correct code -> should succeed
  const goodVerifyReq = new Request('http://localhost:3000/api/trade/signup/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: storedOtp.code,
    }),
  });
  const goodVerifyRes = await verifyPOST(goodVerifyReq);
  const goodVerifyData = await goodVerifyRes.json();

  assert.equal(goodVerifyRes.status, 200);
  assert.equal(goodVerifyData.success, true);
  assert.equal(goodVerifyData.account.segment, 'individual');
  assert.equal(goodVerifyData.account.isGuest, false);
  assert.equal(goodVerifyData.account.status, 'active');

  // Verify cookie set
  const setCookie = goodVerifyRes.headers.get('set-cookie');
  assert.ok(setCookie?.includes('trade_token'), 'Response must set trade_token cookie');

  // Cleanup
  await query('DELETE FROM trade_users WHERE email = $1', [testEmail]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [goodVerifyData.account.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-signup-verification.test.js`  
Expected: FAIL with `Cannot find module '../app/api/trade/signup/route.js'`

- [ ] **Step 3: Implement signup APIs and UI**

1. Create `app/api/trade/signup/route.js`:
   - Validates name, phone, email, password (min 12 chars).
   - Checks if user exists via `findTradeUserByIdentifier(email)`.
   - Hashes password via `hashPassword(password)`.
   - Generates 6-digit random code `crypto.randomInt(100000, 1000000).toString()`.
   - Stores `{ name, phone, email, passwordHash, code }` in `kv_store` via `kvSet(`trade_signup_otp:${email}`, payload, 15 * 60 * 1000)`.
   - Sends email via `sendOtpEmail({ to: email, code })` (logs if credentials missing in test environment).
   - Returns `{ success: true, message: 'Verification code sent to email' }`.

2. Create `app/api/trade/signup/verify/route.js`:
   - Validates email and code.
   - Retrieves stored record from `kvGet(`trade_signup_otp:${email}`)`.
   - Checks code match.
   - Provisions account: `buildTradeAccount({ tradingName: stored.name, segment: 'individual', isGuest: false }, { status: 'active' })`.
   - Provisions user: `addTradeUser({ id: 'usr_' + Date.now(), accountId: account.id, name: stored.name, email: stored.email, phone: stored.phone, seatType: 'owner', role: 'Account Owner', passwordHash: stored.passwordHash })`.
   - Deletes OTP key via `kvDelete`.
   - Signs token via `signTradeToken` and sets `trade_token` cookie.
   - Returns `{ success: true, user, account }`.

3. Create `app/trade/signup/page.js`:
   - Clean, modern registration UI with Fast Cart / Montserrat styling.
   - Step 1: Name, Email, Phone, Password inputs.
   - Step 2: 6-digit OTP code entry with auto-focus and resend link.
   - Upon completion: redirects to `/trade/checkout` (if cart has items) or `/trade/order-pad`.

4. Update `app/trade/login/page.js`:
   - Add clear CTA: "Don't have an account? Sign up for wholesale purchasing →" linking to `/trade/signup`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-signup-verification.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/trade/signup/route.js app/api/trade/signup/verify/route.js app/trade/signup/page.js app/trade/login/page.js tests/trade-signup-verification.test.js
git commit -m "feat(trade): add universal signup with instant email verification"
```

---

### Task 4: Individual Bulk Checkout & "Purchase as a Business" Expansion

**Files:**
- Modify: `app/trade/checkout/page.js:1-250`
- Modify: `app/api/trade/checkout/route.js:90-140`
- Modify: `lib/trade/trade-store.js:1700-1730`
- Test: `tests/trade-checkout-business-toggle.test.js`

**Interfaces:**
- Consumes: `findMatchingTradeAccount`, `upsertTradeAccount` from `lib/trade/trade-store.js`
- Produces: `POST /api/trade/checkout` accepts optional `businessDetails: { tradingName, legalName, kraPin, licenceNo }`

- [ ] **Step 1: Write the failing test**

Create `tests/trade-checkout-business-toggle.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { upsertTradeAccount, buildTradeAccount } from '../lib/trade/trade-store.js';
import { POST } from '../app/api/trade/checkout/route.js';

test('Individual checkout works with zero business details; business toggle associates with matching company', async () => {
  await ensureTradeDb();

  // 1. Test individual guest checkout without business details:
  // Must succeed with no KRA PIN or liquor licence required
  const guestOrderReq = new Request('http://localhost:3000/api/trade/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerName: 'David Event Organizer',
      buyerPhone: '0722112233',
      buyerEmail: 'david.event@example.test',
      deliveryAddress: { addressLine: 'Kilimani Road', city: 'Nairobi' },
      paymentMethod: 'paystack',
      ageConfirmed: true,
      submissionDurationMs: 3000,
      items: [
        { sku: 'JABA-JUICE-1L', quantity: 20 }, // Meets wholesale threshold
      ],
    }),
  });

  const guestRes = await POST(guestOrderReq);
  const guestData = await guestRes.json();
  assert.equal(guestRes.status, 200);
  assert.ok(guestData.order, 'Order should be created successfully');
  assert.equal(guestData.account.isGuest, true);
  assert.equal(guestData.account.segment, 'individual');

  // 2. Test business toggle with existing KRA PIN:
  const coKra = 'P077766655X';
  const existingBiz = buildTradeAccount({
    tradingName: 'Savannah Bar & Grill',
    kraPin: coKra,
    licenceNo: 'LQ-NRB-99881',
    segment: 'horeca',
  }, { status: 'active' });
  await upsertTradeAccount(existingBiz);

  const bizOrderReq = new Request('http://localhost:3000/api/trade/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerName: 'Savannah Manager',
      buyerPhone: '0722334455',
      buyerEmail: 'manager@savannahbar.test',
      deliveryAddress: { addressLine: 'Westlands Mall', city: 'Nairobi' },
      paymentMethod: 'paystack',
      ageConfirmed: true,
      submissionDurationMs: 3000,
      businessDetails: {
        tradingName: 'Savannah Bar & Grill',
        kraPin: coKra,
      },
      items: [
        { sku: 'JABA-JUICE-1L', quantity: 20 },
      ],
    }),
  });

  const bizRes = await POST(bizOrderReq);
  const bizData = await bizRes.json();
  assert.equal(bizRes.status, 200);
  assert.equal(bizData.order.accountId, existingBiz.id);

  // Cleanup
  await query('DELETE FROM trade_orders WHERE id IN ($1, $2)', [guestData.order.id, bizData.order.id]);
  await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [guestData.account.id, existingBiz.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-checkout-business-toggle.test.js`  
Expected: FAIL (guest account has segment 'horeca' instead of 'individual', or `businessDetails` not handled)

- [ ] **Step 3: Implement individual bulk checkout & business toggle**

1. In `lib/trade/trade-store.js`:
   - In `findOrCreateGuestTradeAccount`: set `segment: 'individual'`, `isGuest: true`.
2. In `app/api/trade/checkout/route.js`:
   - Check if `body.businessDetails` is provided:
     - Validate KRA PIN if provided (`/^[A-Z]\d{9}[A-Z]$/i`).
     - Run `findMatchingTradeAccount(body.businessDetails)`.
     - If matching account found: use that account for the order, and create/link the user.
     - If not found: create a new business account with `isGuest: false`.
   - If `businessDetails` not provided:
     - Proceed with standard individual checkout using `findOrCreateGuestTradeAccount` or authenticated individual user.
3. In `app/trade/checkout/page.js`:
   - Add expandable toggle:
     `[ ] Purchasing on behalf of a registered business? (Requires VAT invoice or Net 14 credit)`
   - Show input fields when checked: Company Name, Business KRA PIN, County Liquor Licence.
   - Include `businessDetails` in the POST payload to `/api/trade/checkout`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-checkout-business-toggle.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/trade/trade-store.js app/api/trade/checkout/route.js app/trade/checkout/page.js tests/trade-checkout-business-toggle.test.js
git commit -m "feat(trade): individual bulk checkout and optional business upgrade toggle"
```

---

### Task 5: Admin Trade Hub Segregation & Filtering

**Files:**
- Modify: `app/admin/trade/page.js:50-70,650-675,1140-1200`
- Modify: `app/api/admin/trade/accounts/route.js:5-15`
- Test: `tests/trade-admin-segregation.test.js`

**Interfaces:**
- Consumes: `getTradeAccounts` from `lib/trade/trade-store.js`
- Produces: Segregated admin accounts view where commercial accounts are the default, and individual/guest bulk accounts are isolated into their own filter view

- [ ] **Step 1: Write the failing test**

Create `tests/trade-admin-segregation.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { getTradeAccounts, upsertTradeAccount, buildTradeAccount } from '../lib/trade/trade-store.js';

test('getTradeAccounts returns accounts with isGuest and segment properties for admin segregation', async () => {
  await ensureTradeDb();

  const biz = buildTradeAccount({
    tradingName: 'Commercial Hotel Ltd',
    kraPin: 'P012345678A',
    licenceNo: 'LQ-NRB-1111',
    segment: 'horeca',
  }, { status: 'pending' });
  biz.isGuest = false;

  const ind = buildTradeAccount({
    tradingName: 'Chris Onyi Guest',
    segment: 'individual',
  }, { status: 'active' });
  ind.isGuest = true;

  await upsertTradeAccount(biz);
  await upsertTradeAccount(ind);

  const accounts = await getTradeAccounts();

  const commercialAccounts = accounts.filter((a) => !a.isGuest && a.segment !== 'individual');
  const individualAccounts = accounts.filter((a) => a.isGuest || a.segment === 'individual');

  const foundBiz = commercialAccounts.find((a) => a.id === biz.id);
  const foundInd = individualAccounts.find((a) => a.id === ind.id);

  assert.ok(foundBiz, 'Commercial account should be in commercial list');
  assert.ok(foundInd, 'Individual account should be in individual list');
  assert.equal(commercialAccounts.some((a) => a.id === ind.id), false, 'Individual should not be in commercial list');

  // Cleanup
  await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [biz.id, ind.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/trade-admin-segregation.test.js`  
Expected: PASS (data layer) or FAIL if mapping is missing

- [ ] **Step 3: Update `app/admin/trade/page.js`**

In `app/admin/trade/page.js`:
1. Add state: `const [accountTypeFilter, setAccountTypeFilter] = useState('commercial'); // 'commercial' | 'individual' | 'all'`
2. Update `filteredAccounts`:
   ```javascript
   const filteredAccounts = useMemo(() => {
     return accounts.filter((acc) => {
       const isInd = acc.isGuest === true || acc.segment === 'individual';
       if (accountTypeFilter === 'commercial' && isInd) return false;
       if (accountTypeFilter === 'individual' && !isInd) return false;

       const q = accountSearch.trim().toLowerCase();
       const matchSearch =
         !q ||
         (acc.tradingName || '').toLowerCase().includes(q) ||
         (acc.legalName || '').toLowerCase().includes(q) ||
         (acc.kraPin || '').toLowerCase().includes(q) ||
         (acc.licenceNo || '').toLowerCase().includes(q);

       const matchStatus = accountStatusFilter === 'all' || acc.status === accountStatusFilter;
       const matchSegment = accountSegmentFilter === 'all' || acc.segment === accountSegmentFilter;

       return matchSearch && matchStatus && matchSegment;
     });
   }, [accounts, accountTypeFilter, accountSearch, accountStatusFilter, accountSegmentFilter]);
   ```
3. Update `pendingAccountsCount` to count only commercial pending accounts:
   ```javascript
   const pendingAccountsCount = useMemo(
     () => accounts.filter((a) => a.status === 'pending' && !a.isGuest && a.segment !== 'individual').length,
     [accounts]
   );
   ```
4. In UI controls (above the table):
   Add segmented pill for Account Type:
   - `Commercial Businesses` (Default)
   - `Individual Bulk Buyers`
   - `All Accounts`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/trade-admin-segregation.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/trade/page.js tests/trade-admin-segregation.test.js
git commit -m "feat(trade): segregate commercial and individual accounts in Admin Trade Hub"
```

---

### Task 6: End-to-End Verification & Database Migration Run

**Files:**
- Run: `node scripts/deduplicate-trade-accounts.mjs`
- Test: Full regression suite (`node --test tests/trade-profile-settings.test.js tests/trade-password-reset.test.js tests/trade-deduplication-db.test.js tests/trade-deduplication-apply.test.js tests/trade-signup-verification.test.js tests/trade-checkout-business-toggle.test.js tests/trade-admin-segregation.test.js`)

- [ ] **Step 1: Run deduplication migration on PostgreSQL database**

Run: `node scripts/deduplicate-trade-accounts.mjs`  
Expected: Scans PostgreSQL, identifies duplicate company accounts, merges child records, deletes secondary duplicates, reports clean output.

- [ ] **Step 2: Run test suite to verify zero regressions**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 3: Verify live endpoints via HTTP curl**

Run:
1. `curl -s -X POST http://localhost:3000/api/trade/signup ...`
2. `curl -s -X POST http://localhost:3000/api/trade/apply ...`
3. `curl -s -X GET http://localhost:3000/api/admin/trade/accounts ...`
Expected: HTTP 200 responses with correct JSON payloads.

- [ ] **Step 4: Commit and finalize**

```bash
git add -A
git commit -m "chore(trade): run deduplication migration and verify test suite"
```

