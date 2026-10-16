/**
 * Stock holds for pay-now (Paystack) trade orders.
 *
 * createTradeOrder deducts stock when the order is created. A buyer who opens
 * the Paystack page and walks away would otherwise keep that stock locked
 * forever. The hold lasts `stockHoldMinutes` (admin-set, default 15); after
 * that the order is cancelled and the stock released.
 */

import { query, ensureTradeDb } from './trade-pg.js';

/**
 * Record that an order is waiting on a Paystack payment, and until when.
 */
export async function markAwaitingPayment({ orderId, reference, holdMinutes }) {
  await ensureTradeDb();
  await query(
    `UPDATE trade_orders SET
       paystack_reference = $1,
       status = 'pending_payment',
       hold_expires_at = NOW() + ($2 * INTERVAL '1 minute'),
       updated_at = NOW()
     WHERE id = $3`,
    [reference, holdMinutes, orderId]
  );
}

/**
 * Cancel (and restock) every unpaid Paystack order whose hold has run out.
 * Safe to call repeatedly and concurrently with settlement: an order that was
 * paid in the meantime no longer matches, and one failing order never stops
 * the rest.
 */
export async function expireUnpaidHolds() {
  await ensureTradeDb();
  const { updateTradeOrderStatus, mutateTradeStore } = await import('./trade-store.js');

  const { rows } = await query(
    `SELECT id FROM trade_orders
      WHERE payment_method = 'paystack'
        AND status = 'pending_payment'
        AND payment_status = 'unpaid'
        AND hold_expires_at IS NOT NULL
        AND hold_expires_at < NOW()`
  );

  const expired = [];
  for (const { id } of rows) {
    try {
      // Re-check under the row lock inside updateTradeOrderStatus is not
      // available, so guard the status flip itself on the unpaid state.
      const guard = await query(
        `UPDATE trade_orders SET payment_status = 'expired', updated_at = NOW()
          WHERE id = $1 AND payment_status = 'unpaid' AND status = 'pending_payment'
          RETURNING id`,
        [id]
      );
      if (guard.rows.length === 0) continue; // paid or changed since the scan

      await updateTradeOrderStatus(id, 'cancelled');
      mutateTradeStore((store) => {
        const o = store.orders?.find((ord) => ord.id === id);
        if (o) o.paymentStatus = 'expired';
      });
      expired.push(id);
    } catch (err) {
      console.error(`Hold expiry failed for order ${id}:`, err.message);
    }
  }
  return { expired };
}
