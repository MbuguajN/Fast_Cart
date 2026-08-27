import { NextResponse } from 'next/server';
import { getProducts, upsertProduct, WOOCOMMERCE_OWNED_FIELDS } from '@/lib/data-store';
import { wcPut } from '@/lib/wc-config';
import { adminGuard } from '@/lib/api-guard';
import { timed, EVENT_KINDS } from '@/lib/event-log';

/**
 * Admin product editing.
 *
 * Commerce fields are written through to WooCommerce before the cache is
 * touched. Previously an admin stock edit was written only locally, where
 * the next sync overwrote it — so the edit was neither durable nor visible
 * to the system of record.
 */

/** Local field name -> WooCommerce REST field name. */
const WC_FIELD_MAP = {
  name: 'name',
  price: 'regular_price',
  regularPrice: 'regular_price',
  salePrice: 'sale_price',
  stockStatus: 'stock_status',
  stockQuantity: 'stock_quantity',
  sku: 'sku',
};

export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const products = getProducts();
  return NextResponse.json(products);
}

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const data = await request.json();
    const { wcId, overrides, ...updates } = data;

    if (!wcId) {
      return NextResponse.json({ error: 'wcId is required' }, { status: 400 });
    }

    // Presentation-only edits stay local; nothing to push.
    if (overrides && Object.keys(updates).length === 0) {
      return NextResponse.json(upsertProduct({ wcId, overrides }));
    }

    const rejected = Object.keys(updates).filter(
      (k) => WOOCOMMERCE_OWNED_FIELDS.includes(k) && WC_FIELD_MAP[k] === undefined
    );
    if (rejected.length) {
      return NextResponse.json(
        { error: `Edit these in WooCommerce: ${rejected.join(', ')}` },
        { status: 400 }
      );
    }

    const wcPayload = {};
    for (const [local, remote] of Object.entries(WC_FIELD_MAP)) {
      if (updates[local] !== undefined) wcPayload[remote] = updates[local];
    }
    if (wcPayload.stock_quantity !== undefined) {
      wcPayload.stock_quantity = Number(wcPayload.stock_quantity);
      wcPayload.manage_stock = true;
    }

    // Write through first. Updating the cache before WooCommerce confirms
    // would show admin a value the source of truth never accepted.
    if (Object.keys(wcPayload).length > 0) {
      try {
        const confirmed = await timed(
          EVENT_KINDS.WC_CALL,
          () => wcPut(`products/${wcId}`, wcPayload),
          `product ${wcId} write-through`
        );

        const saved = upsertProduct({
          wcId,
          price: confirmed.price ?? confirmed.regular_price,
          regularPrice: confirmed.regular_price,
          salePrice: confirmed.sale_price,
          stockStatus: confirmed.stock_status,
          stockQuantity: confirmed.stock_quantity,
          name: confirmed.name,
          sku: confirmed.sku,
          ...(overrides ? { overrides } : {}),
        });

        return NextResponse.json(saved);
      } catch (err) {
        console.error('Product write-through failed:', err.message);
        return NextResponse.json(
          { error: 'WooCommerce rejected the change. Nothing was saved.' },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(upsertProduct({ wcId, ...(overrides ? { overrides } : {}) }));
  } catch (error) {
    console.error('Admin product update failed:', error.message);
    return NextResponse.json({ error: 'Could not update the product' }, { status: 500 });
  }
}
