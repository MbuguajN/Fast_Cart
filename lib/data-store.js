const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      const empty = { lastSync: null, products: [], brands: [], categories: [], syncStatus: 'idle' };
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastSync: null, products: [], brands: [], categories: [], syncStatus: 'idle' };
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function getProducts() {
  return readStore().products || [];
}

function getBrands() {
  return readStore().brands || [];
}

function getCategories() {
  return readStore().categories || [];
}

function getSyncStatus() {
  const store = readStore();
  return { lastSync: store.lastSync, syncStatus: store.syncStatus };
}

function updateStore(updates) {
  const store = readStore();
  Object.assign(store, updates);
  writeStore(store);
  return store;
}

function updateBrand(brandId, data) {
  const store = readStore();
  const idx = store.brands.findIndex(b => b.id === brandId);
  if (idx >= 0) {
    store.brands[idx] = { ...store.brands[idx], ...data };
  } else {
    store.brands.push({ id: brandId, ...data });
  }
  writeStore(store);
  return store.brands.find(b => b.id === brandId);
}

function upsertProduct(wcProduct) {
  const store = readStore();
  const idx = store.products.findIndex(p => p.wcId === wcProduct.wcId);
  const entry = {
    wcId: wcProduct.wcId,
    name: wcProduct.name,
    slug: wcProduct.slug,
    price: wcProduct.price,
    regularPrice: wcProduct.regularPrice,
    salePrice: wcProduct.salePrice,
    stockStatus: wcProduct.stockStatus,
    stockQuantity: wcProduct.stockQuantity,
    image: wcProduct.image,
    images: wcProduct.images || [],
    categoryId: wcProduct.categoryId,
    categoryName: wcProduct.categoryName,
    brandId: wcProduct.brandId || null,
    brandName: wcProduct.brandName || '',
    description: wcProduct.description || '',
    shortDescription: wcProduct.shortDescription || '',
    sku: wcProduct.sku || '',
    weight: wcProduct.weight || '',
    lastSynced: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.products[idx] = { ...store.products[idx], ...entry };
  } else {
    store.products.push(entry);
  }
  writeStore(store);
  return entry;
}

function upsertBrand(wcBrand) {
  const store = readStore();
  const idx = store.brands.findIndex(b => b.wcId === wcBrand.wcId);
  const entry = {
    wcId: wcBrand.wcId,
    name: wcBrand.name,
    slug: wcBrand.slug,
    image: wcBrand.image || null,
    description: wcBrand.description || '',
    display: wcBrand.display || 'default',
    lastSynced: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.brands[idx] = { ...store.brands[idx], ...entry };
  } else {
    store.brands.push(entry);
  }
  writeStore(store);
  return entry;
}

function upsertCategory(wcCategory) {
  const store = readStore();
  const idx = store.categories.findIndex(c => c.wcId === wcCategory.wcId);
  const entry = {
    wcId: wcCategory.wcId,
    name: wcCategory.name,
    slug: wcCategory.slug,
    image: wcCategory.image || null,
    description: wcCategory.description || '',
    display: wcCategory.display || 'default',
    lastSynced: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.categories[idx] = { ...store.categories[idx], ...entry };
  } else {
    store.categories.push(entry);
  }
  writeStore(store);
  return entry;
}

module.exports = {
  readStore,
  writeStore,
  getProducts,
  getBrands,
  getCategories,
  getSyncStatus,
  updateStore,
  updateBrand,
  upsertProduct,
  upsertBrand,
  upsertCategory,
};
