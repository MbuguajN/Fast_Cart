import { NextResponse } from 'next/server';
import { getProducts, getBrands, getCategories, getSettings } from '@/lib/data-store';

export async function GET() {
  const products = getProducts();
  const brands = getBrands();
  const categories = getCategories();
  const settings = getSettings();
  const showOutOfStock = settings.showOutOfStock !== false;

  return NextResponse.json({
    products,
    brands,
    categories,
    settings,
    showOutOfStock,
    count: products.length,
  });
}
