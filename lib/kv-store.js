/**
 * Minimal key/value store with TTL, used for OTP challenges, rate-limit
 * counters, and small response caches (e.g. geo lookups).
 *
 * Three backends, tried in this order:
 *
 *   • Redis, when `UPSTASH_REDIS_REST_URL`/`_TOKEN` is configured. The
 *     fastest option, but an extra service to provision.
 *
 *   • Postgres (kv_store table), otherwise — this app already runs a real
 *     Postgres pool (lib/trade/trade-pg.js) for everything else, so this is
 *     "use the database we already have" rather than a new dependency. Both
 *     Redis and Postgres solve the same correctness problem an in-process
 *     Map can't: state shared across server instances and surviving a
 *     restart, which matters because a rate limit enforced per-instance
 *     quietly divides by the instance count, and a pending OTP written on
 *     one instance is invisible to whichever instance handles the verify.
 *
 *   • An in-process Map, only as a last-resort fallback if a Postgres call
 *     itself fails (e.g. the DB is briefly unreachable) — better to degrade
 *     to per-instance behaviour for a few requests than to hard-fail login
 *     or checkout.
 *
 * The interface is async in every case so swapping backends never changes a
 * call site.
 */

import { query, ensureTradeDb } from './trade/trade-pg.js';

const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const isDistributed = Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);

/* ── in-process backend ──────────────────────────────────────────────── */

const memory = new Map();

function memoryGet(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlMs) {
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memoryDelete(key) {
  memory.delete(key);
}

// Bounded sweep so an abandoned-key flood cannot grow the map without limit.
if (!globalThis.__kvSweeper) {
  globalThis.__kvSweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memory) {
      if (entry.expiresAt <= now) memory.delete(key);
    }
  }, 60_000);
  globalThis.__kvSweeper.unref?.();
}

/* ── Postgres backend ─────────────────────────────────────────────────── */

async function pgGet(key) {
  await ensureTradeDb();
  const res = await query('SELECT value FROM kv_store WHERE key = $1 AND expires_at > NOW()', [key]);
  return res.rows.length ? res.rows[0].value : null;
}

async function pgSet(key, value, ttlMs) {
  await ensureTradeDb();
  const ms = Math.max(1, Math.round(ttlMs));
  await query(
    `INSERT INTO kv_store (key, value, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' milliseconds')::interval)
     ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + ($3 || ' milliseconds')::interval`,
    [key, JSON.stringify(value), ms]
  );
}

async function pgDelete(key) {
  await ensureTradeDb();
  await query('DELETE FROM kv_store WHERE key = $1', [key]);
}

/**
 * Atomic upsert-increment in one round trip. A missing or already-expired
 * row resets to 1 with a fresh TTL; otherwise it increments and — matching
 * memoryGet/kvIncrement's contract — keeps the *original* expiry rather
 * than sliding the window on every hit.
 */
async function pgIncrement(key, ttlMs) {
  await ensureTradeDb();
  const ms = Math.max(1, Math.round(ttlMs));
  const res = await query(
    `INSERT INTO kv_store (key, value, expires_at)
     VALUES ($1, '1'::jsonb, NOW() + ($2 || ' milliseconds')::interval)
     ON CONFLICT (key) DO UPDATE SET
       value = CASE WHEN kv_store.expires_at <= NOW() THEN '1'::jsonb ELSE to_jsonb((kv_store.value)::int + 1) END,
       expires_at = CASE WHEN kv_store.expires_at <= NOW() THEN NOW() + ($2 || ' milliseconds')::interval ELSE kv_store.expires_at END
     RETURNING value`,
    [key, ms]
  );
  return Number(res.rows[0].value);
}

async function pgTimeToLive(key) {
  await ensureTradeDb();
  const res = await query(
    `SELECT GREATEST(0, EXTRACT(EPOCH FROM (expires_at - NOW())) * 1000) AS ms FROM kv_store WHERE key = $1`,
    [key]
  );
  return res.rows.length ? Number(res.rows[0].ms) : 0;
}

// Sweeps expired rows periodically — a DB call, so much less frequent than
// the in-process Map's 60s sweep. Best-effort: a failure here just means
// stale rows wait for the next sweep, never a functional problem (every
// read already filters on expires_at > NOW()).
if (!globalThis.__kvPgSweeper) {
  globalThis.__kvPgSweeper = setInterval(() => {
    query('DELETE FROM kv_store WHERE expires_at <= NOW()').catch(() => {});
  }, 5 * 60_000);
  globalThis.__kvPgSweeper.unref?.();
}

/* ── Redis (Upstash REST) backend ────────────────────────────────────── */

async function redisCommand(command) {
  const res = await fetch(REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Redis command failed: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

/* ── public interface ────────────────────────────────────────────────── */
//
// Backend order: Redis if configured, else Postgres, with the in-process
// Map only as a fallback if the Postgres call itself throws. `isDistributed`
// keeps its original meaning (Redis specifically configured) since that's
// still what a multi-instance *serverless* deployment needs; Postgres is
// the default distributed backend for the single-server case this app
// actually runs on.

export async function kvGet(key) {
  if (isDistributed) {
    const raw = await redisCommand(['GET', key]);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  try {
    return await pgGet(key);
  } catch (err) {
    console.error('kvGet: Postgres backend failed, falling back to in-process store:', err.message);
    return memoryGet(key);
  }
}

export async function kvSet(key, value, ttlMs) {
  if (isDistributed) {
    await redisCommand(['SET', key, JSON.stringify(value), 'PX', String(Math.max(1, Math.round(ttlMs)))]);
    return;
  }

  try {
    await pgSet(key, value, ttlMs);
  } catch (err) {
    console.error('kvSet: Postgres backend failed, falling back to in-process store:', err.message);
    memorySet(key, value, ttlMs);
  }
}

export async function kvDelete(key) {
  if (isDistributed) {
    await redisCommand(['DEL', key]);
    return;
  }

  try {
    await pgDelete(key);
  } catch (err) {
    console.error('kvDelete: Postgres backend failed, falling back to in-process store:', err.message);
    memoryDelete(key);
  }
}

/**
 * Atomically increment a counter, setting its TTL on first write.
 * Returns the counter's new value.
 *
 * Atomic on every backend: the single-threaded event loop for the
 * in-process Map, Redis's INCR, and Postgres's single upserting statement.
 */
export async function kvIncrement(key, ttlMs) {
  if (isDistributed) {
    const count = await redisCommand(['INCR', key]);
    if (count === 1) {
      await redisCommand(['PEXPIRE', key, String(Math.max(1, Math.round(ttlMs)))]);
    }
    return count;
  }

  try {
    return await pgIncrement(key, ttlMs);
  } catch (err) {
    console.error('kvIncrement: Postgres backend failed, falling back to in-process store:', err.message);
    const current = memoryGet(key);
    if (current === null) {
      memorySet(key, 1, ttlMs);
      return 1;
    }
    const next = current + 1;
    // Preserve the original window expiry rather than sliding it.
    const entry = memory.get(key);
    memory.set(key, { value: next, expiresAt: entry.expiresAt });
    return next;
  }
}

/** Milliseconds until `key` expires, or 0 when it has no TTL / does not exist. */
export async function kvTimeToLive(key) {
  if (isDistributed) {
    const ms = await redisCommand(['PTTL', key]);
    return ms > 0 ? ms : 0;
  }

  try {
    return await pgTimeToLive(key);
  } catch (err) {
    console.error('kvTimeToLive: Postgres backend failed, falling back to in-process store:', err.message);
    const entry = memory.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.expiresAt - Date.now());
  }
}
