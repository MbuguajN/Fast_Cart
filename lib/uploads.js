import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import crypto from 'crypto';

/**
 * Where uploaded media lives.
 *
 * Deliberately outside `public/`. Anything under `public/` is served
 * statically by Next at its own URL, with none of the headers the
 * /api/uploads route applies — so storing uploads there meant every hardening
 * header on that route could be skipped by requesting `/uploads/<name>`
 * directly.
 */
export const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

/** Files uploaded before the move. Still readable, never written to. */
export const LEGACY_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/** Public URL for an uploaded file. Always the API route, never a static path. */
export function uploadUrl(filename) {
  return `/api/uploads/${encodeURIComponent(filename)}`;
}

const ALLOWED_MIRROR_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const MIRROR_MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
};
const MIRROR_MAX_SIZE = 5 * 1024 * 1024; // 5MB, same ceiling as /api/admin/upload

/**
 * Hosts this server will fetch an image from. The same list next.config.mjs
 * already trusts for next/image's remotePatterns — reused here rather than
 * duplicated, since both are "images we already trust." A hostname
 * allowlist checked against the URL string, not the resolved IP, is
 * deliberate: an IP-range check (rejecting 127.0.0.0/8, 169.254.0.0/16,
 * 10.0.0.0/8, etc.) has to re-resolve DNS to actually connect, and an
 * attacker-controlled DNS record can answer differently between the check
 * and the fetch (DNS rebinding) — the source URL here is admin-supplied, so
 * that gap is real, not theoretical. Naming exact hosts has no such window.
 */
const ALLOWED_MIRROR_HOSTS = new Set([
  'images.unsplash.com',
  'lh3.googleusercontent.com',
  'myhappyhour.co.ke',
  'logo.clearbit.com',
  'i.vimeocdn.com',
]);

function matchesMirrorMagic(buffer, ext) {
  const signature = MIRROR_MAGIC_BYTES[ext];
  if (!signature || buffer.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  if (ext === 'webp') return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
  return true;
}

/**
 * Downloads an external image once and stores it under our own upload
 * store, so a product's image survives the source site changing or going
 * down, and stops costing every catalog page load a request to it.
 *
 * A URL that's already ours (`/api/uploads/...`) is returned unchanged —
 * mirroring is a one-time copy, not a redirect, so there's nothing to do.
 * Any failure (network, non-image response, oversized file, disallowed
 * host) throws; callers that shouldn't let a bad image URL block a save
 * should catch and fall back to the original URL rather than propagate.
 */
export async function mirrorImageLocally(sourceUrl) {
  if (!sourceUrl || typeof sourceUrl !== 'string') return sourceUrl;
  if (sourceUrl.startsWith('/api/uploads/')) return sourceUrl;

  // The URL is admin-supplied (typed in, or picked from a "borrow from
  // retail" search) — fetching it is a server-side request on the caller's
  // behalf, so it's only ever pointed at hosts we've already decided to
  // trust for images, never wherever the caller happens to type.
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error('Invalid image URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
  }
  if (!ALLOWED_MIRROR_HOSTS.has(parsed.hostname)) {
    throw new Error(`Image host "${parsed.hostname}" is not on the allowed list`);
  }

  const res = await fetch(sourceUrl, { redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    throw new Error('Source image responded with a redirect, which is not followed');
  }
  if (!res.ok) throw new Error(`Source image returned ${res.status}`);

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = ALLOWED_MIRROR_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported image content-type: ${contentType || 'unknown'}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) throw new Error('Source image was empty');
  if (buffer.length > MIRROR_MAX_SIZE) throw new Error('Source image exceeds 5MB');
  if (!matchesMirrorMagic(buffer, ext)) throw new Error('Source image content does not match its declared type');

  const filename = `mirror_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const target = path.resolve(path.join(UPLOAD_DIR, filename));
  if (!target.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) throw new Error('Invalid path');

  await writeFile(target, buffer);
  return uploadUrl(filename);
}
