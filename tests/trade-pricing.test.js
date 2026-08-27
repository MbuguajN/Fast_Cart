import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLineTier,
  calculateTradeOrderPricing,
  evaluateMinimumOrderRule,
  evaluateDeliveryFee,
  isPrkOrJabaTradeProduct,
  getTradePriceLine,
  DEFAULT_PRICE_BANDS,
} from '../lib/trade/pricing-engine.js';
import {
  generateTradeInvoiceDocument,
  generateTradeDeliveryNote,
  generateInvoiceEmailHtml,
  generateDeliveryNoteEmailHtml,
} from '../lib/trade/trade-documents.js';

test('Trade Scope - PRK & Jaba Product Inclusions vs Exclusions', () => {
  // PRK Products (Must be included)
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Jameson Irish Whiskey 750ml', brandName: 'Jameson Irish Whiskey' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'The Glenlivet 12 Yo 1L 40%', brandName: 'Glenlivet' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Martell VSOP 700ml', brandName: 'Martell' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Chivas 12 YO 750ml', brandName: 'Chivas' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Beefeater Gin 750ml 40%', brandName: 'Beefeater' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Malfy Gin Rosa', brandName: 'Malfy' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Olmeca Silver 1L', brandName: 'Olmeca' }), true);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Happy Hour Jaba Juice Beetroot 500ml', brandName: 'Jaba' }), true);

  // Non-PRK Products (Must be excluded)
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Jinro Is Back', brandName: 'Jinro', categoryName: 'Soju' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Peach Soju', brandName: 'Jinro', categoryName: 'Soju' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Bumbu Original 750ml', brandName: 'Bumbu', categoryName: 'Rum' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Krest Bitter Lemon Soda 1.25L', categoryName: 'Mixers' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Regular Coke 2L', categoryName: 'Mixers' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'Dasani Mineral Water 1L', categoryName: 'Chasers' }), false);
  assert.equal(isPrkOrJabaTradeProduct({ name: 'After Work Party Pack', categoryName: 'Party Packs' }), false);

  // Price Line resolution
  assert.equal(getTradePriceLine({ name: 'Jameson Whiskey 750ml', brandName: 'Jameson' }), 'spirits');
  assert.equal(getTradePriceLine({ name: 'Jaba Juice Tamarind 500ml', brandName: 'Jaba' }), 'jaba');
  assert.equal(getTradePriceLine({ name: 'Sprite 2L', categoryName: 'Mixers' }), 'excluded');
});

test('Trade Pricing Engine - Spirits T1 (10% GM above PRK cost)', () => {
  const result = resolveLineTier({
    sku: 'jameson-original-750ml',
    priceLine: 'spirits',
    prkCostIncVat: 2850,
    quantity: 12,
  });

  assert.equal(result.tierKey, 'T1');
  assert.equal(result.unitPriceIncVat, 3135);
  assert.equal(result.eligible, true);
});

test('Trade Pricing Engine - Jaba Juice T1 and T2 Footing', () => {
  const t1 = resolveLineTier({
    sku: 'jaba-beetroot-500ml',
    priceLine: 'jaba',
    quantity: 24,
  });
  assert.equal(t1.tierKey, 'T1');
  assert.equal(t1.unitPriceExVat, 750);
  assert.equal(t1.unitPriceIncVat, 870);

  const t2 = resolveLineTier({
    sku: 'jaba-beetroot-500ml',
    priceLine: 'jaba',
    quantity: 60,
  });
  assert.equal(t2.tierKey, 'T2');
  assert.equal(t2.unitPriceExVat, 700);
  assert.equal(t2.unitPriceIncVat, 812);
});

test('Trade Pricing Engine - Full Cart Pricing Calculation', () => {
  const cart = [
    {
      sku: 'jameson-original-750ml',
      priceLine: 'spirits',
      prkCostIncVat: 2850,
      quantity: 12,
    },
    {
      sku: 'jaba-beetroot-500ml',
      priceLine: 'jaba',
      quantity: 24,
    },
  ];

  const pricing = calculateTradeOrderPricing({ items: cart, isNairobi: true });
  assert.equal(pricing.totalBottles, 36);
  assert.equal(pricing.minOrderCheck.passed, true);
  assert.equal(pricing.grandTotal, 3135 * 12 + 870 * 24);
});

test('Trade Pricing Engine - Minimum Order & Delivery Policy', () => {
  const validCheck = evaluateMinimumOrderRule({ totalBottles: 24, goodsValueExVat: 50000 });
  assert.equal(validCheck.passed, true);

  const invalidCheck = evaluateMinimumOrderRule({ totalBottles: 6, goodsValueExVat: 5000 });
  assert.equal(invalidCheck.passed, false);
});

test('Trade Documents - VAT Tax Invoice Generator & HTML Email', () => {
  const mockOrder = {
    id: 'ord_test_001',
    orderNumber: 'HH-TR-1041',
    invoiceNumber: 'HH-INV-2026-1041',
    accountId: 'acc_serena_01',
    accountName: 'Nairobi Serena Hotel',
    totalBottles: 24,
    subtotalExVat: 64862.16,
    vatTotal: 10377.84,
    subtotalIncVat: 75240,
    deliveryFee: 0,
    grandTotal: 75240,
    items: [
      {
        sku: 'jameson-original-750ml',
        name: 'Jameson Irish Whiskey 750ml',
        quantity: 24,
        unitPriceIncVat: 3135,
        lineTotalIncVat: 75240,
      },
    ],
  };

  const invoice = generateTradeInvoiceDocument(mockOrder, {
    tradingName: 'Nairobi Serena Hotel',
    kraPin: 'P051123456Z',
  });

  assert.equal(invoice.invoiceNumber, 'HH-INV-2026-1041');
  assert.equal(invoice.customer.kraPin, 'P051123456Z');
  assert.equal(invoice.grandTotal, 75240);

  const emailHtml = generateInvoiceEmailHtml(invoice, 'Immediate dispatch approved.');
  assert.ok(emailHtml.includes('HH-INV-2026-1041'));
  assert.ok(emailHtml.includes('Nairobi Serena Hotel'));
  assert.ok(emailHtml.includes('KES 75,240'));
  assert.ok(emailHtml.includes('P051987654Z'));
});

test('Trade Documents - Delivery Note (GRN) Generator & HTML Email', () => {
  const mockOrder = {
    id: 'ord_test_002',
    orderNumber: 'HH-TR-1042',
    invoiceNumber: 'HH-INV-2026-1042',
    accountId: 'acc_serena_01',
    accountName: 'Nairobi Serena Hotel',
    totalBottles: 24,
    items: [
      {
        sku: 'the-glenlivet-12yo-750ml',
        name: 'The Glenlivet 12YO Single Malt 750ml',
        quantity: 12,
      },
      {
        sku: 'chivas-regal-12yo-750ml',
        name: 'Chivas Regal 12YO Blended Scotch 750ml',
        quantity: 12,
      },
    ],
  };

  const dn = generateTradeDeliveryNote(mockOrder, {
    tradingName: 'Nairobi Serena Hotel',
  });

  assert.ok(dn.deliveryNoteNumber.startsWith('HH-DN-2026-'));
  assert.equal(dn.items.length, 2);
  assert.equal(dn.totalBottles, 24);

  const dnEmailHtml = generateDeliveryNoteEmailHtml(dn);
  assert.ok(dnEmailHtml.includes(dn.deliveryNoteNumber));
  assert.ok(dnEmailHtml.includes('HH-TR-1042'));
  assert.ok(dnEmailHtml.includes('The Glenlivet 12YO'));
});

