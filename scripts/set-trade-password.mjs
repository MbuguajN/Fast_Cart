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
 * Run this before exposing /trade to anyone: a seat with no password cannot
 * sign in, which is the intended failure mode but will lock out real users
 * until they are provisioned.
 */

import { readTradeStore, writeTradeStore } from '../lib/trade/trade-store.js';
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

/** Apply a hash directly, bypassing the async store lock for CLI simplicity. */
function persist(userId, passwordHash, mustChange) {
  const store = readTradeStore();
  const index = store.users.findIndex((u) => u.id === userId);
  if (index < 0) throw new Error(`User ${userId} vanished from the store`);

  store.users[index] = {
    ...store.users[index],
    passwordHash,
    mustChangePassword: mustChange,
    passwordUpdatedAt: new Date().toISOString(),
  };
  writeTradeStore(store);
  return store.users[index];
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
  persist(user.id, passwordHash, isGenerated);

  console.log(`  ✓ ${user.name} <${user.email || user.phone || user.id}>`);
  console.log(`    password: ${plaintext}${isGenerated ? '   (temporary — must be changed)' : ''}`);
  return true;
}

const store = readTradeStore();

if (args[0] === '--all') {
  const pending = (store.users || []).filter((u) => !hasPassword(u));

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
const clean = String(identifier).trim().toLowerCase();

const user = (store.users || []).find(
  (u) =>
    u.email?.toLowerCase() === clean ||
    u.phone?.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
    u.id === identifier
);

if (!user) {
  console.error(`No trade seat matches "${identifier}".`);
  console.error('Known seats:');
  for (const u of store.users || []) {
    console.error(`  ${u.id}  ${u.name}  <${u.email || u.phone || '—'}>`);
  }
  process.exit(1);
}

const success = await provision(user, password || null);
process.exit(success ? 0 : 1);
