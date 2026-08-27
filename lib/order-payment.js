/**
 * Settling a WooCommerce order against a verified Paystack transaction.
 *
 * Shared by the browser callback and the server-to-server webhook, which race
 * each other on every successful payment. Three guarantees:
 *
 *   • Idempotent — an order already paid is left alone, so a replayed callback
 *     URL or a duplicated webhook cannot double-process it.
 *   • Amount-checked — the transaction must cover the order total. Marking an
 *     order paid on a "success" status alone trusts that nothing upstream can
 *     influence the initialised amount.
 *   • Reference-bound — the transaction's reference must be the one checkout
 *     recorded against that order.
 */

import { wcFetch, wcPut } from './wc-config.js';

/** Statuses that mean the order has already been settled. */
const SETTLED_STATUSES = new Set(['processing', 'completed', 'refunded']);

/** Tolerance for float/rounding drift between Paystack minor units and WC totals. */
const AMOUNT_TOLERANCE_KES = 1;

function metaValue(order, key) {
  return order?.meta_data?.find((m) => m.key === key)?.value ?? null;
}

/**
 * @param {object} paystackData a *verified* transaction from verifyPayment()
 * @returns {{ settled: boolean, reason: string, orderId?: number }}
 */
export async function settleOrderFromPayment(paystackData) {
  const orderId = paystackData?.metadata?.order_id;

  if (!orderId) {
    return { settled: false, reason: 'no_order_in_metadata' };
  }
  if (paystackData.status !== 'success') {
    return { settled: false, reason: `transaction_status_${paystackData.status}`, orderId };
  }

  let order;
  try {
    ({ data: order } = await wcFetch(`orders/${orderId}`));
  } catch (err) {
    console.error(`Order ${orderId} lookup failed during settlement:`, err.message);
    return { settled: false, reason: 'order_lookup_failed', orderId };
  }

  if (!order?.id) {
    return { settled: false, reason: 'order_not_found', orderId };
  }

  // Idempotency — the callback and the webhook both arrive for every payment.
  if (order.date_paid || SETTLED_STATUSES.has(order.status)) {
    return { settled: true, reason: 'already_settled', orderId };
  }

  // The reference must be the one this order was initialised with.
  const expectedReference = metaValue(order, 'paystack_expected_reference');
  if (expectedReference && expectedReference !== paystackData.reference) {
    console.error(
      `Reference mismatch settling order ${orderId}: expected ${expectedReference}, got ${paystackData.reference}`
    );
    return { settled: false, reason: 'reference_mismatch', orderId };
  }

  // The amount must cover the order. Paystack reports minor units.
  const paidKes = Number(paystackData.amount) / 100;
  const dueKes = Number.parseFloat(order.total);

  if (!Number.isFinite(paidKes) || !Number.isFinite(dueKes)) {
    return { settled: false, reason: 'amount_unreadable', orderId };
  }

  if (paidKes + AMOUNT_TOLERANCE_KES < dueKes) {
    console.error(`Underpayment on order ${orderId}: paid ${paidKes}, due ${dueKes}`);
    await flagUnderpayment(orderId, paidKes, dueKes);
    return { settled: false, reason: 'amount_short', orderId };
  }

  const currency = paystackData.currency || 'KES';
  if (order.currency && currency !== order.currency) {
    console.error(`Currency mismatch on order ${orderId}: paid ${currency}, expected ${order.currency}`);
    return { settled: false, reason: 'currency_mismatch', orderId };
  }

  try {
    await wcPut(`orders/${orderId}`, {
      status: 'processing',
      set_paid: true,
      transaction_id: String(paystackData.id),
      meta_data: [
        { key: 'paystack_reference', value: paystackData.reference },
        { key: 'paystack_transaction_id', value: String(paystackData.id) },
        { key: 'paystack_amount', value: String(paidKes) },
        { key: 'paystack_channel', value: paystackData.channel || '' },
      ],
    });
  } catch (err) {
    console.error(`Failed to mark order ${orderId} paid:`, err.message);
    return { settled: false, reason: 'wc_update_failed', orderId };
  }

  return { settled: true, reason: 'settled', orderId };
}

/**
 * Leave an audit trail on a short payment rather than silently ignoring it —
 * an underpaid order needs a human, not a dropped event.
 */
async function flagUnderpayment(orderId, paidKes, dueKes) {
  try {
    await wcPut(`orders/${orderId}`, {
      status: 'on-hold',
      meta_data: [
        { key: 'payment_anomaly', value: 'underpaid' },
        { key: 'payment_amount_received', value: String(paidKes) },
        { key: 'payment_amount_expected', value: String(dueKes) },
      ],
    });
  } catch (err) {
    console.error(`Could not flag underpayment on order ${orderId}:`, err.message);
  }
}
