import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';
import { getHeroSlides, saveHeroSlide, removeHeroSlide } from '@/lib/trade/hero-slides.js';

/** Trade-scoped (the path is under /api/admin/trade, see lib/api-guard.js). */

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;
  return NextResponse.json({ success: true, slides: await getHeroSlides() });
}

// Create (no id) or update (id) a slide.
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const slide = await saveHeroSlide(await request.json());
    return NextResponse.json({ success: true, slide });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Slide id is required' }, { status: 400 });
  await removeHeroSlide(id);
  return NextResponse.json({ success: true });
}
