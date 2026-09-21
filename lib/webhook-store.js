/**
 * Durable buffer for inbound WooCommerce webhooks — see the comment on
 * webhook_events in lib/trade/trade-pg.js for why this exists.
 */

import { query, ensureTradeDb } from './trade/trade-pg.js';

const MAX_ATTEMPTS = 5;

export async function recordWebhookEvent(topic, payload) {
  await ensureTradeDb();
  const res = await query(
    `INSERT INTO webhook_events (topic, payload, status, attempts)
     VALUES ($1, $2, 'pending', 1)
     RETURNING id`,
    [topic, JSON.stringify(payload)]
  );
  return res.rows[0].id;
}

export async function markWebhookProcessed(id) {
  await ensureTradeDb();
  await query(`UPDATE webhook_events SET status = 'processed', processed_at = NOW() WHERE id = $1`, [id]);
}

export async function markWebhookFailed(id, error) {
  await ensureTradeDb();
  await query(
    `UPDATE webhook_events SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE id = $1`,
    [id, String(error?.message || error).slice(0, 2000)]
  );
}

/** Failed events still within the retry budget, oldest first. */
export async function getRetryableWebhookEvents(limit = 25) {
  await ensureTradeDb();
  const res = await query(
    `SELECT id, topic, payload, attempts FROM webhook_events
     WHERE status = 'failed' AND attempts < $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [MAX_ATTEMPTS, limit]
  );
  return res.rows;
}

export async function incrementWebhookAttempt(id, error) {
  await ensureTradeDb();
  await query(
    `UPDATE webhook_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
    [id, error ? String(error?.message || error).slice(0, 2000) : null]
  );
}
