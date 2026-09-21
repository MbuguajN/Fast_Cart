import { NextResponse } from 'next/server';
import { getTradeProducts, updateTradeProduct, createTradeProduct, getInventoryLogs } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * Admin API for B2B trade product catalog and live inventory management.
 * Provides live stock levels, landed cost breakdown, tier price calculations
 * with override support, and inventory audit trail via PostgreSQL.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const logs = searchParams.get('logs');

    if (logs === 'true' && sku) {
      const inventoryLogs = await getInventoryLogs(sku, 50);
      return NextResponse.json({ success: true, logs: inventoryLogs });
    }

    const priceLine = searchParams.get('priceLine') || 'all';
    const search = searchParams.get('search') || '';

    const items = await getTradeProducts({ priceLine, search });

    const total = items.length;
    const spirits = items.filter((i) => i.priceLine === 'spirits').length;
    const jaba = items.filter((i) => i.priceLine === 'jaba').length;
    const missingCost = items.filter((i) => i.priceLine === 'spirits' && !i.hasExplicitCost).length;
    const lowStock = items.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= 10).length;
    const outOfStock = items.filter((i) => i.stockQuantity <= 0).length;

    return NextResponse.json({
      success: true,
      products: items.map((p) => ({
        ...p,
        cost: p.prkCostIncVat,
      })),
      counts: {
        total,
        spirits,
        jaba,
        missingCost,
        lowStock,
        outOfStock,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load trade products' }, { status: 500 });
  }
}

export async function PUT(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { sku, stockQuantity, reason, priceOverride, name, imageUrl, brand, categoryName, isActive } = body;

    if (!sku) {
      return NextResponse.json({ error: 'Product SKU or ID is required' }, { status: 400 });
    }

    const patch = {};
    if (stockQuantity !== undefined) {
      const qty = parseInt(stockQuantity, 10);
      if (isNaN(qty) || qty < 0) {
        return NextResponse.json({ error: 'Stock quantity must be a non-negative integer' }, { status: 400 });
      }
      patch.stockQuantity = qty;
    }
    if (reason) patch.reason = reason;
    if (name !== undefined) patch.name = name;
    if (imageUrl !== undefined) patch.imageUrl = imageUrl;
    if (brand !== undefined) patch.brand = brand;
    if (categoryName !== undefined) patch.categoryName = categoryName;
    if (isActive !== undefined) patch.isActive = isActive;

    let updated = null;
    if (Object.keys(patch).length > 0) {
      updated = await updateTradeProduct(sku, patch, 'Admin');
    }

    let overrideResult = null;
    if (priceOverride) {
      const { setPriceOverride, clearPriceOverride } = await import('@/lib/trade/trade-costing.js');
      const prodRes = await getTradeProducts({ search: sku });
      const product = prodRes.find((p) => p.sku === sku) || prodRes[0];
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (priceOverride.price === null || priceOverride.price === undefined) {
        await clearPriceOverride({ productId: product.id, tierKey: priceOverride.tierKey });
      } else {
        try {
          overrideResult = await setPriceOverride({
            productId: product.id,
            tierKey: priceOverride.tierKey,
            priceLine: product.priceLine,
            price: priceOverride.price,
            updatedBy: 'Admin',
          });
        } catch (overrideError) {
          return NextResponse.json({ error: overrideError.message }, { status: 400 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      product: updated,
      override: overrideResult,
      message: `Product ${sku} successfully updated`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update trade product' }, { status: 500 });
  }
}

/**
 * Adds a trade-only product — one that may have no retail counterpart at
 * all (see createTradeProduct). The admin UI's image field either uploads a
 * new file (via /api/admin/upload) or copies a URL borrowed from an
 * existing retail product; either way this route just stores whatever URL
 * it's given.
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const product = await createTradeProduct(body, 'Admin');

    return NextResponse.json({
      success: true,
      product,
      message: `Product ${product.sku} added to the trade catalogue`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create trade product' }, { status: 400 });
  }
}
