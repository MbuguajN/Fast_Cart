import { NextResponse } from 'next/server';
import { WC_WEBHOOK_SECRET } from '@/lib/wc-config';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
import { recordWebhookEvent, markWebhookProcessed, markWebhookFailed } from '@/lib/webhook-store.js';
import { processWebhookPayload } from '@/lib/webhook-processor.js';
import crypto from 'crypto';

/**
 * Verify a WooCommerce webhook signature over the RAW request body.
 *
 * WooCommerce sends base64-encoded HMAC-SHA256 of the exact bytes it posted.
 * Hashing a re-serialised `JSON.stringify(parsedBody)` changes those bytes —
 * whitespace, unicode escaping and numeric formatting all shift — so valid
 * deliveries were being rejected.
 */
function verifyWebhook(request, rawBody) {
  if (!WC_WEBHOOK_SECRET) {
    console.error('WC webhook secret not configured — rejecting request');
    return false;
  }

  const signature = request.headers.get('x-wc-webhook-signature');
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', WC_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Check length before timingSafeEqual, which throws on a mismatch.
  if (expected.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export async function POST(request) {
  // Raw bytes first — the signature is computed over exactly what was sent.
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!verifyWebhook(request, rawBody)) {
    recordEvent({
      kind: EVENT_KINDS.WEBHOOK,
      outcome: OUTCOMES.FAIL,
      detail: 'signature verification failed',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const topic = request.headers.get('x-wc-webhook-topic') || '';

  // Recorded before processing starts, so a crash mid-processing still
  // leaves a 'pending'-turned-'failed' row the reconcile cron can retry,
  // instead of the event only ever existing in this request's memory.
  let eventId = null;
  try {
    eventId = await recordWebhookEvent(topic, body);
  } catch (err) {
    console.error('Webhook buffer write failed (processing continues without retry coverage):', err.message);
  }

  try {
    await processWebhookPayload(topic, body);
    if (eventId) await markWebhookProcessed(eventId).catch(() => {});
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    if (eventId) await markWebhookFailed(eventId, error).catch(() => {});
  }

  // Always acknowledged, matching the original behaviour — WooCommerce's
  // own retry is not relied on; the reconcile cron's retry pass is.
  return NextResponse.json({ received: true });
}
