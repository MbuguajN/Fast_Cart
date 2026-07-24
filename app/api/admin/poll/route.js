import { NextResponse } from 'next/server';
import { getProducts, getSyncStatus, updateStore, upsertProduct } from '@/lib/data-store';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

export async function GET() {
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
    const idParam = productIds.join(',');
    const url = `${WC_URL}/wp-json/wc/v3/products?include=${idParam}&per_page=100&consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ error: 'WooCommerce API error' }, { status: 502 });
    }

    const wcProducts = await res.json();
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
