import { NextResponse } from 'next/server';
import { getProducts, getBrands, getCategories, getSettings } from '@/lib/data-store';
import { visibleProducts } from '@/lib/storefront-catalog';

/**
 * GET /api/products — the storefront catalogue.
 *
 * Filtering happens here rather than in each client surface, so search,
 * category, brand and upsell listings cannot drift apart on what counts as
 * sellable.
 *
 * Note the changed default: this previously used `showOutOfStock !== false`,
 * which displayed out-of-stock products whenever the setting was absent.
 * Showing them is now opt-in.
 */
export async function GET() {
  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock === true;

  const products = visibleProducts(getProducts(), { showOutOfStock });

  return NextResponse.json({
    products,
    brands: getBrands(),
    categories: getCategories(),
    settings,
    showOutOfStock,
    count: products.length,
  });
}
