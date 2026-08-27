import { NextResponse } from 'next/server';
import { upsertProduct, mutateStore, updateStore } from '@/lib/data-store';
import { wcFetch, WC_WEBHOOK_SECRET } from '@/lib/wc-config';
import { extractStockDelta, isDeletion } from '@/lib/catalog-delta';
import { recordEvent, EVENT_KINDS, OUTCOMES } from '@/lib/event-log';
import crypto from 'crypto';

/**
 * Verify a WooCommerce webhook signature over the RAW request body.
 *
 * WooCommerce sends base64-encoded HMAC-SHA256 of the exact bytes it posted.
 * Hashing a re-serialised `JSON.stringify(parsedBody)` changes those bytes —
 * whitespace, unicode escaping and numeric formatting all shift — so valid
 * deliveries were being rejected.
 */
function verifyWebhook(request, rawBody) {
  if (!WC_WEBHOOK_SECRET) {
    console.error('WC webhook secret not configured — rejecting request');
    return false;
  }

  const signature = request.headers.get('x-wc-webhook-signature');
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', WC_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Check length before timingSafeEqual, which throws on a mismatch.
  if (expected.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

async function fetchProduct(productId) {
  try {
    const { data } = await wcFetch(`products/${productId}`);
    return data;
  } catch (err) {
    console.error(`Webhook product fetch failed for ${productId}:`, err.message);
    return null;
  }
}

export async function POST(request) {
  // Raw bytes first — the signature is computed over exactly what was sent.
  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (!verifyWebhook(request, rawBody)) {
    recordEvent({
      kind: EVENT_KINDS.WEBHOOK,
      outcome: OUTCOMES.FAIL,
      detail: 'signature verification failed',
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const topic = request.headers.get('x-wc-webhook-topic') || '';

    if (topic.startsWith('product.')) {
      const productId = body.id;
      if (!productId) {
        return NextResponse.json({ received: true });
      }

      if (isDeletion(topic)) {
        await mutateStore((store) => {
          store.products = (store.products || []).filter((p) => p.wcId !== productId);
        });
        recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.OK, detail: `product ${productId} deleted` });
        return NextResponse.json({ received: true });
      }

      // The webhook payload already carries price and stock, so a stock
      // change lands in the cache without a round trip back to the origin.
      // Only fall back to fetching when the payload is too thin to use.
      const delta = extractStockDelta(body);
      if (delta && delta.stockStatus) {
        upsertProduct(delta);
        recordEvent({
          kind: EVENT_KINDS.WEBHOOK,
          outcome: OUTCOMES.OK,
          detail: `product ${productId} -> ${delta.stockStatus}`,
        });
        updateStore({ lastSync: new Date().toISOString() });
        return NextResponse.json({ received: true });
      }

      const wcProduct = await fetchProduct(productId);
      if (!wcProduct) {
        recordEvent({
          kind: EVENT_KINDS.WEBHOOK,
          outcome: OUTCOMES.FAIL,
          detail: `product ${productId} refetch failed`,
        });
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

      recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.OK, detail: `product ${productId} refetched` });
      updateStore({ lastSync: new Date().toISOString() });
    }

    if (topic === 'order.created' || topic === 'order.completed') {
      // Under the store lock: two concurrent orders would otherwise each read
      // the same starting quantity and one decrement would be lost.
      await mutateStore((store) => {
        for (const item of body.line_items || []) {
          const prod = store.products.find((p) => p.wcId === item.product_id);
          if (prod && prod.stockQuantity !== null) {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - (item.quantity || 1));
            if (prod.stockQuantity <= 0) {
              prod.stockStatus = 'outofstock';
            }
          }
        }
      });
      updateStore({ lastSync: new Date().toISOString() });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error');
    return NextResponse.json({ received: true });
  }
}
