import { NextResponse } from 'next/server';
import { coordinateKey, parseNominatim } from '@/lib/geocode';
import { kvGet, kvSet } from '@/lib/kv-store';
import { rateLimitRequest } from '@/lib/rate-limit';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';

/**
 * GET /api/geo/reverse?lat=&lon=
 *
 * Server-side reverse geocoding. This was previously called from the
 * browser, where `connect-src` in our own CSP blocked it — so every GPS
 * lookup failed silently. Moving it here also lets one place honour
 * Nominatim's rate limit and User-Agent policy, and cache the result.
 *
 * A failure here must never block checkout: the caller falls back to
 * manual zone selection.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // addresses do not move
const UPSTREAM_TIMEOUT_MS = 4000;

/** Nominatim requires a real identifying User-Agent. */
const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || 'FastCart/1.0 (+https://myhappyhour.co.ke)';

export async function GET(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const key = coordinateKey(searchParams.get('lat'), searchParams.get('lon'));

  if (!key) {
    return NextResponse.json({ ok: false, error: 'Valid lat and lon are required' }, { status: 400 });
  }

  const cacheKey = `geo:${key}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK, durationMs: 0, detail: 'cache hit' });
    return NextResponse.json({ ok: true, address: cached, cached: true });
  }

  const [lat, lon] = key.split(',');
  const started = Date.now();

  try {
    const url = `${NOMINATIM}?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const address = parseNominatim(await res.json());
    await kvSet(cacheKey, address, CACHE_TTL_MS);

    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.OK,
      durationMs: Date.now() - started,
      detail: 'upstream hit',
    });

    return NextResponse.json({ ok: true, address, cached: false });
  } catch (error) {
    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: error.message,
    });

    return NextResponse.json({ ok: false, error: 'Could not determine your area' }, { status: 502 });
  }
}
