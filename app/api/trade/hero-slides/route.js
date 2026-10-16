import { NextResponse } from 'next/server';
import { readTradeStore } from '@/lib/trade/trade-store.js';
import { publicSlides } from '@/lib/trade/hero-slides.js';

/** Public: the live promotional slides for the trade landing page hero. */
export async function GET() {
  const slides = publicSlides(readTradeStore().heroSlides);
  return NextResponse.json({ slides }, { headers: { 'Cache-Control': 'no-store' } });
}
