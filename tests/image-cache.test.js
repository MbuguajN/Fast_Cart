import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { getLocalImageFilename, cacheProductImage, cacheProductImages } from '../lib/image-cache.js';

test('getLocalImageFilename returns clean sanitized filename with hash', () => {
  const url = 'https://myhappyhour.co.ke/wp-content/uploads/2026/03/freepik__talk__61619-1.webp';
  const filename = getLocalImageFilename(url, 'prod_123');
  assert.match(filename, /^prod_123_freepik__talk__61619-1_[a-f0-9]{8}\.webp$/);
});

test('cacheProductImage passes through local URLs unchanged', async () => {
  const localUrl = '/uploads/products/sample.webp';
  const res = await cacheProductImage(localUrl);
  assert.equal(res, localUrl);
});

test('cacheProductImage passes through non-string or non-http values', async () => {
  assert.equal(await cacheProductImage(null), null);
  assert.equal(await cacheProductImage(''), '');
  assert.equal(await cacheProductImage('data:image/png;base64,123'), 'data:image/png;base64,123');
});

test('cacheProductImages handles array with local and empty values', async () => {
  const urls = ['/uploads/1.webp', ''];
  const res = await cacheProductImages(urls);
  assert.deepEqual(res, ['/uploads/1.webp', '']);
});

