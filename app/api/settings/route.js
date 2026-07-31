import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data-store';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({
      logo: settings.logo || null,
      background: settings.background || null,
      showOutOfStock: settings.showOutOfStock !== false,
    });
  } catch {
    return NextResponse.json({ logo: null, background: null, showOutOfStock: true });
  }
}
