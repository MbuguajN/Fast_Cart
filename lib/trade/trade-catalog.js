/**
 * Canonical, server-authoritative resolution of trade line items.
 *
 * The pricing engine derives a unit price from `prkCostIncVat` and `priceLine`.
 * Both used to arrive straight from the request body, so a buyer could post
 * `{ prkCostIncVat: 1, priceLine: 'jaba' }` and both price the order at a cost
 * base they chose and skip the liquor-licence check that applies to spirits.
 *
 * Everything here re-derives those fields from the product catalogue and the
 * cost store. From the client we accept exactly two things per line: which
 * product, and how many.
 * Backed by PostgreSQL `trade_products` for real stock management and cost verification.
 */

import { query, ensureTradeDb } from './trade-pg.js';
import { getProducts } from '../data-store.js';
import { getPrkCosts } from './trade-store.js';
import { isPrkOrJabaTradeProduct, getTradePriceLine } from './pricing-engine.js';

/** Fallback cost ratio when a SKU has no entry in the PRK cost sheet. */
const FALLBACK_COST_RATIO = 0.75;
const FALLBACK_COST = 2000;

const MAX_LINES = 200;
const MAX_QTY_PER_LINE = 10000;

function keyOf(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Fetch all active trade products directly from PostgreSQL.
 */
export async function getTradeProductsFromDb() {
  await ensureTradeDb();
  try {
    const res = await query(
      'SELECT * FROM trade_products WHERE is_active = true ORDER BY name ASC'
    );
    return res.rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      slug: r.slug,
      brandName: r.brand,
      categoryName: r.category_name,
      priceLine: r.price_line,
      prkCostIncVat: Number(r.prk_cost_inc_vat),
      stockQuantity: Number(r.stock_quantity),
      reservedStock: Number(r.reserved_stock),
      inStock: Boolean(r.in_stock && r.stock_quantity > 0),
      image: r.image_url || '/images/bottle-placeholder.png',
    }));
  } catch (err) {
    console.error('getTradeProductsFromDb fallback to JSON:', err.message);
    const rawProducts = getProducts() || [];
    const prkCosts = getPrkCosts();
    return rawProducts.filter(isPrkOrJabaTradeProduct).map((p) => {
      const priceLine = getTradePriceLine(p);
      const sku = p.sku || p.slug || String(p.id);
      const cost = resolveTradeCost(p, prkCosts);
      return {
        id: p.id || p.wcId,
        sku,
        name: p.name,
        slug: p.slug,
        brandName: p.brandName,
        categoryName: p.categoryName,
        priceLine,
        prkCostIncVat: cost,
        stockQuantity: p.stockQuantity ?? 100,
        reservedStock: 0,
        inStock: p.inStock ?? true,
        image: p.image || p.images?.[0] || '/images/bottle-placeholder.png',
      };
    });
  }
}

/**
 * Index the trade-eligible catalogue by every identifier a client might send.
 * Built per call — the product store is a small in-process JSON read.
 */
export async function buildCatalogIndex() {
  const products = await getTradeProductsFromDb();
  const index = new Map();

  for (const p of products) {
    if (!isPrkOrJabaTradeProduct(p)) continue;
    for (const id of [p.sku, p.slug, p.id, p.wcId]) {
      const k = keyOf(id);
      if (k && !index.has(k)) index.set(k, p);
    }
  }
  return index;
}

/**
 * Landed cost for a product, mirroring the catalogue route so a quote and an
 * order always agree.
 */
export function resolveTradeCost(product, prkCosts) {
  const bySku = prkCosts[product.sku];
  const listed = Number(bySku ?? bySlug ?? byId);
  if (Number.isFinite(listed) && listed > 0) return listed;

  const derived = Number(product.price) * FALLBACK_COST_RATIO;
  return Number.isFinite(derived) && derived > 0 ? derived : FALLBACK_COST;
}

/**
 * Turn client line requests into trusted priced-order input.
 *
 * @param {Array} items client lines; only identifier and `quantity` are read
 * @param {object} options
 * @param {object} options.account    trade account, for licence gating
 * @param {boolean} options.checkStock whether to enforce live stock availability
 * @returns {Promise<Array>} sanitised lines safe to hand to calculateTradeOrderPricing
 * @throws {Error} on an unknown SKU, bad quantity, insufficient stock, or licence violation
 */
export async function resolveTradeLineItems(items, { account = null, checkStock = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  if (items.length > MAX_LINES) {
    throw new Error(`Too many order lines (max ${MAX_LINES})`);
  }

  const index = await buildCatalogIndex();

  const hasLiquorLicence = Boolean(account?.licenceNo);
  const licenceExpired = Boolean(
    account?.licenceExpiry && new Date(account.licenceExpiry) < new Date()
  );

  // Collapse duplicate lines so quantity-based tier bands cannot be gamed by
  // splitting one SKU across many lines.
  const merged = new Map();

  for (const raw of items) {
    const identifier = raw?.sku ?? raw?.slug ?? raw?.id ?? raw?.wcId;
    const product = index.get(keyOf(identifier));

    if (!product) {
      throw new Error(`"${identifier ?? 'unknown'}" is not available on the trade catalogue`);
    }

    const quantity = Number.parseInt(raw?.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }

    const priceLine = product.priceLine || getTradePriceLine(product);
    if (priceLine === 'excluded') {
      throw new Error(`${product.name} is not available on the trade catalogue`);
    }

    // Licence gating against server-authoritative priceLine
    if (priceLine === 'spirits') {
      if (!hasLiquorLicence) {
        throw new Error('A valid liquor licence is required to order spirits lines. Add your licence in account settings.');
      }
      if (licenceExpired) {
        throw new Error('Your liquor licence has expired. Spirits ordering is restricted until it is renewed.');
      }
    }

    const key = keyOf(product.sku || product.slug || product.id);
    const existing = merged.get(key);
    const totalQty = existing ? existing.quantity + quantity : quantity;

    // Real Stock Check if requested (e.g. at checkout or quote acceptance)
    if (checkStock && totalQty > product.stockQuantity) {
      throw new Error(
        `Insufficient stock for "${product.name}" (${product.sku}). Requested: ${totalQty}, Available: ${product.stockQuantity}`
      );
    }

    if (existing) {
      existing.quantity = Math.min(totalQty, MAX_QTY_PER_LINE);
      continue;
    }

    merged.set(key, {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      image: product.image || '/images/bottle-placeholder.png',
      categoryName: product.categoryName || '',
      brandName: product.brandName || '',
      priceLine,
      prkCostIncVat: product.prkCostIncVat,
      stockQuantity: product.stockQuantity,
      quantity,
    });
  }

  return Array.from(merged.values());
}

export { buildCatalogIndex };
