import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { adminGuard } from '@/lib/api-guard';
import { UPLOAD_DIR, uploadUrl } from '@/lib/uploads';

/**
 * POST /api/admin/upload
 *
 * SVG is deliberately not accepted. An SVG is an XML document that can carry
 * script; served from this origin it is stored XSS. Existing SVGs remain
 * readable through /api/uploads, which serves everything under a sandboxing
 * CSP, but no new ones are accepted.
 *
 * Files are written to `data/uploads/` rather than `public/uploads/`, so the
 * API route is the only way to reach them and its headers cannot be bypassed.
 */

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/** Leading bytes each accepted format must start with. */
const MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46], // "RIFF", with "WEBP" at offset 8
};

function matchesMagic(buffer, ext) {
  const signature = MAGIC_BYTES[ext];
  if (!signature) return false;
  if (buffer.length < signature.length) return false;

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }

  if (ext === 'webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return true;
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPG, GIF, WebP' }, { status: 400 });
    }

    const ext = path.extname(file.name || '').toLowerCase().replace('.', '');
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // The declared MIME type and extension are both caller-controlled; the
    // file's own leading bytes are not.
    if (!matchesMagic(buffer, ext)) {
      return NextResponse.json(
        { error: 'That file is not a valid image, or its contents do not match its extension' },
        { status: 400 }
      );
    }

    // Generated name — the client's filename never reaches the filesystem.
    const filename = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });

    const target = path.resolve(path.join(UPLOAD_DIR, filename));
    if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    await writeFile(target, buffer);

    return NextResponse.json({ url: uploadUrl(filename), filename });
  } catch (error) {
    console.error('Upload failed:', error.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
