import test from 'node:test';
import assert from 'node:assert/strict';

const { extractStockDelta, isDeletion } = await import('../lib/catalog-delta.js');

test('a WooCommerce product payload reduces to the fields the cache holds', () => {
  const delta = extractStockDelta({
    id: 42,
    name: 'Jameson',
    price: '2600',
    regular_price: '2800',
    sale_price: '2600',
    stock_status: 'outofstock',
    stock_quantity: 0,
    sku: 'JAM-750',
  });

  assert.equal(delta.wcId, 42);
  assert.equal(delta.stockStatus, 'outofstock');
  assert.equal(delta.stockQuantity, 0);
  assert.equal(delta.price, '2600');
});

test('a missing stock quantity stays null rather than becoming zero', () => {
  const delta = extractStockDelta({ id: 7, stock_status: 'instock', stock_quantity: null });
  assert.equal(delta.stockQuantity, null, 'null means untracked, not sold out');
});

test('a payload without an id yields nothing to apply', () => {
  assert.equal(extractStockDelta({}), null);
  assert.equal(extractStockDelta(null), null);
});

test('deletion is recognised from the topic', () => {
  assert.equal(isDeletion('product.deleted'), true);
  assert.equal(isDeletion('product.updated'), false);
  assert.equal(isDeletion(''), false);
});
