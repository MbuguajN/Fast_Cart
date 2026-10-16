#!/usr/bin/env node
/**
 * Real-browser run of the trade checkout (guest + logged-in accounts).
 *
 *   node scripts/seed-test-trade-accounts.mjs seed
 *   node scripts/e2e-trade-checkout.mjs [--base http://localhost:3000] [--attacks]
 *   node scripts/seed-test-trade-accounts.mjs cleanup
 *
 * Drives the local Playwright Chromium (the MCP browser tools do not work in
 * this environment). Needs a running dev server. Paystack scenarios need
 * PAYSTACK_SECRET_KEY (test key) in .env.local and are skipped without it.
 */
import { createRequire } from 'module';
import fs from 'fs';
import { TEST_PASSWORD, TEST_USERS } from './seed-test-trade-accounts.mjs';

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE || '/home/chris/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core';
const { chromium } = require(PW);
const CHROME = process.env.CHROME_PATH || fs.readdirSync(`${process.env.HOME}/.cache/ms-playwright`)
  .filter((d) => /^chromium-\d+$/.test(d)).sort().map((d) => `${process.env.HOME}/.cache/ms-playwright/${d}/chrome-linux64/chrome`).pop();

const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3000';
const SHOTS = process.env.E2E_SHOTS || '/tmp/claude-1000/-var-www-Fast-Cart/6f38d0dc-7e53-4559-9fd0-63d43a4ae29a/scratchpad';
fs.mkdirSync(SHOTS, { recursive: true });

