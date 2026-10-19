#!/usr/bin/env node
/**
 * Standalone migration runner for Fast Cart / Happy Hour B2B.
 *
 * Runs `ensureTradeDb()` to apply PostgreSQL schema migrations,
 * table creations, sentinel checks, and backfills, then closes
 * the database connection pool cleanly.
 *
 * Usage:
 *   node scripts/migrate.mjs
 *   or: npm run migrate
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load .env and .env.local if present
if (fs.existsSync(path.join(rootDir, '.env'))) {
  dotenv.config({ path: path.join(rootDir, '.env') });
}
if (fs.existsSync(path.join(rootDir, '.env.local'))) {
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });
}

import { ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';

async function runMigrations() {
  console.log('--- Fast Cart Database Migration ---');
  console.log(`Database target: ${process.env.DATABASE_URL ? 'DATABASE_URL is set' : 'Default local socket / connection'}`);

  try {
    const startTime = Date.now();
    await ensureTradeDb();
    const duration = Date.now() - startTime;
    console.log(`✓ Schema & migrations successfully applied (${duration}ms).`);
  } catch (err) {
    console.error('✗ Migration error:', err.message || err);
    process.exitCode = 1;
  } finally {
    try {
      const pool = getPgPool();
      if (pool) {
        await pool.end();
      }
    } catch {
      // ignore pool close errors on exit
    }
  }
}

runMigrations();

