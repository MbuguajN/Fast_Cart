import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeConfigPatch, publicCheckoutOptions } from '../lib/trade/trade-config.js';

const details = { bankName: 'Test Bank', accountName: 'Happy Hour Ltd', accountNumber: '12345' };

test('unknown keys are dropped', () => {
  const out = sanitizeConfigPatch({ evil: 1, minOrderBottles: 6 }, {});
  assert.deepEqual(out, { minOrderBottles: 6 });
});

test('accountManager passes through', () => {
  const am = { name: 'A', phone: '1' };
  assert.deepEqual(sanitizeConfigPatch({ accountManager: am }, {}), { accountManager: am });
});

test('stockHoldMinutes must be an integer from 1 to 1440', () => {
  for (const bad of [0, 1.5, 'abc', 5000, -3, null]) {
    assert.throws(() => sanitizeConfigPatch({ stockHoldMinutes: bad }, {}), /stockHoldMinutes/, String(bad));
  }
  assert.deepEqual(sanitizeConfigPatch({ stockHoldMinutes: 15 }, {}), { stockHoldMinutes: 15 });
  assert.deepEqual(sanitizeConfigPatch({ stockHoldMinutes: '30' }, {}), { stockHoldMinutes: 30 });
});

test('bank transfer cannot be enabled without details', () => {
  assert.throws(() => sanitizeConfigPatch({ bankTransfer: { enabled: true } }, {}), /bank/i);
  assert.throws(() => sanitizeConfigPatch({ bankTransfer: { enabled: true, bankName: 'X' } }, {}), /bank/i);
});

test('bank transfer can be enabled with details, merged over current config', () => {
  const current = { bankTransfer: { enabled: false, ...details } };
  const out = sanitizeConfigPatch({ bankTransfer: { enabled: true } }, current);
  assert.equal(out.bankTransfer.enabled, true);
  assert.equal(out.bankTransfer.accountNumber, '12345');
});

test('bank transfer can always be switched off', () => {
  const out = sanitizeConfigPatch({ bankTransfer: { enabled: false } }, {});
  assert.equal(out.bankTransfer.enabled, false);
});

test('bank detail strings are trimmed, tag-stripped and length-capped', () => {
  const out = sanitizeConfigPatch(
    { bankTransfer: { enabled: false, bankName: '  <b>Bank</b>  ', accountNumber: 'x'.repeat(500) } },
    {}
  );
  assert.equal(out.bankTransfer.bankName, 'bBank/b');
  assert.ok(out.bankTransfer.accountNumber.length <= 64);
});

test('public checkout options never leak other config or disabled bank details', () => {
  const cfg = { stockHoldMinutes: 20, gmFloorPercent: 4, bankTransfer: { enabled: false, ...details } };
  assert.deepEqual(publicCheckoutOptions(cfg), { stockHoldMinutes: 20, nirvanaContact: { name: '', phone: '', email: '' }, bankTransfer: { enabled: false } });
});

test('public checkout options default to 15 minutes and show details only when enabled', () => {
  assert.equal(publicCheckoutOptions({}).stockHoldMinutes, 15);
  const on = publicCheckoutOptions({ bankTransfer: { enabled: true, ...details, branch: 'CBD' } });
  assert.deepEqual(on.bankTransfer, { enabled: true, ...details, branch: 'CBD' });
});

test('nirvanaContact is allow-listed, cleaned, and exposed publicly', () => {
  const out = sanitizeConfigPatch({ nirvanaContact: { name: ' <i>Wanjiru</i> ', phone: '+254700', email: 'n@x.test', junk: 1 } }, {});
  assert.deepEqual(out.nirvanaContact, { name: 'iWanjiru/i', phone: '+254700', email: 'n@x.test' });
  assert.deepEqual(publicCheckoutOptions({ nirvanaContact: out.nirvanaContact }).nirvanaContact, out.nirvanaContact);
  assert.deepEqual(publicCheckoutOptions({}).nirvanaContact, { name: '', phone: '', email: '' });
});
