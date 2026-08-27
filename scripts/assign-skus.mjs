import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

function generateStandardSku(p) {
  if (p.sku && String(p.sku).trim() !== '') {
    return String(p.sku).trim();
  }
  const slug = (p.slug || p.name || `prd-${p.wcId || p.id || Math.floor(1000 + Math.random() * 9000)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const brand = (p.brandName || '').toLowerCase();
  const cat = (p.categoryName || '').toLowerCase();

  if (brand.includes('jaba') || cat.includes('jaba')) {
    const flavor = slug.replace(/^jaba-/, '').replace(/-juice$/, '').toUpperCase();
    return `JB-${flavor}-500ML`;
  }

  if (brand.includes('jinro') || cat.includes('soju')) {
    const flavor = slug.replace(/-soju$/, '').replace(/^jinro-/, '').toUpperCase();
    return `JNR-${flavor}-350ML`;
  }

  if (slug.includes('glenlivet-12-yo-1l')) return 'GLV-12YO-1L';
  if (slug.includes('olmeca-gold-1l')) return 'OLM-GOLD-1L';

  if (cat.includes('mixer') || cat.includes('chaser') || cat.includes('soft')) {
    return `MIX-${slug.replace(/[^a-z0-9]/g, '-').toUpperCase()}`;
  }

  if (cat.includes('party')) {
    return `PPK-${slug.replace(/[^a-z0-9]/g, '-').toUpperCase()}`;
  }

  const prefix = (p.brandName ? p.brandName.slice(0, 4) : p.categoryName ? p.categoryName.slice(0, 4) : 'HH')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return `HH-${prefix}-${p.wcId || p.id || slug.slice(0, 8).toUpperCase()}`;
}

const raw = fs.readFileSync(STORE_PATH, 'utf8');
const store = JSON.parse(raw);

let updatedCount = 0;
store.products = (store.products || [])
  .filter(p => p && p.name && p.name !== 'undefined' && p.name !== 'test pr')
  .map(p => {
    const newSku = generateStandardSku(p);
    if (p.sku !== newSku) {
      updatedCount++;
      return { ...p, sku: newSku };
    }
    return p;
  });

fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
console.log(`Successfully processed all ${store.products.length} products. Updated ${updatedCount} SKUs!`);

