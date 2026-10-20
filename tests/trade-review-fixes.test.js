import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTradeOrder, getTradeAccounts, getTradeOrderById, updateTradeOrderStatus,
  findOrCreateGuestTradeAccount, upsertTradeAccount, readTradeStore,
} from '../lib/trade/trade-store.js';
import { resolveTradeLineItems, buildCatalogIndex } from '../lib/trade/trade-catalog.js';
import { markAwaitingPayment, expireUnpaidHolds, openHoldCount } from '../lib/trade/trade-hold.js';
import { settleTradeOrderFromPayment, settlementRedirectPath } from '../lib/trade/trade-payment.js';
import { query } from '../lib/trade/trade-pg.js';

const orderIds = [];
let ceilingRestore = null;

async function product() {
  const index = await buildCatalogIndex();
  return [...new Set(index.values())].find((x) => x.stockQuantity >= 60);
}
async function stockOf(sku) {
  const { rows } = await query('SELECT stock_quantity FROM trade_products WHERE sku = $1', [sku]);
  return Number(rows[0].stock_quantity);
}
async function place({ seatType = 'owner', account } = {}) {
  const p = await product();
  const acct = account || (await getTradeAccounts()).find((a) => a.id === 'acc_serena_01') || (await getTradeAccounts()).find((a) => a.status === 'active' && !a.isGuest);
  const items = await resolveTradeLineItems([{ sku: p.sku, quantity: 12 }], { checkStock: true });
  const order = await createTradeOrder({
    account: acct, user: { id: 'usr_test_rf', seatType, name: 'TEST_rf' }, items,
    deliveryAddress: { id: 'a', addressLine: 'TEST', city: 'Nairobi' }, paymentMethod: 'paystack', ageConfirmed: true,
  });
  orderIds.push(order.id);
  return { order, sku: p.sku, acct };
}
const pay = (order, ref, over = {}) => ({
  status: 'success', reference: ref, id: 888001, amount: order.grandTotal * 100, currency: 'KES', channel: 'card',
  metadata: { trade_order_id: order.id }, ...over,
});

after(async () => {
  if (ceilingRestore) await query('UPDATE trade_accounts SET order_ceiling = $1 WHERE id = $2', [ceilingRestore.value, ceilingRestore.id]);
  for (const id of orderIds) {
    const o = await getTradeOrderById(id);
    if (o && o.status !== 'cancelled') await updateTradeOrderStatus(id, 'cancelled');
  }
});

