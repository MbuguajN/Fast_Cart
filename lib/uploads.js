import path from 'path';

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
