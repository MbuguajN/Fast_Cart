import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];
const ALLOWED_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export async function GET(request, { params }) {
  try {
    const { filename } = await params;

    // Block path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('%')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const ext = path.extname(filename).toLowerCase();

    // Only allow safe image extensions (no SVG — XSS vector)
    if (!ALLOWED_EXTENSIONS.includes(ext.replace('.', ''))) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
    const filepath = path.join(uploadsDir, filename);
    const resolved = path.resolve(filepath);

    // Ensure resolved path is inside uploads directory
    if (!resolved.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const buffer = await readFile(filepath);
    const contentType = ALLOWED_MIME[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
