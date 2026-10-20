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

  let createdAccountId = null;

  const cleanup = async () => {
    if (createdAccountId) {
      await query('DELETE FROM trade_orders WHERE account_id = $1', [createdAccountId]);
      await query('DELETE FROM trade_users WHERE account_id = $1', [createdAccountId]);
      await query('DELETE FROM trade_accounts WHERE id = $1', [createdAccountId]);
    }
    const userRes = await query('SELECT account_id FROM trade_users WHERE email = $1', [testEmail]);
    for (const row of userRes.rows) {
      if (row.account_id) {
        await query('DELETE FROM trade_orders WHERE account_id = $1', [row.account_id]);
        await query('DELETE FROM trade_users WHERE account_id = $1', [row.account_id]);
        await query('DELETE FROM trade_accounts WHERE id = $1', [row.account_id]);
      }
    }
    await query('DELETE FROM trade_users WHERE email = $1', [testEmail]);
    await query("DELETE FROM kv_store WHERE key = $1 OR key LIKE 'ratelimit:%'", [`trade_signup_otp:${testEmail}`]);
  };

  // Clean any leftover test data
  await cleanup();

  try {
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

    // 2. Verify with invalid code -> should fail and increment attempt count
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

    const otpAfterFail = await kvGet(`trade_signup_otp:${testEmail}`);
    assert.equal(otpAfterFail.attempts, 1);

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

    createdAccountId = goodVerifyData.account.id;

    // Verify cookie set
    const setCookie = goodVerifyRes.headers.get('set-cookie');
    assert.ok(setCookie?.includes('trade_token'), 'Response must set trade_token cookie');
  } finally {
    // Guaranteed cleanup even on assertion failure
    await cleanup();
  }
});

test('Universal Signup flow: locks out challenge after 5 failed verification attempts', async () => {
  await ensureTradeDb();

  const testEmail = 'lockout.user@example.test';
  const testPhone = '0712999777';
  const testPass = 'SecurePassword123!';

  const cleanup = async () => {
    const userRes = await query('SELECT account_id FROM trade_users WHERE email = $1', [testEmail]);
    for (const row of userRes.rows) {
      if (row.account_id) {
        await query('DELETE FROM trade_orders WHERE account_id = $1', [row.account_id]);
        await query('DELETE FROM trade_users WHERE account_id = $1', [row.account_id]);
        await query('DELETE FROM trade_accounts WHERE id = $1', [row.account_id]);
      }
    }
    await query('DELETE FROM trade_users WHERE email = $1', [testEmail]);
    await query("DELETE FROM kv_store WHERE key = $1 OR key LIKE 'ratelimit:%'", [`trade_signup_otp:${testEmail}`]);
  };

  await cleanup();

  try {
    // Initiate signup
    const signupReq = new Request('http://localhost:3000/api/trade/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lockout Test Buyer',
        email: testEmail,
        phone: testPhone,
        password: testPass,
      }),
    });
    const signupRes = await signupPOST(signupReq);
    assert.equal(signupRes.status, 200);

    // 4 invalid attempts: should stay in KV with attempts 1..4
    for (let i = 1; i <= 4; i++) {
      const badReq = new Request('http://localhost:3000/api/trade/signup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, code: '000000' }),
      });
      const res = await verifyPOST(badReq);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /invalid or expired/i);
      const otp = await kvGet(`trade_signup_otp:${testEmail}`);
      assert.equal(otp.attempts, i);
    }

    // 5th invalid attempt: should delete key and return lockout error
    const fifthReq = new Request('http://localhost:3000/api/trade/signup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, code: '000000' }),
    });
    const fifthRes = await verifyPOST(fifthReq);
    assert.equal(fifthRes.status, 400);
    const fifthData = await fifthRes.json();
    assert.match(fifthData.error, /too many invalid verification attempts/i);

    const otpAfterLockout = await kvGet(`trade_signup_otp:${testEmail}`);
    assert.equal(otpAfterLockout, null, 'OTP should be deleted on lockout');
  } finally {
    await cleanup();
  }
});
