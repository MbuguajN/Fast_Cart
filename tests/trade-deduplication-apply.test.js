import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';
import { upsertTradeAccount, buildTradeAccount, findTradeUserByIdentifier, syncTradeUserToPg } from '../lib/trade/trade-store.js';
import { POST } from '../app/api/trade/apply/route.js';

after(async () => {
  const pool = getPgPool();
  if (pool) await pool.end();
});

test('POST /api/trade/apply attaches user to existing account when KRA PIN matches rather than creating duplicate', async () => {
  await ensureTradeDb();

  const testKra = 'P088877766Y';
  // Clean up any stale test data first
  await query('DELETE FROM trade_users WHERE email = $1', ['brian.kip@datamuse.co.ke']);
  await query('DELETE FROM trade_accounts WHERE UPPER(kra_pin) = $1', [testKra]);

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
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
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

test('POST /api/trade/apply attaches user to existing account when licence matches', async () => {
  await ensureTradeDb();

  const testLicence = 'LIC-MATCH-TEST-99';
  await query('DELETE FROM trade_users WHERE email = $1', ['licence.user@testbusiness.co.ke']);
  await query('DELETE FROM trade_accounts WHERE LOWER(licence_no) = $1', [testLicence.toLowerCase()]);

  const existingAccount = buildTradeAccount({
    tradingName: 'Original Business Bar',
    legalName: 'Original Business Bar Ltd',
    kraPin: 'P012398745A',
    licenceNo: testLicence,
    segment: 'horeca',
  }, { status: 'active' });

  await upsertTradeAccount(existingAccount);

  const applyBody = {
    tradingName: 'Branch Bar',
    legalName: 'Original Business Bar Ltd',
    segment: 'horeca',
    contactName: 'Alice Buyer',
    role: 'Bar Manager',
    email: 'licence.user@testbusiness.co.ke',
    phone: '0722114455',
    kraPin: 'P099988877Z', // different PIN, but matching licence
    licenceNo: testLicence,
    deliveryAddress: 'Westlands, Nairobi',
    city: 'Nairobi',
    termsAccepted: true,
  };

  const req = new Request('http://localhost:3000/api/trade/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.2' },
    body: JSON.stringify(applyBody),
  });

  const res = await POST(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.attachedToExisting, true);
  assert.equal(data.account.id, existingAccount.id);

  const user = await findTradeUserByIdentifier('licence.user@testbusiness.co.ke');
  assert.ok(user, 'User seat should be created');
  assert.equal(user.accountId, existingAccount.id);
  assert.equal(user.seatType, 'buyer');

  // Cleanup
  await query('DELETE FROM trade_users WHERE account_id = $1', [existingAccount.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [existingAccount.id]);
});

test('POST /api/trade/apply attaches user when trading name matches and creates buyer seat', async () => {
  await ensureTradeDb();

  const tradingName = 'Unique Bistro Serena Branch';
  await query('DELETE FROM trade_users WHERE email = $1', ['chef@uniquebistro.co.ke']);
  await query('DELETE FROM trade_accounts WHERE LOWER(trading_name) = $1', [tradingName.toLowerCase()]);

  const existingAccount = buildTradeAccount({
    tradingName,
    legalName: 'Unique Bistro Hospitality Ltd',
    kraPin: 'P077766655B',
    licenceNo: 'LIC-UB-101',
    segment: 'horeca',
  }, { status: 'active' });

  await upsertTradeAccount(existingAccount);

  const applyBody = {
    tradingName,
    legalName: 'Unique Bistro Hospitality Ltd',
    segment: 'horeca',
    contactName: 'Chef John',
    role: 'Head Chef',
    email: 'chef@uniquebistro.co.ke',
    phone: '0733445566',
    kraPin: 'P011122233C',
    licenceNo: 'LIC-UB-999',
    deliveryAddress: 'Kilimani, Nairobi',
    city: 'Nairobi',
    termsAccepted: true,
  };

  const req = new Request('http://localhost:3000/api/trade/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.3' },
    body: JSON.stringify(applyBody),
  });

  const res = await POST(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.attachedToExisting, true);
  assert.equal(data.account.id, existingAccount.id);

  const user = await findTradeUserByIdentifier('chef@uniquebistro.co.ke');
  assert.ok(user, 'User seat should be created');
  assert.equal(user.accountId, existingAccount.id);
  assert.equal(user.seatType, 'buyer');

  // Cleanup
  await query('DELETE FROM trade_users WHERE account_id = $1', [existingAccount.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [existingAccount.id]);
});

