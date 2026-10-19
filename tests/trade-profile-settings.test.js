import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure signing secret exists in test environment
process.env.TRADE_JWT_SECRET = 'test_trade_secret_key_with_at_least_32_bytes_of_random_data_for_unit_tests';
process.env.CUSTOMER_SESSION_SECRET = 'test_customer_secret_key_with_at_least_32_bytes_of_random_data_for_unit_tests';

import { signToken, AUDIENCE } from '../lib/crypto-tokens.js';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';

import { GET, PUT } from '../app/api/trade/profile/route.js';

function createRequest(method, url, { body, token } = {}) {
  const headers = new Headers();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  if (body) {
    headers.set('content-type', 'application/json');
  }

  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('trade profile: unauthenticated request returns 401', async () => {
  assert.ok(GET, 'GET handler should be defined');
  const req = createRequest('GET', 'http://localhost:3000/api/trade/profile');
  const res = await GET(req);
  assert.equal(res.status, 401, 'Unauthenticated request must return 401');
  const data = await res.json();
  assert.ok(data.error, 'Must include error message');
});

test('trade profile: GET as owner returns account, user, isOwner=true, and seats roster', async () => {
  await ensureTradeDb();

  // Find an owner user from Postgres
  const userRes = await query("SELECT * FROM trade_users WHERE seat_type = 'owner' LIMIT 1");
  assert.ok(userRes.rows.length > 0, 'Must have at least one owner user in DB');
  const ownerUser = userRes.rows[0];

  const token = await signToken(AUDIENCE.TRADE, {
    userId: ownerUser.id,
    accountId: ownerUser.account_id,
    seatType: ownerUser.seat_type,
    role: ownerUser.role,
    name: ownerUser.name,
  }, 3600000);

  const req = createRequest('GET', 'http://localhost:3000/api/trade/profile', { token });
  const res = await GET(req);
  assert.equal(res.status, 200, 'Owner GET must return 200');

  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.isOwner, true);
  assert.equal(data.user.id, ownerUser.id);
  assert.equal(data.account.id, ownerUser.account_id);
  assert.ok(Array.isArray(data.seats), 'Seats must be an array for owner');
  assert.ok(data.seats.length > 0, 'Seats roster should list account users');
  assert.ok(data.seats.some((s) => s.id === ownerUser.id));
});

test('trade profile: GET as non-owner (buyer) returns user, account, isOwner=false, and empty/omitted seats', async () => {
  await ensureTradeDb();

  // Find or create a buyer user
  let buyerRes = await query("SELECT * FROM trade_users WHERE seat_type = 'buyer' LIMIT 1");
  let buyerUser;
  if (buyerRes.rows.length > 0) {
    buyerUser = buyerRes.rows[0];
  } else {
    const acc = (await query("SELECT id FROM trade_accounts LIMIT 1")).rows[0];
    buyerUser = {
      id: 'usr_test_buyer_sample',
      account_id: acc.id,
      name: 'Test Buyer User',
      email: 'buyer.test@sample.co.ke',
      phone: '+254711999888',
      role: 'Purchasing Lead',
      seat_type: 'buyer',
    };
    await query(
      'INSERT INTO trade_users (id, account_id, name, email, phone, role, seat_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [buyerUser.id, buyerUser.account_id, buyerUser.name, buyerUser.email, buyerUser.phone, buyerUser.role, buyerUser.seat_type]
    );
  }

  const token = await signToken(AUDIENCE.TRADE, {
    userId: buyerUser.id,
    accountId: buyerUser.account_id,
    seatType: 'buyer',
    role: buyerUser.role,
    name: buyerUser.name,
  }, 3600000);

  const req = createRequest('GET', 'http://localhost:3000/api/trade/profile', { token });
  const res = await GET(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.isOwner, false);
  assert.equal(data.user.id, buyerUser.id);
  assert.equal(data.seats, undefined, 'Seats should be omitted for non-owners');
});

