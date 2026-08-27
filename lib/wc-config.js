/**
 * WooCommerce REST client.
 *
 * Credentials travel in an `Authorization: Basic` header rather than as
 * `consumer_key`/`consumer_secret` query parameters. As query parameters they
 * were written into the WordPress access log, any reverse-proxy log and any
 * APM trace on the path — a persistent copy of the store's API credentials in
 * plaintext, in several places nobody rotates.
 */

const WC_URL = process.env.WOOCOMMERCE_STORE_URL || '';
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';
const WC_WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';

export function wcAuth() {
  return { consumer_key: WC_KEY, consumer_secret: WC_SECRET };
}

/** Basic auth header carrying the WooCommerce key pair. */
export function wcAuthHeaders(extra = {}) {
  const credentials = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * Build a WooCommerce endpoint URL.
 *
 * No longer embeds credentials. Callers must send `wcAuthHeaders()`; the
 * helpers below do that for you.
 */
export function wcUrl(endpoint, params = {}) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${String(endpoint).replace(/^\//, '')}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function wcRequest(endpoint, { method = 'GET', params = {}, body } = {}) {
  const res = await fetch(wcUrl(endpoint, params), {
    method,
    headers: wcAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  return res;
}

export async function wcFetch(endpoint, params = {}) {
  const res = await wcRequest(endpoint, { params });

  if (!res.ok) {
    const text = await res.text();
    // Truncated: WooCommerce error bodies can echo request context.
    throw new Error(`WC API ${endpoint} error ${res.status}: ${text.slice(0, 300)}`);
  }

  const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
  const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
  const data = await res.json();
  return { data, total, totalPages };
}

export async function wcFetchAll(endpoint, params = {}) {
  let page = 1;
  let all = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, totalPages: tp } = await wcFetch(endpoint, { ...params, page, per_page: '50' });
    all = all.concat(data);
    totalPages = tp;
    page++;
    if (page > 50) break;
  }
  return all;
}

export async function wcPost(endpoint, body) {
  const res = await wcRequest(endpoint, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `WC POST ${endpoint} failed: ${res.status}`);
  }
  return data;
}

export async function wcPut(endpoint, body) {
  const res = await wcRequest(endpoint, { method: 'PUT', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `WC PUT ${endpoint} failed: ${res.status}`);
  }
  return data;
}

export async function wcDelete(endpoint, params = {}) {
  const res = await wcRequest(endpoint, { method: 'DELETE', params });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `WC DELETE ${endpoint} failed: ${res.status}`);
  }
  return data;
}

export { WC_URL, WC_KEY, WC_SECRET, WC_WEBHOOK_SECRET };
