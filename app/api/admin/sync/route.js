import { NextResponse } from 'next/server';
import {
  updateStore,
  upsertProduct,
  upsertBrand,
  upsertCategory,
  getSyncStatus,
} from '@/lib/data-store';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

async function wcFetch(endpoint, params = {}) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set('consumer_key', WC_KEY);
  url.searchParams.set('consumer_secret', WC_SECRET);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WC API error (${endpoint}): ${res.status} ${err}`);
  }
  return res.json();
}

async function fetchAllPages(endpoint, params = {}) {
  let page = 1;
  let all = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await wcFetch(endpoint, { ...params, page, per_page: '50' });
    if (page === 1 && Array.isArray(data)) {
      totalPages = parseInt(res?.headers?.get('x-wp-totalpages') || '1');
    }
    all = all.concat(data);
    if (!Array.isArray(data) || data.length === 0) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

export async function POST() {
  const status = getSyncStatus();
  if (status.syncStatus === 'syncing') {
    return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
  }

  updateStore({ syncStatus: 'syncing' });

  try {
    const [wcProducts, wcCategories] = await Promise.all([
      wcFetch('products', { per_page: '100', status: 'publish' }).catch(() => []),
      wcFetch('products/categories', { per_page: '100' }).catch(() => []),
    ]);

    const productCount = wcProducts.length;
    const categoryCount = wcCategories.length;

    let brandCount = 0;

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

    const brandMap = new Map();
    for (const p of wcProducts) {
      const brandAttr = p.attributes?.find(
        (a) => a.name.toLowerCase() === 'brand' || a.name.toLowerCase() === 'manufacturer'
      );
      if (brandAttr && brandAttr.options?.length) {
        const brandName = brandAttr.options[0];
        if (!brandMap.has(brandName)) {
          brandMap.set(brandName, {
            wcId: `brand_${brandName.toLowerCase().replace(/\s+/g, '_')}`,
            name: brandName,
            slug: brandName.toLowerCase().replace(/\s+/g, '-'),
            image: null,
          });
        }
      }
    }

    for (const [name, brandData] of brandMap) {
      upsertBrand(brandData);
      brandCount++;
    }

    for (const p of wcProducts) {
      const primaryImage = p.images?.[0]?.src || '';
      const brandAttr = p.attributes?.find(
        (a) => a.name.toLowerCase() === 'brand' || a.name.toLowerCase() === 'manufacturer'
      );
      const brandName = brandAttr?.options?.[0] || '';

      upsertProduct({
        wcId: p.id,
        name: p.name,
        slug: p.slug,
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
      });
    }

    updateStore({
      lastSync: new Date().toISOString(),
      syncStatus: 'idle',
    });

    return NextResponse.json({
      success: true,
      products: productCount,
      categories: categoryCount,
      brands: brandCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    updateStore({ syncStatus: 'error' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
