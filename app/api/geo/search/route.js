import { NextResponse } from 'next/server';
import { kvGet, kvSet } from '@/lib/kv-store';
import { rateLimitRequest } from '@/lib/rate-limit';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';

/**
 * GET /api/geo/search?q=
 *
 * Server-side forward geocoding (place name -> candidate coordinates), used
 * to recentre the delivery-location map without requiring GPS. Same reasons
 * as /api/geo/reverse: our CSP blocks a direct browser call to Nominatim, and
 * only a server can honour its rate limit and User-Agent policy.
 *
 * A failure here must never block address entry: the caller falls back to
 * dropping the pin manually or picking a neighbourhood from the quick list.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 4000;
const MAX_QUERY_LEN = 200;

const USER_AGENT = process.env.GEOCODER_USER_AGENT
  || 'FastCart/1.0 (+https://myhappyhour.co.ke)';

// Kenya's bounding box, biases and restricts results to the delivery area.
const KENYA_VIEWBOX = '33.9,5.6,41.9,-4.9';

export async function GET(request) {
  const rl = await rateLimitRequest(request, { maxRequests: 20, windowMs: 60000 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LEN);

  if (query.length < 3) {
    return NextResponse.json({ ok: false, error: 'Query too short' }, { status: 400 });
  }

  const cacheKey = `geosearch:${query.toLowerCase()}`;
  const cached = await kvGet(cacheKey);
  if (cached) {
    recordEvent({ kind: EVENT_KINDS.GEOCODE, outcome: OUTCOMES.OK, durationMs: 0, detail: 'search cache hit' });
    return NextResponse.json({ ok: true, results: cached, cached: true });
  }

  const started = Date.now();

  try {
    const url = `${NOMINATIM}?format=json&q=${encodeURIComponent(query)}&countrycodes=ke&viewbox=${KENYA_VIEWBOX}&bounded=1&addressdetails=1&limit=5`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const payload = await res.json();
    const results = (Array.isArray(payload) ? payload : []).map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lon: Number(r.lon),
    })).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));

    await kvSet(cacheKey, results, CACHE_TTL_MS);

    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.OK,
      durationMs: Date.now() - started,
      detail: 'search upstream hit',
    });

    return NextResponse.json({ ok: true, results, cached: false });
  } catch (error) {
    recordEvent({
      kind: EVENT_KINDS.GEOCODE,
      outcome: OUTCOMES.FAIL,
      durationMs: Date.now() - started,
      detail: error.message,
    });

    return NextResponse.json({ ok: false, error: 'Search unavailable' }, { status: 502 });
  }
}
