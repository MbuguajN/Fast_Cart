import { NextResponse } from 'next/server';
import { getProducts, getSyncStatus, updateStore, upsertProduct } from '@/lib/data-store';
import { wcFetch, WC_URL, WC_KEY, WC_SECRET } from '@/lib/wc-config';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const status = getSyncStatus();
  const products = getProducts();

  if (!WC_URL || !WC_KEY || !WC_SECRET) {
    return NextResponse.json({
      updated: 0,
      products: products.length,
      lastSync: status.lastSync,
      note: 'No WooCommerce credentials configured',
    });
  }

  if (products.length === 0) {
    return NextResponse.json({
      updated: 0,
      products: 0,
      lastSync: status.lastSync,
      note: 'No products in store. Run a full sync first.',
    });
  }

  try {
    const productIds = products.map((p) => p.wcId).filter(Boolean);

    // Credentials go in the Authorization header, not the query string.
    let wcProducts;
    try {
      ({ data: wcProducts } = await wcFetch('products', {
        include: productIds.join(','),
        per_page: '100',
      }));
    } catch (err) {
      console.error('Poll: WooCommerce API error:', err.message);
      return NextResponse.json({ error: 'WooCommerce API error' }, { status: 502 });
    }
    let updated = 0;

    for (const p of wcProducts) {
      const existing = products.find((ep) => ep.wcId === p.id);
      if (!existing) continue;

      const stockChanged = existing.stockStatus !== p.stock_status || existing.stockQuantity !== p.stock_quantity;
      const priceChanged = existing.price !== (p.price || p.regular_price);

      if (stockChanged || priceChanged) {
        const primaryImage = p.images?.[0]?.src || '';
        upsertProduct({
          wcId: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price || p.regular_price,
          regularPrice: p.regular_price,
          salePrice: p.sale_price,
          stockStatus: p.stock_status,
          stockQuantity: p.stock_quantity,
          image: primaryImage || existing.image,
          images: (p.images || []).map((img) => img.src),
          categoryId: p.categories?.[0]?.id ?? existing.categoryId,
          categoryName: p.categories?.[0]?.name || existing.categoryName,
          brandId: existing.brandId,
          brandName: existing.brandName,
          description: p.description || '',
          shortDescription: p.short_description || '',
          sku: p.sku || '',
          weight: p.weight || '',
        });
        updated++;
      }
    }

    if (updated > 0) {
      updateStore({ lastSync: new Date().toISOString() });
    }

    return NextResponse.json({
      updated,
      total: products.length,
      lastSync: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
