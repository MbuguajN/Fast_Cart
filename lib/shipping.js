/**
 * Delivery zone resolution and fee calculation.
 *
 * Extracted from the /api/zones route so checkout can price delivery on the
 * server. The fee used to come from the request body, which meant a client
 * could name its own delivery charge — `{ deliveryFee: 0 }` produced an order
 * with no shipping line at all.
 */

import { getZones } from './data-store.js';
import { ZONE_MAP } from './zone-map.js';

/** Charged when an address matches no known zone. */
export const DEFAULT_ZONE_PRICE = 300;

export function normalizeAddress(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanAreaName(text) {
  return String(text || '')
    .replace(/\bward\b/gi, '')
    .replace(/\bdivision\b/gi, '')
    .replace(/\blocation\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,$/g, '')
    .trim();
}

function fromZoneMap() {
  return Object.entries(ZONE_MAP).map(([key, meta]) => ({
    id: key.replace('_price', ''),
    name: meta.name,
    zonePrice: meta.zonePrice || DEFAULT_ZONE_PRICE,
    locations: (meta.locations || []).map((loc) => ({
      name: loc.name,
      keywords: loc.keywords || [],
      price: loc.price ?? meta.zonePrice ?? DEFAULT_ZONE_PRICE,
    })),
  }));
}

/**
 * The canonical zone list: synced WooCommerce shipping zones when present,
 * otherwise the static map.
 */
export function getZoneCatalog() {
  const stored = getZones() || [];

  if (stored.length > 0) {
    return stored.map((z) => ({
      id: z.id,
      name: z.name,
      zonePrice: z.zonePrice || DEFAULT_ZONE_PRICE,
      locations: (z.locations || []).map((loc) => ({
        name: loc.name,
        keywords: loc.keywords || [],
        price: loc.price ?? z.zonePrice ?? DEFAULT_ZONE_PRICE,
      })),
    }));
  }

  return fromZoneMap();
}

/**
 * Score an address against the zone keyword table.
 * Longer keyword matches win, so "ngong road" beats a bare "ngong".
 */
export function matchZone(neighbourhood, suburb, road, city, zones) {
  if (!zones || !zones.length) return null;

  const tryMatch = (text) => {
    if (!text) return null;
    const normalized = normalizeAddress(text);
    let bestZone = null;
    let bestLocation = null;
    let bestScore = 0;

    for (const zone of zones) {
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

    return bestZone ? { zone: bestZone, location: bestLocation, score: bestScore } : null;
  };

  const cleanNeighbourhood = cleanAreaName(neighbourhood || '');
  const cleanSuburb = cleanAreaName(suburb || '');

  const candidates = [
    cleanNeighbourhood,
    cleanSuburb,
    `${cleanNeighbourhood} ${cleanSuburb}`,
    `${road || ''} ${cleanNeighbourhood} ${city || ''}`,
  ];

  for (const candidate of candidates) {
    const result = tryMatch(candidate);
    if (result && result.score >= 2) return result;
  }

  return null;
}

/**
 * Authoritative delivery fee for an order.
 *
 * Resolution order:
 *   1. an exact zone name supplied by the client, validated against the catalogue
 *   2. keyword matching over the free-text delivery address
 *   3. the default zone price
 *
 * The client's chosen zone is treated as a *hint* — it selects a row from the
 * catalogue, it never supplies the price.
 *
 * @returns {{ fee: number, zoneName: string, locationName: string, matched: boolean }}
 */
export function resolveDeliveryFee({ zoneName = '', address = '' } = {}) {
  const zones = getZoneCatalog();

  // 1. Named zone, priced from our own catalogue.
  if (zoneName) {
    const wanted = String(zoneName).trim().toLowerCase();
    const zone = zones.find((z) => String(z.name).trim().toLowerCase() === wanted);

    if (zone) {
      // Within a named zone, a specific location keyword can refine the price.
      const refined = matchZone(address, '', '', '', [zone]);
      const fee = refined?.location?.price ?? zone.zonePrice ?? DEFAULT_ZONE_PRICE;

      return {
        fee: toFee(fee),
        zoneName: zone.name,
        locationName: refined?.location?.name || '',
        matched: true,
      };
    }
  }

  // 2. Keyword match over the address itself.
  const matched = matchZone(address, '', '', '', zones);
  if (matched) {
    const fee = matched.location?.price ?? matched.zone?.zonePrice ?? DEFAULT_ZONE_PRICE;
    return {
      fee: toFee(fee),
      zoneName: matched.zone?.name || '',
      locationName: matched.location?.name || '',
      matched: true,
    };
  }

  // 3. Unknown address — charge the standard rate rather than nothing.
  return { fee: DEFAULT_ZONE_PRICE, zoneName: '', locationName: '', matched: false };
}

function toFee(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_ZONE_PRICE;
  return Math.round(n);
}
