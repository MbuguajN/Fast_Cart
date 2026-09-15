import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file format. Only PDF, PNG, JPG, and WebP documents are accepted.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum 10MB limit.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = path.extname(file.name) || (file.type === 'application/pdf' ? '.pdf' : '.jpg');
    const safeExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext.toLowerCase())
      ? ext.toLowerCase()
      : '.pdf';

    const filename = `licence_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'trade', 'licences');

    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, filename);
    await fs.writeFile(targetPath, buffer);

    const fileUrl = `/uploads/trade/licences/${filename}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Trade licence upload error:', error);
    return NextResponse.json({ error: 'Failed to upload licence document' }, { status: 500 });
  }
}

