/**
 * Integration event log.
 *
 * Records the outcome of every crossing into an external system —
 * WooCommerce, Paystack, the geocoder, webhooks — so a failure surfaces on
 * the admin health page instead of vanishing into a console nobody reads.
 * Two live examples this exists to catch: the browser-side geocoder blocked
 * by our own CSP, and the WooCommerce REST API refused by NinjaFirewall.
 *
 * Deliberately in-memory: it records failures OF the JSON store, so writing
 * to that store would lose exactly the events that matter most. It resets on
 * restart, which is acceptable for an operational dashboard.
 */

export const EVENT_KINDS = {
  WC_CALL: 'wc_call',
  WEBHOOK: 'webhook',
  GEOCODE: 'geocode',
  ORDER: 'order',
  PAYMENT: 'payment',
  SYNC: 'sync',
};

export const OUTCOMES = { OK: 'ok', FAIL: 'fail', SKIPPED: 'skipped' };

const MAX_EVENTS = 2000;
const MAX_DETAIL = 300;

/** Newest last; readEvents reverses. Survives module reload via globalThis. */
function buffer() {
  if (!globalThis.__eventLog) globalThis.__eventLog = [];
  return globalThis.__eventLog;
}

/**
 * Strip anything that must never be persisted. Applied to every detail
 * string rather than trusting each call site to remember.
 */
function redact(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[redacted]')
    .replace(/\b(consumer_secret|consumer_key|password|secret|token|api[_-]?key)\b\s*[=:]\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(ck|cs|sk|pk)_[A-Za-z0-9]{8,}/g, '[redacted]')
    .slice(0, MAX_DETAIL);
}

export function recordEvent({ kind, outcome, durationMs = null, detail = '', correlationId = null }) {
  const events = buffer();
  events.push({
    ts: new Date().toISOString(),
    kind: kind || 'unknown',
    outcome: outcome || OUTCOMES.OK,
    durationMs,
    detail: redact(detail),
    correlationId,
  });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function readEvents({ limit = 200, kind = null, outcome = null } = {}) {
  let events = buffer();
  if (kind) events = events.filter((e) => e.kind === kind);
  if (outcome) events = events.filter((e) => e.outcome === outcome);
  return events.slice(-limit).reverse();
}

export function summarise(events = []) {
  const byKind = {};
  let lastFailureAt = null;
  let failed = 0;

  for (const e of events) {
    const bucket = (byKind[e.kind] ||= { total: 0, failed: 0, avgMs: 0, _sum: 0, _timed: 0 });
    bucket.total += 1;
    if (typeof e.durationMs === 'number') {
      bucket._sum += e.durationMs;
      bucket._timed += 1;
      bucket.avgMs = Math.round(bucket._sum / bucket._timed);
    }
    if (e.outcome === OUTCOMES.FAIL) {
      bucket.failed += 1;
      failed += 1;
      if (!lastFailureAt || e.ts > lastFailureAt) lastFailureAt = e.ts;
    }
  }

  for (const bucket of Object.values(byKind)) {
    delete bucket._sum;
    delete bucket._timed;
  }

  return {
    byKind,
    total: events.length,
    failureRate: events.length ? failed / events.length : 0,
    lastFailureAt,
  };
}

/**
 * Run `fn`, record how it went, and let its result or error through
 * unchanged. Wrapping a call must never alter its behaviour.
 */
export async function timed(kind, fn, detail = '', correlationId = null) {
  const started = Date.now();
  try {
    const result = await fn();
    recordEvent({ kind, outcome: OUTCOMES.OK, durationMs: Date.now() - started, detail, correlationId });
    return result;
  } catch (error) {
    recordEvent({
      kind,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: `${detail}: ${error.message}`,
      correlationId,
    });
    throw error;
  }
}

/** Test-only. */
export function __resetForTests() {
  globalThis.__eventLog = [];
}
