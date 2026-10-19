import test, { after } from 'node:test';
import assert from 'node:assert/strict';

// Ensure signing secret exists in test environment
if (!process.env.TRADE_JWT_SECRET) {
  process.env.TRADE_JWT_SECRET = 'test_trade_secret_key_with_at_least_32_bytes_of_random_data_for_unit_tests';
}

import { query, ensureTradeDb, getPgPool } from '../lib/trade/trade-pg.js';
import { kvGet } from '../lib/kv-store.js';
import { POST as signupPOST } from '../app/api/trade/signup/route.js';
import { POST as verifyPOST } from '../app/api/trade/signup/verify/route.js';

after(async () => {
  const pool = getPgPool();
  if (pool) await pool.end();
});

test('Universal Signup flow: initiates OTP, verifies code, creates active individual trade account', async () => {
  await ensureTradeDb();

  const testEmail = 'test.signup.user@example.test';
  const testPhone = '0712999888';
  const testPass = 'SecurePassword123!';

  // Clean any leftover test data
  await query('DELETE FROM trade_users WHERE email = $1', [testEmail]);

  // 1. Initiate signup
  const signupReq = new Request('http://localhost:3000/api/trade/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Signup Buyer',
      email: testEmail,
      phone: testPhone,
      password: testPass,
    }),
  });

  const signupRes = await signupPOST(signupReq);
  const signupData = await signupRes.json();
  assert.equal(signupRes.status, 200);
  assert.equal(signupData.success, true);

  // Retrieve OTP code from kv_store
  const storedOtp = await kvGet(`trade_signup_otp:${testEmail}`);
  assert.ok(storedOtp, 'OTP payload should be stored in kv_store');
  assert.equal(typeof storedOtp.code, 'string');
  assert.equal(storedOtp.code.length, 6);

  // 2. Verify with invalid code -> should fail
  const badVerifyReq = new Request('http://localhost:3000/api/trade/signup/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '000000',
    }),
  });
  const badVerifyRes = await verifyPOST(badVerifyReq);
  assert.equal(badVerifyRes.status, 400);

  // 3. Verify with correct code -> should succeed
  const goodVerifyReq = new Request('http://localhost:3000/api/trade/signup/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: storedOtp.code,
    }),
  });
  const goodVerifyRes = await verifyPOST(goodVerifyReq);
  const goodVerifyData = await goodVerifyRes.json();

  assert.equal(goodVerifyRes.status, 200);
  assert.equal(goodVerifyData.success, true);
  assert.equal(goodVerifyData.account.segment, 'individual');
  assert.equal(goodVerifyData.account.isGuest, false);
  assert.equal(goodVerifyData.account.status, 'active');

  // Verify cookie set
  const setCookie = goodVerifyRes.headers.get('set-cookie');
  assert.ok(setCookie?.includes('trade_token'), 'Response must set trade_token cookie');

  // Cleanup
  await query('DELETE FROM trade_users WHERE email = $1', [testEmail]);
  await query('DELETE FROM trade_accounts WHERE id = $1', [goodVerifyData.account.id]);
});
