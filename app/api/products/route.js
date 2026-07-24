import { NextResponse } from 'next/server';
import { getProducts, getBrands, getCategories } from '@/lib/data-store';

export async function GET() {
  const products = getProducts();
  const brands = getBrands();
  const categories = getCategories();

  return NextResponse.json({
    products,
    brands,
    categories,
    count: products.length,
  });
}
