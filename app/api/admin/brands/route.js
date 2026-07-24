import { NextResponse } from 'next/server';
import { getBrands, updateBrand, readStore, writeStore } from '@/lib/data-store';

export async function GET() {
  const brands = getBrands();
  return NextResponse.json(brands);
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const { id, ...updates } = data;

    if (!id) {
      return NextResponse.json({ error: 'Brand id is required' }, { status: 400 });
    }

    const updated = updateBrand(id, updates);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brand id is required' }, { status: 400 });
    }

    const store = readStore();
    store.brands = store.brands.filter((b) => b.id !== id && b.wcId !== id);
    writeStore(store);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
