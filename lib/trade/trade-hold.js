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
 * Keep the JSON store (read by statements and reports) in step with Postgres.
 * Best effort: Postgres is the source of truth, so a failure here only logs.
 */
export async function mirrorOrder(orderId, patch) {
  try {
    const { mutateTradeStore } = await import('./trade-store.js');
    await mutateTradeStore((store) => {
      const o = store.orders?.find((ord) => ord.id === orderId);
      if (o) Object.assign(o, patch, { updatedAt: new Date().toISOString() });
    });
  } catch (err) {
    console.warn(`JSON store mirror failed for ${orderId} (non-fatal):`, err.message);
  }
}

/** Live unpaid Paystack holds an account currently has open. */
export async function openHoldCount(accountId) {
  await ensureTradeDb();
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM trade_orders
      WHERE account_id = $1 AND payment_method = 'paystack'
        AND status = 'pending_payment' AND payment_status = 'unpaid'
        AND hold_expires_at > NOW()`,
    [accountId]
  );
  return rows[0].n;
}

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
  await mirrorOrder(orderId, {
    status: 'pending_payment',
    paystackReference: reference,
    holdExpiresAt: new Date(Date.now() + holdMinutes * 60000).toISOString(),
  });
}

/**
 * Cancel (and restock) every unpaid Paystack order whose hold has run out.
 * Safe to call repeatedly and concurrently with settlement: an order that was
 * paid in the meantime no longer matches, and one failing order never stops
 * the rest.
 */
export async function expireUnpaidHolds() {
  await ensureTradeDb();
  const { updateTradeOrderStatus } = await import('./trade-store.js');

  // 'expired' is included so an order whose cancel step failed last time (the
  // flag committed, the restock did not) is retried instead of holding stock
  // forever.
  const { rows } = await query(
    `SELECT id FROM trade_orders
      WHERE payment_method = 'paystack'
        AND status = 'pending_payment'
        AND payment_status IN ('unpaid', 'expired')
        AND hold_expires_at IS NOT NULL
        AND hold_expires_at < NOW()`
  );

  const expired = [];
  for (const { id } of rows) {
    try {
      // Guard on the unpaid state so a payment that landed in the meantime wins.
      const guard = await query(
        `UPDATE trade_orders SET payment_status = 'expired', updated_at = NOW()
          WHERE id = $1 AND payment_status IN ('unpaid', 'expired') AND status = 'pending_payment'
          RETURNING id`,
        [id]
      );
      if (guard.rows.length === 0) continue; // paid or changed since the scan

      await updateTradeOrderStatus(id, 'cancelled');
      // Mirror whatever Postgres ended up with (a late payment may have
      // flagged it paid_after_expiry in the meantime).
      const now = await query('SELECT * FROM trade_orders WHERE id = $1', [id]);
      await mirrorOrder(id, { paymentStatus: now.rows[0]?.payment_status || 'expired' });
      expired.push(id);

      // Send operational cancellation alert
      if (now.rows.length > 0) {
        const orderRow = now.rows[0];
        const { sendTradeOrderCancelledAlert } = await import('./trade-email.js');
        sendTradeOrderCancelledAlert({
          order: {
            ...orderRow,
            orderNumber: orderRow.order_number,
            grandTotal: orderRow.grand_total,
            deliveryAddress: orderRow.delivery_address,
            orderedBy: orderRow.ordered_by,
            items: orderRow.items,
          },
          reason: 'Stock hold reservation expired (unpaid after 15 minutes)',
        }).catch(() => {});
      }
    } catch (err) {
      console.error(`Hold expiry failed for order ${id}:`, err.message);
    }
  }
  return { expired };
}
