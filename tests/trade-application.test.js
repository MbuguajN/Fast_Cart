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
