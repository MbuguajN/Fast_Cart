import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// data-store resolves its path from cwd, so point cwd at a scratch dir.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fastcart-store-'));
fs.mkdirSync(path.join(scratch, 'data'), { recursive: true });
const originalCwd = process.cwd();
process.chdir(scratch);

const store = await import('../lib/data-store.js');
const { upsertProduct, getProducts, WOOCOMMERCE_OWNED_FIELDS } = store.default || store;

process.chdir(originalCwd);

test('sync preserves locally-owned overrides', () => {
  process.chdir(scratch);
  try {
    upsertProduct({ wcId: 1, name: 'Jameson', price: '2500', stockStatus: 'instock' });

    // Admin hides it from the storefront.
    upsertProduct({ wcId: 1, overrides: { hidden: true, badge: 'Staff pick' } });

    // A later sync brings fresh WooCommerce values.
    upsertProduct({ wcId: 1, name: 'Jameson Irish Whiskey', price: '2600', stockStatus: 'outofstock' });

    const p = getProducts().find((x) => x.wcId === 1);
    assert.equal(p.price, '2600', 'WooCommerce owns price');
    assert.equal(p.stockStatus, 'outofstock', 'WooCommerce owns stock');
    assert.equal(p.overrides.hidden, true, 'local override survives sync');
    assert.equal(p.overrides.badge, 'Staff pick');
  } finally {
    process.chdir(originalCwd);
  }
});

test('an overrides-only update does not blank the commerce fields', () => {
  process.chdir(scratch);
  try {
    upsertProduct({ wcId: 5, name: 'Tusker', price: '250', stockStatus: 'instock', sku: 'TSK-1' });
    upsertProduct({ wcId: 5, overrides: { featured: true } });

    const p = getProducts().find((x) => x.wcId === 5);
    assert.equal(p.name, 'Tusker', 'name survives an overrides-only write');
    assert.equal(p.price, '250', 'price survives an overrides-only write');
    assert.equal(p.stockStatus, 'instock');
    assert.equal(p.overrides.featured, true);
  } finally {
    process.chdir(originalCwd);
  }
});

test('overrides merge rather than replace', () => {
  process.chdir(scratch);
  try {
    upsertProduct({ wcId: 2, name: 'Gin', price: '1000' });
    upsertProduct({ wcId: 2, overrides: { hidden: true } });
    upsertProduct({ wcId: 2, overrides: { featured: true } });

    const p = getProducts().find((x) => x.wcId === 2);
    assert.equal(p.overrides.hidden, true, 'earlier override not clobbered');
    assert.equal(p.overrides.featured, true);
  } finally {
    process.chdir(originalCwd);
  }
});

test('the WooCommerce-owned field list is explicit', () => {
  for (const field of ['price', 'stockStatus', 'stockQuantity', 'sku', 'name']) {
    assert.ok(WOOCOMMERCE_OWNED_FIELDS.includes(field), `${field} must be WooCommerce-owned`);
  }
  assert.ok(!WOOCOMMERCE_OWNED_FIELDS.includes('overrides'));
});


test('a partial update does not blank fields it omits', () => {
  process.chdir(scratch);
  try {
    upsertProduct({
      wcId: 9,
      name: 'Gilbeys',
      slug: 'gilbeys-gin',
      image: 'https://example.test/g.jpg',
      brandName: 'Gilbeys',
      categoryName: 'Gin',
      price: '1500',
      stockStatus: 'instock',
    });

    // A webhook stock delta carries only a handful of fields.
    upsertProduct({ wcId: 9, name: 'Gilbeys', price: '1600', stockStatus: 'outofstock', stockQuantity: 0 });

    const p = getProducts().find((x) => x.wcId === 9);
    assert.equal(p.stockStatus, 'outofstock', 'the delta applied');
    assert.equal(p.price, '1600', 'the delta applied');
    assert.equal(p.slug, 'gilbeys-gin', 'slug survived a partial update');
    assert.equal(p.image, 'https://example.test/g.jpg', 'image survived');
    assert.equal(p.brandName, 'Gilbeys', 'brand survived');
    assert.equal(p.categoryName, 'Gin', 'category survived');
  } finally {
    process.chdir(originalCwd);
  }
});

test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
