import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBrandName } from '../lib/trade/public-brand.js';

test('the supplier partnership is never exposed through the brand field', () => {
  assert.equal(publicBrandName('Pernod Ricard', false), '');
  assert.equal(publicBrandName('  PERNOD RICARD KENYA ', false), '');
});

test('real consumer brands pass through; Jaba defaults to Jaba', () => {
  assert.equal(publicBrandName('Jameson Irish Whiskey', false), 'Jameson Irish Whiskey');
  assert.equal(publicBrandName('', true), 'Jaba');
  assert.equal(publicBrandName(undefined, false), '');
});
