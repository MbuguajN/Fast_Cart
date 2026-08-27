/**
 * Regression tests for the security remediation.
 *
 * Each test pins a specific defect that was found in the audit, so a future
 * refactor that reintroduces one fails here rather than in production.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Signing secrets must exist before the token module resolves them.
process.env.ADMIN_JWT_SECRET ||= 'test-admin-secret-that-is-long-enough-000000';
process.env.TRADE_JWT_SECRET ||= 'test-trade-secret-that-is-long-enough-000000';
process.env.CUSTOMER_SESSION_SECRET ||= 'test-customer-secret-that-is-long-enough-000';

const { signToken, verifyToken, readCookie, timingSafeEquals, AUDIENCE } =
  await import('../lib/crypto-tokens.js');
const { hashPassword, verifyPassword, hasPassword, validatePasswordStrength, generateTemporaryPassword } =
  await import('../lib/trade/trade-password.js');

/* ── F-08: token forgery, audience confusion, secret hygiene ─────────── */

test('a valid token round-trips and carries its claims', async () => {
  const token = await signToken(AUDIENCE.CUSTOMER, { customerId: 42, phone: '712345678' }, 60_000);
  const payload = await verifyToken(AUDIENCE.CUSTOMER, token);

  assert.equal(payload.customerId, 42);
  assert.equal(payload.phone, '712345678');
  assert.equal(payload.aud, AUDIENCE.CUSTOMER);
});

test('a tampered payload is rejected', async () => {
  const token = await signToken(AUDIENCE.CUSTOMER, { customerId: 42 }, 60_000);
  const [header, , signature] = token.split('.');

  // Re-encode the body claiming to be a different customer.
  const forgedBody = Buffer.from(JSON.stringify({
    customerId: 999,
    aud: AUDIENCE.CUSTOMER,
    iat: Date.now(),
    exp: Date.now() + 60_000,
  })).toString('base64url');

  assert.equal(await verifyToken(AUDIENCE.CUSTOMER, `${header}.${forgedBody}.${signature}`), null);
});

test('an admin token cannot be replayed as a trade or customer token', async () => {
  const adminToken = await signToken(AUDIENCE.ADMIN, { email: 'a@b.c' }, 60_000);

  assert.ok(await verifyToken(AUDIENCE.ADMIN, adminToken), 'valid for its own audience');
  assert.equal(await verifyToken(AUDIENCE.TRADE, adminToken), null);
  assert.equal(await verifyToken(AUDIENCE.CUSTOMER, adminToken), null);
});

test('an expired token is rejected', async () => {
  const token = await signToken(AUDIENCE.CUSTOMER, { customerId: 1 }, -1000);
  assert.equal(await verifyToken(AUDIENCE.CUSTOMER, token), null);
});

test('malformed tokens are rejected without throwing', async () => {
  for (const bad of ['', 'not-a-token', 'a.b', 'a.b.c.d', null, undefined, 123, {}]) {
    assert.equal(await verifyToken(AUDIENCE.CUSTOMER, bad), null);
  }
});

test('a missing signing secret raises rather than falling back', async () => {
  const saved = process.env.ADMIN_JWT_SECRET;
  delete process.env.ADMIN_JWT_SECRET;
  try {
    await assert.rejects(
      () => signToken(AUDIENCE.ADMIN, {}, 1000),
      /Missing signing secret/,
      'must not sign with a hardcoded default'
    );
  } finally {
    process.env.ADMIN_JWT_SECRET = saved;
  }
});

test('a too-short signing secret is refused', async () => {
  const saved = process.env.ADMIN_JWT_SECRET;
  process.env.ADMIN_JWT_SECRET = 'short';
  try {
    await assert.rejects(() => signToken(AUDIENCE.ADMIN, {}, 1000), /too short/);
  } finally {
    process.env.ADMIN_JWT_SECRET = saved;
  }
});

/* ── F-21: cookie parsing must be exact, not a substring match ───────── */

test('readCookie matches the cookie name exactly', () => {
  const request = {
    headers: {
      get: () => 'x_admin_token=attacker; other=1; admin_token=genuine; trailing=2',
    },
  };

  assert.equal(readCookie(request, 'admin_token'), 'genuine');
  assert.equal(readCookie(request, 'nope'), null);
});

test('readCookie does not match a name that is a suffix of another cookie', () => {
  const request = { headers: { get: () => 'evil_admin_token=attacker' } };
  assert.equal(readCookie(request, 'admin_token'), null);
});

test('timingSafeEquals compares content, including on length mismatch', () => {
  assert.equal(timingSafeEquals('abc', 'abc'), true);
  assert.equal(timingSafeEquals('abc', 'abd'), false);
  assert.equal(timingSafeEquals('abc', 'abcd'), false);
  assert.equal(timingSafeEquals('', ''), true);
});

/* ── F-02: trade seats need a real, verifiable credential ────────────── */

