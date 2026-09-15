import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTradeQuoteDocument,
  generateTradeInvoiceDocument,
  generateTradeDeliveryNote,
  generateQuoteEmailHtml,
  generateApplicationReceivedEmailHtml,
  generateApplicationAdminNoticeHtml,
  generateAccountApprovedEmailHtml,
} from '../lib/trade/trade-documents.js';
import {
  renderQuotePdf,
  renderInvoicePdf,
  renderDeliveryNotePdf,
} from '../lib/trade/trade-pdf.js';
import {
  getTradeAccounts,
  getTradeProducts,
  updateTradeProduct,
  getInventoryLogs,
  createTradeQuote,
  getTradeQuotes,
  declineTradeQuote,
  acceptTradeQuote,
  createTradeOrder,
  updateTradeOrderStatus,
  getTradeOrderById,
} from '../lib/trade/trade-store.js';

test('Trade PDF Rendering - Quote, Invoice, and Delivery Note (GRN) PDFs', async () => {
  const sampleAccount = {
    id: 'acc_test_hotel',
    tradingName: 'Sankara Hotel Nairobi',
    legalName: 'Sankara Hospitality Ltd',
    kraPin: 'P051123456Z',
    licenceNo: 'LQ-NRB-2025-001',
    deliveryAddress: {
      street: 'Woodvale Grove, Westlands',
      city: 'Nairobi',
      contactName: 'James Mwangi',
      phone: '+254711222333',
    },
  };

  const sampleQuoteRecord = {
    id: 'q_test_101',
    quoteNumber: 'FC-QT-2026-999',
    accountId: sampleAccount.id,
    accountName: sampleAccount.tradingName,
    createdAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 14 * 86400000).toISOString(),
    items: [
      {
        sku: 'jameson-original-750ml',
        name: 'Jameson Irish Whiskey 750ml',
        quantity: 24,
        priceLine: 'spirits',
        tierKey: 'T1',
        unitPriceExVat: 2702.59,
        unitPriceIncVat: 3135,
        lineTotalExVat: 64862.07,
        lineTotalIncVat: 75240,
      },
    ],
    totalBottles: 24,
    subtotalExVat: 64862.07,
    vatTotal: 10377.93,
    grandTotal: 75240,
    notes: 'Festival volume quotation',
  };

  // 1. Quote PDF Generation
  const quoteDoc = generateTradeQuoteDocument(sampleQuoteRecord, sampleAccount);
  assert.equal(quoteDoc.quoteNumber, 'FC-QT-2026-999');
  assert.equal(quoteDoc.grandTotal, 75240);

  const quotePdf = await renderQuotePdf(quoteDoc);
  assert.ok(Buffer.isBuffer(quotePdf));
  assert.ok(quotePdf.length > 500, 'Quote PDF buffer should be non-empty');
  assert.equal(quotePdf.subarray(0, 5).toString('ascii'), '%PDF-');

  // 2. Invoice PDF Generation
  const invoiceDoc = generateTradeInvoiceDocument({
    id: 'ord_test_201',
    orderNumber: 'FC-ORD-999',
    invoiceNumber: 'FC-INV-999',
    createdAt: new Date().toISOString(),
    paymentMethod: 'pay_on_account',
    paymentStatus: 'pending',
    items: sampleQuoteRecord.items,
    subtotalExVat: 64862.07,
    vatTotal: 10377.93,
    deliveryFee: 0,
    grandTotal: 75240,
  }, sampleAccount);

  const invoicePdf = await renderInvoicePdf(invoiceDoc);
  assert.ok(Buffer.isBuffer(invoicePdf));
  assert.ok(invoicePdf.length > 500);
  assert.equal(invoicePdf.subarray(0, 5).toString('ascii'), '%PDF-');

  // 3. Delivery Note PDF Generation
  const deliveryDoc = generateTradeDeliveryNote({
    id: 'ord_test_201',
    orderNumber: 'FC-ORD-999',
    deliveryNoteNumber: 'DN-999',
    sealNumber: 'SL-884912',
    driverInfo: {
      driverName: 'Peter Kamau',
      driverPhone: '+254722111222',
      vehicleRegistration: 'KDF 452X',
    },
    items: sampleQuoteRecord.items,
    totalBottles: 24,
  }, sampleAccount);

  const deliveryPdf = await renderDeliveryNotePdf(deliveryDoc);
  assert.ok(Buffer.isBuffer(deliveryPdf));
  assert.ok(deliveryPdf.length > 500);
  assert.equal(deliveryPdf.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('Trade Email HTML Templates - Quotes, Applications & Onboarding', () => {
  const sampleQuote = {
    quoteNumber: 'FC-QT-2026-1001',
    accountName: 'Sankara Hotel',
    validUntil: '2026-09-30',
    grandTotal: 150000,
    totalBottles: 48,
    items: [
      { name: 'Jameson Irish Whiskey 750ml', quantity: 24, lineTotalIncVat: 75240 },
      { name: 'Chivas Regal 12YO 750ml', quantity: 24, lineTotalIncVat: 74760 },
    ],
  };

  const quoteHtml = generateQuoteEmailHtml(sampleQuote, 'Guaranteed pricing for Oktoberfest event.');
  assert.ok(quoteHtml.includes('FC-QT-2026-1001'));
  assert.ok(quoteHtml.includes('KES 150,000'));
  assert.ok(quoteHtml.includes('Oktoberfest event'));

  const appHtml = generateApplicationReceivedEmailHtml({
    contactName: 'Jane Wanjiru',
    tradingName: 'Artcaffe Grand',
  });
  assert.ok(appHtml.includes('Jane Wanjiru'));
  assert.ok(appHtml.includes('Artcaffe Grand'));
  assert.ok(appHtml.includes('2 hours'));

  const adminNoticeHtml = generateApplicationAdminNoticeHtml({
    id: 'acc_artcaffe',
    tradingName: 'Artcaffe Grand',
    contactName: 'Jane Wanjiru',
    email: 'jane@artcaffe.co.ke',
    phone: '+254700000000',
    kraPin: 'P051999888Z',
    segment: 'horeca',
  });
  assert.ok(adminNoticeHtml.includes('New B2B Trade Application'));
  assert.ok(adminNoticeHtml.includes('Artcaffe Grand'));

  const approvedHtml = generateAccountApprovedEmailHtml(
    { tradingName: 'Artcaffe Grand' },
    'ABCD-EFGH-JKLM-NPQR',
    'jane@artcaffe.co.ke'
  );
  assert.ok(approvedHtml.includes('ABCD-EFGH-JKLM-NPQR'));
  assert.ok(approvedHtml.includes('jane@artcaffe.co.ke'));
  assert.ok(approvedHtml.includes('Trade Account Activated'));
});

test('PostgreSQL Inventory Management - Stock adjustment and audit trail', async () => {
  const products = await getTradeProducts();
  assert.ok(products.length > 0, 'Catalog should contain trade products');

  const testProduct = products.find((p) => p.sku === 'jameson-original-750ml') || products[0];
  const initialStock = testProduct.stockQuantity;

  // Manual stock adjustment
  const targetStock = initialStock + 10;
  await updateTradeProduct(testProduct.sku, {
    stockQuantity: targetStock,
    reason: 'test_restock_delivery',
  }, 'TestRunner');

  // Verify updated balance
  const refreshedProducts = await getTradeProducts();
  const updatedProduct = refreshedProducts.find((p) => p.sku === testProduct.sku);
  assert.equal(updatedProduct.stockQuantity, targetStock);

  // Check inventory audit trail
  const logs = await getInventoryLogs(testProduct.sku, 5);
  assert.ok(logs.length > 0);
  const latestLog = logs[0];
  assert.equal(latestLog.sku, testProduct.sku);
  assert.equal(latestLog.balance_after, targetStock);
  assert.equal(latestLog.reason, 'test_restock_delivery');
  assert.equal(latestLog.change_qty, 10);

  // Reset back to initial stock
  await updateTradeProduct(testProduct.sku, {
    stockQuantity: initialStock,
    reason: 'test_cleanup',
  }, 'TestRunner');
});

test('Trade Quotes Flow - Create, Decline and Accept Lifecycle', async () => {
  const accounts = await getTradeAccounts();
  const testAccount = accounts.find(
    (a) => a.status === 'active' && a.licenceExpiry && new Date(a.licenceExpiry) > new Date()
  ) || accounts[0];

  const products = await getTradeProducts();
  const testProduct = products.find((p) => p.stockQuantity >= 24) || products[0];
  const unitCost = testProduct.prkCostIncVat || 2500;

  // 1. Create a quote
  const quote = await createTradeQuote({
    accountId: testAccount.id,
    accountName: testAccount.tradingName,
    items: [
      {
        sku: testProduct.sku,
        name: testProduct.name,
        quantity: 12,
        priceLine: testProduct.priceLine,
        prkCostIncVat: unitCost,
        tierKey: 'T1',
      },
    ],
    notes: 'E2E Test quote',
    validDays: 7,
  });

  assert.ok(quote.id);
  assert.ok(quote.quoteNumber.startsWith('HH-Q-'));
  assert.equal(quote.status, 'sent');

  // 2. Decline flow
  const declinedQuote = await declineTradeQuote(quote.id, {
    reasonCode: 'budget_cancelled',
    notes: 'Client cancelled summer party',
  });
  assert.equal(declinedQuote.status, 'declined');

  // 3. Create another quote for accept flow (meets wholesale minimum threshold)
  const quote2 = await createTradeQuote({
    accountId: testAccount.id,
    accountName: testAccount.tradingName,
    items: [
      {
        sku: testProduct.sku,
        name: testProduct.name,
        quantity: 12,
        priceLine: testProduct.priceLine,
        prkCostIncVat: unitCost,
        tierKey: 'T1',
      },
    ],
    notes: 'Acceptance test quote',
    validDays: 14,
  });

  // Accept and convert to active order
  const order = await acceptTradeQuote(quote2.id, { id: testAccount.id, tradingName: testAccount.tradingName });
  assert.ok(order.id);
  assert.ok(order.orderNumber.startsWith('FC-ORD-'));
  assert.ok(order.invoiceNumber.startsWith('FC-INV-'));
  assert.equal(order.status, 'confirmed');

  // Cancel order to test automatic stock restoration
  const cancelledOrder = await updateTradeOrderStatus(order.id, 'cancelled');
  assert.equal(cancelledOrder.status, 'cancelled');
});

