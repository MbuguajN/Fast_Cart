import { NextResponse } from 'next/server';
import {
  updateStore,
  upsertProduct,
  upsertBrand,
  upsertCategory,
  upsertZone,
  getSyncStatus,
  extractBrandsFromProducts,
  updateProductVariations,
} from '@/lib/data-store';
import { wcFetch, wcFetchAll, wcUrl, wcAuthHeaders, WC_URL, WC_KEY, WC_SECRET } from '@/lib/wc-config';
import { recordEvent, timed, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
import { ZONE_MAP } from '@/lib/zone-map';
import { adminGuard } from '@/lib/api-guard';

async function syncZones() {
  try {
    const zones = await wcFetch('shipping/zones').then((r) => r.data);
    let count = 0;

    for (const zone of zones) {
      if (zone.name === 'Locations not covered by your other zones') continue;

      try {
        const methodsUrl = wcUrl(`shipping/zones/${zone.id}/methods`);
        const methodsRes = await fetch(methodsUrl, { headers: wcAuthHeaders() });
        if (!methodsRes.ok) continue;
        const methods = await methodsRes.json();

        for (const method of methods) {
          if (method.method_id === 'nairobi_shipping' && method.settings) {
            for (const [key, meta] of Object.entries(ZONE_MAP)) {
              const setting = method.settings[key];
              const zonePrice = parseInt(setting?.value || setting?.default || '300', 10) || 300;
              upsertZone({
                id: key.replace('_price', ''),
                name: meta.name,
                zonePrice,
                locations: meta.locations.map((loc) => ({
                  name: loc.name,
                  keywords: loc.keywords,
                  price: loc.price,
                })),
              });
              count++;
            }
          }
        }
      } catch {
        // skip zone on error
      }
    }

    return count;
  } catch {
    return 0;
  }
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const status = getSyncStatus();
  if (status.syncStatus === 'syncing') {
    return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
  }

  if (!WC_URL || !WC_KEY || !WC_SECRET) {
    return NextResponse.json({ error: 'WooCommerce credentials not configured' }, { status: 500 });
  }

  updateStore({ syncStatus: 'syncing' });

  try {
    // wcFetchAll pages until the server says there are no more. wcFetch
    // returns only the first page, which silently capped the catalogue at
    // 100 products — the cache was already at 106.
    const [wcProducts, wcCategories, wcBrands] = await Promise.all([
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products', { status: 'publish' }), 'products').catch(() => []),
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products/categories'), 'categories').catch(() => []),
      timed(EVENT_KINDS.SYNC, () => wcFetchAll('products/brands'), 'brands').catch(() => []),
    ]);

    // A firewalled REST API answers with an error, which the catch above
    // turns into an empty array. Without this guard that reads as a
    // successful sync and quietly empties the shop.
    if (wcProducts.length === 0) {
      recordEvent({
        kind: EVENT_KINDS.SYNC,
        outcome: OUTCOMES.FAIL,
        detail: 'sync returned zero products — cache left untouched',
      });
      updateStore({ syncStatus: 'idle', syncError: 'WooCommerce returned no products' });
      return NextResponse.json(
        { error: 'WooCommerce returned no products. Check REST API access and try again.' },
        { status: 502 }
      );
    }

    const productCount = wcProducts.length;
    const categoryCount = wcCategories.length;

    let brandCount = wcBrands.length;

    if (wcBrands.length > 0) {
      for (const b of wcBrands) {
        upsertBrand({
          wcId: b.id,
          name: b.name,
          slug: b.slug,
          image: b.image?.src || b.thumbnail || null,
          description: b.description || '',
        });
      }
    }

    for (const cat of wcCategories) {
      upsertCategory({
        wcId: cat.id,
        name: cat.name,
        slug: cat.slug,
        image: cat.image?.src || null,
        description: cat.description || '',
        display: cat.display || 'default',
      });
    }

    for (const p of wcProducts) {
      const primaryImage = p.images?.[0]?.src || '';
      const brandAttr = p.attributes?.find(
        (a) => a.name.toLowerCase() === 'brand' || a.name.toLowerCase() === 'manufacturer'
      );
      let brandName = brandAttr?.options?.[0] || '';

      // If no brand attribute, check if a WC brand taxonomy term was assigned
      if (!brandName && Array.isArray(p.brands) && p.brands.length > 0) {
        brandName = p.brands[0].name || '';
      }

      // No fallback guessing from product name — that creates junk brands

      const productType = p.type || 'simple';

      upsertProduct({
        wcId: p.id,
        name: p.name,
        slug: p.slug,
        type: productType,
        price: p.price || p.regular_price,
        regularPrice: p.regular_price,
        salePrice: p.sale_price,
        stockStatus: p.stock_status,
        stockQuantity: p.stock_quantity,
        image: primaryImage,
        images: (p.images || []).map((img) => img.src),
        categoryId: p.categories?.[0]?.id || null,
        categoryName: p.categories?.[0]?.name || '',
        brandId: brandName ? `brand_${brandName.toLowerCase().replace(/\s+/g, '_')}` : null,
        brandName,
        description: p.description || '',
        shortDescription: p.short_description || '',
        sku: p.sku || '',
        weight: p.weight || '',
        upsellIds: p.upsell_ids || [],
        totalSales: p.total_sales || 0,
        attributes: (p.attributes || []).map((a) => ({
          name: a.name,
          options: a.options || [],
        })),
      });

      // Fetch variations for variable products
      if (productType === 'variable') {
        try {
          const varsUrl = wcUrl(`products/${p.id}/variations`, { per_page: '100' });
          const varsRes = await fetch(varsUrl, { headers: wcAuthHeaders() });
          if (varsRes.ok) {
            const wcVariations = await varsRes.json();
            const variations = wcVariations.map((v) => ({
              wcId: v.id,
              price: v.price || v.regular_price,
              regularPrice: v.regular_price,
              salePrice: v.sale_price,
              stockStatus: v.stock_status,
              stockQuantity: v.stock_quantity,
              sku: v.sku || '',
              image: v.image?.src || primaryImage,
              attributes: (v.attributes || []).map((a) => ({
                name: a.option || a.name || '',
                value: a.option || '',
              })),
            }));
            updateProductVariations(p.id, variations);
          }
        } catch {
          // skip variations on error
        }
      }
    }

    const extractedBrands = extractBrandsFromProducts();
    brandCount = extractedBrands.length;

    const zoneCount = await syncZones();

    updateStore({
      lastSync: new Date().toISOString(),
      syncStatus: 'idle',
    });

    recordEvent({
      kind: EVENT_KINDS.SYNC,
      outcome: OUTCOMES.OK,
      detail: `${productCount} products, ${categoryCount} categories, ${brandCount} brands, ${zoneCount} zones`,
    });

    return NextResponse.json({
      success: true,
      products: productCount,
      categories: categoryCount,
      brands: brandCount,
      zones: zoneCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    updateStore({ syncStatus: 'error' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
