import test from 'node:test';
import assert from 'node:assert/strict';

const { readCart, writeCart, addLine, changeQty, removeLine, hydrate } =
  await import('../lib/cart-storage.js');

/** Minimal in-memory stand-in for localStorage. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('an empty or absent store reads as an empty cart', () => {
  assert.deepEqual(readCart(fakeStorage()), []);
  assert.deepEqual(readCart(fakeStorage({ liquordash_cart: 'not json' })), []);
  assert.deepEqual(readCart(null), []);
});

test('a written cart reads back identically', () => {
  const storage = fakeStorage();
  writeCart(storage, [{ id: 1, variantId: null, quantity: 2 }]);
  assert.deepEqual(readCart(storage), [{ id: 1, variantId: null, quantity: 2 }]);
});

test('malformed lines are discarded on read', () => {
  const storage = fakeStorage({
    liquordash_cart: JSON.stringify({ lines: [{ id: 1, quantity: 2 }, { quantity: 3 }, null] }),
  });
  const lines = readCart(storage);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 1);
});

test('a storage that throws does not break the cart', () => {
  const hostile = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
  };
  assert.deepEqual(readCart(hostile), []);
  assert.doesNotThrow(() => writeCart(hostile, [{ id: 1, variantId: null, quantity: 1 }]));
});

test('adding the same product twice increments rather than duplicating', () => {
  let lines = addLine([], 1, null);
  lines = addLine(lines, 1, null);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 2);
});

test('changeQty removes a line when it reaches zero', () => {
  let lines = addLine([], 1, null);
  lines = changeQty(lines, 1, -1);
  assert.deepEqual(lines, []);
});

test('changeQty never produces a negative quantity', () => {
  const lines = changeQty([{ id: 1, variantId: null, quantity: 1 }], 1, -5);
  assert.deepEqual(lines, []);
});

test('removeLine drops only the named product', () => {
  const lines = removeLine(
    [{ id: 1, variantId: null, quantity: 1 }, { id: 2, variantId: null, quantity: 1 }],
    1
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 2);
});

test('hydrate drops lines that are no longer purchasable and reports them', () => {
  const catalog = [
    { wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null },
    { wcId: 2, name: 'Gin', stockStatus: 'outofstock', stockQuantity: 0 },
  ];
  const result = hydrate(
    [{ id: 1, variantId: null, quantity: 1 }, { id: 2, variantId: null, quantity: 1 }],
    catalog
  );

  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].id, 1);
  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].name, 'Gin');
});

test('hydrate caps a line at the available quantity instead of dropping it', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: 2 }];
  const result = hydrate([{ id: 1, variantId: null, quantity: 9 }], catalog);

  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.removed.length, 0);
  assert.equal(result.capped.length, 1);
  assert.equal(result.capped[0].name, 'Jameson');
});

test('hydrate leaves a valid cart untouched', () => {
  const catalog = [{ wcId: 1, name: 'Jameson', stockStatus: 'instock', stockQuantity: null }];
  const lines = [{ id: 1, variantId: null, quantity: 3 }];
  const result = hydrate(lines, catalog);
  assert.deepEqual(result.lines, lines);
  assert.equal(result.removed.length, 0);
});
