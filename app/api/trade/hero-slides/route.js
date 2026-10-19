import { NextResponse } from 'next/server';
import { getHeroSlides, publicSlides } from '@/lib/trade/hero-slides.js';

/** Public: the live promotional slides for the trade landing page hero. */
export async function GET() {
  const allSlides = await getHeroSlides();
  const slides = publicSlides(allSlides);
  return NextResponse.json({ slides }, { headers: { 'Cache-Control': 'no-store' } });
}
