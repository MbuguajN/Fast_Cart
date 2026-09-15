import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/api-guard';

/**
 * GET /api/admin/trade/stock/import/template
 *
 * Returns a CSV template for the bulk stock import.
 * Includes a header row and one example row so operators
 * know exactly what format to use.
 */
export async function GET(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const csv = [
    'sku,cases,unit_product_cost_inc_vat',
    '# Replace the example rows below with your actual data.',
    '# sku: the product slug (e.g. jameson-original-750ml)',
    '# cases: number of cases received (e.g. 10)',
    '# unit_product_cost_inc_vat: cost per BOTTLE, inc-VAT (e.g. 2950)',
    'jameson-original-750ml,10,2950',
    'tanqueray-london-dry-gin-1l,5,3100',
  ].join('\n');

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hh-import-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
