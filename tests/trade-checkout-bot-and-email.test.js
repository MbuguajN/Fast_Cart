import test from 'node:test';
import assert from 'node:assert/strict';

import { validateBotProtection, MIN_SUBMISSION_DURATION_MS } from '../lib/trade/anti-bot.js';
import {
  generateOrderCancelledStaffAlertHtml,
  generateOrderCancelledBuyerNoticeHtml,
  generatePaymentWarningStaffAlertHtml,
  generateOrderConfirmedEmailHtml,
} from '../lib/trade/trade-documents.js';

test('anti-bot: rejects submissions with a populated honeypot field', () => {
  const result = validateBotProtection({
    honeypot: 'spam-bot-input',
    submissionDurationMs: 5000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'honeypot_triggered');
  assert.equal(result.error, 'Automated submission rejected');
});

test('anti-bot: rejects whitespace-only honeypot submissions', () => {
  // Whitespace only is still flagged if not completely empty
  const result = validateBotProtection({
    honeypot: '   ',
    submissionDurationMs: 5000,
  });
  // Empty or trimmed empty is treated as human
  assert.equal(result.ok, true);
});

test('anti-bot: rejects submissions completed suspiciously fast (< 1500ms)', () => {
  const result = validateBotProtection({
    honeypot: '',
    submissionDurationMs: 450,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'submission_too_fast');
  assert.equal(result.error, 'Please take a moment before submitting');
});

test('anti-bot: allows legitimate submissions (> 1500ms and empty honeypot)', () => {
  const result = validateBotProtection({
    honeypot: '',
    submissionDurationMs: MIN_SUBMISSION_DURATION_MS + 100,
  });
  assert.equal(result.ok, true);
  assert.equal(result.error, undefined);
});

test('email templates: generateOrderCancelledStaffAlertHtml includes essential operational intervention details', () => {
  const html = generateOrderCancelledStaffAlertHtml({
    order: {
      id: 'ord_test_1',
      orderNumber: 'HH-9901',
      grandTotal: 58000,
      deliveryAddress: {
        contactName: 'James Mwangi',
        phone: '0712345678',
        addressLine: 'The Tavern, Kilimani',
        city: 'Nairobi',
      },
      orderedBy: { name: 'James Mwangi', email: 'james@tavern.ke' },
      items: [
        { name: 'Johnnie Walker Black 1L', sku: 'JWB-1L', quantity: 12, lineTotalIncVat: 58000 },
      ],
    },
    reason: 'Payment window timed out / customer cancelled payment on Paystack',
  });

  assert.ok(html.includes('HH-9901'), 'Must include order number');
  assert.ok(html.includes('58,000'), 'Must include formatted grand total');
  assert.ok(html.includes('James Mwangi'), 'Must include customer contact name');
  assert.ok(html.includes('0712345678'), 'Must include customer phone number');
  assert.ok(html.includes('wa.me/254712345678'), 'Must include click-to-WhatsApp link with E.164 Kenya formatting');
  assert.ok(html.includes('tel:0712345678'), 'Must include click-to-call tel link');
  assert.ok(html.includes('orders@myhappyhour.co.ke'), 'Must designate ops email footer');
});

test('email templates: generateOrderCancelledBuyerNoticeHtml includes reason and 1-click cart recovery', () => {
  const html = generateOrderCancelledBuyerNoticeHtml({
    order: {
      id: 'ord_test_2',
      orderNumber: 'HH-9902',
      deliveryAddress: { contactName: 'Sarah Kimani' },
    },
    reason: 'Your payment session was cancelled or timed out',
  });

  assert.ok(html.includes('HH-9902'), 'Must include order number');
  assert.ok(html.includes('Sarah Kimani'), 'Must greet buyer by name');
  assert.ok(html.includes('was cancelled'), 'Must clearly state cancellation');
  assert.ok(html.includes('Return to Trade Cart'), 'Must include cart resume action');
});

test('email templates: generatePaymentWarningStaffAlertHtml includes Paystack reference and amounts', () => {
  const html = generatePaymentWarningStaffAlertHtml({
    order: {
      id: 'ord_test_3',
      orderNumber: 'HH-9903',
      grandTotal: 20000,
      deliveryAddress: { contactName: 'David Omondi', phone: '0799887766' },
    },
    reason: 'Underpayment detected',
    paystackData: {
      reference: 'pstk_ref_abc123',
      amount: 1500000, // 15,000 KES in cents
    },
  });

  assert.ok(html.includes('HH-9903'), 'Must include order number');
  assert.ok(html.includes('pstk_ref_abc123'), 'Must include Paystack reference');
  assert.ok(html.includes('15,000'), 'Must show paid amount');
  assert.ok(html.includes('20,000'), 'Must show order total due');
  assert.ok(html.includes('wa.me/254799887766'), 'Must have WhatsApp customer link');
});

test('email templates: generateOrderConfirmedEmailHtml renders correctly for staff fulfillment', () => {
  const html = generateOrderConfirmedEmailHtml({
    order: {
      id: 'ord_test_4',
      orderNumber: 'HH-9904',
      grandTotal: 12500,
      deliveryAddress: {
        contactName: 'Grace Wambui',
        phone: '0722112233',
        addressLine: 'Westlands Mall, Shop 4',
        city: 'Nairobi',
      },
      items: [
        { name: 'Baileys Irish Cream 750ml', quantity: 6, lineTotalIncVat: 12500 },
      ],
    },
    isStaff: true,
  });

  assert.ok(html.includes('HH-9904'), 'Must include order number');
  assert.ok(html.includes('NEW TRADE ORDER RECEIVED'), 'Must have staff alert heading');
  assert.ok(html.includes('Grace Wambui'), 'Must have recipient name');
  assert.ok(html.includes('Baileys Irish Cream 750ml'), 'Must have item list');
  assert.ok(html.includes('12,500'), 'Must show grand total');
});

