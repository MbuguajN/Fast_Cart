const WC_URL = process.env.WOOCOMMERCE_STORE_URL || '';
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';
const WC_WEBHOOK_SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';

export function wcAuth() {
  return { consumer_key: WC_KEY, consumer_secret: WC_SECRET };
}

export function wcUrl(endpoint, params = {}) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set('consumer_key', WC_KEY);
  url.searchParams.set('consumer_secret', WC_SECRET);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

export async function wcFetch(endpoint, params = {}) {
  const url = wcUrl(endpoint, params);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WC API ${endpoint} error ${res.status}: ${text}`);
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
  const url = wcUrl(endpoint);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `WC POST ${endpoint} failed: ${res.status}`);
  }
  return data;
}

export async function wcPut(endpoint, body) {
  const url = wcUrl(endpoint);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `WC PUT ${endpoint} failed: ${res.status}`);
  }
  return data;
}

export { WC_URL, WC_KEY, WC_SECRET, WC_WEBHOOK_SECRET };
