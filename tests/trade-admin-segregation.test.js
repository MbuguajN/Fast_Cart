import test, { after } from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_JWT_SECRET ||= 'test-admin-secret-that-is-long-enough-000000';

import { query, ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';
import { getTradeAccounts, upsertTradeAccount, buildTradeAccount } from '../lib/trade/trade-store.js';
import { signToken } from '../lib/auth.js';
import { GET } from '../app/api/admin/trade/accounts/route.js';

after(async () => {
  const pool = getPgPool();
  if (pool) await pool.end();
});

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

  try {
    const accounts = await getTradeAccounts();

    const commercialAccounts = accounts.filter((a) => !a.isGuest && a.segment !== 'individual');
    const individualAccounts = accounts.filter((a) => a.isGuest || a.segment === 'individual');

    const foundBiz = commercialAccounts.find((a) => a.id === biz.id);
    const foundInd = individualAccounts.find((a) => a.id === ind.id);

    assert.ok(foundBiz, 'Commercial account should be in commercial list');
    assert.ok(foundInd, 'Individual account should be in individual list');
    assert.equal(commercialAccounts.some((a) => a.id === ind.id), false, 'Individual should not be in commercial list');
  } finally {
    // Cleanup
    await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [biz.id, ind.id]);
  }
});

test('GET /api/admin/trade/accounts supports ?type=commercial|individual|all query filtering', async () => {
  await ensureTradeDb();

  const biz = buildTradeAccount({
    tradingName: 'Commercial Safari Lodge',
    kraPin: 'P099887766K',
    licenceNo: 'LQ-NRB-9999',
    segment: 'horeca',
  }, { status: 'pending' });
  biz.isGuest = false;

  const ind = buildTradeAccount({
    tradingName: 'Chris Okoth Bulk Buyer',
    segment: 'individual',
  }, { status: 'active' });
  ind.isGuest = true;

  await upsertTradeAccount(biz);
  await upsertTradeAccount(ind);

  try {
    const adminToken = await signToken({ email: 'admin@test.com', role: 'owner' });
    const createReq = (url) => {
      const req = new Request(url, {
        headers: { cookie: `admin_token=${adminToken}` },
      });
      req.nextUrl = new URL(url);
      return req;
    };

    // 1. type=commercial
    const resComm = await GET(createReq('http://localhost:3000/api/admin/trade/accounts?type=commercial'));
    assert.equal(resComm.status, 200);
    const dataComm = await resComm.json();
    assert.ok(dataComm.accounts.some((a) => a.id === biz.id), 'Commercial account should be returned in commercial query');
    assert.ok(!dataComm.accounts.some((a) => a.id === ind.id), 'Individual account should NOT be returned in commercial query');

    // 2. type=individual
    const resInd = await GET(createReq('http://localhost:3000/api/admin/trade/accounts?type=individual'));
    assert.equal(resInd.status, 200);
    const dataInd = await resInd.json();
    assert.ok(dataInd.accounts.some((a) => a.id === ind.id), 'Individual account should be returned in individual query');
    assert.ok(!dataInd.accounts.some((a) => a.id === biz.id), 'Commercial account should NOT be returned in individual query');

    // 3. type=all
    const resAll = await GET(createReq('http://localhost:3000/api/admin/trade/accounts?type=all'));
    assert.equal(resAll.status, 200);
    const dataAll = await resAll.json();
    assert.ok(dataAll.accounts.some((a) => a.id === biz.id), 'Commercial account should be returned in all query');
    assert.ok(dataAll.accounts.some((a) => a.id === ind.id), 'Individual account should be returned in all query');
  } finally {
    await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [biz.id, ind.id]);
  }
});
