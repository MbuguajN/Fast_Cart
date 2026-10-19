import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_SUBDIR = path.join('uploads', 'products');
const UPLOAD_DIR = path.join(process.cwd(), 'public', UPLOAD_SUBDIR);

/**
 * Ensures the uploads directory exists on disk.
 */
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Derives a clean, consistent filename for a remote image URL.
 */
export function getLocalImageFilename(url, prefix = '') {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname) || '.webp';
    const rawBase = path.basename(pathname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);

    const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);
    const cleanPrefix = prefix ? `${prefix}_` : '';
    return `${cleanPrefix}${rawBase}_${hash}${ext}`;
  } catch {
    const hash = crypto.createHash('md5').update(String(url)).digest('hex').slice(0, 12);
    const cleanPrefix = prefix ? `${prefix}_` : '';
    return `${cleanPrefix}image_${hash}.webp`;
  }
}

/**
 * Caches a remote image to the local public/uploads/products directory.
 * If already cached or if the URL is already local, returns the local path immediately.
 * If the download fails, returns the original URL as a safe fallback.
 *
 * @param {string} url - Remote image URL or local path
 * @param {string} prefix - Optional prefix for the filename (e.g. product wcId)
 * @returns {Promise<string>} Local public path (e.g. /uploads/products/xyz.webp) or original URL
 */
export async function cacheProductImage(url, prefix = '') {
  if (!url || typeof url !== 'string') return url;

  const trimmed = url.trim();
  // Already a local path
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/images/') || trimmed.startsWith('/')) {
    return trimmed;
  }

  // Not an HTTP/HTTPS remote URL
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  ensureUploadDir();

  const filename = getLocalImageFilename(trimmed, prefix);
  const targetPath = path.join(UPLOAD_DIR, filename);
  const publicPath = `/${UPLOAD_SUBDIR}/${filename}`.replace(/\\/g, '/');

  // Cache hit: already downloaded and non-empty
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.size > 0) {
        return publicPath;
      }
    }
  } catch {
    // continue to download
  }

  // Download remote image with retries
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(trimmed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        console.warn(`[image-cache] Failed to fetch ${trimmed}: HTTP ${res.status}`);
        return trimmed;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        console.warn(`[image-cache] Empty image received from ${trimmed}`);
        return trimmed;
      }

      // Atomic write via temp file
      const tmpPath = path.join(UPLOAD_DIR, `.${filename}.${crypto.randomUUID()}.tmp`);
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, targetPath);

      return publicPath;
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      console.warn(`[image-cache] Error caching ${trimmed}:`, err.message || err);
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Caches an array of image URLs with concurrency control.
 *
 * @param {string[]} urls - Array of image URLs
 * @param {string} prefix - Optional prefix for filenames
 * @param {number} concurrency - Max concurrent downloads
 * @returns {Promise<string[]>}
 */
export async function cacheProductImages(urls, prefix = '', concurrency = 3) {
  if (!urls || !Array.isArray(urls)) return [];

  const results = new Array(urls.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < urls.length) {
      const index = currentIndex++;
      const url = urls[index];
      results[index] = await cacheProductImage(url, `${prefix}_${index}`);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, urls.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

