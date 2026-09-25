#!/usr/bin/env node
/**
 * Production auth diagnostics — run on the server to identify login failures.
 *
 *   node scripts/diagnose-auth.mjs
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

console.log('\n========================================');
console.log('  FAST CART AUTH DIAGNOSTICS');
console.log('========================================\n');

// ── 1. Environment check ────────────────────────────────────────────────
console.log('1. ENVIRONMENT VARIABLES\n');
const checks = {
  DATABASE_URL: DATABASE_URL ? `✅ Set (${DATABASE_URL.replace(/:[^@]+@/, ':***@')})` : '❌ MISSING',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ? `✅ ${process.env.ADMIN_EMAIL}` : '❌ MISSING',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? `✅ Set (${process.env.ADMIN_PASSWORD.length} chars)` : '❌ MISSING',
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET ? `✅ Set (${process.env.ADMIN_JWT_SECRET.length} chars)` : '❌ MISSING — tokens cannot be signed!',
  TRADE_JWT_SECRET: process.env.TRADE_JWT_SECRET ? `✅ Set (${process.env.TRADE_JWT_SECRET.length} chars)` : '❌ MISSING — trade tokens cannot be signed!',
  WOOCOMMERCE_STORE_URL: process.env.WOOCOMMERCE_STORE_URL || '❌ MISSING',
  WOOCOMMERCE_CONSUMER_KEY: process.env.WOOCOMMERCE_CONSUMER_KEY ? `✅ ${process.env.WOOCOMMERCE_CONSUMER_KEY.slice(0, 8)}...` : '❌ MISSING',
  WOOCOMMERCE_CONSUMER_SECRET: process.env.WOOCOMMERCE_CONSUMER_SECRET ? `✅ Set` : '❌ MISSING',
  NODE_ENV: process.env.NODE_ENV || '(not explicitly set — Next.js sets it automatically)',
};

for (const [key, val] of Object.entries(checks)) {
  console.log(`  ${key}: ${val}`);
}

// ── 2. Database connection ──────────────────────────────────────────────
console.log('\n2. DATABASE CONNECTION\n');

let pg;
try {
  pg = (await import('pg')).default;
} catch (e) {
  console.log('  ❌ pg module not found:', e.message);
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
});

try {
  const res = await pool.query('SELECT NOW() AS now');
  console.log(`  ✅ Connected — server time: ${res.rows[0].now}`);
} catch (err) {
  console.log(`  ❌ Connection FAILED: ${err.message}`);
  console.log('  → Check DATABASE_URL in .env.local');
  process.exit(1);
}

// ── 3. Trade users and password hashes ──────────────────────────────────
console.log('\n3. TRADE USERS IN DATABASE\n');

try {
  const res = await pool.query(`
    SELECT id, email, 
           LENGTH(password_hash) AS hash_len,
           SUBSTRING(password_hash, 1, 20) AS hash_prefix,
           password_hash LIKE 'scrypt$%' AS valid_format,
           must_change_password,
           failed_attempts,
           locked_until
    FROM trade_users
    ORDER BY id
  `);

  for (const row of res.rows) {
    const lockStatus = row.locked_until && new Date(row.locked_until) > new Date()
      ? `🔒 LOCKED until ${row.locked_until}`
      : '🔓 Unlocked';
    console.log(`  ${row.id}`);
    console.log(`    Email: ${row.email}`);
    console.log(`    Hash: ${row.valid_format ? '✅' : '❌'} format, ${row.hash_len} chars (${row.hash_prefix}...)`);
    console.log(`    Status: ${lockStatus} | Failed attempts: ${row.failed_attempts || 0}`);
    console.log('');
  }
} catch (err) {
  console.log(`  ❌ Query failed: ${err.message}`);
}

// ── 4. Test password verification against first user ────────────────────
console.log('4. PASSWORD VERIFICATION TEST\n');

try {
  const res = await pool.query(`SELECT id, email, password_hash FROM trade_users WHERE password_hash IS NOT NULL LIMIT 1`);
  if (res.rows.length === 0) {
    console.log('  ❌ No users with passwords found');
  } else {
    const user = res.rows[0];
    const stored = user.password_hash;
    const testPassword = 'HappyHour2026!';

    console.log(`  Testing "${testPassword}" against ${user.email}...`);

    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      console.log(`  ❌ Hash format invalid: ${parts.length} parts, prefix="${parts[0]}"`);
    } else {
      const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
      const N = parseInt(nRaw); const r = parseInt(rRaw); const p = parseInt(pRaw);

      const salt = Buffer.from(saltB64, 'base64');
      const expected = Buffer.from(hashB64, 'base64');

      const derived = await new Promise((resolve, reject) => {
        crypto.scrypt(testPassword, salt, expected.length,
          { N, r, p, maxmem: 128 * N * r * 2 },
          (err, key) => err ? reject(err) : resolve(key)
        );
      });

      const match = crypto.timingSafeEqual(derived, expected);
      console.log(`  ${match ? '✅ Password MATCHES' : '❌ Password DOES NOT MATCH'}`);
      if (!match) {
        console.log('  → The seed data password may have been changed. Run:');
        console.log('    node scripts/set-trade-password.mjs angela.mutua@serenahotels.com HappyHour2026!');
      }
    }
  }
} catch (err) {
  console.log(`  ❌ Verification test failed: ${err.message}`);
}

// ── 5. Rate limiter state ───────────────────────────────────────────────
console.log('\n5. RATE LIMITER STATE (kv_store)\n');

try {
  const res = await pool.query(`
    SELECT key, expires_at, expires_at > NOW() AS active
    FROM kv_store
    WHERE key LIKE 'rl:%' OR key LIKE 'rate:%' OR key LIKE 'trade-login:%'
    ORDER BY expires_at DESC
    LIMIT 20
  `);

  if (res.rows.length === 0) {
    console.log('  ✅ No rate-limit entries (clean slate)');
  } else {
    for (const row of res.rows) {
      console.log(`  ${row.active ? '⚠️  ACTIVE' : '✅ Expired'} | ${row.key} | expires: ${row.expires_at}`);
    }
    console.log('\n  → To clear all rate limits:');
    console.log("    psql -d fastcart_trade -c \"DELETE FROM kv_store;\"");
  }
} catch (err) {
  console.log(`  ❌ Query failed: ${err.message}`);
}

// ── 6. WooCommerce API connectivity ─────────────────────────────────────
console.log('\n6. WOOCOMMERCE API CONNECTIVITY\n');

const wcUrl = process.env.WOOCOMMERCE_STORE_URL;
const ck = process.env.WOOCOMMERCE_CONSUMER_KEY;
const cs = process.env.WOOCOMMERCE_CONSUMER_SECRET;

if (!wcUrl || !ck || !cs) {
  console.log('  ❌ WooCommerce credentials not configured');
} else {
  try {
    const auth = Buffer.from(`${ck}:${cs}`).toString('base64');
    const res = await fetch(`${wcUrl}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ Connected to WooCommerce ${data.environment?.version || 'unknown'}`);
      console.log(`  Store: ${data.environment?.site_url || wcUrl}`);
    } else {
      const body = await res.text();
      console.log(`  ❌ API returned ${res.status}: ${body.slice(0, 200)}`);
      if (res.status === 401) {
        console.log('  → Consumer key/secret are invalid or revoked');
      } else if (res.status === 404) {
        console.log('  → REST API may be disabled or URL is wrong');
      }
    }
  } catch (err) {
    console.log(`  ❌ Connection FAILED: ${err.message}`);
    console.log('  → Server cannot reach WooCommerce. Check DNS/firewall.');
  }
}

console.log('\n========================================');
console.log('  DIAGNOSTICS COMPLETE');
console.log('========================================\n');

await pool.end();
