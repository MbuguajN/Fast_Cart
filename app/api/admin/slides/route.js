import { NextResponse } from 'next/server';
import { getSlides, upsertSlide, deleteSlide } from '@/lib/data-store';

export async function GET() {
  try {
    const slides = getSlides();
    return NextResponse.json(slides);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.title && !data.image) {
      return NextResponse.json({ error: 'Title or image is required' }, { status: 400 });
    }
    const saved = upsertSlide(data);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Slide ID is required' }, { status: 400 });
    }
    const saved = upsertSlide(data);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Slide ID is required' }, { status: 400 });
    }
    deleteSlide(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
