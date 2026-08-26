import { NextResponse } from 'next/server';
import { getBrands } from '@/lib/data-store';

export async function GET() {
  const brands = getBrands();
  return NextResponse.json({ brands: brands.filter(b => b.visible !== false) });
}
