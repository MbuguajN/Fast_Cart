import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure signing secret exists in test environment
process.env.TRADE_JWT_SECRET = 'test_trade_secret_key_with_at_least_32_bytes_of_random_data_for_unit_tests';
process.env.CUSTOMER_SESSION_SECRET = 'test_customer_secret_key_with_at_least_32_bytes_of_random_data_for_unit_tests';

import { generatePasswordResetEmailHtml } from '../lib/trade/trade-documents.js';
import { signToken, verifyToken, AUDIENCE } from '../lib/crypto-tokens.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../lib/trade/trade-password.js';
import {
  findTradeUserByIdentifier,
  setTradeUserPasswordHash,
  getTradeAccounts,
  syncTradeUserToPg,
} from '../lib/trade/trade-store.js';

test('email templates: generatePasswordResetEmailHtml includes portal branding and reset link', () => {
  const html = generatePasswordResetEmailHtml({
    user: {
      name: 'James Mwangi',
      email: 'james@serena.co.ke',
    },
    resetUrl: 'https://app.myhappyhour.co.ke/trade/reset-password?token=test_reset_token_xyz',
    expiresInMinutes: 30,
  });

  assert.ok(html.includes('HAPPY HOUR B2B BUSINESS PORTAL'), 'Must include portal branding');
  assert.ok(html.includes('Password Reset Request'), 'Must state email purpose');
  assert.ok(html.includes('James Mwangi'), 'Must include user name');
  assert.ok(html.includes('test_reset_token_xyz'), 'Must include the reset token URL');
  assert.ok(html.includes('30 minutes'), 'Must state expiration period');
});

test('crypto tokens: sign and verify trade password reset token', async () => {
  const payload = {
    userId: 'usr_serena_owner',
    email: 'angela.mutua@serenahotels.com',
    purpose: 'pwd_reset',
  };

  const token = await signToken(AUDIENCE.TRADE, payload, 30 * 60 * 1000);
  assert.ok(token && typeof token === 'string', 'Token must be generated');

  const verified = await verifyToken(AUDIENCE.TRADE, token);
  assert.ok(verified, 'Token must verify successfully');
  assert.equal(verified.userId, payload.userId);
  assert.equal(verified.email, payload.email);
  assert.equal(verified.purpose, 'pwd_reset');

  // Must reject wrong audience
  const wrongAudience = await verifyToken(AUDIENCE.CUSTOMER, token);
  assert.equal(wrongAudience, null, 'Token should fail verification for wrong audience');
});

test('password policies: validatePasswordStrength enforces 12 characters minimum and rejects weak passwords', () => {
  assert.ok(validatePasswordStrength('short123!'), 'Must reject passwords shorter than 12 chars');
  assert.ok(validatePasswordStrength('123456789012'), 'Must reject all-numeric passwords');
  assert.ok(validatePasswordStrength('aaaaaaaaaaaa'), 'Must reject repeated character passwords');

  const valid = validatePasswordStrength('HappyHourSecure2026!');
  assert.equal(valid, null, 'Must accept strong 12+ character password');
});

test('password hashing: scrypt hash and verify workflow', async () => {
  const plain = 'StrongPortalPassword2026#';
  const hashed = await hashPassword(plain);
  assert.ok(hashed && hashed.startsWith('scrypt$'), 'Hash must use scrypt format');

  const matches = await verifyPassword(plain, hashed);
  assert.equal(matches, true, 'Correct password must verify');

  const wrongMatches = await verifyPassword('IncorrectPassword123!', hashed);
  assert.equal(wrongMatches, false, 'Wrong password must fail verification');
});

test('e2e user management: update password hash and verify authentication cycle', async () => {
  const accounts = await getTradeAccounts();
  const testAccount = accounts.find((a) => a.status === 'active') || accounts[0];
  assert.ok(testAccount, 'Requires at least one account');

  const userEmail = `pwd_reset_test_${Date.now()}@myhappyhour.co.ke`;
  const initialUser = {
    id: `usr_pwd_test_${Date.now()}`,
    accountId: testAccount.id,
    name: 'Reset Test User',
    email: userEmail,
    phone: '0711999888',
    role: 'Procurement Specialist',
    seatType: 'buyer',
  };

  await syncTradeUserToPg(initialUser);

  // Set new password
  const newPassword = 'NewSecretPassword2026!';
  const newHash = await hashPassword(newPassword);
  await setTradeUserPasswordHash(initialUser.id, newHash, { mustChange: false });

  // Re-fetch user and verify credential
  const updatedUser = await findTradeUserByIdentifier(userEmail);
  assert.ok(updatedUser, 'User must be found after password update');
  assert.ok(updatedUser.passwordHash, 'User must have password hash saved');

  const valid = await verifyPassword(newPassword, updatedUser.passwordHash);
  assert.equal(valid, true, 'Updated password must verify against stored hash');

  const invalid = await verifyPassword('OldOrWrongPassword123!', updatedUser.passwordHash);
  assert.equal(invalid, false, 'Wrong password must fail verification');
});

test('password verification: hasPassword and verifyPassword handle scrypt and fallback credentials', async () => {
  const { hasPassword, verifyPassword } = await import('../lib/trade/trade-password.js');

  // hasPassword checks
  assert.equal(hasPassword({ passwordHash: null }), false, 'Null password is not set');
  assert.equal(hasPassword({ passwordHash: '' }), false, 'Empty string password is not set');
  assert.equal(hasPassword({ passwordHash: '   ' }), false, 'Whitespace-only password is not set');
  assert.equal(hasPassword({ passwordHash: 'scrypt$16384$8$1$salt$hash' }), true, 'scrypt hash is set');
  assert.equal(hasPassword({ passwordHash: 'PlaintextPassword123!' }), true, 'Plaintext string is recognized as set');

  // Plaintext verification
  const plainMatch = await verifyPassword('PlaintextPassword123!', 'PlaintextPassword123!');
  assert.equal(plainMatch, true, 'Matching plaintext credential verifies');

  const plainMismatch = await verifyPassword('WrongPassword123!', 'PlaintextPassword123!');
  assert.equal(plainMismatch, false, 'Mismatched plaintext credential fails verification');
});

test('proxy authorization gate: password reset and licence upload endpoints must remain public/pre-auth', async () => {
  const { proxy } = await import('../proxy.js');

  const testPublicPaths = [
    '/api/trade/password/reset-request',
    '/api/trade/password/verify-token',
    '/api/trade/password/reset',
    '/api/trade/apply/upload',
    '/api/trade/auth',
    '/api/trade/catalog',
  ];

  for (const pathname of testPublicPaths) {
    const fakeReq = {
      nextUrl: { pathname },
      headers: new Headers(),
    };
    const res = await proxy(fakeReq);
    assert.ok(res, `Proxy must return a response for ${pathname}`);
    assert.notEqual(res.status, 401, `Path ${pathname} must not be blocked with 401`);
  }

  // Protected trade endpoints without token must be blocked with 401
  const protectedPaths = [
    '/api/trade/password',
    '/api/trade/orders',
    '/api/trade/invoices/123',
  ];

  for (const pathname of protectedPaths) {
    const fakeReq = {
      nextUrl: { pathname },
      headers: new Headers(),
      cookies: { get: () => undefined },
    };
    const res = await proxy(fakeReq);
    assert.equal(res.status, 401, `Protected path ${pathname} must be blocked with 401 without session`);
  }
});


