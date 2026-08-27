/**
 * Minimal key/value store with TTL, used for OTP challenges and rate-limit
 * counters.
 *
 * Two backends:
 *
 *   • Redis, when `REDIS_URL` (or `UPSTASH_REDIS_REST_URL`) is configured.
 *     Required for any multi-instance or serverless deployment — otherwise
 *     rate limits are enforced per instance and divide by the instance count,
 *     and a pending OTP is invisible to whichever instance handles the verify.
 *
 *   • An in-process Map otherwise. Correct for a single long-lived server,
 *     which is what this app runs on today.
 *
 * The interface is async in both cases so swapping backends never changes a
 * call site.
 */

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

export async function kvGet(key) {
  if (!isDistributed) return memoryGet(key);

  const raw = await redisCommand(['GET', key]);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function kvSet(key, value, ttlMs) {
  if (!isDistributed) return memorySet(key, value, ttlMs);

  await redisCommand(['SET', key, JSON.stringify(value), 'PX', String(Math.max(1, Math.round(ttlMs)))]);
}

export async function kvDelete(key) {
  if (!isDistributed) return memoryDelete(key);
  await redisCommand(['DEL', key]);
}

/**
 * Atomically increment a counter, setting its TTL on first write.
 * Returns the counter's new value.
 *
 * On the in-process backend this is atomic by virtue of the single-threaded
 * event loop; on Redis it is atomic by INCR.
 */
export async function kvIncrement(key, ttlMs) {
  if (!isDistributed) {
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

  const count = await redisCommand(['INCR', key]);
  if (count === 1) {
    await redisCommand(['PEXPIRE', key, String(Math.max(1, Math.round(ttlMs)))]);
  }
  return count;
}

/** Milliseconds until `key` expires, or 0 when it has no TTL / does not exist. */
export async function kvTimeToLive(key) {
  if (!isDistributed) {
    const entry = memory.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  const ms = await redisCommand(['PTTL', key]);
  return ms > 0 ? ms : 0;
}
