const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;

export async function fetchProducts(categoryId = null) {
  let url = `${WC_URL}/wp-json/wc/v3/products?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}&per_page=50&status=publish`;
  if (categoryId) {
    url += `&category=${categoryId}`;
  }
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function fetchCategories() {
  const url = `${WC_URL}/wp-json/wc/v3/products/categories?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}&per_page=20`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function createOrder({ cart, paymentMethod, locationData, customerId, customerNote }) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart, paymentMethod, locationData, customerId, customerNote }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to create order');
  }

  return data;
}
