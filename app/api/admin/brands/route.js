import { NextResponse } from 'next/server';
import { getBrands, updateBrand, mutateStore } from '@/lib/data-store';
import { adminGuard } from '@/lib/api-guard';

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const brands = getBrands();
  return NextResponse.json(brands);
}

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

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
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brand id is required' }, { status: 400 });
    }

    await mutateStore((store) => {
      store.brands = store.brands.filter((b) => b.id !== id && b.wcId !== id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
