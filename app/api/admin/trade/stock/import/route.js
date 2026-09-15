import { NextResponse } from 'next/server';
import { recordStockReceipt } from '@/lib/trade/trade-costing.js';
import { query, ensureTradeDb } from '@/lib/trade/trade-pg.js';
import { adminGuard } from '@/lib/api-guard';

/**
 * POST /api/admin/trade/stock/import
 *
 * Bulk stock receipt via CSV upload. Accepts multipart/form-data with:
 *   - file: the CSV file
 *   - supplierName (optional form field)
 *   - reference (optional form field)
 *   - freightCost (optional form field, KES)
 *   - clearingCost (optional form field, KES)
 *   - handlingCost (optional form field, KES)
 *   - notes (optional form field)
 *   - dryRun: 'true' | 'false' — if true, parse and validate but don't persist
 *
 * CSV format (header row required):
 *   sku, cases, unit_product_cost_inc_vat
 *
 * Extra columns (e.g. name, stock_quantity from the export) are silently ignored,
 * so the exported CSV can be re-imported directly after editing the cost column.
 *
 * Example:
 *   sku,cases,unit_product_cost_inc_vat
 *   jameson-original-750ml,10,2950
 *   tanqueray-london-dry-gin-1l,5,3100
 *
 * Returns on dry run:
 *   { dryRun: true, parsed: [ { sku, cases, unitProductCost, bottles, product } ] }
 *
 * Returns on commit:
 *   { success: true, receipt: { receiptNumber, lines: [...] } }
 */
export async function POST(request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'A CSV file is required (form field: file)' }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = parseCsv(csvText);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows — at least one product line is required' }, { status: 400 });
    }

    // Validate SKUs exist in the trade catalogue
    await ensureTradeDb();
    const skus = [...new Set(parsed.map((r) => r.sku))];
    const existing = await query('SELECT id, sku, case_size FROM trade_products WHERE sku = ANY($1)', [skus]);
    const bySku = new Map(existing.rows.map((r) => [r.sku, r]));
    const unknownSkus = skus.filter((s) => !bySku.has(s));

    if (unknownSkus.length > 0) {
      return NextResponse.json({
        error: `Unknown SKU(s): ${unknownSkus.join(', ')} — check spelling or ensure the product exists in the trade catalogue`,
      }, { status: 400 });
    }

    // Enrich parsed lines with case size / bottle count for the preview
    const lines = parsed.map((row) => {
      const product = bySku.get(row.sku);
      const caseSize = product?.case_size || 12;
      return {
        sku: row.sku,
        cases: row.cases,
        unitProductCost: row.unitProductCost,
        bottles: Math.round(row.cases * caseSize),
      };
    });

    const supplierName = formData.get('supplierName') || '';
    const reference = formData.get('reference') || '';
    const freightCost = Number(formData.get('freightCost') || 0);
    const clearingCost = Number(formData.get('clearingCost') || 0);
    const handlingCost = Number(formData.get('handlingCost') || 0);
    const notes = formData.get('notes') || '';
    const dryRun = formData.get('dryRun') === 'true';

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        rowCount: lines.length,
        totalBottles: lines.reduce((s, l) => s + l.bottles, 0),
        totalLogistics: freightCost + clearingCost + handlingCost,
        parsed: lines,
      });
    }

    const receipt = await recordStockReceipt({
      supplierName,
      reference,
      freightCost,
      clearingCost,
      handlingCost,
      notes,
      lines: lines.map((l) => ({ sku: l.sku, cases: l.cases, unitProductCost: l.unitProductCost })),
      createdBy: 'Admin (bulk import)',
    });

    return NextResponse.json({ success: true, receipt });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}

/**
 * Parses a CSV string into an array of { sku, cases, unitProductCost }.
 * Expects a header row; the three required columns may appear in any order
 * and alongside extra columns (e.g. from the export CSV).
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));

  const skuIdx = headers.indexOf('sku');
  const casesIdx = headers.indexOf('cases');
  // Accept either column name for backward compat
  const costIdx = headers.indexOf('unit_product_cost_inc_vat') !== -1
    ? headers.indexOf('unit_product_cost_inc_vat')
    : headers.indexOf('unit_product_cost');

  if (skuIdx === -1 || casesIdx === -1 || costIdx === -1) {
    throw new Error(
      'CSV must have columns: sku, cases, unit_product_cost_inc_vat — ' +
      `found headers: ${headers.join(', ')}`
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    const sku = cells[skuIdx]?.trim();
    const cases = Number(cells[casesIdx]);
    const unitProductCost = Number(cells[costIdx]);

    if (!sku) continue; // skip blank rows
    if (isNaN(cases) || cases <= 0) throw new Error(`Row ${i + 1}: "cases" must be a positive number (got "${cells[casesIdx]}")`);
    if (isNaN(unitProductCost) || unitProductCost <= 0) throw new Error(`Row ${i + 1}: "unit_product_cost_inc_vat" must be a positive number (got "${cells[costIdx]}")`);

    rows.push({ sku, cases, unitProductCost });
  }
  return rows;
}

/** Simple CSV row splitter that handles quoted fields with embedded commas. */
function splitCsvRow(row) {
  const cells = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
