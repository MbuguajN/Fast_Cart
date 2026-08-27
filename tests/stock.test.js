import test from 'node:test';
import assert from 'node:assert/strict';

const { isPurchasable, maxOrderableQty, validateCartLines } = await import('../lib/stock.js');

test('only in-stock products are purchasable', () => {
  assert.equal(isPurchasable({ stockStatus: 'instock' }), true);
  assert.equal(isPurchasable({ stockStatus: 'outofstock' }), false);
  assert.equal(isPurchasable({ stockStatus: 'onbackorder' }), false);
  assert.equal(isPurchasable({}), false, 'unknown status is not purchasable');
  assert.equal(isPurchasable(null), false);
});

test('a hidden override makes a product unpurchasable regardless of stock', () => {
  assert.equal(isPurchasable({ stockStatus: 'instock', overrides: { hidden: true } }), false);
});

test('untracked stock has no quantity ceiling', () => {
  assert.equal(maxOrderableQty({ stockStatus: 'instock', stockQuantity: null }), Infinity);
  assert.equal(maxOrderableQty({ stockStatus: 'instock', stockQuantity: 7 }), 7);
  assert.equal(maxOrderableQty({ stockStatus: 'outofstock', stockQuantity: 7 }), 0);
});

test('validateCartLines rejects out-of-stock lines with a reason', () => {
  const catalog = [
    { wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 5 },
    { wcId: 2, name: 'Gin', stockStatus: 'outofstock', stockQuantity: 0 },
  ];

  const result = validateCartLines([{ wcId: 1, qty: 2 }, { wcId: 2, qty: 1 }], catalog);

  assert.equal(result.ok, false);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].wcId, 2);
  assert.equal(result.rejected[0].name, 'Gin');
  assert.match(result.rejected[0].reason, /out of stock/i);
});

test('validateCartLines caps a line at the available quantity', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 3 }];
  const result = validateCartLines([{ wcId: 1, qty: 10 }], catalog);

  assert.equal(result.ok, false);
  assert.equal(result.rejected[0].availableQty, 3);
  assert.match(result.rejected[0].reason, /only 3/i);
});

test('validateCartLines rejects a product missing from the catalogue', () => {
  const result = validateCartLines([{ wcId: 999, qty: 1 }], []);
  assert.equal(result.ok, false);
  assert.match(result.rejected[0].reason, /no longer available/i);
});

test('a fully valid cart passes', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null }];
  const result = validateCartLines([{ wcId: 1, qty: 99 }], catalog);
  assert.equal(result.ok, true);
  assert.equal(result.rejected.length, 0);
});
