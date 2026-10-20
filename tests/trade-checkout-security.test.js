import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTradeOrder, getTradeAccounts, getTradeOrderById, updateTradeOrderStatus,
  findOrCreateGuestTradeAccount, readTradeStore,
} from '../lib/trade/trade-store.js';
import { resolveTradeLineItems, buildCatalogIndex } from '../lib/trade/trade-catalog.js';
import { markAwaitingPayment } from '../lib/trade/trade-hold.js';
import { settleTradeOrderFromPayment } from '../lib/trade/trade-payment.js';
import { query } from '../lib/trade/trade-pg.js';

const orderIds = [];

async function newPaystackOrder() {
  const index = await buildCatalogIndex();
  const p = [...new Set(index.values())].find((x) => x.stockQuantity >= 40);
  const account = (await getTradeAccounts()).find((a) => a.id === 'acc_serena_01') || (await getTradeAccounts()).find((a) => a.status === 'active' && !a.isGuest);
  const items = await resolveTradeLineItems([{ sku: p.sku, quantity: 12 }], { checkStock: true });
  const order = await createTradeOrder({
    account, user: { id: 'usr_test_sec', seatType: 'owner', name: 'TEST_sec' }, items,
    deliveryAddress: { id: 'a', addressLine: 'TEST', city: 'Nairobi' }, paymentMethod: 'paystack', ageConfirmed: true,
  });
  orderIds.push(order.id);
  return order;
}

const payment = (order, over = {}) => ({
  status: 'success', reference: 'TEST_sec_ref', id: 777001, amount: order.grandTotal * 100,
  currency: 'KES', channel: 'card', metadata: { trade_order_id: order.id }, ...over,
});

after(async () => {
  for (const id of orderIds) {
    const o = await getTradeOrderById(id);
    if (o && o.status !== 'cancelled') await updateTradeOrderStatus(id, 'cancelled');
  }
});

test('underpayment is flagged underpaid and does not confirm the order', async () => {
  const order = await newPaystackOrder();
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_sec_ref', holdMinutes: 15 });
  const r = await settleTradeOrderFromPayment(payment(order, { amount: (order.grandTotal - 50) * 100 }));
  assert.equal(r.settled, false);
  assert.equal(r.reason, 'amount_short');
  const { rows } = await query('SELECT status, payment_status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].payment_status, 'underpaid');
  assert.notEqual(rows[0].status, 'confirmed');
});

test('a payment with the wrong reference does not settle the order', async () => {
  const order = await newPaystackOrder();
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_sec_ref', holdMinutes: 15 });
  const r = await settleTradeOrderFromPayment(payment(order, { reference: 'SOMEONE_ELSES_REF' }));
  assert.equal(r.settled, false);
  assert.equal(r.reason, 'reference_mismatch');
});

test('a non-KES payment does not settle the order', async () => {
  const order = await newPaystackOrder();
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_sec_ref', holdMinutes: 15 });
  const r = await settleTradeOrderFromPayment(payment(order, { currency: 'USD' }));
  assert.equal(r.settled, false);
  assert.equal(r.reason, 'currency_mismatch');
});

test('a failed Paystack transaction does not settle the order', async () => {
  const order = await newPaystackOrder();
  const r = await settleTradeOrderFromPayment(payment(order, { status: 'failed' }));
  assert.equal(r.settled, false);
});

test('replaying a settled payment is a no-op that still reports settled', async () => {
  const order = await newPaystackOrder();
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_sec_ref', holdMinutes: 15 });
  assert.equal((await settleTradeOrderFromPayment(payment(order))).settled, true);
  const again = await settleTradeOrderFromPayment(payment(order));
  assert.equal(again.settled, true);
  assert.equal(again.reason, 'already_settled');
});

test('a repeat guest reuses their guest account; a KYC account is never matched', async () => {
  const email = `test.guest.${Date.now()}@example.test`;
  const details = { name: 'TEST Repeat Guest', phone: '0700000555', email, addressLine: 'TEST', city: 'Nairobi' };
  const first = await findOrCreateGuestTradeAccount(details);
  const second = await findOrCreateGuestTradeAccount(details);
  assert.equal(second.account.id, first.account.id, 'repeat guest must reuse the account');

  const kyc = readTradeStore().users.find((u) => u.email && u.phone);
  const kycAccount = readTradeStore().accounts.find((a) => a.id === kyc.accountId);
  assert.ok(kycAccount && !kycAccount.isGuest, 'fixture: a non-guest account exists');
  await assert.rejects(
    findOrCreateGuestTradeAccount({ ...details, name: 'TEST Impostor', email: kyc.email, phone: kyc.phone }),
    /already exists.*sign in/i,
    'a guest checkout must never attach to a KYC account, and must fail with a readable message'
  );
  await assert.rejects(
    findOrCreateGuestTradeAccount({ ...details, phone: '0700000556' }),
    /already exists.*sign in/i,
    'same email with a different phone must not be silently merged or crash'
  );
});
