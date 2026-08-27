import test from 'node:test';
import assert from 'node:assert/strict';

const { isAuthorisedCron, sinceParam } = await import('../lib/cron-auth.js');

test('a request without the secret is refused', () => {
  assert.equal(isAuthorisedCron('', 'expected-secret'), false);
  assert.equal(isAuthorisedCron(null, 'expected-secret'), false);
  assert.equal(isAuthorisedCron('wrong', 'expected-secret'), false);
});

test('a matching secret is accepted', () => {
  assert.equal(isAuthorisedCron('expected-secret', 'expected-secret'), true);
});

test('an unconfigured secret refuses everything rather than allowing everything', () => {
  assert.equal(isAuthorisedCron('anything', ''), false);
  assert.equal(isAuthorisedCron('', ''), false);
  assert.equal(isAuthorisedCron('anything', undefined), false);
});

test('the since window overlaps the last sync so nothing falls between runs', () => {
  const last = '2026-08-27T12:00:00.000Z';
  const since = sinceParam(last, 120000);
  assert.ok(since < last, 'the window starts before the last sync');
  assert.equal(new Date(last) - new Date(since), 120000);
});

test('with no previous sync the window falls back to a fixed lookback', () => {
  const since = sinceParam(null, 120000);
  assert.ok(since, 'always returns something usable');
  assert.ok(new Date(since) < new Date());
});
