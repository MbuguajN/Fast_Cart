import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data-store';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const settings = getSettings();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    let files = [];
    try {
      files = await readdir(uploadsDir);
    } catch {}

    return NextResponse.json({
      logo: settings.logo || null,
      background: settings.background || null,
      showOutOfStock: settings.showOutOfStock !== false,
      _debug: {
        cwd: process.cwd(),
        uploadsDir,
        uploadedFiles: files,
      },
    });
  } catch {
    return NextResponse.json({ logo: null, background: null, showOutOfStock: true });
  }
}