test('trade profile: PUT personal details succeeds for any seat and updates PostgreSQL', async () => {
  await ensureTradeDb();

  const userRes = await query("SELECT * FROM trade_users LIMIT 1");
  const user = userRes.rows[0];

  const token = await signToken(AUDIENCE.TRADE, {
    userId: user.id,
    accountId: user.account_id,
    seatType: user.seat_type,
    role: user.role,
    name: user.name,
  }, 3600000);

  const newName = 'Updated Contact ' + Date.now();
  const newPhone = '+254799000111';
  const newRole = 'Lead Sommelier';

  const req = createRequest('PUT', 'http://localhost:3000/api/trade/profile', {
    token,
    body: {
      personal: {
        name: newName,
        phone: newPhone,
        role: newRole,
      },
    },
  });

  const res = await PUT(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.user.name, newName);
  assert.equal(data.user.phone, newPhone);
  assert.equal(data.user.role, newRole);

  // Directly verify PostgreSQL persistence
  const checkDb = await query('SELECT name, phone, role FROM trade_users WHERE id = $1', [user.id]);
  assert.equal(checkDb.rows[0].name, newName);
  assert.equal(checkDb.rows[0].phone, newPhone);
  assert.equal(checkDb.rows[0].role, newRole);
});

test('trade profile: PUT business details by non-owner seat returns 403 Forbidden', async () => {
  await ensureTradeDb();

  const buyerRes = await query("SELECT * FROM trade_users WHERE seat_type = 'buyer' LIMIT 1");
  assert.ok(buyerRes.rows.length > 0, 'Must have a buyer user');
  const buyerUser = buyerRes.rows[0];

  const token = await signToken(AUDIENCE.TRADE, {
    userId: buyerUser.id,
    accountId: buyerUser.account_id,
    seatType: 'buyer',
    role: buyerUser.role,
    name: buyerUser.name,
  }, 3600000);

  const req = createRequest('PUT', 'http://localhost:3000/api/trade/profile', {
    token,
    body: {
      business: {
        tradingName: 'Malicious Change Inc',
        kraPin: 'P051234567Z',
      },
    },
  });

  const res = await PUT(req);
  assert.equal(res.status, 403, 'Non-owner updating business details must receive 403 Forbidden');
  const data = await res.json();
  assert.ok(data.error.includes('owner') || data.error.includes('permission') || data.error.includes('Forbidden'), 'Error must mention permissions or owner');
});

test('trade profile: PUT business with invalid KRA PIN format returns 400 Bad Request', async () => {
  await ensureTradeDb();

  const ownerRes = await query("SELECT * FROM trade_users WHERE seat_type = 'owner' LIMIT 1");
  const ownerUser = ownerRes.rows[0];

  const token = await signToken(AUDIENCE.TRADE, {
    userId: ownerUser.id,
    accountId: ownerUser.account_id,
    seatType: 'owner',
    role: ownerUser.role,
    name: ownerUser.name,
  }, 3600000);

  const req = createRequest('PUT', 'http://localhost:3000/api/trade/profile', {
    token,
    body: {
      business: {
        tradingName: 'Valid Trading Name',
        kraPin: 'INVALID_123',
      },
    },
  });

  const res = await PUT(req);
  assert.equal(res.status, 400, 'Invalid KRA PIN must be rejected with 400');
  const data = await res.json();
  assert.ok(data.error.toLowerCase().includes('kra pin'), 'Error must specify KRA PIN format issue');
});

