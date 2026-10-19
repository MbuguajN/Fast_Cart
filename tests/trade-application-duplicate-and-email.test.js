import test from 'node:test';
import assert from 'node:assert/strict';
import { generateApplicationReceivedEmailHtml } from '../lib/trade/trade-documents.js';
import { syncTradeUserToPg, getTradeAccounts } from '../lib/trade/trade-store.js';

test('email templates: generateApplicationReceivedEmailHtml includes verification badge and portal branding', () => {
  const html = generateApplicationReceivedEmailHtml({
    id: 'acc_test_99',
    tradingName: 'Savannah Lounge',
    contactName: 'Brian Kiprop',
    role: 'Operations Director',
    email: 'brian@savannah.co.ke',
    phone: '0711223344',
    segment: 'horeca',
    kraPin: 'P051234567A',
    licenceNo: 'LQ-2026-99',
  });

  assert.ok(html.includes('HAPPY HOUR B2B BUSINESS PORTAL'), 'Must have updated B2B Portal branding');
  assert.ok(html.includes('✓ Email Verified: brian@savannah.co.ke'), 'Must include email verification badge');
  assert.ok(html.includes('Savannah Lounge'), 'Must include trading entity name');
  assert.ok(html.includes('Brian Kiprop'), 'Must include primary contact');
  assert.ok(html.includes('Under Compliance Review'), 'Must clearly state review status');
});

test('duplicate user handling: syncTradeUserToPg cleanly wraps trade_users_email_key constraint violation', async () => {
  const accounts = await getTradeAccounts();
  const testAccount = accounts.find((a) => a.status === 'active') || accounts[0];
  assert.ok(testAccount, 'Fixture requires at least one account');

  const uniqueEmail = `test_unique_${Date.now()}@myhappyhour.co.ke`;

  // First insert should succeed
  const firstUser = {
    id: `usr_test_dup_${Date.now()}_1`,
    accountId: testAccount.id,
    name: 'First User',
    email: uniqueEmail,
    phone: '0700000001',
    role: 'Owner',
    seatType: 'owner',
  };
  await syncTradeUserToPg(firstUser);

  // Second insert with different id but same email should throw a friendly "already exists" error
  const duplicateUser = {
    id: `usr_test_dup_${Date.now()}_2`,
    accountId: testAccount.id,
    name: 'Duplicate User',
    email: uniqueEmail,
    phone: '0700000002',
    role: 'Buyer',
    seatType: 'buyer',
  };

  await assert.rejects(
    async () => {
      await syncTradeUserToPg(duplicateUser);
    },
    (err) => {
      assert.ok(err.message.includes('already exists'), 'Error message must say account already exists');
      assert.ok(!err.message.includes('duplicate key value violates unique constraint'), 'Must not leak raw Postgres constraint error');
      return true;
    }
  );
});

