#!/usr/bin/env node
/**
 * scripts/deduplicate-trade-accounts.mjs
 *
 * Scans PostgreSQL trade_accounts for duplicate records sharing identical
 * KRA PINs or trading names (excluding guest accounts).
 *
 * For each duplicate group, elects the primary surviving account
 * (active accounts prioritized, followed by earliest creation date),
 * reassigns all trade_users, trade_orders, and trade_quotes to the
 * surviving account, and deletes the duplicate account records inside
 * a single database transaction.
 *
 * Usage:
 *   node scripts/deduplicate-trade-accounts.mjs
 *   node scripts/deduplicate-trade-accounts.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ensureTradeDb, getPgPool, withTransaction } from '../lib/trade/trade-pg.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

if (fs.existsSync(path.join(rootDir, '.env'))) {
  dotenv.config({ path: path.join(rootDir, '.env') });
}
if (fs.existsSync(path.join(rootDir, '.env.local'))) {
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });
}

export async function deduplicateTradeAccounts({ dryRun = false, logger = console } = {}) {
  await ensureTradeDb();

  let mergedAccountsCount = 0;
  let reassignedUsersCount = 0;
  let reassignedOrdersCount = 0;
  let reassignedQuotesCount = 0;
  const auditLog = [];

  try {
    await withTransaction(async (client) => {
      async function mergeAccount(primaryId, duplicateId, reason) {
        if (primaryId === duplicateId) return;

        // Fetch primary and duplicate account details
        const primRes = await client.query('SELECT id, trading_name, kra_pin, licence_no FROM trade_accounts WHERE id = $1', [primaryId]);
        const dupRes = await client.query('SELECT id, trading_name, kra_pin, licence_no FROM trade_accounts WHERE id = $1', [duplicateId]);
        if (primRes.rows.length === 0 || dupRes.rows.length === 0) return;

        const primary = primRes.rows[0];
        const duplicate = dupRes.rows[0];

        // Backfill any missing fields on primary from duplicate
        const patchPin = (!primary.kra_pin || !primary.kra_pin.trim()) && duplicate.kra_pin ? duplicate.kra_pin : null;
        const patchLic = (!primary.licence_no || !primary.licence_no.trim()) && duplicate.licence_no ? duplicate.licence_no : null;
        if (patchPin || patchLic) {
          await client.query(
            `UPDATE trade_accounts
             SET kra_pin = COALESCE(NULLIF(kra_pin, ''), $1),
                 licence_no = COALESCE(NULLIF(licence_no, ''), $2),
                 updated_at = NOW()
             WHERE id = $3`,
            [patchPin, patchLic, primaryId]
          );
        }

        // Reassign users (seats)
        const userRes = await client.query(
          'UPDATE trade_users SET account_id = $1 WHERE account_id = $2',
          [primaryId, duplicateId]
        );
        reassignedUsersCount += userRes.rowCount;

        // Reassign orders
        const orderRes = await client.query(
          'UPDATE trade_orders SET account_id = $1, account_name = $2 WHERE account_id = $3',
          [primaryId, primary.trading_name, duplicateId]
        );
        reassignedOrdersCount += orderRes.rowCount;

        // Reassign quotes
        const quoteRes = await client.query(
          'UPDATE trade_quotes SET account_id = $1, account_name = $2 WHERE account_id = $3',
          [primaryId, primary.trading_name, duplicateId]
        );
        reassignedQuotesCount += quoteRes.rowCount;

        // Delete duplicate account row
        await client.query('DELETE FROM trade_accounts WHERE id = $1', [duplicateId]);
        mergedAccountsCount++;

        const entry = {
          reason,
          primaryId,
          primaryName: primary.trading_name,
          duplicateId,
          duplicateName: duplicate.trading_name,
          usersReassigned: userRes.rowCount,
          ordersReassigned: orderRes.rowCount,
          quotesReassigned: quoteRes.rowCount,
        };
        auditLog.push(entry);
        logger.log(
          `Merged duplicate account "${duplicate.trading_name}" (${duplicateId}) into "${primary.trading_name}" (${primaryId}) ` +
          `[reason: ${reason}] -> ${userRes.rowCount} users, ${orderRes.rowCount} orders, ${quoteRes.rowCount} quotes reassigned.`
        );
      }

      // Pass 1: Find duplicate KRA PINs
      const kraDuplicates = await client.query(`
        SELECT LOWER(TRIM(kra_pin)) as pin,
               array_agg(id ORDER BY (CASE WHEN status = 'active' THEN 0 ELSE 1 END), created_at ASC, id ASC) as ids
        FROM trade_accounts
        WHERE kra_pin IS NOT NULL AND TRIM(kra_pin) <> ''
        GROUP BY LOWER(TRIM(kra_pin))
        HAVING count(*) > 1
      `);

      for (const row of kraDuplicates.rows) {
        const ids = row.ids;
        const primaryId = ids[0];
        for (let i = 1; i < ids.length; i++) {
          await mergeAccount(primaryId, ids[i], `duplicate KRA PIN: ${row.pin}`);
        }
      }

      // Pass 2: Find duplicate non-guest trading names
      const nameDuplicates = await client.query(`
        SELECT LOWER(TRIM(trading_name)) as name,
               array_agg(id ORDER BY (CASE WHEN status = 'active' THEN 0 ELSE 1 END), created_at ASC, id ASC) as ids
        FROM trade_accounts
        WHERE (is_guest IS FALSE OR is_guest IS NULL)
          AND trading_name IS NOT NULL
          AND TRIM(trading_name) <> ''
        GROUP BY LOWER(TRIM(trading_name))
        HAVING count(*) > 1
      `);

      for (const row of nameDuplicates.rows) {
        const ids = row.ids;
        // Verify which IDs still exist in the database (they may have been merged in Pass 1)
        const validRes = await client.query(
          `SELECT id FROM trade_accounts
           WHERE id = ANY($1)
           ORDER BY (CASE WHEN status = 'active' THEN 0 ELSE 1 END), created_at ASC, id ASC`,
          [ids]
        );
        const validIds = validRes.rows.map((r) => r.id);
        if (validIds.length > 1) {
          const primaryId = validIds[0];
          for (let i = 1; i < validIds.length; i++) {
            await mergeAccount(primaryId, validIds[i], `duplicate trading name: ${row.name}`);
          }
        }
      }

      if (dryRun) {
        logger.log(`[DRY RUN] Deduplication preview completed. Rolling back transaction.`);
        throw new Error('ROLLBACK_DRY_RUN');
      }
    });
  } catch (err) {
    if (err.message === 'ROLLBACK_DRY_RUN') {
      return {
        dryRun: true,
        mergedAccountsCount,
        reassignedUsersCount,
        reassignedOrdersCount,
        reassignedQuotesCount,
        auditLog,
      };
    }
    throw err;
  }

  return {
    dryRun: false,
    mergedAccountsCount,
    reassignedUsersCount,
    reassignedOrdersCount,
    reassignedQuotesCount,
    auditLog,
  };
}

// Direct execution from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`--- Fast Cart Trade Account Deduplication ---`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database changes will be committed)' : 'LIVE EXECUTION'}`);

  try {
    const result = await deduplicateTradeAccounts({ dryRun, logger: console });
    console.log('\n--- Deduplication Summary ---');
    console.log(`Accounts merged & removed: ${result.mergedAccountsCount}`);
    console.log(`Users reassigned:           ${result.reassignedUsersCount}`);
    console.log(`Orders reassigned:          ${result.reassignedOrdersCount}`);
    console.log(`Quotes reassigned:          ${result.reassignedQuotesCount}`);
    console.log('✓ Finished successfully.');
  } catch (err) {
    console.error('✗ Deduplication failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    try {
      const pool = getPgPool();
      if (pool) {
        await pool.end();
      }
    } catch {
      // ignore on exit
    }
  }
}