test('trade profile: PUT business by owner updates PostgreSQL, normalizes KRA PIN, and preserves secondary addresses', async () => {
  await ensureTradeDb();

  const ownerRes = await query("SELECT * FROM trade_users WHERE seat_type = 'owner' LIMIT 1");
  const ownerUser = ownerRes.rows[0];

  // Prepare account with multiple addresses to test preservation
  const testAccountRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [ownerUser.account_id]);
  const account = testAccountRes.rows[0];

  const originalAddresses = [
    {
      id: 'addr_primary_test',
      label: 'Main Entrance Receiving',
      addressLine: 'Old Address Line 1',
      city: 'Nairobi',
      deliveryWindow: '08:00 - 12:00 EAT',
      contactName: 'Old Contact',
      phone: '+254711000111',
      isDefault: true,
    },
    {
      id: 'addr_secondary_branch',
      label: 'Westlands Cellar Bay',
      addressLine: 'Parklands Road Bay 4',
      city: 'Nairobi',
      deliveryWindow: '14:00 - 18:00 EAT',
      contactName: 'Cellar Master',
      phone: '+254722333444',
      isDefault: false,
    },
  ];

  await query('UPDATE trade_accounts SET addresses = $1, default_address_id = $2 WHERE id = $3', [
    JSON.stringify(originalAddresses),
    'addr_primary_test',
    account.id,
  ]);

  const token = await signToken(AUDIENCE.TRADE, {
    userId: ownerUser.id,
    accountId: ownerUser.account_id,
    seatType: 'owner',
    role: ownerUser.role,
    name: ownerUser.name,
  }, 3600000);

  const updatedTradingName = 'The Grand Westlands Lounge';
  const updatedLegalName = 'Grand Westlands Hospitality Ltd';
  const updatedKraPin = 'p059876543w'; // Lowercase to test uppercase normalization
  const updatedLicenceNo = 'LQ-NRB-2026-9999';
  const updatedLicenceExpiry = '2027-06-30';

  const req = createRequest('PUT', 'http://localhost:3000/api/trade/profile', {
    token,
    body: {
      business: {
        tradingName: updatedTradingName,
        legalName: updatedLegalName,
        kraPin: updatedKraPin,
        licenceNo: updatedLicenceNo,
        licenceExpiry: updatedLicenceExpiry,
        primaryAddress: {
          label: 'Primary Gate Receiving',
          addressLine: 'New Kenyatta Avenue Gate 2',
          city: 'Nairobi',
          deliveryWindow: '07:00 - 11:00 EAT',
          contactName: 'Receiving Team Lead',
          phone: '+254700112233',
        },
      },
    },
  });

  const res = await PUT(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.account.tradingName, updatedTradingName);
  assert.equal(data.account.legalName, updatedLegalName);
  assert.equal(data.account.kraPin, 'P059876543W', 'KRA PIN must be normalized to uppercase');
  assert.equal(data.account.licenceNo, updatedLicenceNo);

  // Verify PostgreSQL directly
  const dbCheck = await query('SELECT * FROM trade_accounts WHERE id = $1', [account.id]);
  const dbAccount = dbCheck.rows[0];
  assert.equal(dbAccount.trading_name, updatedTradingName);
  assert.equal(dbAccount.legal_name, updatedLegalName);
  assert.equal(dbAccount.kra_pin, 'P059876543W');
  assert.equal(dbAccount.licence_no, updatedLicenceNo);

  // Address preservation assertions
  const parsedAddresses = dbAccount.addresses;
  assert.equal(parsedAddresses.length, 2, 'Must still have 2 addresses (secondary address preserved)');
  
  const primary = parsedAddresses.find((a) => a.id === 'addr_primary_test' || a.isDefault);
  assert.ok(primary, 'Primary address must exist');
  assert.equal(primary.label, 'Primary Gate Receiving');
  assert.equal(primary.addressLine, 'New Kenyatta Avenue Gate 2');
  assert.equal(primary.contactName, 'Receiving Team Lead');

  const secondary = parsedAddresses.find((a) => a.id === 'addr_secondary_branch');
  assert.ok(secondary, 'Secondary branch address must be preserved intact');
  assert.equal(secondary.label, 'Westlands Cellar Bay');
  assert.equal(secondary.addressLine, 'Parklands Road Bay 4');
});
