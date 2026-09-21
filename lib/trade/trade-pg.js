import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

let pool = null;

export function getPgPool() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgres://chris@/fastcart_trade?host=/var/run/postgresql';

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL client error:', err);
    });
  }
  return pool;
}

export async function query(text, params = []) {
  const p = getPgPool();
  return p.query(text, params);
}

export async function withTransaction(callback) {
  const p = getPgPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Initializes database tables and runs initial migration from JSON store if empty.
 */
let isDbInitialized = false;
let initPromise = null;

export async function ensureTradeDb() {
  if (isDbInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await createSchema();
    await migrateFromJsonIfEmpty();
    await backfillLandedCostColumns();
    isDbInitialized = true;
  })();

  return initPromise;
}

async function createSchema() {
  const p = getPgPool();

  await p.query(`
    -- 1. Accounts
    CREATE TABLE IF NOT EXISTS trade_accounts (
      id VARCHAR(64) PRIMARY KEY,
      trading_name VARCHAR(255) NOT NULL,
      legal_name VARCHAR(255),
      segment VARCHAR(64) DEFAULT 'horeca',
      status VARCHAR(32) DEFAULT 'pending',
      kra_pin VARCHAR(32),
      licence_no VARCHAR(64),
      licence_doc_url TEXT,
      licence_expiry DATE,
      price_book VARCHAR(32) DEFAULT 'standard',
      tier_override VARCHAR(16),
      credit_enabled BOOLEAN DEFAULT FALSE,
      credit_limit NUMERIC(12, 2) DEFAULT 0,
      credit_terms INT DEFAULT 14,
      credit_used NUMERIC(12, 2) DEFAULT 0,
      clean_orders INT DEFAULT 0,
      order_ceiling NUMERIC(12, 2),
      points INT DEFAULT 0,
      referral_credit NUMERIC(12, 2) DEFAULT 0,
      account_manager JSONB,
      addresses JSONB DEFAULT '[]'::jsonb,
      default_address_id VARCHAR(64),
      terms_accepted JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Users (Seats)
    CREATE TABLE IF NOT EXISTS trade_users (
      id VARCHAR(64) PRIMARY KEY,
      account_id VARCHAR(64) REFERENCES trade_accounts(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(64),
      role VARCHAR(64) DEFAULT 'Business Owner',
      seat_type VARCHAR(32) DEFAULT 'owner',
      password_hash TEXT,
      must_change_password BOOLEAN DEFAULT FALSE,
      failed_attempts INT DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 3. Products & Stock
    CREATE TABLE IF NOT EXISTS trade_products (
      id VARCHAR(64) PRIMARY KEY,
      sku VARCHAR(128) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      brand VARCHAR(128),
      category_name VARCHAR(128),
      price_line VARCHAR(32) NOT NULL,
      prk_cost_inc_vat NUMERIC(10, 2) NOT NULL,
      stock_quantity INT NOT NULL DEFAULT 0,
      reserved_stock INT NOT NULL DEFAULT 0,
      in_stock BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. Inventory Logs
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(64) REFERENCES trade_products(id) ON DELETE CASCADE,
      sku VARCHAR(128) NOT NULL,
      change_qty INT NOT NULL,
      balance_after INT NOT NULL,
      reason VARCHAR(64) NOT NULL,
      reference_id VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 5. Orders
    CREATE TABLE IF NOT EXISTS trade_orders (
      id VARCHAR(64) PRIMARY KEY,
      order_number VARCHAR(64) UNIQUE NOT NULL,
      invoice_number VARCHAR(64) UNIQUE NOT NULL,
      account_id VARCHAR(64) REFERENCES trade_accounts(id),
      account_name VARCHAR(255) NOT NULL,
      segment VARCHAR(64),
      ordered_by JSONB NOT NULL,
      status VARCHAR(32) DEFAULT 'confirmed',
      payment_terms VARCHAR(32) DEFAULT 'cash',
      payment_method VARCHAR(64) DEFAULT 'mpesa_paybill',
      payment_status VARCHAR(32) DEFAULT 'unpaid',
      due_date DATE NOT NULL,
      po_reference VARCHAR(128),
      notes TEXT,
      source VARCHAR(32) DEFAULT 'portal',
      delivery_date DATE,
      delivery_address JSONB NOT NULL,
      delivery_fee NUMERIC(10, 2) DEFAULT 0,
      subtotal_ex_vat NUMERIC(12, 2) NOT NULL,
      vat_total NUMERIC(12, 2) NOT NULL,
      subtotal_inc_vat NUMERIC(12, 2) NOT NULL,
      referral_credit NUMERIC(10, 2) DEFAULT 0,
      grand_total NUMERIC(12, 2) NOT NULL,
      total_bottles INT NOT NULL,
      economics JSONB,
      driver_info JSONB,
      delivery_note_number VARCHAR(64),
      seal_number VARCHAR(64),
      approved_by VARCHAR(255),
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 6. Order Items
    CREATE TABLE IF NOT EXISTS trade_order_items (
      id SERIAL PRIMARY KEY,
      order_id VARCHAR(64) REFERENCES trade_orders(id) ON DELETE CASCADE,
      product_id VARCHAR(64),
      sku VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price_line VARCHAR(32) NOT NULL,
      tier_key VARCHAR(16),
      quantity INT NOT NULL,
      unit_price_inc_vat NUMERIC(10, 2) NOT NULL,
      unit_price_ex_vat NUMERIC(10, 2) NOT NULL,
      vat_amount NUMERIC(10, 2) NOT NULL,
      line_total_inc_vat NUMERIC(12, 2) NOT NULL,
      line_total_ex_vat NUMERIC(12, 2) NOT NULL,
      prk_cost_snapshot NUMERIC(10, 2) NOT NULL,
      margin_percent NUMERIC(6, 2) NOT NULL
    );

    -- 7. Quotes
    CREATE TABLE IF NOT EXISTS trade_quotes (
      id VARCHAR(64) PRIMARY KEY,
      quote_number VARCHAR(64) UNIQUE NOT NULL,
      account_id VARCHAR(64) REFERENCES trade_accounts(id),
      account_name VARCHAR(255) NOT NULL,
      status VARCHAR(32) DEFAULT 'sent',
      valid_until DATE NOT NULL,
      notes TEXT,
      total_bottles INT NOT NULL,
      subtotal_ex_vat NUMERIC(12, 2) NOT NULL,
      vat_total NUMERIC(12, 2) NOT NULL,
      delivery_fee NUMERIC(10, 2) DEFAULT 0,
      grand_total NUMERIC(12, 2) NOT NULL,
      decline_reason TEXT,
      order_id VARCHAR(64),
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 8. Quote Items
    CREATE TABLE IF NOT EXISTS trade_quote_items (
      id SERIAL PRIMARY KEY,
      quote_id VARCHAR(64) REFERENCES trade_quotes(id) ON DELETE CASCADE,
      product_id VARCHAR(64),
      sku VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      price_line VARCHAR(32) NOT NULL,
      tier_key VARCHAR(16),
      quantity INT NOT NULL,
      unit_price_inc_vat NUMERIC(10, 2) NOT NULL,
      unit_price_ex_vat NUMERIC(10, 2) NOT NULL,
      line_total_inc_vat NUMERIC(12, 2) NOT NULL,
      prk_cost_snapshot NUMERIC(10, 2) NOT NULL
    );

    -- 9. Config & Sequences
    CREATE TABLE IF NOT EXISTS trade_config (
      key VARCHAR(64) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE SEQUENCE IF NOT EXISTS trade_invoice_seq START 1050;
    CREATE SEQUENCE IF NOT EXISTS trade_quote_seq START 120;

    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS case_size INT NOT NULL DEFAULT 12;
    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS product_cost_inc_vat NUMERIC(10, 2);
    ALTER TABLE trade_products ADD COLUMN IF NOT EXISTS logistics_cost_inc_vat NUMERIC(10, 2) NOT NULL DEFAULT 0;

    -- Marks accounts auto-provisioned by public guest checkout (see
    -- findOrCreateGuestTradeAccount) so a repeat guest can be matched back to
    -- their own order history WITHOUT ever matching onto a real, vetted
    -- account by identifier collision.
    ALTER TABLE trade_accounts ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

    -- App-wide (not trade-specific) staff roster for /admin access. Lives
    -- here because this is the app's only real database connection — see
    -- lib/admin-store.js. 'owner' is unrestricted; 'retail' and 'trade' are
    -- scoped by lib/api-guard.js's path-based check, so a retail-scoped
    -- staff member's token is rejected by every /api/admin/trade/* route
    -- and vice versa. The .env ADMIN_EMAIL bootstrap account is always
    -- 'owner' regardless of whether it has a row here.
    CREATE TABLE IF NOT EXISTS admin_staff (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      role VARCHAR(32) NOT NULL CHECK (role IN ('owner', 'retail', 'trade')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- App-wide KV store: rate-limit counters, login OTP challenges, geo
    -- lookup cache (see lib/kv-store.js). Used whenever Redis
    -- (UPSTASH_REDIS_REST_URL) isn't configured, in place of an in-process
    -- Map — a Map resets on every restart and isn't shared across more than
    -- one server instance, which quietly divides a rate limit by the
    -- instance count and can make a pending OTP invisible to whichever
    -- instance handles the verify request.
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kv_store_expires_at ON kv_store (expires_at);

    -- Durable webhook buffer (see lib/webhook-store.js and app/api/webhook).
    -- WooCommerce webhook processing used to be fire-and-forget: a failure
    -- mid-processing was swallowed and WooCommerce told "received: true"
    -- regardless, so it never knew to retry. Every inbound webhook is now
    -- recorded here first; a processing failure marks it 'failed' instead
    -- of losing it, and the reconcile cron retries failed rows on its own
    -- schedule, independent of WooCommerce's own retry behaviour.
    CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      topic VARCHAR(128) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events (status);

    CREATE TABLE IF NOT EXISTS trade_stock_receipts (
      id VARCHAR(64) PRIMARY KEY,
      receipt_number VARCHAR(64) UNIQUE NOT NULL,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      supplier_name VARCHAR(255),
      reference VARCHAR(128),
      freight_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      clearing_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      handling_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS trade_stock_receipt_lines (
      id SERIAL PRIMARY KEY,
      receipt_id VARCHAR(64) REFERENCES trade_stock_receipts(id) ON DELETE CASCADE,
      product_id VARCHAR(64) REFERENCES trade_products(id),
      sku VARCHAR(128) NOT NULL,
      cases NUMERIC(10, 2) NOT NULL,
      bottles INT NOT NULL,
      unit_product_cost_inc_vat NUMERIC(10, 2) NOT NULL,
      allocated_logistics_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0,
      landed_unit_cost NUMERIC(10, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trade_price_overrides (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(64) REFERENCES trade_products(id) ON DELETE CASCADE,
      tier_key VARCHAR(8) NOT NULL,
      price_inc_vat NUMERIC(10, 2) NOT NULL,
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (product_id, tier_key)
    );

    CREATE SEQUENCE IF NOT EXISTS trade_receipt_seq START 1;
  `);
}

