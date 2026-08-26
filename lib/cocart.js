/**
 * CoCart API helpers — server-side only.
 *
 * All CoCart calls are made from Next.js API routes (BFF pattern),
 * keeping WooCommerce credentials off the client.
 */

const WC_URL = process.env.WOOCOMMERCE_STORE_URL || '';
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';

/**
 * Build a full CoCart v2 endpoint URL.
 */
export function cocartUrl(endpoint, params = {}) {
  const base = `${WC_URL}/wp-json/cocart/v2/${endpoint.replace(/^\//, '')}`;
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

/**
 * Server-side fetch to CoCart using WooCommerce REST API keys (admin-level).
 * Used for session management, customer cart operations from the backend, etc.
 */
export async function cocartAdminFetch(endpoint, options = {}) {
  const url = cocartUrl(endpoint, options.params || {});
  const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Server-side fetch to CoCart using customer credentials (Basic Auth).
 * `identifier` can be username, email, or phone number.
 */
export async function cocartCustomerFetch(endpoint, identifier, password, options = {}) {
  const url = cocartUrl(endpoint, options.params || {});
  const auth = Buffer.from(`${identifier}:${password}`).toString('base64');

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Login a customer via CoCart's /login endpoint.
 * Returns user profile info on success.
 *
 * @param {string} username - Phone number, email, or username
 * @param {string} password - Account password
 */
export async function cocartLogin(username, password) {
  const url = cocartUrl('login');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: data.message || 'Login failed',
      code: data.code || 'unknown_error',
    };
  }

  return {
    ok: true,
    status: res.status,
    user: {
      id: data.user_id,
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      displayName: data.display_name || '',
      email: data.email || '',
      role: data.role || '',
    },
  };
}

/**
 * Get a customer's cart via CoCart.
 */
export async function cocartGetCart(identifier, password) {
  return cocartCustomerFetch('cart', identifier, password);
}

/**
 * Add an item to the cart via CoCart.
 */
export async function cocartAddItem(identifier, password, productId, quantity = 1) {
  return cocartCustomerFetch('cart/add-item', identifier, password, {
    method: 'POST',
    body: { id: String(productId), quantity: String(quantity) },
  });
}

/**
 * Server-side fetch to CoCart using a session cart_key (Guest carts).
 */
export async function cocartSessionFetch(endpoint, cartKey, options = {}) {
  try {
    const params = { ...options.params };
    if (cartKey) {
      params.cart_key = cartKey;
    }
    const url = cocartUrl(endpoint, params);

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('CoCart Session Fetch Error:', err?.message || err);
    return { ok: false, status: 500, data: { message: err?.message || 'Network error', items: [] } };
  }
}

