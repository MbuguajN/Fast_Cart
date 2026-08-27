import { NextResponse } from 'next/server';
import { getZoneCatalog, matchZone, normalizeAddress, cleanAreaName } from '@/lib/shipping';

/**
 * GET /api/zones — the public delivery zone catalogue.
 *
 * The matching and pricing logic now lives in lib/shipping.js so that checkout
 * prices delivery from the same source rather than trusting a fee sent by the
 * client.
 */
export async function GET() {
  const zones = getZoneCatalog();
  return NextResponse.json({ zones, count: zones.length });
}

export { matchZone, normalizeAddress, cleanAreaName };
