'use client';

/**
 * Browser-side reverse geocoding.
 *
 * Calls our own `/api/geo/reverse` proxy rather than Nominatim directly.
 * The direct calls were blocked by `connect-src` in our CSP, so GPS
 * detection failed silently in production; they also could not honour
 * Nominatim's rate limit or User-Agent policy.
 *
 * Returns the same `{ address, display_name }` shape the previous direct
 * calls did, so callers need no other change. Resolves to `null` on
 * failure — GPS is an assist, never a gate.
 */
export async function reverseGeocodeViaProxy(lat, lon) {
  try {
    const res = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lon}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.ok || !data.address) return null;

    const { road, neighbourhood, suburb, city } = data.address;
    const display_name = [road, neighbourhood, suburb, city].filter(Boolean).join(', ');

    return { address: data.address, display_name };
  } catch {
    return null;
  }
}