test('a sweep that died after flagging expiry is retried and releases the stock', async () => {
  const { order, sku } = await place();
  const before = await stockOf(sku);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_rf_1', holdMinutes: 15 });
  // The half-finished state the old sweep could leave behind.
  await query("UPDATE trade_orders SET payment_status = 'expired', hold_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [order.id]);

  const { expired } = await expireUnpaidHolds();
  assert.ok(expired.includes(order.id));
  const { rows } = await query('SELECT status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'cancelled');
  assert.equal(await stockOf(sku), before + 12);
});

test('a paid Paystack order above the buyer ceiling goes to approval, not straight to confirmed', async () => {
  const acct = (await getTradeAccounts()).find((a) => a.status === 'active');
  const cur = await query('SELECT order_ceiling FROM trade_accounts WHERE id = $1', [acct.id]);
  ceilingRestore = { id: acct.id, value: cur.rows[0].order_ceiling };
  await query('UPDATE trade_accounts SET order_ceiling = 1 WHERE id = $1', [acct.id]);

  const { order } = await place({ seatType: 'buyer', account: { ...acct, orderCeiling: 1 } });
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_rf_2', holdMinutes: 15 });
  const r = await settleTradeOrderFromPayment(pay(order, 'TEST_rf_2'));
  assert.equal(r.settled, true);
  const { rows } = await query('SELECT status, payment_status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].payment_status, 'paid');
  assert.equal(rows[0].status, 'awaiting_approval');
});

test('an owner-seat Paystack order (no ceiling issue) is confirmed on payment', async () => {
  const { order } = await place({ seatType: 'owner' });
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_rf_3', holdMinutes: 15 });
  await settleTradeOrderFromPayment(pay(order, 'TEST_rf_3'));
  const { rows } = await query('SELECT status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'confirmed');
});

test('payment state is mirrored to the JSON store (awaiting payment, and paid-after-expiry)', async () => {
  const { order } = await place();
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_rf_4', holdMinutes: 15 });
  let mirrored = readTradeStore().orders.find((o) => o.id === order.id);
  assert.equal(mirrored.status, 'pending_payment');
  assert.equal(mirrored.paystackReference, 'TEST_rf_4');

  await query("UPDATE trade_orders SET hold_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [order.id]);
  await expireUnpaidHolds();
  await settleTradeOrderFromPayment(pay(order, 'TEST_rf_4'));
  mirrored = readTradeStore().orders.find((o) => o.id === order.id);
  assert.equal(mirrored.status, 'cancelled');
  assert.equal(mirrored.paymentStatus, 'paid_after_expiry');
});

test('a cancelled order cannot be reopened', async () => {
  const { order } = await place();
  await updateTradeOrderStatus(order.id, 'cancelled');
  await assert.rejects(updateTradeOrderStatus(order.id, 'confirmed'), /cannot be reopened/i);
});

test('callback redirects: late and short payments go to the order page for review, failures to the dashboard', () => {
  assert.equal(settlementRedirectPath({ settled: true, orderId: 'o1' }), '/trade/orders/o1?payment=success');
  assert.equal(settlementRedirectPath({ settled: false, reason: 'order_expired', orderId: 'o1' }), '/trade/orders/o1?payment=review');
  assert.equal(settlementRedirectPath({ settled: false, reason: 'amount_short', orderId: 'o1' }), '/trade/orders/o1?payment=review');
  assert.equal(settlementRedirectPath({ settled: false, reason: 'order_not_found' }), '/trade/dashboard?payment=failed');
});

test('openHoldCount counts only an account\'s live unpaid Paystack holds', async () => {
  const { order, acct } = await place();
  const before = await openHoldCount(acct.id);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_rf_5', holdMinutes: 15 });
  assert.equal(await openHoldCount(acct.id), before + 1);
  await updateTradeOrderStatus(order.id, 'cancelled');
  assert.equal(await openHoldCount(acct.id), before);
});

test('a guest account that staff have upgraded can no longer be reached by guest checkout', async () => {
  const email = `test.upg.${Date.now()}@example.test`;
  const d = { name: 'TEST Upgraded', phone: '0700000601', email, addressLine: 'TEST', city: 'Nairobi' };
  const first = await findOrCreateGuestTradeAccount(d);
  await upsertTradeAccount({ ...first.account, creditEnabled: true, creditLimit: 100000 });
  await assert.rejects(findOrCreateGuestTradeAccount(d), /sign in/i);
});

test('a repeat guest is recognised across Kenyan phone formats', async () => {
  const email = `test.fmt.${Date.now()}@example.test`;
  const base = { name: 'TEST Fmt', email, addressLine: 'TEST', city: 'Nairobi' };
  const a = await findOrCreateGuestTradeAccount({ ...base, phone: '0712345678' });
  for (const phone of ['+254712345678', '254712345678', '0712 345 678', '712345678']) {
    const again = await findOrCreateGuestTradeAccount({ ...base, phone });
    assert.equal(again.account.id, a.account.id, phone);
  }
});

test('guest checkout rejects a missing or malformed email instead of matching a blank one', async () => {
  for (const email of [undefined, '', 123, 'not-an-email']) {
    await assert.rejects(
      findOrCreateGuestTradeAccount({ name: 'TEST Bad', phone: '0700000602', email, addressLine: 'x', city: 'Nairobi' }),
      /email/i,
      String(email)
    );
  }
});
