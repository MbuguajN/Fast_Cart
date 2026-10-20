import test from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import { upsertTradeAccount, buildTradeAccount, addTradeUser, findOrCreateGuestTradeAccount } from '../lib/trade/trade-store.js';
import { POST } from '../app/api/trade/checkout/route.js';

test('Individual checkout works with zero business details; business toggle associates with matching company', async () => {
  await ensureTradeDb();
  await query("DELETE FROM kv_store WHERE key LIKE 'ratelimit:%'");
  await query("DELETE FROM trade_orders WHERE account_id IN (SELECT id FROM trade_accounts WHERE kra_pin = 'P077766655X' OR trading_name IN ('Savannah Bar & Grill', 'David Event Organizer'))");
  await query("DELETE FROM trade_users WHERE email IN ('david.event@example.test', 'manager@savannahbar.test')");
  await query("DELETE FROM trade_accounts WHERE kra_pin = 'P077766655X' OR trading_name IN ('Savannah Bar & Grill', 'David Event Organizer')");
  await query(`
    INSERT INTO trade_products (
      id, sku, name, slug, brand, category_name, price_line,
      prk_cost_inc_vat, stock_quantity, reserved_stock, in_stock, is_active,
      case_size, product_cost_inc_vat, logistics_cost_inc_vat
    ) VALUES (
      'prod_tr_jaba_juice_1l', 'JABA-JUICE-1L', 'Jaba Juice 1L', 'jaba-juice-1l', 'Jaba', 'Ready to Drink', 'spirits',
      1500.00, 1000, 0, true, true,
      12, 1500.00, 0.00
    ) ON CONFLICT (sku) DO UPDATE SET stock_quantity = 1000, is_active = true, in_stock = true
  `);

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
  await query('DELETE FROM trade_users WHERE email IN ($1, $2)', ['david.event@example.test', 'manager@savannahbar.test']);
  await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [guestData.account.id, existingBiz.id]);
  await query("DELETE FROM kv_store WHERE key LIKE 'ratelimit:%'");
});

test('Repeat guest checkout backfills and persists segment individual to PostgreSQL', async () => {
  await ensureTradeDb();
  const email = `repeat.guest.${Date.now()}@example.test`;
  const phone = '0711998877';

  // Create an initial guest account manually with legacy segment 'horeca'
  const initialGuest = buildTradeAccount({
    tradingName: 'Legacy Guest',
    contactName: 'Legacy Guest',
    phone,
    email,
    segment: 'horeca',
  }, { status: 'active' });
  initialGuest.isGuest = true;
  await upsertTradeAccount(initialGuest);

  const initialUser = {
    id: `usr_legacy_${Date.now()}`,
    accountId: initialGuest.id,
    name: 'Legacy Guest',
    role: 'Guest Buyer',
    seatType: 'buyer',
    email,
    phone,
  };
  await addTradeUser(initialUser);

  // Repeat guest checkout
  const { account } = await findOrCreateGuestTradeAccount({
    name: 'Legacy Guest',
    phone,
    email,
    addressLine: 'Ngong Road',
    city: 'Nairobi',
  });

  assert.equal(account.segment, 'individual');

  // Verify it was persisted to PostgreSQL
  const { rows } = await query('SELECT segment FROM trade_accounts WHERE id = $1', [initialGuest.id]);
  assert.equal(rows[0].segment, 'individual');

  // Cleanup
  await query('DELETE FROM trade_users WHERE id = $1', [initialUser.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [initialGuest.id]);
});

test('Business checkout rejects unauthenticated order using email of existing non-guest user', async () => {
  await ensureTradeDb();
  await query("DELETE FROM kv_store WHERE key LIKE 'ratelimit:%'");

  const nonGuestEmail = `corp.owner.${Date.now()}@example.test`;
  const nonGuestAcct = buildTradeAccount({
    tradingName: 'Registered Corp Ltd',
    kraPin: 'P011122233Z',
    segment: 'corporate',
  }, { status: 'active' });
  nonGuestAcct.isGuest = false;
  await upsertTradeAccount(nonGuestAcct);

  const nonGuestUser = {
    id: `usr_corp_${Date.now()}`,
    accountId: nonGuestAcct.id,
    name: 'Registered Owner',
    role: 'Business Owner',
    seatType: 'owner',
    email: nonGuestEmail,
    phone: '0733445566',
  };
  await addTradeUser(nonGuestUser);

  // Try placing a business checkout using nonGuestEmail without authentication
  const req = new Request('http://localhost:3000/api/trade/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyerName: 'Impostor Buyer',
      buyerPhone: '0799887766',
      buyerEmail: nonGuestEmail,
      deliveryAddress: { addressLine: 'Riverside Drive', city: 'Nairobi' },
      paymentMethod: 'paystack',
      ageConfirmed: true,
      submissionDurationMs: 3000,
      businessDetails: {
        tradingName: 'New Restaurant',
        kraPin: 'P099988877Y',
      },
      items: [
        { sku: 'JABA-JUICE-1L', quantity: 20 },
      ],
    }),
  });

  const res = await POST(req);
  const data = await res.json();
  assert.equal(res.status, 400);
  assert.match(data.error, /already exists.*sign in/i);

  // Cleanup
  await query('DELETE FROM trade_users WHERE id = $1', [nonGuestUser.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [nonGuestAcct.id]);
  await query("DELETE FROM kv_store WHERE key LIKE 'ratelimit:%'");
});
