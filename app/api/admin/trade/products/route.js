import { NextResponse } from 'next/server';
import { getTradeProducts, updateTradeProduct, getInventoryLogs } from '@/lib/trade/trade-store.js';
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
    const { sku, stockQuantity, reason, priceOverride } = body;

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
