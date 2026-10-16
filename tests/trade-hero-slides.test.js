import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSlide, publicSlides, getHeroSlides, saveHeroSlide, removeHeroSlide, MAX_LIVE_SLIDES } from '../lib/trade/hero-slides.js';

const ok = { image: '/api/uploads/abc.webp', title: 'Jameson deal', link: '/trade/catalog' };

test('an image is required', () => {
  assert.throws(() => cleanSlide({ title: 'x' }), /image/i);
});

test('images must be a path on this site or an https URL', () => {
  for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/x.png', 'http://insecure.test/x.png', 'abc.png']) {
    assert.throws(() => cleanSlide({ image: bad }), /image/i, bad);
  }
  assert.equal(cleanSlide({ image: 'https://myhappyhour.co.ke/a.webp' }).image, 'https://myhappyhour.co.ke/a.webp');
  assert.equal(cleanSlide({ image: '/uploads/a.webp' }).image, '/uploads/a.webp');
});

test('links must be a site path or https, otherwise rejected; empty is allowed', () => {
  for (const bad of ['javascript:alert(1)', '//evil.test', 'http://x.test', 'vbscript:x', ' javascript:alert(1)']) {
    assert.throws(() => cleanSlide({ ...ok, link: bad }), /link/i, bad);
  }
  assert.equal(cleanSlide({ ...ok, link: '' }).link, '');
  assert.equal(cleanSlide({ ...ok, link: 'https://shop.test/p' }).link, 'https://shop.test/p');
});

test('text is trimmed, stripped of angle brackets and capped', () => {
  const s = cleanSlide({ ...ok, title: '<b>' + 'x'.repeat(500), subtitle: ' sub ', badge: 'y'.repeat(100), buttonText: 'z'.repeat(100) });
  assert.ok(!s.title.includes('<') && s.title.length <= 100);
  assert.equal(s.subtitle, 'sub');
  assert.ok(s.badge.length <= 30 && s.buttonText.length <= 30);
});

test('a new slide defaults to active with an id, and unknown fields are dropped', () => {
  const s = cleanSlide({ ...ok, evil: 'x', id: undefined });
  assert.equal(s.active, true);
  assert.match(s.id, /^hero_/);
  assert.ok(!('evil' in s));
});

test('publicSlides returns only active slides, in order, capped, with public fields only', () => {
  const slides = [
    { id: 'c', image: '/c', order: 3, active: true },
    { id: 'off', image: '/off', order: 0, active: false },
    { id: 'a', image: '/a', order: 1, active: true, secret: 'x' },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, image: `/n${i}`, order: 10 + i, active: true })),
  ];
  const out = publicSlides(slides);
  assert.equal(out.length, MAX_LIVE_SLIDES);
  assert.deepEqual(out.slice(0, 2).map((s) => s.id), ['a', 'c']);
  assert.ok(!out.some((s) => s.id === 'off'));
  assert.ok(!('secret' in out[0]));
});

test('publicSlides tolerates a missing list', () => {
  assert.deepEqual(publicSlides(undefined), []);
});

const created = [];
after(async () => { for (const id of created) await removeHeroSlide(id); });

test('slides can be saved, edited and removed', async () => {
  const saved = await saveHeroSlide({ ...ok, title: 'TEST slide' });
  created.push(saved.id);
  assert.ok((await getHeroSlides()).some((s) => s.id === saved.id));

  const edited = await saveHeroSlide({ ...saved, title: 'TEST edited', active: false });
  assert.equal(edited.id, saved.id);
  assert.equal((await getHeroSlides()).find((s) => s.id === saved.id).title, 'TEST edited');
  assert.equal((await getHeroSlides()).filter((s) => s.id === saved.id).length, 1);

  await removeHeroSlide(saved.id);
  assert.ok(!(await getHeroSlides()).some((s) => s.id === saved.id));
});
