import { NextResponse } from 'next/server';
import { wcFetchAll } from '@/lib/wc-config';
import { getSyncStatus, upsertProduct, updateStore } from '@/lib/data-store';
import { extractStockDelta } from '@/lib/catalog-delta';
import { isAuthorisedCron, sinceParam } from '@/lib/cron-auth';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
import { getRetryableWebhookEvents, markWebhookProcessed, incrementWebhookAttempt } from '@/lib/webhook-store.js';
import { processWebhookPayload } from '@/lib/webhook-processor.js';

/**
 * Reconcile the cache against WooCommerce.
 *
 * Webhooks are the primary path for stock changes; they also fail quietly.
 * This pulls everything modified since the last sync and re-applies it, so a
 * dropped or mis-signed webhook costs freshness for one interval instead of
 * indefinitely.
 *
 * Triggered externally rather than by an in-process timer, which would die
 * with the process and stop reconciling without saying so.
 */

const OVERLAP_MS = 120000;

async function reconcile() {
  const status = getSyncStatus();
  const since = sinceParam(status.lastSync, OVERLAP_MS);

  const changed = await wcFetchAll('products', { status: 'publish', modified_after: since });

  let applied = 0;
  for (const product of changed) {
    const delta = extractStockDelta(product);
    if (!delta) continue;
    upsertProduct(delta);
    applied += 1;
  }

  if (applied > 0) updateStore({ lastSync: new Date().toISOString() });

  return { since, applied, examined: changed.length };
}

/**
 * Re-runs webhooks that failed processing (see app/api/webhook/route.js and
 * lib/webhook-store.js) — decoupled from WooCommerce's own retry, which the
 * webhook route never relies on (it always acknowledges 200 immediately).
 * A webhook failing again here just increments its attempt count for next
 * time; it only stops being retried once it hits the attempt ceiling.
 */
async function retryFailedWebhooks() {
  const retryable = await getRetryableWebhookEvents(25);
  let succeeded = 0;
  let stillFailing = 0;

  for (const event of retryable) {
    try {
      await processWebhookPayload(event.topic, event.payload);
      await markWebhookProcessed(event.id);
      succeeded += 1;
    } catch (error) {
      await incrementWebhookAttempt(event.id, error);
      stillFailing += 1;
    }
  }

  return { examined: retryable.length, succeeded, stillFailing };
}

async function handle(request) {
  const provided = request.headers.get('x-cron-secret');

  if (!isAuthorisedCron(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  try {
    const result = await reconcile();
    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.OK,
      durationMs: Date.now() - started,
      detail: `reconcile applied ${result.applied} of ${result.examined}`,
    });

    // A failure here shouldn't fail the whole cron run — the product
    // reconcile above already succeeded and its result should still return.
    let webhookRetry = null;
    try {
      webhookRetry = await retryFailedWebhooks();
      if (webhookRetry.examined > 0) {
        recordEvent({
          kind: EVENT_KINDS.SYNC,
          outcome: OUTCOMES.OK,
          detail: `webhook retry: ${webhookRetry.succeeded} recovered, ${webhookRetry.stillFailing} still failing`,
        });
      }
    } catch (retryError) {
      console.error('Webhook retry pass failed:', retryError.message);
    }

    return NextResponse.json({ ok: true, ...result, webhookRetry });
  } catch (error) {
    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: `reconcile failed: ${error.message}`,
    });
    return NextResponse.json({ ok: false, error: 'Reconcile failed' }, { status: 502 });
  }
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }
