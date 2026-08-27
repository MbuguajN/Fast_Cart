'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { readCart, writeCart, addLine, changeQty, removeLine, hydrate } from './cart-storage.js';

const CartContext = createContext(null);

/**
 * Cart state.
 *
 * Every mutation is local and synchronous — no network call, so the badge
 * updates on the tap rather than after a ~1.5s round trip to the WooCommerce
 * origin. The order is priced and validated by WooCommerce at creation,
 * which is the only place that check has to happen.
 */
export function CartProvider({ children, initialProducts = [] }) {
  const [cart, setCart] = useState([]);
  const [upsellPopup, setUpsellPopup] = useState(null);
  const [products, setProducts] = useState(initialProducts);

  // What hydration changed, so the customer can be told.
  const [cartNotice, setCartNotice] = useState(null);

  const loaded = useRef(false);
  // Hydrate once per catalogue load, not on every cart change — otherwise
  // setCart inside the effect retriggers it.
  const hydratedFor = useRef(null);

  // Restore once on mount. Nothing is fetched.
  useEffect(() => {
    const stored = readCart(typeof window === 'undefined' ? null : window.localStorage);
    if (stored.length > 0) setCart(stored);
    loaded.current = true;
  }, []);

  // Persist after every change, but not before the initial read has run —
  // otherwise the empty starting state overwrites a stored cart.
  useEffect(() => {
    if (!loaded.current) return;
    writeCart(typeof window === 'undefined' ? null : window.localStorage, cart);
  }, [cart]);

  // Reconcile against the catalogue once products are available.
  useEffect(() => {
    if (!loaded.current || products.length === 0) return;
    if (hydratedFor.current === products) return;
    hydratedFor.current = products;

    setCart((prev) => {
      if (prev.length === 0) return prev;

      const { lines, removed, capped } = hydrate(prev, products);
      if (removed.length === 0 && capped.length === 0) return prev;

      queueMicrotask(() => setCartNotice({ removed, capped }));
      return lines;
    });
  }, [products]);

  const buzz = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  };

  const addToCart = useCallback((productId, variantId = null) => {
    buzz();
    setCart((prev) => addLine(prev, productId, variantId));

    const product = products.find((p) => p.id === productId);
    if (!product?.upsellIds?.length) return;

    const upsellProducts = product.upsellIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p) => p && p.purchasable !== false && p.inStock !== false);

    if (upsellProducts.length > 0) {
      setTimeout(() => {
        queueMicrotask(() => setUpsellPopup({ product, upsellProducts }));
      }, 300);
    }
  }, [products]);

  const incrementItem = useCallback((productId) => {
    buzz();
    setCart((prev) => changeQty(prev, productId, 1));
  }, []);

  const decrementItem = useCallback((productId) => {
    buzz();
    setCart((prev) => changeQty(prev, productId, -1));
  }, []);

  const removeItem = useCallback((productId) => {
    buzz();
    setCart((prev) => removeLine(prev, productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const getQuantity = useCallback(
    (productId) => cart.find((i) => i.id === productId)?.quantity || 0,
    [cart]
  );

  const dismissCartNotice = useCallback(() => setCartNotice(null), []);

  return (
    <CartContext.Provider value={{
      cart, setCart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity,
      upsellPopup, setUpsellPopup,
      products, setProducts,
      cartNotice, dismissCartNotice,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
