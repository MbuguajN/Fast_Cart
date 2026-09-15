import { NextResponse } from 'next/server';
import { getTradeProducts, updateTradeProduct, getInventoryLogs } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * Admin API for B2B trade product catalog and live inventory management.
 * Provides live stock levels, PRK cost configuration, tier price calculations,
 * and inventory audit trail via PostgreSQL.
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
    const { sku, stockQuantity, prkCostIncVat, reason } = body;

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

    if (prkCostIncVat !== undefined) {
      const cost = Number(prkCostIncVat);
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json({ error: 'Cost must be a non-negative number' }, { status: 400 });
      }
      patch.prkCostIncVat = cost;
    }

    if (reason) {
      patch.reason = reason;
    }

    const updated = await updateTradeProduct(sku, patch, 'Admin');

    return NextResponse.json({
      success: true,
      product: updated,
      message: `Product ${sku} successfully updated`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update trade product' }, { status: 500 });
  }
}
