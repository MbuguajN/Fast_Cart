import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTradeCost, buildCatalogIndex } from '../lib/trade/trade-catalog.js';

test('trade-catalog loads as an ES module (no duplicate exports)', () => {
  assert.equal(typeof buildCatalogIndex, 'function');
});

test('resolveTradeCost uses the SKU, then slug, then id entry in the cost sheet', () => {
  assert.equal(resolveTradeCost({ sku: 'a', slug: 'b', id: 'c', price: 100 }, { a: 500 }), 500);
  assert.equal(resolveTradeCost({ sku: 'a', slug: 'b', id: 'c', price: 100 }, { b: 600 }), 600);
  assert.equal(resolveTradeCost({ sku: 'a', slug: 'b', id: 'c', price: 100 }, { c: 700 }), 700);
});

test('resolveTradeCost falls back to a ratio of price when the sheet has no entry', () => {
  assert.equal(resolveTradeCost({ sku: 'a', slug: 'b', id: 'c', price: 1000 }, {}), 750);
});
