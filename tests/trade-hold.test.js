import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTradeOrder,
  getTradeAccounts,
  getTradeProducts,
  getTradeOrderById,
  updateTradeOrderStatus,
} from '../lib/trade/trade-store.js';
import { resolveTradeLineItems, buildCatalogIndex } from '../lib/trade/trade-catalog.js';
import { query } from '../lib/trade/trade-pg.js';
import { markAwaitingPayment, expireUnpaidHolds } from '../lib/trade/trade-hold.js';
import { settleTradeOrderFromPayment } from '../lib/trade/trade-payment.js';

const createdOrderIds = [];

async function pickProduct() {
  const index = await buildCatalogIndex();
  const eligible = [...new Set(index.values())];
  const p = eligible.find((x) => x.stockQuantity >= 40 && x.prkCostIncVat >= 1500) || eligible.find((x) => x.stockQuantity >= 40);
  assert.ok(p, 'catalogue has a trade-eligible product with stock');
  return p;
}

async function stockOf(sku) {
  const products = await getTradeProducts();
  return products.find((x) => x.sku === sku).stockQuantity;
}

async function placePaystackOrder(sku, quantity = 12) {
  const accounts = await getTradeAccounts();
  const account = accounts.find((a) => a.status === 'active');
  const items = await resolveTradeLineItems([{ sku, quantity }], { checkStock: true });
  const order = await createTradeOrder({
    account,
    user: { id: 'usr_test_hold', seatType: 'owner', name: 'TEST_hold' },
    items,
    deliveryAddress: { id: 'addr_test', addressLine: 'TEST', city: 'Nairobi' },
    paymentMethod: 'paystack',
    ageConfirmed: true,
  });
  createdOrderIds.push(order.id);
  return order;
}

async function expireNow(orderId) {
  await query("UPDATE trade_orders SET hold_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [orderId]);
}

after(async () => {
  for (const id of createdOrderIds) {
    const o = await getTradeOrderById(id);
    if (o && o.status !== 'cancelled') await updateTradeOrderStatus(id, 'cancelled');
  }
});

test('markAwaitingPayment sets pending_payment, reference and a future expiry', async () => {
  const p = await pickProduct();
  const order = await placePaystackOrder(p.sku);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_ref_1', holdMinutes: 15 });

  const { rows } = await query('SELECT status, paystack_reference, hold_expires_at FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'pending_payment');
  assert.equal(rows[0].paystack_reference, 'TEST_ref_1');
  const minutes = (new Date(rows[0].hold_expires_at) - Date.now()) / 60000;
  assert.ok(minutes > 14 && minutes <= 15, `expiry ~15 min ahead, got ${minutes}`);
});

test('expireUnpaidHolds cancels an expired unpaid order, restocks, and is idempotent', async () => {
  const p = await pickProduct();
  const before = await stockOf(p.sku);
  const order = await placePaystackOrder(p.sku, 12);
  assert.equal(await stockOf(p.sku), before - 12);

  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_ref_2', holdMinutes: 15 });
  await expireNow(order.id);

  const first = await expireUnpaidHolds();
  assert.ok(first.expired.includes(order.id));
  const { rows } = await query('SELECT status, payment_status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'cancelled');
  assert.equal(rows[0].payment_status, 'expired');
  assert.equal(await stockOf(p.sku), before);

  const second = await expireUnpaidHolds();
  assert.ok(!second.expired.includes(order.id));
  assert.equal(await stockOf(p.sku), before, 'second sweep must not restock again');
});

test('expireUnpaidHolds leaves an unexpired hold alone', async () => {
  const p = await pickProduct();
  const before = await stockOf(p.sku);
  const order = await placePaystackOrder(p.sku, 12);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_ref_3', holdMinutes: 15 });

  const res = await expireUnpaidHolds();
  assert.ok(!res.expired.includes(order.id));
  const { rows } = await query('SELECT status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'pending_payment');
  assert.equal(await stockOf(p.sku), before - 12);
});

test('a paid order is never expired, even past its hold time', async () => {
  const p = await pickProduct();
  const order = await placePaystackOrder(p.sku, 12);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_ref_4', holdMinutes: 15 });

  const settled = await settleTradeOrderFromPayment({
    status: 'success',
    reference: 'TEST_ref_4',
    id: 999001,
    amount: order.grandTotal * 100,
    currency: 'KES',
    channel: 'card',
    metadata: { trade_order_id: order.id },
  });
  assert.equal(settled.settled, true);

  await expireNow(order.id);
  const res = await expireUnpaidHolds();
  assert.ok(!res.expired.includes(order.id));
  const { rows } = await query('SELECT status, payment_status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].payment_status, 'paid');
  assert.equal(rows[0].status, 'confirmed');
});

test('payment arriving after expiry is flagged for refund and does not re-confirm the order', async () => {
  const p = await pickProduct();
  const before = await stockOf(p.sku);
  const order = await placePaystackOrder(p.sku, 12);
  await markAwaitingPayment({ orderId: order.id, reference: 'TEST_ref_5', holdMinutes: 15 });
  await expireNow(order.id);
  await expireUnpaidHolds();

  const result = await settleTradeOrderFromPayment({
    status: 'success',
    reference: 'TEST_ref_5',
    id: 999002,
    amount: order.grandTotal * 100,
    currency: 'KES',
    channel: 'card',
    metadata: { trade_order_id: order.id },
  });
  assert.equal(result.settled, false);
  assert.equal(result.reason, 'order_expired');

  const { rows } = await query('SELECT status, payment_status FROM trade_orders WHERE id = $1', [order.id]);
  assert.equal(rows[0].status, 'cancelled');
  assert.equal(rows[0].payment_status, 'paid_after_expiry');
  assert.equal(await stockOf(p.sku), before, 'stock stays released');
});
