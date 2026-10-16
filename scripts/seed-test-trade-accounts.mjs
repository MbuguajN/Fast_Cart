#!/usr/bin/env node
/**
 * Create / remove TEST_ trade accounts for the browser checkout script.
 *
 *   node scripts/seed-test-trade-accounts.mjs seed
 *   node scripts/seed-test-trade-accounts.mjs cleanup
 *
 * Works on the LOCAL trade store + Postgres only (never WooCommerce).
 * `cleanup` cancels any open order of a TEST account first so stock is
 * restored, then deletes the orders, users and accounts.
 */
import { buildTradeAccount, upsertTradeAccount, addTradeUser, mutateTradeStore, updateTradeOrderStatus } from '../lib/trade/trade-store.js';
import { hashPassword } from '../lib/trade/trade-password.js';
import { query, ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';

export const TEST_PASSWORD = 'TestPass-2345-Checkout';
export const TEST_USERS = {
  credit: { email: 'test.credit@example.test', accountId: 'acc_TEST_credit' },
  plain: { email: 'test.plain@example.test', accountId: 'acc_TEST_plain' },
  viewer: { email: 'test.viewer@example.test', accountId: 'acc_TEST_plain' },
};

async function seed() {
  await ensureTradeDb();
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const accounts = [
    { id: 'acc_TEST_credit', tradingName: 'TEST Credit Co', creditEnabled: true, creditLimit: 50000, creditTerms: 14 },
    { id: 'acc_TEST_plain', tradingName: 'TEST Plain Co', creditEnabled: false },
  ];
  for (const a of accounts) {
    await upsertTradeAccount(buildTradeAccount({ ...a, city: 'Nairobi', deliveryAddress: 'TEST Dock' }, { status: 'active' }));
  }

  const users = [
    { id: 'usr_TEST_credit', ...TEST_USERS.credit, name: 'TEST Credit Owner', seatType: 'owner', phone: '0700000101' },
    { id: 'usr_TEST_plain', ...TEST_USERS.plain, name: 'TEST Plain Buyer', seatType: 'buyer', phone: '0700000102' },
    { id: 'usr_TEST_viewer', ...TEST_USERS.viewer, name: 'TEST Viewer', seatType: 'viewer', phone: '0700000103' },
  ];
  for (const u of users) {
    await addTradeUser({ ...u, role: 'Tester', passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null });
  }
  console.log('Seeded TEST accounts. Password:', TEST_PASSWORD);
}

async function cleanup() {
  await ensureTradeDb();
  const { rows: accts } = await query("SELECT id FROM trade_accounts WHERE trading_name LIKE 'TEST%' OR id LIKE 'acc_TEST%'");
  const ids = accts.map((r) => r.id);
  if (ids.length) {
    const { rows: orders } = await query('SELECT id, status FROM trade_orders WHERE account_id = ANY($1)', [ids]);
    for (const o of orders) {
      if (o.status !== 'cancelled') await updateTradeOrderStatus(o.id, 'cancelled');
    }
    await query('DELETE FROM trade_orders WHERE account_id = ANY($1)', [ids]);
    await query("DELETE FROM trade_users WHERE account_id = ANY($1)", [ids]).catch(() => {});
    await query('DELETE FROM trade_accounts WHERE id = ANY($1)', [ids]);
  }
  mutateTradeStore((store) => {
    const gone = new Set(ids);
    store.accounts = (store.accounts || []).filter((a) => !gone.has(a.id) && !String(a.tradingName).startsWith('TEST'));
    store.users = (store.users || []).filter((u) => !gone.has(u.accountId));
    store.orders = (store.orders || []).filter((o) => !gone.has(o.accountId));
  });
  console.log(`Removed ${ids.length} TEST accounts and their orders.`);
}

const mode = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    if (mode === 'seed') await seed();
    else if (mode === 'cleanup') await cleanup();
    else console.log('usage: seed | cleanup');
  } finally {
    await getPgPool().end();
  }
}
