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

// Official live featured brand banners
const BRAND_BANNERS = {
  'glenlivet': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero-TGL.webp',
  'the_glenlivet': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero-TGL.webp',
  'ballantine_s': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Ballantines-Hero.webp',
  'ballantines': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Ballantines-Hero.webp',
  'absolut': 'https://myhappyhour.co.ke/wp-content/uploads/2025/12/Absolut-Cover-1.webp',
  'jinro': 'https://myhappyhour.co.ke/wp-content/uploads/2026/03/freepik__talk__61619-1.webp',
  'jaba': 'https://myhappyhour.co.ke/wp-content/uploads/2026/08/HAPPY-HOUR-JABA-JUICE-STICKERS-2.webp',
  'martell': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Martell-Hero.webp',
  'olmeca': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero-Olmeca.webp',
  'jameson_irish_whiskey': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Jameson-SPD-Desktop-1-1.webp',
  'jameson': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Jameson-SPD-Desktop-1-1.webp',
  'chivas': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero-Chivas.webp',
  'belaire': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero-Belaire.webp',
  'beefeater': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Hero.webp',
  'malfy': 'https://myhappyhour.co.ke/wp-content/uploads/2025/03/Malfy-Hero.webp',
  'malibu': 'https://myhappyhour.co.ke/wp-content/uploads/2025/12/Malibu-Cover-1.webp',
};

// Known real brands — these are always kept even with 1 product
const KNOWN_BRANDS = new Set([
  'jameson', 'jameson_irish_whiskey', 'chivas', 'ballantine_s', 'ballantines', 'olmeca', 'martell',
  'beefeater', 'malfy', 'the_glenlivet', 'glenlivet', 'malibu', 'bumbu',
  'jinro', 'schweppes', 'absolut', 'aberlour', 'havana', 'havana_club', 'kahlua',
  'mumm', 'inverroche', 'monkey', 'ricard', 'jacobs', 'campo',
  'royal', 'imperial', 'luc', 'belaire', 'jaba',
]);

// Normalize brand slugs to merge duplicates
const BRAND_MERGE = {
  'ballantines': 'ballantine_s',
  'the_glenlivet': 'glenlivet',
  'havana': 'havana_club',
};

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

function getProductBySlug(slugOrId) {
  if (!slugOrId) return null;
  const products = getProducts();
  const normalized = String(slugOrId).toLowerCase().trim();
  
  return products.find(p => 
    (p.slug && p.slug.toLowerCase() === normalized) ||
    String(p.id).toLowerCase() === normalized ||
    String(p.wcId).toLowerCase() === normalized ||
    (p.name && p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === normalized)
  ) || null;
}

function getBrands() {
  const brands = readStore().brands || [];
  return brands.map(b => {
    const slug = b.slug || b.id || '';
    const normSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const normName = b.name ? b.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') : '';
    const fallbackBanner = BRAND_BANNERS[slug] || BRAND_BANNERS[normSlug] || BRAND_BANNERS[normName] || null;
    return {
      ...b,
      banner: b.banner || fallbackBanner || null,
    };
  });
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
  return {
    lastSync: store.lastSync,
    syncStatus: store.syncStatus || 'idle',
    syncError: store.syncError || null,
    productsCount: store.products?.length || 0,
    brandsCount: store.brands?.length || 0,
    categoriesCount: store.categories?.length || 0,
    zonesCount: store.zones?.length || 0,
  };
}

function updateStore(data) {
  const store = readStore();
  const updated = { ...store, ...data };
  writeStore(updated);
  return updated;
}

function updateBrand(brandId, data) {
  const store = readStore();
  const idx = store.brands.findIndex(b => String(b.id) === String(brandId) || String(b.wcId) === String(brandId));
  if (idx >= 0) {
    store.brands[idx] = { ...store.brands[idx], ...data };
  } else {
    store.brands.push({ id: brandId, ...data });
  }
  writeStore(store);
  return store.brands.find(b => String(b.id) === String(brandId) || String(b.wcId) === String(brandId));
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
  const slug = wcBrand.slug;
  const fallbackBanner = BRAND_BANNERS[slug] || (wcBrand.name ? BRAND_BANNERS[wcBrand.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')] : null);
  const entry = {
    wcId: wcBrand.wcId,
    name: wcBrand.name,
    slug: wcBrand.slug,
    image: wcBrand.image || existing?.image || null,
    logo: wcBrand.image || existing?.logo || existing?.image || null,
    banner: wcBrand.banner || existing?.banner || fallbackBanner || null,
    visible: existing?.visible !== false,
    color: existing?.color || wcBrand.color || '#840037',
    description: wcBrand.description || existing?.description || '',
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
  const brandProductCount = new Map();

  const colors = ['#840037', '#5b0024', '#00321a', '#004b29', '#5f5e5e', '#191c1d', '#ba1a1a', '#ae2a54'];
  let colorIdx = 0;

  for (const p of store.products) {
    if (p.brandName) {
      let slug = p.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      if (BRAND_MERGE[slug]) slug = BRAND_MERGE[slug];

      brandProductCount.set(slug, (brandProductCount.get(slug) || 0) + 1);

      if (!brandSet.has(slug)) {
        brandSet.set(slug, {
          id: `brand_${slug}`,
          wcId: `brand_${slug}`,
          name: p.brandName,
          slug,
          image: null,
          banner: BRAND_BANNERS[slug] || null,
          color: colors[colorIdx % colors.length],
        });
        colorIdx++;
      }
    }
  }

  // Filter: keep brands that are known OR have 2+ products
  const filtered = [...brandSet.entries()].filter(([slug]) => {
    return KNOWN_BRANDS.has(slug) || (brandProductCount.get(slug) || 0) >= 2;
  });

  const existingBrands = new Map();
  for (const b of store.brands) {
    if (b.slug) existingBrands.set(b.slug, b);
    if (b.wcId) existingBrands.set(String(b.wcId), b);
    if (b.name) {
      const normalizedName = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      existingBrands.set(normalizedName, b);
    }
  }

  store.brands = filtered.map(([, b]) => {
    const existing = existingBrands.get(b.slug)
      || existingBrands.get(b.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''));
    const defaultBanner = BRAND_BANNERS[b.slug] || (b.name ? BRAND_BANNERS[b.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')] : null);
    if (existing) {
      return {
        ...b,
        wcId: existing.wcId || b.wcId,
        image: existing.image || b.image,
        logo: existing.logo || b.logo || existing.image || b.image || null,
        banner: existing.banner || defaultBanner || null,
        visible: existing.visible !== false,
        color: existing.color || b.color,
        description: existing.description || b.description || '',
      };
    }
    return { ...b, banner: defaultBanner || null, visible: true };
  });

  store.brands.forEach(b => {
    b.productCount = brandProductCount.get(b.slug) || 0;
  });

  store.brands.sort((a, b) => (b.productCount || 0) - (a.productCount || 0));

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
  getProductBySlug,
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
