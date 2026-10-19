/**
 * Promotional slides for the trade landing page hero, managed from the trade
 * admin. Stored in the trade JSON store under `heroSlides`.
 */
import crypto from 'crypto';
import { readTradeStore, mutateTradeStore } from './trade-store.js';
import { query, ensureTradeDb } from './trade-pg.js';

export const MAX_LIVE_SLIDES = 8;

const text = (value, max) =>
  typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, max) : '';

/** A path on this site (not protocol-relative) or an https URL. Never script/data/http. */
function safeUrl(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  return null;
}

export function cleanSlide(input) {
  const image = safeUrl(input?.image);
  if (!image) throw new Error('A slide image is required (upload one, or use an https image address).');

  let link = '';
  if (input?.link !== undefined && String(input.link).trim() !== '') {
    link = safeUrl(input.link);
    if (!link) throw new Error('Slide link must be a page on this site (starting with /) or an https address.');
  }

  const order = Number.parseInt(input?.order, 10);
  return {
    id: typeof input?.id === 'string' && input.id.startsWith('hero_') ? input.id : `hero_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    image,
    title: text(input?.title, 100),
    subtitle: text(input?.subtitle, 200),
    badge: text(input?.badge, 30),
    buttonText: text(input?.buttonText, 30),
    link,
    order: Number.isFinite(order) ? order : 0,
    active: input?.active === undefined ? true : input.active === true,
  };
}

/** What the public landing page may see: live slides only, in order, capped. */
export function publicSlides(slides) {
  return (Array.isArray(slides) ? slides : [])
    .filter((s) => s?.active === true && s.image)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, MAX_LIVE_SLIDES)
    .map(({ id, image, title, subtitle, badge, buttonText, link }) => ({ id, image, title, subtitle, badge, buttonText, link }));
}

export async function getHeroSlides() {
  try {
    await ensureTradeDb();
    const res = await query(`SELECT value FROM trade_config WHERE key = 'hero_slides'`);
    if (res.rows.length > 0 && Array.isArray(res.rows[0].value)) {
      return [...res.rows[0].value].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  } catch (err) {
    console.error('getHeroSlides: postgres query failed, falling back to JSON store:', err.message);
  }
  return [...(readTradeStore().heroSlides || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveHeroSlide(input) {
  const slide = cleanSlide(input);
  const slides = await getHeroSlides();
  const i = slides.findIndex((s) => s.id === slide.id);
  if (i >= 0) slides[i] = slide;
  else slides.push(slide);

  try {
    await ensureTradeDb();
    await query(
      `INSERT INTO trade_config (key, value, updated_at)
       VALUES ('hero_slides', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(slides)]
    );
  } catch (err) {
    console.error('saveHeroSlide: postgres update failed:', err.message);
  }

  try {
    await mutateTradeStore((store) => {
      const list = store.heroSlides || (store.heroSlides = []);
      const idx = list.findIndex((s) => s.id === slide.id);
      if (idx >= 0) list[idx] = slide;
      else list.push(slide);
    });
  } catch (err) {
    console.warn('Non-fatal: could not sync hero slide to fallback JSON store:', err.message);
  }

  return slide;
}

export async function removeHeroSlide(id) {
  const slides = (await getHeroSlides()).filter((s) => s.id !== id);
  try {
    await ensureTradeDb();
    await query(
      `INSERT INTO trade_config (key, value, updated_at)
       VALUES ('hero_slides', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(slides)]
    );
  } catch (err) {
    console.error('removeHeroSlide: postgres update failed:', err.message);
  }

  try {
    await mutateTradeStore((store) => {
      store.heroSlides = (store.heroSlides || []).filter((s) => s.id !== id);
    });
  } catch (err) {
    console.warn('Non-fatal: could not remove hero slide from fallback JSON store:', err.message);
  }
}
