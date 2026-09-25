#!/usr/bin/env node
/**
 * Reset trade portal passwords directly in PostgreSQL.
 *
 *   node scripts/reset-trade-passwords.mjs                     # reset ALL users
 *   node scripts/reset-trade-passwords.mjs user@example.com    # reset one user
 *   node scripts/reset-trade-passwords.mjs user@example.com MyPassword123!
 *
 * Unlike set-trade-password.mjs (which writes to JSON), this updates Postgres
 * directly — matching where the production login route actually reads from.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
});

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64, saltBytes: 16 };
const MAX_MEMORY = 128 * SCRYPT.N * SCRYPT.r * 2;
const MIN_PASSWORD_LENGTH = 12;

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT.keyLength,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAX_MEMORY },
      (err, key) => err ? reject(err) : resolve(key)
    );
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SCRYPT.saltBytes);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

function generateTempPassword() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let chunk = '';
    for (let i = 0; i < 4; i++) chunk += alpha[crypto.randomInt(0, alpha.length)];
    groups.push(chunk);
  }
  return groups.join('-');
}

const args = process.argv.slice(2);

if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  node scripts/reset-trade-passwords.mjs                       Reset ALL trade users
  node scripts/reset-trade-passwords.mjs <email>               Reset one user (temp password)
  node scripts/reset-trade-passwords.mjs <email> <password>    Reset one user (explicit password)
`);
  process.exit(0);
}

try {
  await pool.query('SELECT 1');
  console.log('✅ Connected to PostgreSQL\n');
} catch (err) {
  console.error('❌ Cannot connect to PostgreSQL:', err.message);
  process.exit(1);
}

if (args.length === 0) {
  // Reset ALL users
  const res = await pool.query('SELECT id, name, email FROM trade_users ORDER BY id');
  console.log(`Resetting passwords for ${res.rows.length} trade user(s):\n`);

  for (const user of res.rows) {
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    await pool.query(
      'UPDATE trade_users SET password_hash = $1, must_change_password = TRUE WHERE id = $2',
      [hash, user.id]
    );
    console.log(`  ✓ ${user.name} <${user.email}>`);
    console.log(`    password: ${tempPassword}   (temporary — must be changed)`);
    console.log('');
  }

  console.log('Done. Distribute these passwords over a trusted channel.');
} else {
  // Reset one user
  const [emailOrId, explicitPassword] = args;
  const clean = emailOrId.trim().toLowerCase();

  const res = await pool.query(
    'SELECT id, name, email FROM trade_users WHERE LOWER(email) = $1 OR id = $2 LIMIT 1',
    [clean, emailOrId]
  );

  if (res.rows.length === 0) {
    console.error(`❌ No trade user found matching "${emailOrId}"`);
    const all = await pool.query('SELECT id, name, email FROM trade_users ORDER BY id');
    console.log('\nKnown users:');
    for (const u of all.rows) console.log(`  ${u.id}  ${u.name}  <${u.email}>`);
    process.exit(1);
  }

  const user = res.rows[0];
  const isGenerated = !explicitPassword;
  const plaintext = isGenerated ? generateTempPassword() : explicitPassword;

  if (plaintext.length < MIN_PASSWORD_LENGTH) {
    console.error(`❌ Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    process.exit(1);
  }

  const hash = await hashPassword(plaintext);
  await pool.query(
    'UPDATE trade_users SET password_hash = $1, must_change_password = $2 WHERE id = $3',
    [hash, isGenerated, user.id]
  );

  console.log(`✓ ${user.name} <${user.email}>`);
  console.log(`  password: ${plaintext}${isGenerated ? '   (temporary — must be changed)' : ''}`);
}

await pool.end();
