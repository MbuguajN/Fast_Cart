import { NextResponse } from 'next/server';
import { getTradeProducts } from '@/lib/trade/trade-store.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * GET /api/admin/trade/stock/export
 *
 * Streams a CSV of the full trade product catalogue: SKU, name, price line,
 * case size, landed cost (prk_cost_inc_vat), product cost component,
 * logistics cost component, live stock, reserved stock, T1/T2/T3 suggested
 * prices, and the current T1/T2/T3 actual prices (which may differ from
 * suggested if a price override is in force).
 *
 * Designed to round-trip with the bulk-import endpoint:
 *   columns sku, cases, unit_product_cost_inc_vat are all you need to import.
 *
 * Query params:
 *   priceLine=spirits|jaba|all  (default: all)
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const priceLine = searchParams.get('priceLine') || 'all';

    const products = await getTradeProducts({ priceLine });

    const headers = [
      'sku',
      'name',
      'price_line',
      'case_size',
      'landed_cost_inc_vat',
      'product_cost_inc_vat',
      'logistics_cost_inc_vat',
      'stock_quantity',
      'reserved_stock',
      // Suggested (engine-derived) prices
      'T1_suggested',
      'T2_suggested',
      'T3_suggested',
      // Actual prices (may be overridden)
      'T1_actual',
      'T2_actual',
      'T3_actual',
      // Override flag
      'T1_override',
      'T2_override',
      'T3_override',
    ];

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = products.map((p) => {
      const tp = p.tierPrices || {};
      return [
        p.sku,
        p.name,
        p.priceLine,
        p.caseSize ?? 12,
        p.prkCostIncVat ?? '',
        p.productCostIncVat ?? '',
        p.logisticsCostIncVat ?? 0,
        p.stockQuantity ?? 0,
        p.reservedStock ?? 0,
        tp.T1?.suggested ?? '',
        tp.T2?.suggested ?? '',
        tp.T3?.suggested ?? '',
        tp.T1?.actual ?? '',
        tp.T2?.actual ?? '',
        tp.T3?.actual ?? '',
        tp.T1?.overrideApplied ? 'yes' : 'no',
        tp.T2?.overrideApplied ? 'yes' : 'no',
        tp.T3?.overrideApplied ? 'yes' : 'no',
      ].map(escape).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const date = new Date().toISOString().split('T')[0];
    const filename = `hh-trade-stock-${priceLine}-${date}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
