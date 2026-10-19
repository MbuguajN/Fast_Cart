import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query, ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';
import { findMatchingTradeAccount, upsertTradeAccount, buildTradeAccount, syncTradeUserToPg } from '../lib/trade/trade-store.js';
import { deduplicateTradeAccounts } from '../scripts/deduplicate-trade-accounts.mjs';

after(async () => {
  const pool = getPgPool();
  if (pool) await pool.end();
});

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

  try {
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
  } finally {
    // Cleanup test account
    await query('DELETE FROM trade_accounts WHERE id = $1', [account.id]);
  }
});

test('findMatchingTradeAccount handles edge cases: guest accounts, nulls, and non-matches', async () => {
  await ensureTradeDb();

  const guestName = 'Test Guest Entity Checkout';
  const guestAccount = buildTradeAccount({
    tradingName: guestName,
    segment: 'retail',
  }, { status: 'active' });
  guestAccount.isGuest = true;

  await upsertTradeAccount(guestAccount);

  try {
    // Guest accounts must not match by trading name
    const matchGuest = await findMatchingTradeAccount({ tradingName: guestName.toLowerCase() });
    assert.equal(matchGuest, null, 'Guest account should not match by trading name');

    // Empty or missing arguments return null
    assert.equal(await findMatchingTradeAccount({}), null);
    assert.equal(await findMatchingTradeAccount({ kraPin: '', licenceNo: null, tradingName: '   ' }), null);

    // Non-existent identifier returns null
    const nonExistent = await findMatchingTradeAccount({ kraPin: 'NONEXISTENT999' });
    assert.equal(nonExistent, null);
  } finally {
    await query('DELETE FROM trade_accounts WHERE id = $1', [guestAccount.id]);
  }
});

test('deduplicateTradeAccounts merges duplicate accounts and reassigns users/orders', async () => {
  await ensureTradeDb();

  const dupKra = 'P088877766Y';
  const name1 = 'Test Deduplicate Primary Entity';
  const name2 = 'Test Deduplicate Secondary Entity';

  const acct1 = buildTradeAccount({
    id: `acc_test_prim_${Date.now()}`,
    tradingName: name1,
    kraPin: dupKra,
    segment: 'horeca',
  }, { status: 'active' });
  acct1.createdAt = new Date(Date.now() - 60000).toISOString();

  const acct2 = buildTradeAccount({
    id: `acc_test_sec_${Date.now()}`,
    tradingName: name2,
    kraPin: dupKra,
    segment: 'horeca',
  }, { status: 'pending' });

  await upsertTradeAccount(acct1);
  await upsertTradeAccount(acct2);

  const testUser = {
    id: `usr_test_dedup_${Date.now()}`,
    accountId: acct2.id,
    name: 'Dedup Test User',
    email: `test_dedup_${Date.now()}@example.test`,
    phone: '0711000999',
    role: 'Owner',
    seatType: 'owner',
  };
  await syncTradeUserToPg(testUser);

  try {
    const result = await deduplicateTradeAccounts({ dryRun: false, logger: { log: () => {} } });
    assert.ok(result.mergedAccountsCount >= 1, 'Should have merged at least one account');

    // Secondary account should no longer exist
    const secRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [acct2.id]);
    assert.equal(secRes.rows.length, 0, 'Secondary account should be deleted');

    // Primary account should still exist
    const primRes = await query('SELECT * FROM trade_accounts WHERE id = $1', [acct1.id]);
    assert.equal(primRes.rows.length, 1, 'Primary account should remain');

    // User should have been reassigned to primary account
    const userRes = await query('SELECT account_id FROM trade_users WHERE id = $1', [testUser.id]);
    assert.equal(userRes.rows[0].account_id, acct1.id, 'User must be reassigned to primary account');
  } finally {
    await query('DELETE FROM trade_users WHERE id = $1', [testUser.id]);
    await query('DELETE FROM trade_accounts WHERE id IN ($1, $2)', [acct1.id, acct2.id]);
  }
});
