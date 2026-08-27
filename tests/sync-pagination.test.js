import test from 'node:test';
import assert from 'node:assert/strict';

process.env.WOOCOMMERCE_STORE_URL ||= 'https://example.test';
process.env.WOOCOMMERCE_CONSUMER_KEY ||= 'ck_test';
process.env.WOOCOMMERCE_CONSUMER_SECRET ||= 'cs_test';

const { wcFetchAll } = await import('../lib/wc-config.js');

test('wcFetchAll pages past the 100-item ceiling', async () => {
  const realFetch = globalThis.fetch;
  const pagesRequested = [];

  globalThis.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get('page') || '1');
    pagesRequested.push(page);
    const items = Array.from({ length: page < 3 ? 50 : 6 }, (_, i) => ({ id: (page - 1) * 50 + i }));
    return {
      ok: true,
      headers: { get: (h) => (h === 'x-wp-totalpages' ? '3' : '106') },
      json: async () => items,
      text: async () => '',
    };
  };

  try {
    const all = await wcFetchAll('products', { status: 'publish' });
    assert.equal(all.length, 106, 'every page is collected, not just the first');
    assert.deepEqual(pagesRequested, [1, 2, 3]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('wcFetchAll sends credentials in the header, never the query string', async () => {
  const realFetch = globalThis.fetch;
  let seenUrl = '';
  let seenAuth = '';

  globalThis.fetch = async (url, opts) => {
    seenUrl = url;
    seenAuth = opts?.headers?.Authorization || '';
    return {
      ok: true,
      headers: { get: (h) => (h === 'x-wp-totalpages' ? '1' : '0') },
      json: async () => [],
      text: async () => '',
    };
  };

  try {
    await wcFetchAll('products');
    assert.ok(!seenUrl.includes('consumer_key'), 'no credentials in the URL');
    assert.ok(!seenUrl.includes('consumer_secret'), 'no credentials in the URL');
    assert.match(seenAuth, /^Basic /);
  } finally {
    globalThis.fetch = realFetch;
  }
});
