const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

const DEFAULT_SLIDES = [
  {
    id: 'slide_1',
    title: 'Jaba Beetroot Happy Hour',
    subtitle: 'Chilled & refreshing organic blend delivered in 20 minutes',
    image: '/uploads/slides/1-Happy-Hour-Jaba-Beetroot-banners-12-8-26.jpg',
    badge: 'SPECIAL OFFER',
    buttonText: 'Order Now',
    active: true,
    order: 1,
    productId: null,
  },
  {
    id: 'slide_2',
    title: 'Jaba Pineapple Flash Sale',
    subtitle: 'Sweet tropical infusion to kickstart your party',
    image: '/uploads/slides/2-Happy-Hour-Jaba-Pineapple-banners-12-8-26.jpg',
    badge: 'POPULAR',
    buttonText: 'Order Now',
    active: true,
    order: 2,
    productId: null,
  },
  {
    id: 'slide_3',
    title: 'Jaba Watermelon Chilled',
    subtitle: 'Ice cold watermelon elixir for warm Nairobi nights',
    image: '/uploads/slides/3-Happy-Hour-Jaba-Watermelon-banners-12-8-26.jpg',
    badge: 'FRESH ARRIVAL',
    buttonText: 'Order Now',
    active: true,
    order: 3,
    productId: null,
  },
  {
    id: 'slide_4',
    title: 'Jaba Tamarind Delight',
    subtitle: 'Tangy tamarind flavor with a smooth finish',
    image: '/uploads/slides/4-Happy-Hour-Jaba-Tamarind-banners-12-8-26.jpg',
    badge: 'FEATURED',
    buttonText: 'Order Now',
    active: true,
    order: 4,
    productId: null,
  },
  {
    id: 'slide_5',
    title: 'Jaba Tropical Mix',
    subtitle: 'Exotic fruit blend for the ultimate happy hour',
    image: '/uploads/slides/5-Happy-Hour-Jaba-Tropical-banners-12-8-26.jpg',
    badge: 'HAPPY HOUR',
    buttonText: 'Order Now',
    active: true,
    order: 5,
    productId: null,
  },
  {
    id: 'slide_6',
    title: 'Jaba Hibiscus Infusion',
    subtitle: 'Rich floral hibiscus elixir, crafted to perfection',
    image: '/uploads/slides/6-Happy-Hour-Jaba-Hibiscus-banners-12-8-26.jpg',
    badge: 'TRENDING',
    buttonText: 'Order Now',
    active: true,
    order: 6,
    productId: null,
  },
];

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      const empty = { lastSync: null, products: [], brands: [], categories: [], zones: [], slides: DEFAULT_SLIDES, settings: { logo: null, background: null }, syncStatus: 'idle' };
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.settings) data.settings = { logo: null, background: null };
    if (!data.slides || !Array.isArray(data.slides) || data.slides.length === 0) {
      data.slides = DEFAULT_SLIDES;
    }
    return data;
  } catch {
    return { lastSync: null, products: [], brands: [], categories: [], zones: [], slides: DEFAULT_SLIDES, settings: { logo: null, background: null }, syncStatus: 'idle' };
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

function getZones() {
  return readStore().zones || [];
}

function getSettings() {
  return readStore().settings || { logo: null, background: null };
}

function updateSettings(settings) {
  const store = readStore();
  store.settings = { ...store.settings, ...settings };
  writeStore(store);
  return store.settings;
}

function upsertZone(zone) {
  const store = readStore();
  const idx = store.zones.findIndex(z => z.id === zone.id);
  const entry = {
    id: zone.id,
    name: zone.name,
    price: zone.price || 300,
    keywords: zone.keywords || [],
    lastSynced: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.zones[idx] = { ...store.zones[idx], ...entry };
  } else {
    store.zones.push(entry);
  }
  writeStore(store);
  return entry;
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
  const idx = store.brands.findIndex(b => b.id === brandId || b.wcId === brandId);
  if (idx >= 0) {
    store.brands[idx] = { ...store.brands[idx], ...data };
  } else {
    store.brands.push({ id: brandId, ...data });
  }
  writeStore(store);
  return store.brands.find(b => b.id === brandId || b.wcId === brandId);
}

function upsertProduct(wcProduct) {
  const store = readStore();
  const idx = store.products.findIndex(p => p.wcId === wcProduct.wcId);
  const existing = idx >= 0 ? store.products[idx] : null;
  const entry = {
    wcId: wcProduct.wcId,
    name: wcProduct.name,
    slug: wcProduct.slug,
    type: wcProduct.type || 'simple',
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
    upsellIds: wcProduct.upsellIds || [],
    attributes: wcProduct.attributes || [],
    variations: existing?.variations || wcProduct.variations || [],
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
  const existing = idx >= 0 ? store.brands[idx] : null;
  const entry = {
    wcId: wcBrand.wcId,
    name: wcBrand.name,
    slug: wcBrand.slug,
    image: existing?.image || wcBrand.image || null,
    visible: existing?.visible !== false,
    color: existing?.color || wcBrand.color || '#840037',
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
  return store.brands.find(b => b.wcId === wcBrand.wcId);
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

function assignBrandToProduct(productId, brandId) {
  const store = readStore();
  const prod = store.products.find(p => p.wcId === productId);
  if (prod) {
    const brand = store.brands.find(b => b.id === brandId || b.wcId === brandId);
    prod.brandId = brand ? (brand.wcId || brand.id) : null;
    prod.brandName = brand ? brand.name : '';
    writeStore(store);
  }
  return prod;
}

function extractBrandsFromProducts() {
  const store = readStore();
  const brandSet = new Map();

  const colors = ['#840037', '#5b0024', '#00321a', '#004b29', '#5f5e5e', '#191c1d', '#ba1a1a', '#ae2a54'];
  let colorIdx = 0;

  for (const p of store.products) {
    if (p.brandName) {
      const slug = p.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      if (!brandSet.has(slug)) {
        brandSet.set(slug, {
          id: `brand_${slug}`,
          wcId: `brand_${slug}`,
          name: p.brandName,
          slug,
          image: p.image || null,
          color: colors[colorIdx % colors.length],
        });
        colorIdx++;
      }
    }
  }

  const existingBrands = new Map(store.brands.map(b => [b.slug || b.wcId, b]));

  store.brands = [...brandSet.values()].map((b) => {
    const existing = existingBrands.get(b.slug);
    if (existing) {
      return {
        ...b,
        image: existing.image || b.image,
        visible: existing.visible !== false,
        color: existing.color || b.color,
      };
    }
    return { ...b, visible: true };
  });

  writeStore(store);
  return store.brands;
}

function updateProductVariations(wcId, variations) {
  const store = readStore();
  const idx = store.products.findIndex(p => p.wcId === wcId);
  if (idx >= 0) {
    store.products[idx].variations = variations;
    store.products[idx].lastSynced = new Date().toISOString();
    writeStore(store);
  }
}

function getSlides() {
  const store = readStore();
  return store.slides || DEFAULT_SLIDES;
}

function upsertSlide(slide) {
  const store = readStore();
  if (!store.slides) store.slides = [...DEFAULT_SLIDES];
  const idx = store.slides.findIndex(s => s.id === slide.id);
  const entry = {
    id: slide.id || `slide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: slide.title || '',
    subtitle: slide.subtitle || '',
    image: slide.image || '',
    badge: slide.badge || 'FEATURED',
    buttonText: slide.buttonText || 'Order Now',
    active: slide.active !== false,
    order: parseInt(slide.order || '0', 10),
    productId: slide.productId ? parseInt(slide.productId, 10) : null,
    customPrice: slide.customPrice ? parseFloat(slide.customPrice) : null,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    store.slides[idx] = { ...store.slides[idx], ...entry };
  } else {
    store.slides.push(entry);
  }
  writeStore(store);
  return entry;
}

function deleteSlide(id) {
  const store = readStore();
  if (!store.slides) store.slides = [...DEFAULT_SLIDES];
  store.slides = store.slides.filter(s => s.id !== id);
  writeStore(store);
  return true;
}

module.exports = {
  readStore,
  writeStore,
  getProducts,
  getBrands,
  getCategories,
  getZones,
  getSettings,
  updateSettings,
  getSyncStatus,
  updateStore,
  updateBrand,
  upsertProduct,
  upsertBrand,
  upsertCategory,
  upsertZone,
  assignBrandToProduct,
  extractBrandsFromProducts,
  getSlides,
  upsertSlide,
  deleteSlide,
};
