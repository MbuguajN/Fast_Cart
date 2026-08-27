/**
 * Reverse-geocoding helpers.
 *
 * Nominatim's usage policy caps callers at roughly one request per second
 * and requires an identifying User-Agent. Calling it from the browser broke
 * both — and was blocked by our own CSP besides, so GPS detection has been
 * silently dead in production. These helpers support the server-side proxy
 * that replaces it.
 *
 * The only question we need answered is which delivery zone a customer is
 * in, because that sets the fee. Building-level results are a suggestion.
 */

/**
 * ~11 m at 4 decimal places. This is a grid, not a radius: two points a
 * metre apart either side of a cell boundary get different keys. The cost
 * is one extra upstream lookup, never a wrong address.
 */
const PRECISION = 4;

export function coordinateKey(lat, lon) {
  // Number(null) and Number('') are both 0, which is a valid coordinate off
  // the coast of Ghana — so absent parameters must be rejected before
  // coercion, not after it.
  if (lat === null || lat === undefined || lat === '') return null;
  if (lon === null || lon === undefined || lon === '') return null;

  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
  if (latNum < -90 || latNum > 90) return null;
  if (lonNum < -180 || lonNum > 180) return null;

  return `${latNum.toFixed(PRECISION)},${lonNum.toFixed(PRECISION)}`;
}

export function parseNominatim(payload) {
  const a = payload?.address || {};
  return {
    road: a.road || '',
    neighbourhood: a.neighbourhood || a.quarter || '',
    suburb: a.suburb || a.city_district || '',
    city: a.city || a.town || a.county || '',
  };
}
