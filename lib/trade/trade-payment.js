/**
 * Trade order payment settlement against Postgres.
 *
 * The retail flow (lib/order-payment.js) settles WooCommerce orders; this
 * module settles trade orders that live in the trade_orders table. It is used
 * by both the Paystack browser callback and the server-to-server webhook.
 *
 * Guarantees (same as the retail path):
 *   • Idempotent — an already-paid order is left alone.
 *   • Amount-checked — the transaction must cover the order total.
 *   • Reference-bound — the metadata must carry the trade order ID.
 */

import { query, ensureTradeDb } from './trade-pg.js';

/** Statuses that mean the order has already been financially settled. */
const SETTLED_PAYMENT_STATUSES = new Set(['paid', 'refunded']);

/** Tolerance for float/rounding drift between Paystack minor units and stored totals. */
const AMOUNT_TOLERANCE_KES = 1;

/**
 * @param {object} paystackData — a *verified* transaction from verifyPayment()
 * @returns {{ settled: boolean, reason: string, orderId?: string }}
 */
export async function settleTradeOrderFromPayment(paystackData) {
  const orderId = paystackData?.metadata?.trade_order_id;

  if (!orderId) {
    return { settled: false, reason: 'no_trade_order_in_metadata' };
  }
  if (paystackData.status !== 'success') {
    return { settled: false, reason: `transaction_status_${paystackData.status}`, orderId };
  }

  await ensureTradeDb();

  // Look up the trade order
  let orderRow;
  try {
    const res = await query('SELECT * FROM trade_orders WHERE id = $1', [orderId]);
    if (res.rows.length === 0) {
      return { settled: false, reason: 'order_not_found', orderId };
    }
    orderRow = res.rows[0];
  } catch (err) {
    console.error(`Trade order ${orderId} lookup failed during settlement:`, err.message);
    return { settled: false, reason: 'order_lookup_failed', orderId };
  }

  // Idempotency — the callback and the webhook both arrive for every payment.
  if (SETTLED_PAYMENT_STATUSES.has(orderRow.payment_status)) {
    return { settled: true, reason: 'already_settled', orderId };
  }

  // Reference check — the stored reference must match.
  const expectedReference = orderRow.paystack_reference;
  if (expectedReference && expectedReference !== paystackData.reference) {
    console.error(
      `Trade payment reference mismatch on ${orderId}: expected ${expectedReference}, got ${paystackData.reference}`
    );
    return { settled: false, reason: 'reference_mismatch', orderId };
  }

  // Amount check — Paystack reports amounts in minor units (kobo/cents).
  const paidKes = Number(paystackData.amount) / 100;
  const dueKes = Number(orderRow.grand_total);

  if (!Number.isFinite(paidKes) || !Number.isFinite(dueKes)) {
    return { settled: false, reason: 'amount_unreadable', orderId };
  }

  if (paidKes + AMOUNT_TOLERANCE_KES < dueKes) {
    console.error(`Trade underpayment on ${orderId}: paid ${paidKes}, due ${dueKes}`);
    await query(
      `UPDATE trade_orders SET payment_status = 'underpaid', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );
    return { settled: false, reason: 'amount_short', orderId };
  }

  // Currency check
  const currency = paystackData.currency || 'KES';
  if (currency !== 'KES') {
    console.error(`Trade currency mismatch on ${orderId}: paid ${currency}, expected KES`);
    return { settled: false, reason: 'currency_mismatch', orderId };
  }

  // Settle: mark as paid and confirm the order
  try {
    await query(
      `UPDATE trade_orders SET
        payment_status = 'paid',
        status = CASE WHEN status = 'pending_payment' THEN 'confirmed' ELSE status END,
        paystack_reference = $1,
        paystack_transaction_id = $2,
        paystack_amount = $3,
        paystack_channel = $4,
        updated_at = NOW()
      WHERE id = $5`,
      [
        paystackData.reference,
        String(paystackData.id),
        String(paidKes),
        paystackData.channel || '',
        orderId,
      ]
    );
  } catch (err) {
    console.error(`Failed to settle trade order ${orderId}:`, err.message);
    return { settled: false, reason: 'update_failed', orderId };
  }

  // Mirror to JSON store
  try {
    const { mutateTradeStore } = await import('./trade-store.js');
    mutateTradeStore((store) => {
      const o = store.orders?.find((ord) => ord.id === orderId);
      if (o) {
        o.paymentStatus = 'paid';
        if (o.status === 'pending_payment') o.status = 'confirmed';
        o.paystackReference = paystackData.reference;
        o.paystackTransactionId = String(paystackData.id);
        o.updatedAt = new Date().toISOString();
      }
    });
  } catch (e) {
    console.warn('Trade JSON store sync after payment failed (non-fatal):', e.message);
  }

  return { settled: true, reason: 'settled', orderId };
}
