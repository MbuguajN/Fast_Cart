import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { getPgPool, ensureTradeDb } from '../lib/trade/trade-pg.js';

/**
 * Every process runs the schema script once. `ALTER TABLE … ADD COLUMN IF NOT
 * EXISTS` takes an ACCESS EXCLUSIVE lock even when the column exists, so a
 * server starting while an order transaction is open (or two processes
 * starting together) stalled, and everything queued behind it stalled too.
 * Once the schema is current, startup must not touch it.
 */
test('starting a process does not block behind an open order transaction', async () => {
  await ensureTradeDb(); // make sure the schema is fully applied first
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM trade_accounts LIMIT 1 FOR UPDATE');

    const child = spawn(
      process.execPath,
      ['-e', "import('./lib/trade/trade-pg.js').then((m) => m.ensureTradeDb()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })"],
      { cwd: process.cwd(), stdio: 'ignore' }
    );
    const outcome = await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve('blocked'); }, 15000);
      child.on('exit', (code) => { clearTimeout(timer); resolve(code === 0 ? 'ok' : `exit ${code}`); });
    });
    assert.equal(outcome, 'ok', 'schema init blocked on a table lock');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
