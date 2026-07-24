import { NextResponse } from 'next/server';
import { upsertProduct, readStore, writeStore, updateStore } from '@/lib/data-store';

const WC_URL = process.env.NEXT_PUBLIC_WOOCOMMERCE_URL;
const WC_KEY = process.env.NEXT_PUBLIC_WOOCOMMERCE_KEY;
const WC_SECRET = process.env.NEXT_PUBLIC_WOOCOMMERCE_SECRET;
const WEBHOOK_SECRET = process.env.WOO_WEBHOOK_SECRET || '';

function verifyWebhook(request) {
  if (!WEBHOOK_SECRET) return true;
  const signature = request.headers.get('x-wc-webhook-signature');
  // In production, verify HMAC-SHA256 signature
  return !!signature;
}

async function fetchProduct(productId) {
  const url = `${WC_URL}/wp-json/wc/v3/products/${productId}?consumer_key=${WC_KEY}&consumer_secret=${WC_SECRET}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request) {
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const topic = request.headers.get('x-wc-webhook-topic') || '';
    const body = await request.json();

    if (topic.startsWith('product.')) {
      const productId = body.id;
      if (!productId) {
        return NextResponse.json({ received: true });
      }

      const wcProduct = await fetchProduct(productId);
      if (!wcProduct) {
        return NextResponse.json({ received: true });
      }

      const primaryImage = wcProduct.images?.[0]?.src || '';
      const brandAttr = wcProduct.attributes?.find(
        (a) => a.name.toLowerCase() === 'brand' || a.name.toLowerCase() === 'manufacturer'
      );
      const brandName = brandAttr?.options?.[0] || '';

      upsertProduct({
        wcId: wcProduct.id,
        name: wcProduct.name,
        slug: wcProduct.slug,
        price: wcProduct.price || wcProduct.regular_price,
        regularPrice: wcProduct.regular_price,
        salePrice: wcProduct.sale_price,
        stockStatus: wcProduct.stock_status,
        stockQuantity: wcProduct.stock_quantity,
        image: primaryImage,
        images: (wcProduct.images || []).map((img) => img.src),
        categoryId: wcProduct.categories?.[0]?.id || null,
        categoryName: wcProduct.categories?.[0]?.name || '',
        brandId: brandName ? `brand_${brandName.toLowerCase().replace(/\s+/g, '_')}` : null,
        brandName,
        description: wcProduct.description || '',
        shortDescription: wcProduct.short_description || '',
        sku: wcProduct.sku || '',
        weight: wcProduct.weight || '',
      });

      updateStore({ lastSync: new Date().toISOString() });
    }

    if (topic.startsWith('order.')) {
      if (topic === 'order.created' || topic === 'order.completed') {
        const store = readStore();
        const lineItems = body.line_items || [];
        for (const item of lineItems) {
          const prod = store.products.find((p) => p.wcId === item.product_id);
          if (prod && prod.stockQuantity !== null) {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - (item.quantity || 1));
            if (prod.stockQuantity <= 0) {
              prod.stockStatus = 'outofstock';
            }
          }
        }
        writeStore(store);
        updateStore({ lastSync: new Date().toISOString() });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true });
  }
}
