import test from 'node:test';
import assert from 'node:assert/strict';

const { visibleProducts } = await import('../lib/storefront-catalog.js');

const CATALOG = [
  { wcId: 1, name: 'In stock', stockStatus: 'instock' },
  { wcId: 2, name: 'Out of stock', stockStatus: 'outofstock' },
  { wcId: 3, name: 'Hidden by admin', stockStatus: 'instock', overrides: { hidden: true } },
  { wcId: 4, name: 'Backordered', stockStatus: 'onbackorder' },
];

test('out-of-stock and hidden products are excluded by default', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: false });
  assert.deepEqual(visible.map((p) => p.wcId), [1]);
});

test('showOutOfStock reveals out-of-stock but never admin-hidden products', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: true });
  const ids = visible.map((p) => p.wcId);
  assert.ok(ids.includes(2), 'out-of-stock shown when the setting allows');
  assert.ok(!ids.includes(3), 'an admin-hidden product stays hidden regardless');
});

test('every returned product carries a purchasable flag for the client', () => {
  const visible = visibleProducts(CATALOG, { showOutOfStock: true });
  const outOfStock = visible.find((p) => p.wcId === 2);
  assert.equal(outOfStock.purchasable, false, 'client can disable the add button');
  assert.equal(visible.find((p) => p.wcId === 1).purchasable, true);
});
