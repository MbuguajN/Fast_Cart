#!/usr/bin/env node
/**
 * Issue or reset a trade portal password from the command line.
 *
 *   node scripts/set-trade-password.mjs <identifier> [password]
 *   node scripts/set-trade-password.mjs --all
 *
 * `identifier` is the seat's email, phone or user ID. With no password, a
 * temporary one is generated and printed once. `--all` provisions every seat
 * that currently has no credential — use it to bring an existing store up to
 * date after the portal gained password authentication.
 *
 * Persists to BOTH PostgreSQL (`trade_users` table) and the JSON fallback store
 * so authentication succeeds regardless of storage driver.
 */

import {
  findTradeUserByIdentifier,
  setTradeUserPasswordHash,
  getTradeUsers,
  readTradeStore,
} from '../lib/trade/trade-store.js';
import { query, ensureTradeDb } from '../lib/trade/trade-pg.js';
import {
  hashPassword,
  generateTemporaryPassword,
  validatePasswordStrength,
  hasPassword,
} from '../lib/trade/trade-password.js';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  node scripts/set-trade-password.mjs <identifier> [password]
  node scripts/set-trade-password.mjs --all

  <identifier>   trade seat email, phone, or user ID
  [password]     optional; a temporary password is generated when omitted
  --all          provision every seat that has no password yet
`);
  process.exit(0);
}

async function provision(user, explicitPassword) {
  const isGenerated = !explicitPassword;
  const plaintext = isGenerated ? generateTemporaryPassword() : explicitPassword;

  const problem = validatePasswordStrength(plaintext);
  if (problem) {
    console.error(`  ✗ ${user.email || user.id}: ${problem}`);
    return false;
  }

  const passwordHash = await hashPassword(plaintext);
  await setTradeUserPasswordHash(user.id, passwordHash, { mustChange: isGenerated });

  console.log(`  ✓ ${user.name} <${user.email || user.phone || user.id}>`);
  console.log(`    password: ${plaintext}${isGenerated ? '   (temporary — must be changed)' : ''}`);
  return true;
}

if (args[0] === '--all') {
  await ensureTradeDb().catch(() => {});

  const allUsersMap = new Map();

  // 1. Fetch from PostgreSQL
  try {
    const res = await query('SELECT * FROM trade_users');
    for (const r of res.rows) {
      allUsersMap.set(r.id, {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        passwordHash: r.password_hash,
      });
    }
  } catch (err) {
    console.warn('Postgres users query failed, checking JSON store:', err.message);
  }

  // 2. Fetch from JSON store
  const store = readTradeStore();
  for (const u of store.users || []) {
    if (!allUsersMap.has(u.id)) {
      allUsersMap.set(u.id, u);
    } else {
      // If store has passwordHash but PG didn't, merge
      const existing = allUsersMap.get(u.id);
      if (!existing.passwordHash && u.passwordHash) {
        existing.passwordHash = u.passwordHash;
      }
    }
  }

  const pending = Array.from(allUsersMap.values()).filter((u) => !hasPassword(u));

  if (pending.length === 0) {
    console.log('Every trade seat already has a password. Nothing to do.');
    process.exit(0);
  }

  console.log(`Provisioning ${pending.length} seat(s) with no credential:\n`);
  let ok = 0;
  for (const user of pending) {
    if (await provision(user, null)) ok += 1;
  }
  console.log(`\nDone — ${ok}/${pending.length} provisioned.`);
  console.log('Pass these to the account holders over a channel you trust, then have them change the password.');
  process.exit(ok === pending.length ? 0 : 1);
}

const [identifier, password] = args;
const user = await findTradeUserByIdentifier(identifier);

if (!user) {
  console.error(`No trade seat matches "${identifier}".`);
  console.error('Known seats:');
  const all = await getTradeUsers();
  for (const u of all) {
    console.error(`  ${u.id}  ${u.name}  <${u.email || u.phone || '—'}>`);
  }
  process.exit(1);
}

const success = await provision(user, password || null);
process.exit(success ? 0 : 1);