/**
 * One-time backfill for the landed-cost columns. Idempotent: only touches
 * rows that haven't been migrated yet, so it's cheap to call on every
 * ensureTradeDb() rather than gating it on a separate "has this run" flag.
 * Treats whatever cost was already on file as the opening landed cost with
 * zero logistics, so nothing regresses to "missing cost" on deploy.
 */
async function backfillLandedCostColumns() {
  const p = getPgPool();
  await p.query(
    `UPDATE trade_products
     SET product_cost_inc_vat = prk_cost_inc_vat, logistics_cost_inc_vat = 0
     WHERE product_cost_inc_vat IS NULL AND prk_cost_inc_vat > 0`
  );
}

async function migrateFromJsonIfEmpty() {
  const p = getPgPool();

  const accCheck = await p.query('SELECT COUNT(*) FROM trade_accounts');
  const count = parseInt(accCheck.rows[0].count, 10);
  if (count > 0) {
    return; // Already migrated
  }

  console.log('Trade DB empty: starting migration from trade-store.json & store.json...');

  const tradeStorePath = path.join(process.cwd(), 'data', 'trade-store.json');
  const storePath = path.join(process.cwd(), 'data', 'store.json');

  let tradeData = null;
  if (fs.existsSync(tradeStorePath)) {
    try {
      tradeData = JSON.parse(fs.readFileSync(tradeStorePath, 'utf8'));
    } catch (e) {
      console.error('Failed reading trade-store.json for migration:', e.message);
    }
  }

  let retailData = null;
  if (fs.existsSync(storePath)) {
    try {
      retailData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    } catch (e) {
      console.error('Failed reading store.json for migration:', e.message);
    }
  }

  await withTransaction(async (client) => {
    // 1. Config
    if (tradeData?.config) {
      await client.query(
        'INSERT INTO trade_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['main_config', JSON.stringify(tradeData.config)]
      );
    }

    // 2. PRK Costs
    if (tradeData?.prkCosts) {
      await client.query(
        'INSERT INTO trade_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['prk_costs', JSON.stringify(tradeData.prkCosts)]
      );
    }

    // 3. Accounts
    if (Array.isArray(tradeData?.accounts)) {
      for (const a of tradeData.accounts) {
        await client.query(
          `INSERT INTO trade_accounts (
            id, trading_name, legal_name, segment, status, kra_pin, licence_no, licence_doc_url,
            licence_expiry, price_book, tier_override, credit_enabled, credit_limit, credit_terms,
            credit_used, clean_orders, order_ceiling, points, referral_credit, account_manager,
            addresses, default_address_id, terms_accepted, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (id) DO NOTHING`,
          [
            a.id,
            a.tradingName || 'Trading Account',
            a.legalName || a.tradingName,
            a.segment || 'horeca',
            a.status || 'pending',
            a.kraPin || '',
            a.licenceNo || '',
            a.licenceDocUrl || null,
            a.licenceExpiry || null,
            a.priceBook || 'standard',
            a.tierOverride || null,
            Boolean(a.creditEnabled),
            Number(a.creditLimit) || 0,
            Number(a.creditTerms) || 14,
            Number(a.creditUsed) || 0,
            Number(a.cleanOrders) || 0,
            a.orderCeiling ? Number(a.orderCeiling) : null,
            Number(a.points) || 0,
            Number(a.referralCredit) || 0,
            JSON.stringify(a.accountManager || {}),
            JSON.stringify(a.addresses || []),
            a.defaultAddressId || null,
            JSON.stringify(a.termsAccepted || {}),
            a.createdAt || new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }
    }

    // 4. Users
    if (Array.isArray(tradeData?.users)) {
      for (const u of tradeData.users) {
        await client.query(
          `INSERT INTO trade_users (
            id, account_id, name, email, phone, role, seat_type, password_hash,
            must_change_password, failed_attempts, locked_until, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (email) DO NOTHING`,
          [
            u.id,
            u.accountId,
            u.name,
            u.email.toLowerCase().trim(),
            u.phone || '',
            u.role || 'Business Owner',
            u.seatType || 'owner',
            u.passwordHash || null,
            Boolean(u.mustChangePassword),
            Number(u.failedAttempts) || 0,
            u.lockedUntil || null,
            u.createdAt || new Date().toISOString(),
          ]
        );
      }
    }

    // 5. Products & Initial Stock (Seeded from PRK Spirits & Jaba catalogue)
    const prkCosts = tradeData?.prkCosts || {};
    const retailProducts = retailData?.products || [];

    // Helper to identify PRK or Jaba
    const isTradeItem = (p) => {
      const name = (p.name || '').toLowerCase();
      const slug = (p.slug || '').toLowerCase();
      const brand = (p.brandName || p.brandId || '').toLowerCase();
      const cat = (p.categoryName || '').toLowerCase();

      if (cat.includes('mixer') || cat.includes('chaser') || cat.includes('party pack') || cat.includes('soft drink')) return false;
      if (name.includes('coke') || name.includes('fanta') || name.includes('sprite')) return false;
      if (brand.includes('jinro') || cat.includes('soju') || brand.includes('bumbu')) return false;

      if (brand.includes('jaba') || cat.includes('jaba') || name.includes('jaba')) return true;

      const PRK_NAMES = ['jameson', 'glenlivet', 'chivas', 'ballantines', 'martell', 'absolut', 'beefeater', 'malfy', 'olmeca', 'malibu', 'ricard', 'jacobs', 'campo', 'kahlua', 'havana', 'mumm', 'monkey', 'inverroche', 'royal_stag', 'imperial_blue', 'royal_salute', 'aberlour', 'belaire'];
      return PRK_NAMES.some((b) => brand.includes(b) || slug.includes(b.replace(/_/g, '-')) || name.includes(b.replace(/_/g, ' ')));
    };

    for (const p of retailProducts) {
      if (!isTradeItem(p)) continue;

      const slug = p.slug || String(p.id);
      const sku = p.sku || slug;
      const isJaba = (p.brandName || '').toLowerCase().includes('jaba') || (p.name || '').toLowerCase().includes('jaba');
      const priceLine = isJaba ? 'jaba' : 'spirits';

      const listedCost = prkCosts[sku] || prkCosts[slug] || prkCosts[p.id];
      const cost = Number(listedCost) || (p.price ? Number(p.price) * 0.75 : 2000);
      const initialStock = p.stockQuantity !== null && p.stockQuantity !== undefined ? Math.max(0, Number(p.stockQuantity)) : 100;

      await client.query(
        `INSERT INTO trade_products (
          id, sku, name, slug, brand, category_name, price_line, prk_cost_inc_vat,
          stock_quantity, reserved_stock, in_stock, is_active, image_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (sku) DO UPDATE SET
          prk_cost_inc_vat = EXCLUDED.prk_cost_inc_vat,
          name = EXCLUDED.name`,
        [
          `prod_tr_${p.id || slug}`,
          sku,
          p.name,
          slug,
          p.brandName || (isJaba ? 'Jaba' : 'Pernod Ricard'),
          p.categoryName || (isJaba ? 'Jaba Juices' : 'Spirits'),
          priceLine,
          cost,
          initialStock,
          0,
          initialStock > 0,
          true,
          p.image || p.images?.[0] || '/images/bottle-placeholder.png',
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    }

    // 6. Orders & Order Items
    if (Array.isArray(tradeData?.orders)) {
      for (const o of tradeData.orders) {
        await client.query(
          `INSERT INTO trade_orders (
            id, order_number, invoice_number, account_id, account_name, segment, ordered_by,
            status, payment_terms, payment_method, payment_status, due_date, po_reference,
            notes, source, delivery_date, delivery_address, delivery_fee, subtotal_ex_vat,
            vat_total, subtotal_inc_vat, referral_credit, grand_total, total_bottles,
            economics, driver_info, delivery_note_number, seal_number, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
          ON CONFLICT (id) DO NOTHING`,
          [
            o.id,
            o.orderNumber,
            o.invoiceNumber,
            o.accountId,
            o.accountName,
            o.segment,
            JSON.stringify(o.orderedBy || {}),
            o.status || 'confirmed',
            o.paymentTerms || 'cash',
            o.paymentMethod || 'mpesa_paybill',
            o.paymentStatus || 'unpaid',
            o.dueDate || new Date().toISOString().split('T')[0],
            o.poReference || '',
            o.notes || '',
            o.source || 'portal',
            o.deliveryDate || new Date().toISOString().split('T')[0],
            JSON.stringify(o.deliveryAddress || {}),
            Number(o.deliveryFee) || 0,
            Number(o.subtotalExVat) || 0,
            Number(o.vatTotal) || 0,
            Number(o.subtotalIncVat) || 0,
            Number(o.referralCredit) || 0,
            Number(o.grandTotal) || 0,
            Number(o.totalBottles) || 0,
            JSON.stringify(o.economics || {}),
            JSON.stringify(o.driverInfo || null),
            o.deliveryNoteNumber || null,
            o.sealNumber || null,
            o.createdAt || new Date().toISOString(),
            new Date().toISOString(),
          ]
        );

        if (Array.isArray(o.items)) {
          for (const item of o.items) {
            await client.query(
              `INSERT INTO trade_order_items (
                order_id, product_id, sku, name, price_line, tier_key, quantity,
                unit_price_inc_vat, unit_price_ex_vat, vat_amount, line_total_inc_vat,
                line_total_ex_vat, prk_cost_snapshot, margin_percent
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                o.id,
                item.id || item.sku,
                item.sku,
                item.name,
                item.priceLine || 'spirits',
                item.tierKey || 'T1',
                Number(item.quantity) || 1,
                Number(item.unitPriceIncVat) || 0,
                Number(item.unitPriceExVat) || 0,
                Number(item.vatAmount) || 0,
                Number(item.lineTotalIncVat) || 0,
                Number(item.lineTotalExVat) || 0,
                Number(item.prkCostSnapshot || item.prkCostIncVat) || 0,
                Number(item.marginPercent) || 0,
              ]
            );
          }
        }
      }
    }

    // 7. Quotes & Quote Items
    if (Array.isArray(tradeData?.quotes)) {
      for (const q of tradeData.quotes) {
        await client.query(
          `INSERT INTO trade_quotes (
            id, quote_number, account_id, account_name, status, valid_until, notes,
            total_bottles, subtotal_ex_vat, vat_total, delivery_fee, grand_total,
            order_id, accepted_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING`,
          [
            q.id,
            q.quoteNumber,
            q.accountId,
            q.accountName,
            q.status || 'sent',
            q.validUntil ? q.validUntil.split('T')[0] : new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
            q.notes || '',
            Number(q.totalBottles) || 0,
            Number(q.subtotalExVat) || 0,
            Number(q.vatTotal) || 0,
            Number(q.deliveryFee) || 0,
            Number(q.grandTotal) || 0,
            q.orderId || null,
            q.acceptedAt || null,
            q.createdAt || new Date().toISOString(),
            new Date().toISOString(),
          ]
        );

        if (Array.isArray(q.items)) {
          for (const item of q.items) {
            await client.query(
              `INSERT INTO trade_quote_items (
                quote_id, product_id, sku, name, price_line, tier_key, quantity,
                unit_price_inc_vat, unit_price_ex_vat, line_total_inc_vat, prk_cost_snapshot
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                q.id,
                item.id || item.sku,
                item.sku,
                item.name,
                item.priceLine || 'spirits',
                item.tierKey || 'T1',
                Number(item.quantity) || 1,
                Number(item.unitPriceIncVat) || 0,
                Number(item.unitPriceExVat) || 0,
                Number(item.lineTotalIncVat) || 0,
                Number(item.prkCostSnapshot || item.prkCostIncVat) || 0,
              ]
            );
          }
        }
      }
    }

    console.log('Trade DB migration from JSON completed successfully.');
  });
}

