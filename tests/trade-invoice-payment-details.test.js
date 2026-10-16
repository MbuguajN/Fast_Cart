import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTradeInvoiceDocument, generateInvoiceEmailHtml } from '../lib/trade/trade-documents.js';

const order = {
  id: 'ord_tr_123456', orderNumber: 'HH-TR-1', invoiceNumber: 'HH-INV-1', accountName: 'TEST Co', createdAt: '2026-10-16T00:00:00Z',
  items: [], subtotalExVat: 100, vatTotal: 16, subtotalIncVat: 116, deliveryFee: 0, grandTotal: 116, paymentTerms: 'credit_14',
};
const OLD = ['400200', '0108099887700', '0108099221100', 'Standard Chartered'];
const bankOn = { bankTransfer: { enabled: true, bankName: 'Test Bank', accountName: 'HH Ltd', accountNumber: '555000', branch: 'CBD' } };

test('invoices carry no hardcoded paybill or bank details when bank transfer is not configured', () => {
  const doc = generateTradeInvoiceDocument(order, null, {});
  const text = JSON.stringify(doc) + generateInvoiceEmailHtml(doc);
  for (const needle of OLD) assert.ok(!text.includes(needle), `still contains ${needle}`);
  assert.equal(doc.paymentInstructions.paybill, '');
  assert.match(generateInvoiceEmailHtml(doc), /account manager/i);
});

test('invoices show the admin-entered bank details when bank transfer is enabled', () => {
  const doc = generateTradeInvoiceDocument(order, null, bankOn);
  assert.equal(doc.paymentInstructions.accountNumber, '555000');
  const html = generateInvoiceEmailHtml(doc);
  assert.ok(html.includes('555000') && html.includes('Test Bank'));
  for (const needle of OLD) assert.ok(!html.includes(needle), `still contains ${needle}`);
});
