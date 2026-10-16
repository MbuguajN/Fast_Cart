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

/**
 * Free-text fields an applicant may set, with their length caps. This is an
 * allow-list on purpose: the result is handed to buildTradeAccount(), which
 * honours `id`, `creditEnabled`, `creditLimit`, `tierOverride`, `orderCeiling`,
 * `addresses`, `skipTerms` and more. Spreading the request body would let an
 * applicant award themselves a credit line or a pricing tier that survives
 * approval.
 */
const TEXT_FIELDS = {
  legalName: 160,
  role: 80,
  segment: 32,
  kraPin: 20,
  licenceNo: 60,
  licenceExpiry: 20,
  deliveryAddress: 200,
  city: 60,
  deliveryWindow: 40,
  estimatedMonthlyCases: 20,
};

export function cleanApplication(data) {
  const out = {};
  out.tradingName = clean(data?.tradingName, 120);
  out.contactName = clean(data?.contactName, 120);
  out.email = clean(data?.email, 160).toLowerCase();
  out.phone = clean(data?.phone, 30);

  if (!out.tradingName || !out.contactName || !out.email || !out.phone) {
    throw new Error('Missing required business or contact fields');
  }
  if (!EMAIL.test(out.email)) {
    throw new Error('Please enter a valid email address.');
  }

  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    if (data[field] !== undefined) out[field] = clean(data[field], max);
  }
  if (data.termsAccepted !== undefined) out.termsAccepted = data.termsAccepted === true;

  if (data.licenceDocumentUrl) {
    const url = String(data.licenceDocumentUrl);
    if (!LICENCE_URL.test(url) || url.includes('..')) {
      throw new Error('Invalid licence document. Please upload it again.');
    }
    out.licenceDocumentUrl = url;
  }
  return out;
}