const hasPaystack = /^PAYSTACK_SECRET_KEY=.+/m.test(fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '');
const results = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function scenario(name, fn, { needsPaystack = false } = {}) {
  if (needsPaystack && !hasPaystack) {
    results.push({ name, status: 'SKIP', note: 'no PAYSTACK_SECRET_KEY in .env.local' });
    return;
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  try {
    await fn({ page, context, consoleErrors });
    results.push({ name, status: 'PASS' });
  } catch (err) {
    await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
    results.push({ name, status: 'FAIL', note: err.message.split('\n')[0] });
  } finally {
    await context.close();
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function catalog() {
  const res = await fetch(`${BASE}/api/trade/catalog`);
  const { products } = await res.json();
  const stocked = products.filter((p) => p.stockQuantity >= 60);
  const jaba = stocked.find((p) => p.priceLine === 'jaba');
  const spirits = stocked.find((p) => p.priceLine === 'spirits');
  assert(jaba && spirits, 'need a stocked jaba and spirits product in the catalogue');
  return { jaba, spirits };
}
// Mirrors lib/trade/trade-context.js addToCart so the client-side preview prices correctly.
const cartItem = (p, quantity) => ({
  id: p.id, sku: p.sku, name: p.name, categoryName: p.categoryName, priceLine: p.priceLine, quantity,
  priceOverrides: Object.fromEntries(Object.entries(p.tierPrices || {}).map(([k, t]) => [k, p.priceLine === 'jaba' ? t.unitPriceExVat : t.unitPriceIncVat])),
});

async function loadCheckout(page, context, items) {
  await context.addInitScript((cart) => localStorage.setItem('hh_trade_cart', JSON.stringify(cart)), items);
  await page.goto(`${BASE}/trade/checkout`, { waitUntil: 'networkidle' });
  await page.getByText('Settlement', { exact: false }).first().waitFor({ timeout: 15000 });
}

async function login(context, who) {
  const res = await context.request.post(`${BASE}/api/trade/auth`, {
    data: { identifier: TEST_USERS[who].email, password: TEST_PASSWORD },
  });
  assert(res.ok(), `login ${who} failed: ${res.status()}`);
}

async function fillGuest(page) {
  const field = (label) => page.locator('label', { hasText: label }).locator('xpath=following-sibling::input').first();
  await field('Full Name').fill('TEST Guest Buyer');
  await field('Phone Number').fill('0700000999');
  await field('Email').fill('test.guest@example.test');
  await page.getByPlaceholder('Street, building, floor...').fill('TEST Street 1');
}

const body = (page) => page.locator('body').innerText();
const { jaba, spirits } = await catalog();

await scenario('guest sees only valid payment options', async ({ page, context, consoleErrors }) => {
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  const text = await body(page);
  assert(/Pay Now/i.test(text), 'Pay Now missing');
  assert(!/Pay on Account/i.test(text), 'credit option visible to guest');
  assert(!/Paybill|400200|Standard Chartered/i.test(text), 'M-Pesa paybill / hardcoded bank details still shown');
  assert(!/Direct Bank Transfer/i.test(text), 'bank transfer shown while disabled');
  assert(/reserved for \d+ minutes/i.test(text), 'stock-hold note missing');
  assert(consoleErrors.length === 0, `page errors: ${consoleErrors[0]}`);
  await page.screenshot({ path: `${SHOTS}/guest-checkout.png`, fullPage: true });
});

await scenario('guest: below-minimum order is refused with a message', async ({ page, context }) => {
  await loadCheckout(page, context, [cartItem(jaba, 3)]);
  await fillGuest(page);
  await page.getByRole('button', { name: /Place Trade Order|Pay & Place/i }).click();
  await page.getByText(/Add \d+ more bottles/i).first().waitFor({ timeout: 8000 });
});

await scenario('guest: spirits need age confirmation', async ({ page, context }) => {
  await loadCheckout(page, context, [cartItem(spirits, 13)]);
  await fillGuest(page);
  await page.getByRole('button', { name: /Place Trade Order|Pay & Place/i }).click();
  await page.getByText(/legal drinking age/i).first().waitFor({ timeout: 8000 });
});

await scenario('guest: Paystack order redirects to the Paystack page', async ({ page, context }) => {
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  await fillGuest(page);
  await page.getByRole('button', { name: /Pay & Place/i }).click();
  await page.waitForURL(/paystack/, { timeout: 30000 });
}, { needsPaystack: true });

await scenario('credit account sees credit, hits the limit, and can place an on-account order', async ({ page, context }) => {
  await login(context, 'credit');
  await loadCheckout(page, context, [cartItem(spirits, 60)]);
  assert(/Pay on Account/i.test(await body(page)), 'credit option missing for credit account');
  await page.getByText(/Pay on Account/i).first().click();
  await page.getByText(/I confirm I am 18/i).click();
  await page.getByRole('button', { name: /Confirm & Place/i }).click();
  await page.getByText(/Credit limit exceeded/i).first().waitFor({ timeout: 8000 });

  await context.clearCookies();
  await login(context, 'credit');
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  await page.getByText(/Pay on Account/i).first().click();
  await page.getByRole('button', { name: /Confirm & Place/i }).click();
  await page.waitForURL(/\/trade\/orders\/ord_tr_/, { timeout: 20000 });
});

await scenario('Nirvana: guest sees an account-required notice and cannot select it', async ({ page, context }) => {
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  const opt = page.getByTestId('nirvana-option');
  assert(/Nirvana/i.test(await opt.innerText()), 'Nirvana option missing for guest');
  assert(/need a trade account/i.test(await opt.innerText()), 'account-required notice missing');
  assert((await opt.locator('input[type=radio]').count()) === 0, 'guest can select Nirvana');
  await opt.click();
  assert(!/Original vehicle logbook/i.test(await body(page)), 'instructions shown to guest');
  assert(!/nirvana\.presta\.africa/i.test(await page.content()), 'link to Nirvana application must not be shown');
});

await scenario('Nirvana: account sees instructions, nothing can be placed', async ({ page, context }) => {
  await login(context, 'plain');
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  await page.getByTestId('nirvana-option').click();
  const text = await body(page);
  for (const needle of ['Original vehicle logbook', 'KRA PIN', 'national ID', 'passport-size photo', 'No stock is reserved|no stock is reserved']) {
    assert(new RegExp(needle, 'i').test(text), `missing: ${needle}`);
  }
  assert(await page.getByRole('button', { name: /Contact us to arrange funding/i }).isDisabled(), 'submit not disabled for Nirvana');
  assert(!/nirvana\.presta\.africa/i.test(await page.content()), 'link to Nirvana application must not be shown');
  await page.screenshot({ path: `${SHOTS}/nirvana-account.png`, fullPage: true });
});

await scenario('non-credit account does not see credit', async ({ page, context }) => {
  await login(context, 'plain');
  await loadCheckout(page, context, [cartItem(jaba, 15)]);
  assert(!/Pay on Account/i.test(await body(page)), 'credit option shown to non-credit account');
});

await scenario('viewer seat cannot place an order (403)', async ({ context }) => {
  await login(context, 'viewer');
  const res = await context.request.post(`${BASE}/api/trade/checkout`, {
    data: { items: [{ sku: jaba.sku, quantity: 15 }], paymentMethod: 'paystack' },
  });
  assert(res.status() === 403, `expected 403, got ${res.status()}`);
});

if (args.includes('--attacks')) {
  const post = (ctx, data) => ctx.post(`${BASE}/api/trade/checkout`, { data });
  const guest = { buyerName: 'TEST Attacker', buyerPhone: '0700000777', buyerEmail: `test.attack.${Date.now()}@example.test`, deliveryAddress: { addressLine: 'x', city: 'Nairobi' } };
  const line = (q = 15) => [{ sku: jaba.sku, quantity: q }];

  await scenario('attack: guest cannot pay on account (403)', async ({ context }) => {
    const r = await post(context.request, { ...guest, items: line(), paymentMethod: 'pay_on_account' });
    assert(r.status() === 403, `got ${r.status()}`);
  });
  await scenario('attack: non-credit account cannot pay on account', async ({ context }) => {
    await login(context, 'plain');
    const r = await post(context.request, { items: line(), paymentMethod: 'pay_on_account' });
    assert([400, 403].includes(r.status()), `got ${r.status()}`);
  });
  await scenario('attack: removed / unknown / disabled payment methods are refused', async ({ context }) => {
    for (const m of ['mpesa_paybill', 'nirvana', 'bank_transfer', '', null, 12345, { $ne: 1 }]) {
      const r = await post(context.request, { ...guest, items: line(), paymentMethod: m });
      assert(r.status() === 400, `method ${JSON.stringify(m)} got ${r.status()}`);
    }
  });
  await scenario('attack: tampered cost/price fields do not change the price', async ({ context }) => {
    await login(context, 'credit2');
    const honest = await (await post(context.request, { items: line(), paymentMethod: 'pay_on_account' })).json();
    const tampered = await (await post(context.request, {
      items: [{ sku: jaba.sku, quantity: 15, prkCostIncVat: 1, priceLine: 'spirits', unitPriceIncVat: 1, priceOverrides: { T0: 1 } }],
      paymentMethod: 'pay_on_account',
    })).json();
    assert(honest.order && tampered.order, `orders not created: ${JSON.stringify(honest).slice(0, 120)} / ${JSON.stringify(tampered).slice(0, 120)}`);
    assert(honest.order.grandTotal === tampered.order.grandTotal, `price changed: ${honest.order.grandTotal} vs ${tampered.order.grandTotal}`);
  });
  await scenario('attack: another account\'s address id is refused', async ({ context }) => {
    await login(context, 'credit2');
    const r = await post(context.request, { items: line(), paymentMethod: 'pay_on_account', deliveryAddress: { id: 'addr_belongs_to_someone_else' } });
    assert(r.status() === 400, `got ${r.status()}`);
  });
  await scenario('attack: oversized notes are truncated, markup stripped', async ({ context }) => {
    await login(context, 'credit2');
    const r = await post(context.request, { items: line(), paymentMethod: 'pay_on_account', notes: '<script>alert(1)</script>' + 'x'.repeat(100000) });
    const j = await r.json();
    assert(j.order, `not created: ${r.status()}`);
    assert(!String(j.order.notes).includes('<'), 'markup kept');
    assert(String(j.order.notes).length <= 500, `notes ${String(j.order.notes).length} chars`);
  });
  await scenario('attack: unknown SKU, zero/negative/fractional quantity are refused', async ({ context }) => {
    for (const items of [[{ sku: 'nope', quantity: 1 }], [{ sku: jaba.sku, quantity: 0 }], [{ sku: jaba.sku, quantity: -5 }], [{ sku: jaba.sku, quantity: 'abc' }], []]) {
      const r = await post(context.request, { ...guest, items, paymentMethod: 'paystack' });
      assert(r.status() === 400, `${JSON.stringify(items)} got ${r.status()}`);
    }
  });
  await scenario('attack: checkout is rate limited', async ({ context }) => {
    let limited = false;
    for (let i = 0; i < 30 && !limited; i += 1) {
      limited = (await post(context.request, { items: [], paymentMethod: 'paystack' })).status() === 429;
    }
    assert(limited, 'no 429 after 30 rapid requests');
  });
  await scenario('attack: public application endpoints are rate limited and reject bad links', async ({ context }) => {
    const bad = await context.request.post(`${BASE}/api/trade/apply`, { data: { tradingName: 'TEST Apply', contactName: 'x', email: 'test.apply@example.test', phone: '1', licenceDocumentUrl: 'javascript:alert(1)' } });
    assert(bad.status() === 400, `bad licence URL got ${bad.status()}`);
    let limited = false;
    for (let i = 0; i < 12 && !limited; i += 1) {
      limited = (await context.request.post(`${BASE}/api/trade/apply`, { data: {} })).status() === 429;
    }
    assert(limited, 'no 429 on /api/trade/apply');
  });
  await scenario('attack: webhook rejects a missing/forged signature', async ({ context }) => {
    const r = await context.request.post(`${BASE}/api/paystack/webhook`, { data: { event: 'charge.success', data: { reference: 'x' } }, headers: { 'x-paystack-signature': 'deadbeef' } });
    assert([401, 500].includes(r.status()), `got ${r.status()} (must never be 200)`);
  });
  await scenario('attack: trade/admin routes refuse anonymous callers', async ({ context }) => {
    for (const path of ['/api/trade/orders', '/api/trade/invoices/x', '/api/admin/trade/orders', '/api/admin/trade/accounts', '/api/admin/trade/config']) {
      const r = await context.request.get(`${BASE}${path}`);
      assert(r.status() === 401, `${path} got ${r.status()}`);
    }
  });
}

await browser.close();
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(width)}${r.note ? `  — ${r.note}` : ''}`);
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`\n${results.length - failed} ok/skipped, ${failed} failed. Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
