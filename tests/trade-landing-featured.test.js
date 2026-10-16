import test from 'node:test';
import assert from 'node:assert/strict';
import { pickFeaturedProducts, priceSummary } from '../lib/trade/landing-featured.js';

const tiers = (a, b) => ({ T0: { unitPriceIncVat: a }, T1: { unitPriceIncVat: b } });
const p = (name, brandName, priceLine, stockQuantity, tierPrices = tiers(5000, 4000), inStock = true) => ({
  sku: name, name, brandName, priceLine, stockQuantity, inStock, tierPrices,
});

test('priceSummary returns the entry price and the lowest volume price', () => {
  assert.deepEqual(priceSummary(p('a', 'A', 'spirits', 10, { T0: { unitPriceIncVat: 5200 }, T1: { unitPriceIncVat: 4900 }, T2: { unitPriceIncVat: 4600 } })), { from: 5200, to: 4600 });
});

test('priceSummary omits "to" when there is no discount, and is null without prices', () => {
  assert.deepEqual(priceSummary(p('a', 'A', 'spirits', 10, { T0: { unitPriceIncVat: 900 } })), { from: 900, to: null });
  assert.equal(priceSummary(p('a', 'A', 'spirits', 10, {})), null);
});

test('only in-stock, priced products are featured', () => {
  const out = pickFeaturedProducts([
    p('out', 'X', 'spirits', 0, tiers(1, 1), false),
    p('noprice', 'Y', 'spirits', 50, {}),
    p('ok', 'Z', 'spirits', 50),
  ], 8);
  assert.deepEqual(out.map((x) => x.name), ['ok']);
});

test('one product per brand, well-known brands first, Jaba juices at the end', () => {
  const out = pickFeaturedProducts([
    p('Jaba Beetroot', 'Jaba', 'jaba', 100),
    p('Obscure Rum', 'Obscure', 'spirits', 99),
    p('Jameson 750', 'Jameson Irish Whiskey', 'spirits', 20),
    p('Jameson 1L', 'Jameson Irish Whiskey', 'spirits', 90),
    p('Absolut 750', 'Absolut', 'spirits', 30),
    p('Jaba Tropical', 'Jaba', 'jaba', 100),
  ], 8);
  const names = out.map((x) => x.name);
  assert.equal(names.filter((n) => n.startsWith('Jameson')).length, 1);
  assert.equal(names[0].startsWith('Jameson'), true);
  assert.ok(names.indexOf('Absolut 750') < names.indexOf('Obscure Rum'));
  assert.equal(out[out.length - 1].priceLine, 'jaba');
});

test('the limit is respected and at most two Jaba juices are included', () => {
  const many = [
    ...['Jameson Irish Whiskey', 'Absolut', 'Chivas', 'Beefeater', 'Glenlivet', 'Ballantine’s', 'Malibu', 'Havana Club'].map((b) => p(b, b, 'spirits', 40)),
    ...['A', 'B', 'C', 'D'].map((n) => p(`Jaba ${n}`, 'Jaba', 'jaba', 100)),
  ];
  const out = pickFeaturedProducts(many, 8);
  assert.equal(out.length, 8);
  assert.ok(out.filter((x) => x.priceLine === 'jaba').length <= 2);
});

test('works with an empty or missing catalogue', () => {
  assert.deepEqual(pickFeaturedProducts([], 8), []);
  assert.deepEqual(pickFeaturedProducts(undefined, 8), []);
});

test('products whose brand field is a parent company are still told apart by name', () => {
  const out = pickFeaturedProducts([
    p('Jameson Whiskey 750 ml 40%', 'Pernod Ricard', 'spirits', 50),
    p('Absolut Vodka 750ml 40%', 'Pernod Ricard', 'spirits', 40),
    p('Absolut Vodka 1L', 'Pernod Ricard', 'spirits', 30),
    p('Beefeater Gin 1l 40%', 'Pernod Ricard', 'spirits', 20),
  ], 8);
  assert.deepEqual(out.map((x) => x.name), ['Jameson Whiskey 750 ml 40%', 'Absolut Vodka 750ml 40%', 'Beefeater Gin 1l 40%']);
});
