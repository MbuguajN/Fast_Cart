/**
 * WooCommerce webhook effect — extracted out of app/api/webhook/route.js so
 * both the live POST handler and the reconcile cron's retry pass (see
 * lib/webhook-store.js) can call the exact same logic. A route.js file is
 * meant to export HTTP method handlers, not be imported as a library module
 * from another route.
 */

import { upsertProduct, mutateStore, updateStore } from './data-store';
import { wcFetch } from './wc-config';
import { extractStockDelta, isDeletion } from './catalog-delta';
import { recordEvent, EVENT_KINDS, OUTCOMES } from './event-log';

async function fetchProduct(productId) {
  try {
    const { data } = await wcFetch(`products/${productId}`);
    return data;
  } catch (err) {
    console.error(`Webhook product fetch failed for ${productId}:`, err.message);
    return null;
  }
}

/**
 * Applies one webhook's effect to the cache. Throws on failure — unlike the
 * old inline version, which swallowed every error so a failure was
 * indistinguishable from success both to WooCommerce and to us. The caller
 * is what decides how a throw is recorded and whether it's retried; this
 * function only does the actual work.
 */
export async function processWebhookPayload(topic, body) {
  if (topic.startsWith('product.')) {
    const productId = body.id;
    if (!productId) return;

    if (isDeletion(topic)) {
      await mutateStore((store) => {
        store.products = (store.products || []).filter((p) => p.wcId !== productId);
      });
      recordEvent({ kind: EVENT_KINDS.WEBHOOK, outcome: OUTCOMES.OK, detail: `product ${productId} deleted` });
      return;
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
      return;
    }

    const wcProduct = await fetchProduct(productId);
    if (!wcProduct) {
      recordEvent({
        kind: EVENT_KINDS.WEBHOOK,
        outcome: OUTCOMES.FAIL,
        detail: `product ${productId} refetch failed`,
      });
      throw new Error(`Product ${productId} refetch failed`);
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
}
