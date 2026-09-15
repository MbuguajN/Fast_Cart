import { NextResponse } from 'next/server';
import { recordStockReceipt } from '@/lib/trade/trade-costing.js';
import { query, ensureTradeDb } from '@/lib/trade/trade-pg.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * GET  /api/admin/trade/stock-receipts — list recent receipts
 * POST /api/admin/trade/stock-receipts — record a new goods-received batch
 *
 * This replaces the old CSV cost-importer route (/api/admin/trade/costs).
 * Costs are now receipt-derived: each receipt records bottles received,
 * allocates logistics, and rolls the weighted-average landed cost forward
 * on each product. See lib/trade/trade-costing.js for the math.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    await ensureTradeDb();
    const res = await query(
      `SELECT r.*, COALESCE(json_agg(l.* ORDER BY l.id) FILTER (WHERE l.id IS NOT NULL), '[]') as lines
       FROM trade_stock_receipts r
       LEFT JOIN trade_stock_receipt_lines l ON l.receipt_id = r.id
       GROUP BY r.id ORDER BY r.received_at DESC LIMIT 50`
    );
    return NextResponse.json({ success: true, receipts: res.rows });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { supplierName, reference, freightCost, clearingCost, handlingCost, notes, lines } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one receipt line is required' }, { status: 400 });
    }

    const receipt = await recordStockReceipt({
      supplierName,
      reference,
      freightCost,
      clearingCost,
      handlingCost,
      notes,
      lines,
      createdBy: 'Admin',
    });

    return NextResponse.json({ success: true, receipt });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to record stock receipt' }, { status: 500 });
  }
}
