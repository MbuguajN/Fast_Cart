import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTradeDb, query } from '../lib/trade/trade-pg.js';

test('B2B costing schema exists after ensureTradeDb', async () => {
  await ensureTradeDb();

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'trade_products'
       AND column_name IN ('case_size', 'product_cost_inc_vat', 'logistics_cost_inc_vat')`
  );
  assert.equal(cols.rows.length, 3, 'trade_products should have the three new costing columns');

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_name IN ('trade_stock_receipts', 'trade_stock_receipt_lines', 'trade_price_overrides')`
  );
  assert.equal(tables.rows.length, 3, 'all three new tables should exist');

  const seq = await query(`SELECT nextval('trade_receipt_seq') as seq`);
  assert.ok(Number(seq.rows[0].seq) >= 1);
});

test('backfill sets product_cost_inc_vat from prk_cost_inc_vat where present', async () => {
  await ensureTradeDb();
  // Any product migrated from the legacy JSON store with a nonzero cost
  // must have been backfilled — product_cost_inc_vat is never left NULL
  // once prk_cost_inc_vat > 0.
  const res = await query(
    `SELECT COUNT(*) FROM trade_products WHERE prk_cost_inc_vat > 0 AND product_cost_inc_vat IS NULL`
  );
  assert.equal(Number(res.rows[0].count), 0);
});
