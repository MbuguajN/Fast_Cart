import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { readStore } from '@/lib/data-store';

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const store = readStore();

  const products = store.products?.length || 0;
  const categories = store.categories?.length || 0;
  const brands = store.brands?.length || 0;
  const outOfStock = store.products?.filter((p) => p.stockStatus === 'outofstock').length || 0;
  const lastSync = store.lastSync || null;

  return NextResponse.json({
    products,
    categories,
    brands,
    outOfStock,
    lastSync,
  });
}
