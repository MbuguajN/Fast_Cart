import { wcUrl, wcFetch, wcFetchAll } from './wc-config.js';

export async function fetchProducts(categoryId = null) {
  const params = { per_page: '50', status: 'publish' };
  if (categoryId) params.category = categoryId;
  const { data } = await wcFetch('products', params);
  return data;
}

export async function fetchCategories() {
  const { data } = await wcFetch('products/categories', { per_page: '20' });
  return data;
}

export async function fetchZones() {
  const zones = await wcFetchAll('shipping/zones');
  return zones.filter((z) => z.name !== 'Locations not covered by your other zones');
}

export async function createOrder({ cart, paymentMethod, locationData, customerId, customerNote, email }) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart, paymentMethod, locationData, customerId, customerNote, email }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to create order');
  }

  return data;
}
