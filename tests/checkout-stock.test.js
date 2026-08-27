import test from 'node:test';
import assert from 'node:assert/strict';

const { buildStockRejection } = await import('../lib/checkout-guards.js');

test('a rejection message names every affected product', () => {
  const rejected = [
    { wcId: 2, name: 'Gin', reason: 'is out of stock', availableQty: 0 },
    { wcId: 3, name: 'Jameson', reason: 'has only 2 left', availableQty: 2 },
  ];

  const body = buildStockRejection(rejected);

  assert.equal(body.error, 'Some items are no longer available');
  assert.equal(body.rejected.length, 2);
  assert.match(body.message, /Gin is out of stock/);
  assert.match(body.message, /Jameson has only 2 left/);
});

test('a single rejection reads naturally', () => {
  const body = buildStockRejection([{ wcId: 2, name: 'Gin', reason: 'is out of stock', availableQty: 0 }]);
  assert.equal(body.message, 'Gin is out of stock.');
});
