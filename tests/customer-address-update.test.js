import test from 'node:test';
import assert from 'node:assert/strict';

process.env.WOOCOMMERCE_STORE_URL ||= 'https://example.test';
process.env.WOOCOMMERCE_CONSUMER_KEY ||= 'ck_test';
process.env.WOOCOMMERCE_CONSUMER_SECRET ||= 'cs_test';

const { findOrCreateCustomer } = await import('../lib/customer.js');

function existingCustomerFixture() {
  return {
    id: 4242,
    first_name: 'Jane',
    last_name: 'Doe',
    billing: { phone: '0712345678', address_1: 'Old Address, Old Estate', city: 'Old Zone', first_name: 'Jane', last_name: 'Doe' },
    shipping: { phone: '0712345678', address_1: 'Old Address, Old Estate', city: 'Old Zone', first_name: 'Jane', last_name: 'Doe' },
    meta_data: [
      { id: 1, key: 'landmark_hint', value: 'Old Address, Old Estate' },
      { id: 2, key: 'delivery_zone', value: 'Old Zone' },
      { id: 3, key: 'phone_normalized', value: '0712345678' },
    ],
  };
}

/**
 * A returning customer resolving via findCustomerByPhone's search strategy,
 * plus a PUT capture for whatever findOrCreateCustomer sends back.
 */
function mockWooCommerce(existingCustomer) {
  let capturedPutBody = null;
  let putCount = 0;

  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';

    if (u.pathname.endsWith('/customers') && method === 'GET') {
      return { ok: true, headers: { get: () => '1' }, json: async () => [existingCustomer], text: async () => '[]' };
    }
    if (u.pathname.endsWith(`/customers/${existingCustomer.id}`) && method === 'PUT') {
      putCount++;
      capturedPutBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ...existingCustomer, ...capturedPutBody }), text: async () => '{}' };
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  };

  return { fetchImpl, getPutBody: () => capturedPutBody, getPutCount: () => putCount };
}

test('a returning customer picking a new delivery location gets their profile updated, not stuck on their first address', async () => {
  const realFetch = globalThis.fetch;
  const existing = existingCustomerFixture();
  const mock = mockWooCommerce(existing);
  globalThis.fetch = mock.fetchImpl;

  try {
    const result = await findOrCreateCustomer({
      phone: '0712345678',
      name: 'Jane Doe',
      landmark: 'New Building, New Estate',
      zone: 'New Zone',
    });

    assert.equal(result.id, existing.id, 'the existing customer record is reused, not duplicated');
    assert.equal(mock.getPutCount(), 1, 'the profile is written exactly once');

    const put = mock.getPutBody();
    assert.equal(put.billing.address_1, 'New Building, New Estate');
    assert.equal(put.shipping.address_1, 'New Building, New Estate');
    assert.equal(put.billing.city, 'New Zone');
    assert.equal(put.shipping.city, 'New Zone');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('updating the address replaces the old landmark/zone meta rather than appending a duplicate', async () => {
  const realFetch = globalThis.fetch;
  const existing = existingCustomerFixture();
  const mock = mockWooCommerce(existing);
  globalThis.fetch = mock.fetchImpl;

  try {
    await findOrCreateCustomer({
      phone: '0712345678',
      name: 'Jane Doe',
      landmark: 'New Building, New Estate',
      zone: 'New Zone',
    });

    const meta = mock.getPutBody().meta_data;
    const landmarkEntries = meta.filter((m) => m.key === 'landmark_hint');
    const zoneEntries = meta.filter((m) => m.key === 'delivery_zone');

    // A regression here means /api/auth/session's Array.find keeps returning
    // the *first* (oldest, stale) match forever, because WooCommerce appends
    // meta_data pushed without a matching id rather than replacing it.
    assert.equal(landmarkEntries.length, 1, 'exactly one landmark_hint entry survives');
    assert.equal(zoneEntries.length, 1, 'exactly one delivery_zone entry survives');
    assert.equal(landmarkEntries[0].value, 'New Building, New Estate');
    assert.equal(zoneEntries[0].value, 'New Zone');
    assert.ok(meta.some((m) => m.key === 'phone_normalized'), 'unrelated meta entries are preserved');
  } finally {
    globalThis.fetch = realFetch;
  }
});
