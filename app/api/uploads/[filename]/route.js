import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR, LEGACY_UPLOAD_DIR } from '@/lib/uploads';

/**
 * GET /api/uploads/[filename]
 *
 * The only route that serves uploaded media.
 *
 * New uploads are written to `data/uploads/`, outside `public/`, so Next does
 * not also serve them statically. That mattered: a file in `public/uploads/`
 * is reachable at `/uploads/<name>` with none of the headers below, so the
 * sandboxing CSP applied here was trivially bypassed — an uploaded SVG is an
 * XML document that can carry script, and served from this origin without a
 * CSP that is stored XSS.
 *
 * `LEGACY_UPLOAD_DIR` keeps files uploaded before that move readable.
 */

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'];

const ALLOWED_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

export async function GET(request, { params }) {
  try {
    const { filename } = await params;

    if (typeof filename !== 'string' || !filename) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Reject any separator or escape before it reaches the filesystem.
    if (/[\\/]|\.\.|%|\0/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext.replace('.', ''))) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    const buffer = await readFromEither(filename);
    if (!buffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const headers = {
      'Content-Type': ALLOWED_MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      // Applied to every file, not just SVG: an image that turns out to be a
      // document should still be inert.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Content-Disposition': `inline; filename="${filename}"`,
    };

    return new NextResponse(buffer, { headers });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

/** Read from the current upload directory, falling back to the legacy one. */
async function readFromEither(filename) {
  for (const dir of [UPLOAD_DIR, LEGACY_UPLOAD_DIR]) {
    const base = path.resolve(dir);
    const target = path.resolve(path.join(base, filename));

    // Confirm containment after resolution, not just before.
    if (target !== path.join(base, filename)) continue;
    if (!target.startsWith(base + path.sep)) continue;

    try {
      return await readFile(target);
    } catch {
      // Try the next directory.
    }
  }
  return null;
}
