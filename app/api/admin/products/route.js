import { NextResponse } from 'next/server';
import { getProducts, readStore, writeStore, upsertProduct } from '@/lib/data-store';

export async function GET() {
  const products = getProducts();
  return NextResponse.json(products);
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { wcId, ...updates } = data;

    if (!wcId) {
      return NextResponse.json({ error: 'wcId is required' }, { status: 400 });
    }

    const updated = upsertProduct({ wcId, ...updates });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