test('a password verifies against its own hash and nothing else', async () => {
  const hash = await hashPassword('correct-horse-battery');

  assert.ok(hash.startsWith('scrypt$'), 'stored in the documented format');
  assert.ok(!hash.includes('correct-horse-battery'), 'plaintext never stored');

  assert.equal(await verifyPassword('correct-horse-battery', hash), true);
  assert.equal(await verifyPassword('correct-horse-batterz', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('the same password hashes differently each time (per-user salt)', async () => {
  const a = await hashPassword('correct-horse-battery');
  const b = await hashPassword('correct-horse-battery');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('correct-horse-battery', a), true);
  assert.equal(await verifyPassword('correct-horse-battery', b), true);
});

test('verifyPassword rejects malformed or missing hashes without throwing', async () => {
  for (const bad of [null, undefined, '', 'plaintext', 'scrypt$bad', 'md5$1$2$3$4$5']) {
    assert.equal(await verifyPassword('anything', bad), false);
  }
});

test('a seat with no password hash cannot authenticate', () => {
  assert.equal(hasPassword({ id: 'usr_1', name: 'Angela' }), false);
  assert.equal(hasPassword({ passwordHash: '' }), false);
  assert.equal(hasPassword({ passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==' }), true);
});

test('weak passwords are refused', () => {
  assert.ok(validatePasswordStrength('short'));
  assert.ok(validatePasswordStrength('123456789012'), 'digits only');
  assert.ok(validatePasswordStrength('aaaaaaaaaaaa'), 'single repeated character');
  assert.equal(validatePasswordStrength('a-reasonable-passphrase'), null);
});

test('generated temporary passwords meet the strength policy', () => {
  for (let i = 0; i < 20; i++) {
    const pw = generateTemporaryPassword();
    assert.equal(validatePasswordStrength(pw), null, `rejected: ${pw}`);
  }
});

/* ── F-07: OTP codes must come from the CSPRNG ───────────────────────── */

test('OTP codes are six digits and do not repeat across issues', async () => {
  const { createOtp } = await import('../lib/otp-store.js');

  const codes = new Set();
  for (let i = 0; i < 25; i++) {
    // A fresh identity each time, to sidestep the resend cooldown.
    const result = await createOtp(`07${String(10000000 + i)}`);
    assert.ok(result.success, result.error);
    assert.match(result.code, /^\d{6}$/);
    codes.add(result.code);
  }

  // 25 draws from 900k values colliding more than once would indicate the
  // generator is not behaving randomly.
  assert.ok(codes.size >= 24, `expected near-unique codes, got ${codes.size}/25`);
});

test('a wrong OTP is rejected and the right one is single-use', async () => {
  const { createOtp, verifyOtp } = await import('../lib/otp-store.js');

  const phone = '0798765432';
  const { code } = await createOtp(phone);

  const wrong = await verifyOtp(phone, '000000');
  assert.equal(wrong.valid, false);

  const right = await verifyOtp(phone, code);
  assert.equal(right.valid, true);

  const replay = await verifyOtp(phone, code);
  assert.equal(replay.valid, false, 'a consumed code must not verify twice');
});

test('OTP attempts are capped', async () => {
  const { createOtp, verifyOtp } = await import('../lib/otp-store.js');

  const phone = '0711111111';
  await createOtp(phone);

  await verifyOtp(phone, '000000');
  await verifyOtp(phone, '000001');
  const third = await verifyOtp(phone, '000002');

  assert.equal(third.valid, false);
  assert.ok(third.locked, 'the code should be destroyed after repeated failures');
});

test('phone-keyed and challenge-keyed OTPs occupy separate namespaces', async () => {
  const { createOtp, verifyOtp } = await import('../lib/otp-store.js');

  const phone = '0722222222';
  const challenge = 'email-change:722222222:new@example.com';

  const phoneOtp = await createOtp(phone);
  const challengeOtp = await createOtp(challenge);

  // A login code must not satisfy an email-change challenge.
  const crossed = await verifyOtp(challenge, phoneOtp.code);
  assert.equal(crossed.valid, false);

  const correct = await verifyOtp(challenge, challengeOtp.code);
  assert.equal(correct.valid, true);
});

/* ── F-09: the delivery fee is priced by the server ──────────────────── */

test('an unknown address still carries the standard delivery fee', async () => {
  const { resolveDeliveryFee, DEFAULT_ZONE_PRICE } = await import('../lib/shipping.js');

  const result = resolveDeliveryFee({ zoneName: '', address: 'somewhere unmatched xyzzy' });

  assert.equal(result.matched, false);
  assert.equal(result.fee, DEFAULT_ZONE_PRICE);
  assert.ok(result.fee > 0, 'an unmatched address must never be free delivery');
});

test('a known address resolves to its zone price', async () => {
  const { resolveDeliveryFee } = await import('../lib/shipping.js');

  const result = resolveDeliveryFee({ zoneName: '', address: 'Karen Hardy shopping centre' });

  assert.equal(result.matched, true);
  assert.ok(result.fee > 0);
  assert.ok(result.zoneName, 'the matched zone is reported back');
});

test('the delivery fee ignores any amount supplied by the caller', async () => {
  const { resolveDeliveryFee } = await import('../lib/shipping.js');

  // Whatever a client sends, only zoneName and address are read.
  const result = resolveDeliveryFee({
    zoneName: 'Karen',
    address: 'Karen',
    fee: 0,
    deliveryFee: 0,
    price: -9999,
  });

  assert.ok(result.fee > 0, 'a client-supplied zero must not survive');
  assert.equal(typeof result.fee, 'number');
});
