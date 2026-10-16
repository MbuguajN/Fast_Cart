/**
 * Promotional slides for the trade landing page hero, managed from the trade
 * admin. Stored in the trade JSON store under `heroSlides`.
 */
import crypto from 'crypto';
import { readTradeStore, mutateTradeStore } from './trade-store.js';

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
  return [...(readTradeStore().heroSlides || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function saveHeroSlide(input) {
  const slide = cleanSlide(input);
  await mutateTradeStore((store) => {
    const list = store.heroSlides || (store.heroSlides = []);
    const i = list.findIndex((s) => s.id === slide.id);
    if (i >= 0) list[i] = slide;
    else list.push(slide);
  });
  return slide;
}

export async function removeHeroSlide(id) {
  await mutateTradeStore((store) => {
    store.heroSlides = (store.heroSlides || []).filter((s) => s.id !== id);
  });
}
