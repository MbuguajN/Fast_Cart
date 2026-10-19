#!/usr/bin/env node
/**
 * Product Image Caching Tool
 *
 * Downloads all remote WooCommerce product images in `data/store.json`
 * to the local `public/uploads/products/` directory and updates the store
 * references to point to local paths (`/uploads/products/...`).
 *
 * This eliminates runtime external network requests to WooCommerce,
 * giving customers instant image loading on the storefront.
 *
 * Usage:
 *   node scripts/cache-images.mjs
 *   or: npm run cache-images
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cacheProductImage, cacheProductImages } from '../lib/image-cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const STORE_PATH = path.join(rootDir, 'data', 'store.json');

async function main() {
  console.log('--- Fast Cart Image Caching Tool ---');

  if (!fs.existsSync(STORE_PATH)) {
    console.error(`Store file not found at ${STORE_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  const store = JSON.parse(raw);
  const products = store.products || [];
  const brands = store.brands || [];

  console.log(`Found ${products.length} products and ${brands.length} brands in store.json.`);

  let productImagesCached = 0;
  let brandImagesCached = 0;
  let skipped = 0;

  console.log('\n[1/2] Processing product images...');
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `prod_${p.wcId || p.id}`;
    let modified = false;

    // Cache primary image
    if (p.image && typeof p.image === 'string' && (p.image.startsWith('http://') || p.image.startsWith('https://'))) {
      const local = await cacheProductImage(p.image, prefix);
      if (local !== p.image) {
        p.image = local;
        modified = true;
        productImagesCached++;
      }
    } else if (p.image && p.image.startsWith('/uploads/')) {
      skipped++;
    }

    // Cache gallery images
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      const hasRemote = p.images.some(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')));
      if (hasRemote) {
        const localImages = await cacheProductImages(p.images, prefix, 3);
        p.images = localImages;
        modified = true;
      }
    }

    if ((i + 1) % 10 === 0 || i === products.length - 1) {
      process.stdout.write(`\rProgress: ${i + 1}/${products.length} products checked...`);
    }
  }
  console.log('\n✓ Product images processed.');

  console.log('\n[2/2] Processing brand logos...');
  for (let i = 0; i < brands.length; i++) {
    const b = brands[i];
    const prefix = `brand_${b.id || b.name || i}`;

    if (b.logo && typeof b.logo === 'string' && (b.logo.startsWith('http://') || b.logo.startsWith('https://'))) {
      const local = await cacheProductImage(b.logo, prefix);
      if (local !== b.logo) {
        b.logo = local;
        brandImagesCached++;
      }
    }
    if (b.image && typeof b.image === 'string' && (b.image.startsWith('http://') || b.image.startsWith('https://'))) {
      const local = await cacheProductImage(b.image, prefix);
      if (local !== b.image) {
        b.image = local;
        brandImagesCached++;
      }
    }
  }
  console.log('✓ Brand logos processed.');

  // Save updated store.json atomically
  const tmpPath = `${STORE_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);

  console.log('\n========================================');
  console.log(`✓ Image caching complete!`);
  console.log(`  New product images downloaded: ${productImagesCached}`);
  console.log(`  New brand logos downloaded:    ${brandImagesCached}`);
  console.log(`  Already local / skipped:       ${skipped}`);
  console.log(`  Updated store saved to:        ${STORE_PATH}`);
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Fatal error during image caching:', err);
  process.exit(1);
});
