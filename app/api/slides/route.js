import { NextResponse } from 'next/server';
import { getSlides } from '@/lib/data-store';

export async function GET() {
  try {
    const slides = getSlides();
    const activeSlides = (slides || [])
      .filter((s) => s.active !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return NextResponse.json(activeSlides);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
