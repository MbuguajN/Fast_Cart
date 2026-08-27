import test from 'node:test';
import assert from 'node:assert/strict';

const { coordinateKey, parseNominatim } = await import('../lib/geocode.js');

test('coordinates within one grid cell share a cache entry', () => {
  // 4 decimal places is about 11 m. Two readings inside the same cell round
  // to the same key, so a jittery GPS fix reuses the cached lookup.
  assert.equal(coordinateKey(-1.29206, 36.82191), coordinateKey(-1.29208, 36.82193));
});

test('coordinates in different cells get different keys', () => {
  assert.notEqual(coordinateKey(-1.29206, 36.82191), coordinateKey(-1.30206, 36.82191));
});

test('rounding is a grid, not a radius', () => {
  // Points a metre apart either side of a cell boundary get different keys.
  // That costs one extra upstream lookup, never a wrong answer — worth
  // pinning so nobody assumes proximity guarantees a cache hit.
  assert.notEqual(coordinateKey(-1.29206, 36.82194), coordinateKey(-1.29206, 36.82196));
});

test('absent coordinates are rejected rather than coerced to 0,0', () => {
  // Number(null) === 0 and Number('') === 0, which would otherwise geocode
  // to the Gulf of Guinea instead of erroring.
  assert.equal(coordinateKey(null, null), null);
  assert.equal(coordinateKey(undefined, undefined), null);
  assert.equal(coordinateKey('', ''), null);
  assert.equal(coordinateKey(null, 36.82), null);
});

test('invalid coordinates are rejected', () => {
  assert.equal(coordinateKey(NaN, 36), null);
  assert.equal(coordinateKey(-91, 36), null, 'latitude out of range');
  assert.equal(coordinateKey(-1.29, 181), null, 'longitude out of range');
});

test('a Nominatim response is reduced to the fields we use', () => {
  const parsed = parseNominatim({
    address: {
      road: 'Ngong Road',
      neighbourhood: 'Kilimani',
      suburb: 'Dagoretti North',
      city: 'Nairobi',
      country: 'Kenya',
      postcode: '00100',
    },
  });

  assert.deepEqual(parsed, {
    road: 'Ngong Road',
    neighbourhood: 'Kilimani',
    suburb: 'Dagoretti North',
    city: 'Nairobi',
  });
});

test('a malformed response yields empty fields rather than throwing', () => {
  assert.deepEqual(parseNominatim(null), { road: '', neighbourhood: '', suburb: '', city: '' });
  assert.deepEqual(parseNominatim({}), { road: '', neighbourhood: '', suburb: '', city: '' });
});
