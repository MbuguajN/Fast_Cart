import { NextResponse } from 'next/server';
import { getZones, upsertZone, deleteZone } from '@/lib/data-store';
import { adminGuard } from '@/lib/api-guard';
import { ZONE_MAP } from '@/lib/zone-map';

/**
 * GET /api/admin/zones — the admin-editable zone list, plus whether it's
 * currently empty (in which case the storefront is serving the static
 * lib/zone-map.js rate card as a fallback — see lib/shipping.js#getZoneCatalog).
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const zones = getZones();
    return NextResponse.json({ zones, usingFallback: zones.length === 0 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/zones
 *   { resetToDefaults: true }        — seed the editable table from the rate card
 *   { id, name, zonePrice, locations } — add or fully replace one zone
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();

    if (body.resetToDefaults) {
      const saved = Object.entries(ZONE_MAP).map(([key, meta]) =>
        upsertZone({
          id: key.replace('_price', ''),
          name: meta.name,
          zonePrice: meta.zonePrice,
          locations: meta.locations,
        })
      );
      return NextResponse.json({ zones: saved });
    }

    if (!body.id || !body.name) {
      return NextResponse.json({ error: 'Zone id and name are required' }, { status: 400 });
    }
    const saved = upsertZone(body);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Zone id is required' }, { status: 400 });
    }
    deleteZone(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
