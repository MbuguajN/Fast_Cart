import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanApplication } from '../lib/trade/trade-application.js';

const base = { tradingName: 'Acme Ltd', contactName: 'Jo', email: 'Jo@Acme.test ', phone: ' 0700000000 ' };

test('required fields are enforced and values trimmed', () => {
  assert.throws(() => cleanApplication({ ...base, tradingName: '' }), /required/i);
  const out = cleanApplication(base);
  assert.equal(out.email, 'jo@acme.test');
  assert.equal(out.phone, '0700000000');
});

test('a malformed email is rejected', () => {
  assert.throws(() => cleanApplication({ ...base, email: 'not-an-email' }), /email/i);
});

test('licence document URL must be one of our own uploads', () => {
  for (const bad of ['javascript:alert(1)', 'https://evil.test/x.pdf', '//evil.test/x', '/uploads/trade/licences/../../secret.pdf', '/etc/passwd']) {
    assert.throws(() => cleanApplication({ ...base, licenceDocumentUrl: bad }), /licence/i, bad);
  }
  const ok = cleanApplication({ ...base, licenceDocumentUrl: '/uploads/trade/licences/licence_1_ab12.pdf' });
  assert.equal(ok.licenceDocumentUrl, '/uploads/trade/licences/licence_1_ab12.pdf');
});

test('long text fields are capped and angle brackets stripped', () => {
  const out = cleanApplication({ ...base, tradingName: '<b>' + 'x'.repeat(1000) });
  assert.ok(out.tradingName.length <= 120);
  assert.ok(!out.tradingName.includes('<'));
});

test('privileged fields cannot be set by an applicant', () => {
  const out = cleanApplication({
    ...base,
    id: 'acc_serena_01',
    creditEnabled: true,
    creditLimit: 9999999,
    creditTerms: 90,
    tierOverride: 'T3',
    priceBook: 'vip',
    orderCeiling: 1,
    skipTerms: true,
    accountManager: { name: 'Mallory' },
    addresses: [{ id: 'x', addressLine: 'elsewhere' }],
    status: 'active',
    isGuest: true,
    referralCredit: 100000,
    cleanOrders: 50,
  });
  for (const key of ['id', 'creditEnabled', 'creditLimit', 'creditTerms', 'tierOverride', 'priceBook', 'orderCeiling', 'skipTerms', 'accountManager', 'addresses', 'status', 'isGuest', 'referralCredit', 'cleanOrders']) {
    assert.ok(!(key in out), `${key} must be dropped`);
  }
});

test('the fields the application form sends are kept', () => {
  const out = cleanApplication({
    ...base, legalName: 'Acme Holdings', segment: 'horeca', role: 'Owner', kraPin: 'P051123456Z',
    licenceNo: 'LQ-1', licenceExpiry: '2027-01-01', deliveryAddress: '1 Road', city: 'Nairobi',
    deliveryWindow: '08:00 - 12:00 EAT', estimatedMonthlyCases: '10-25', termsAccepted: true,
  });
  assert.equal(out.legalName, 'Acme Holdings');
  assert.equal(out.kraPin, 'P051123456Z');
  assert.equal(out.estimatedMonthlyCases, '10-25');
  assert.equal(out.termsAccepted, true);
});
