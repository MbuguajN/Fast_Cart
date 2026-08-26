'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children, initialProducts = [] }) {
  const [cart, setCart] = useState([]);
  const [upsellPopup, setUpsellPopup] = useState(null);
  
  // Need to providePRODUCTS to context for upsells to work properly across pages
  // But for simplicity, we can fetch them or assume they are passed.
  const [products, setProducts] = useState(initialProducts);

  const syncCartAction = useCallback((action, data) => {
    fetch('/api/cart', {
      method: action,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(err => console.error('Cart sync failed:', err));
  }, []);

  useEffect(() => {
    fetch('/api/cart')
      .then((r) => {
        if (!r.ok) return null;
        return r.json().catch(() => null);
      })
      .then((data) => {
        if (data && data.items && Array.isArray(data.items)) {
          const mappedCart = data.items.map(item => ({
            id: item.id || item.product_id,
            item_key: item.item_key,
            variantId: item.variation_id || null,
            quantity: item.quantity?.value || item.quantity || 1,
          }));
          setCart(mappedCart);
        }
      })
      .catch(err => console.error('Failed to load cart', err));
  }, []);

  const addToCart = useCallback((productId, variantId = null) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const exists = prev.find((i) => i.id === productId);
      if (exists) {
        syncCartAction('PUT', { item_key: exists.item_key || productId, quantity: exists.quantity + 1 });
        return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1, variantId: variantId || i.variantId } : i);
      }
      syncCartAction('POST', { id: productId, quantity: 1, variation_id: variantId });
      return [...prev, { id: productId, variantId, quantity: 1 }];
    });

    const product = products.find((p) => p.id === productId);
    if (!product?.upsellIds?.length) return;

    const upsellProducts = product.upsellIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p) => p && p.inStock !== false);

    if (upsellProducts.length > 0) {
      setTimeout(() => {
        queueMicrotask(() => setUpsellPopup({ product, upsellProducts }));
      }, 300);
    }
  }, [products, syncCartAction]);

  const incrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (item) {
        syncCartAction('PUT', { item_key: item.item_key || productId, quantity: item.quantity + 1 });
      }
      return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i);
    });
  }, [syncCartAction]);

  const decrementItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (item && item.quantity > 1) {
        syncCartAction('PUT', { item_key: item.item_key || productId, quantity: item.quantity - 1 });
      } else if (item && item.quantity === 1) {
        syncCartAction('DELETE', { item_key: item.item_key || productId });
      }
      return prev.map((i) => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i).filter((i) => i.quantity > 0);
    });
  }, [syncCartAction]);

  const removeItem = useCallback((productId) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setCart((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (item) syncCartAction('DELETE', { item_key: item.item_key || productId });
      return prev.filter((i) => i.id !== productId);
    });
  }, [syncCartAction]);

  const clearCart = useCallback(() => {
    setCart([]);
    syncCartAction('DELETE', {});
  }, [syncCartAction]);

  const getQuantity = useCallback((productId) => cart.find((i) => i.id === productId)?.quantity || 0, [cart]);

  return (
    <CartContext.Provider value={{
      cart, setCart, addToCart, incrementItem, decrementItem, removeItem, clearCart, getQuantity,
      upsellPopup, setUpsellPopup,
      products, setProducts
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
