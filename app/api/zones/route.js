import { NextResponse } from 'next/server';
import { wcFetch, wcUrl } from '@/lib/wc-config';
import { getZones } from '@/lib/data-store';
import { ZONE_MAP } from '@/lib/zone-map';

function normalizeAddress(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAreaName(text) {
  return text
    .replace(/\bward\b/gi, '')
    .replace(/\bdivision\b/gi, '')
    .replace(/\blocation\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,$/g, '')
    .trim();
}

function matchZone(neighbourhood, suburb, road, city, zones) {
  if (!zones.length) return null;

  const tryMatch = (text) => {
    if (!text) return null;
    const normalized = normalizeAddress(text);
    let bestZone = null;
    let bestLocation = null;
    let bestScore = 0;

    for (const zone of zones) {
      for (const loc of zone.locations || []) {
        let score = 0;
        for (const kw of loc.keywords) {
          if (normalized.includes(kw)) {
            score += kw.length;
          }
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

  let result = tryMatch(cleanNeighbourhood);
  if (result && result.score >= 2) return result;

  result = tryMatch(cleanSuburb);
  if (result && result.score >= 2) return result;

  result = tryMatch(`${cleanNeighbourhood} ${cleanSuburb}`);
  if (result && result.score >= 2) return result;

  result = tryMatch(`${road || ''} ${cleanNeighbourhood} ${city || ''}`);
  if (result && result.score >= 2) return result;

  return null;
}

function buildZoneList(stored) {
  return stored.map((z) => ({
    id: z.id,
    name: z.name,
    zonePrice: z.zonePrice || 300,
    locations: (z.locations || []).map((loc) => ({
      name: loc.name,
      keywords: loc.keywords || [],
      price: loc.price || z.zonePrice || 300,
    })),
  }));
}

function buildZonesFromWC() {
  const zones = [];

  for (const [key, meta] of Object.entries(ZONE_MAP)) {
    zones.push({
      id: key.replace('_price', ''),
      name: meta.name,
      zonePrice: meta.zonePrice || 300,
      locations: meta.locations.map((loc) => ({
        name: loc.name,
        keywords: loc.keywords,
        price: loc.price,
      })),
    });
  }

  return zones;
}

export async function GET() {
  const stored = getZones();
  let zones;

  if (stored.length > 0) {
    zones = buildZoneList(stored);
  } else {
    zones = buildZonesFromWC();
  }

  return NextResponse.json({ zones, count: zones.length });
}

export { matchZone, normalizeAddress, cleanAreaName };
