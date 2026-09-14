/**
 * Client-side mirror of lib/shipping.js#cleanAreaName. Kenyan administrative
 * unit names from Nominatim often carry their unit type as a literal word
 * ("Kileleshwa Location", "Kilimani Division") — noise for a delivery
 * address, so strip it before showing the text to a customer.
 */
export function cleanAreaName(text) {
  return String(text || '')
    .replace(/\bward\b/gi, '')
    .replace(/\bdivision\b/gi, '')
    .replace(/\blocation\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Client-side mirror of the keyword scoring in lib/shipping.js#matchZone.
 *
 * Kept separate because lib/shipping.js pulls in lib/data-store.js (Node-only
 * file access) — fine on the server, not importable from a browser bundle.
 * This only ever produces a *hint* for the picker UI; the server re-resolves
 * the authoritative fee at checkout via /api/checkout, so drift between the
 * two never reaches a price.
 */
export function matchZoneByKeywords(text, zones) {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let bestZone = null;
  let bestLocation = null;
  let bestScore = 0;

  for (const zone of zones || []) {
    for (const loc of zone.locations || []) {
      let score = 0;
      for (const kw of loc.keywords || []) {
        if (normalized.includes(kw)) score += kw.length;
      }
      if (score > bestScore) {
        bestScore = score;
        bestZone = zone;
        bestLocation = loc;
      }
    }
  }

  return bestScore >= 2 ? { zone: bestZone, location: bestLocation, address: text } : null;
}
