/**
 * Validation for the public trade application (`POST /api/trade/apply`).
 *
 * The endpoint is unauthenticated by design, and what it stores is shown to
 * staff in the admin UI — so free-text is capped and stripped of angle
 * brackets, and the licence document link may only point at a file this
 * site's own upload route produced (never a `javascript:` or third-party URL).
 */

const LICENCE_URL = /^\/uploads\/trade\/licences\/[A-Za-z0-9_.-]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : '';

export function cleanApplication(data) {
  const out = { ...data };
  out.tradingName = clean(data.tradingName, 120);
  out.contactName = clean(data.contactName, 120);
  out.email = clean(data.email, 160).toLowerCase();
  out.phone = clean(data.phone, 30);

  if (!out.tradingName || !out.contactName || !out.email || !out.phone) {
    throw new Error('Missing required business or contact fields');
  }
  if (!EMAIL.test(out.email)) {
    throw new Error('Please enter a valid email address.');
  }

  for (const field of ['legalName', 'role', 'city', 'deliveryAddress', 'licenceNo', 'segment']) {
    if (data[field] !== undefined) out[field] = clean(data[field], 200);
  }

  if (data.licenceDocumentUrl) {
    const url = String(data.licenceDocumentUrl);
    if (!LICENCE_URL.test(url) || url.includes('..')) {
      throw new Error('Invalid licence document. Please upload it again.');
    }
    out.licenceDocumentUrl = url;
  } else {
    delete out.licenceDocumentUrl;
  }
  return out;
}
