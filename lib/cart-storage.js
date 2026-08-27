/**
 * Cart state, owned entirely by the client.
 *
 * The cart previously round-tripped to CoCart on every add, increment,
 * decrement and remove — about 1.5s to the WooCommerce origin per tap. None
 * of that was necessary: WooCommerce prices and validates the order at
 * creation, so the cart before that point is a local list of intentions.
 *
 * These functions are pure and take storage as an argument, so the rules are
 * testable without a browser.
 */

import { isPurchasable, maxOrderableQty } from './stock.js';

export const CART_KEY = 'liquordash_cart';

function isValidLine(line) {
  return Boolean(line) && Number.isFinite(Number(line.id)) && Number(line.quantity) > 0;
}

export function readCart(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const lines = Array.isArray(parsed) ? parsed : parsed?.lines;
    if (!Array.isArray(lines)) return [];

    return lines.filter(isValidLine).map((l) => ({
      id: Number(l.id),
      variantId: l.variantId ?? null,
      quantity: Number(l.quantity),
    }));
  } catch {
    // Unreadable or blocked storage starts an empty cart rather than
    // breaking the page.
    return [];
  }
}

export function writeCart(storage, lines) {
  if (!storage) return;
  try {
    storage.setItem(CART_KEY, JSON.stringify({ lines, updatedAt: new Date().toISOString() }));
  } catch {
    // Private browsing or a full quota. The in-memory cart still works for
    // this session; losing it on reload beats breaking the page.
  }
}

export function addLine(lines, id, variantId = null) {
  const existing = lines.find((l) => l.id === id);
  if (existing) {
    return lines.map((l) =>
      l.id === id ? { ...l, quantity: l.quantity + 1, variantId: variantId ?? l.variantId } : l
    );
  }
  return [...lines, { id, variantId, quantity: 1 }];
}

export function changeQty(lines, id, delta) {
  return lines
    .map((l) => (l.id === id ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
}

export function removeLine(lines, id) {
  return lines.filter((l) => l.id !== id);
}

/**
 * Reconcile a stored cart against the current catalogue.
 *
 * A cart can sit in localStorage for days. Lines that went out of stock are
 * removed and reported so the customer is told rather than discovering it at
 * payment; lines that exceed remaining stock are capped rather than dropped.
 *
 * @returns {{ lines, removed: Array<{id,name}>, capped: Array<{id,name,quantity}> }}
 */
export function hydrate(lines, catalog) {
  const byId = new Map(catalog.map((p) => [Number(p.wcId), p]));
  const kept = [];
  const removed = [];
  const capped = [];

  for (const line of lines) {
    const product = byId.get(Number(line.id));

    if (!product || !isPurchasable(product)) {
      removed.push({ id: line.id, name: product?.name || 'An item' });
      continue;
    }

    const max = maxOrderableQty(product);
    if (line.quantity > max) {
      kept.push({ ...line, quantity: max });
      capped.push({ id: line.id, name: product.name, quantity: max });
      continue;
    }

    kept.push(line);
  }

  return { lines: kept, removed, capped };
}