test('POST /api/trade/apply creates new commercial account when no existing match is found', async () => {
  await ensureTradeDb();

  const newKra = 'P055544433X';
  const newEmail = 'founder@novelbrandtest.co.ke';
  const newTradingName = 'Novel Brand Tasting Room';

  await query('DELETE FROM trade_users WHERE email = $1', [newEmail]);
  await query('DELETE FROM trade_accounts WHERE UPPER(kra_pin) = $1', [newKra]);
  await query('DELETE FROM trade_accounts WHERE LOWER(trading_name) = $1', [newTradingName.toLowerCase()]);

  const applyBody = {
    tradingName: newTradingName,
    legalName: 'Novel Brand Experiences Ltd',
    segment: 'horeca',
    contactName: 'Jane Founder',
    role: 'Managing Director',
    email: newEmail,
    phone: '0744556677',
    kraPin: newKra,
    licenceNo: 'LIC-NB-5544',
    deliveryAddress: 'Karen Road, Nairobi',
    city: 'Nairobi',
    termsAccepted: true,
  };

  const req = new Request('http://localhost:3000/api/trade/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.4' },
    body: JSON.stringify(applyBody),
  });

  const res = await POST(req);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.attachedToExisting, false);
  assert.ok(data.account.id);

  const user = await findTradeUserByIdentifier(newEmail);
  assert.ok(user, 'User seat should be created');
  assert.equal(user.accountId, data.account.id);
  assert.equal(user.seatType, 'owner', 'First applicant of a new business account is owner');

  // Cleanup
  await query('DELETE FROM trade_users WHERE account_id = $1', [data.account.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [data.account.id]);
});

test('POST /api/trade/apply returns 400 when applicant email already exists', async () => {
  await ensureTradeDb();

  const existingEmail = 'existing.applicant@testtrade.co.ke';
  await query('DELETE FROM trade_users WHERE email = $1', [existingEmail]);

  const existingAccount = buildTradeAccount({
    tradingName: 'Existing Trade Hotel',
    legalName: 'Existing Trade Hotel Ltd',
    kraPin: 'P011223344K',
    licenceNo: 'LIC-ETH-123',
    segment: 'horeca',
  }, { status: 'active' });
  await upsertTradeAccount(existingAccount);

  await syncTradeUserToPg({
    id: `usr_test_exist_${Date.now()}`,
    accountId: existingAccount.id,
    name: 'Existing User',
    email: existingEmail,
    phone: '0711000000',
    role: 'Buyer',
    seatType: 'buyer',
  });

  const applyBody = {
    tradingName: 'Existing Trade Hotel',
    legalName: 'Existing Trade Hotel Ltd',
    segment: 'horeca',
    contactName: 'Duplicate Applicant',
    role: 'Buyer',
    email: existingEmail,
    phone: '0711000000',
    kraPin: 'P011223344K',
    licenceNo: 'LIC-ETH-123',
    deliveryAddress: 'CBD, Nairobi',
    city: 'Nairobi',
    termsAccepted: true,
  };

  const req = new Request('http://localhost:3000/api/trade/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.5' },
    body: JSON.stringify(applyBody),
  });

  const res = await POST(req);
  const data = await res.json();

  assert.equal(res.status, 400);
  assert.ok(data.error.includes('already exists'));

  // Cleanup
  await query('DELETE FROM trade_users WHERE account_id = $1', [existingAccount.id]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [existingAccount.id]);
});
