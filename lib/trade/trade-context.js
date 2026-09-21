'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  calculateTradeOrderPricing,
  evaluateMinimumOrderRule,
  evaluateDeliveryFee,
  calculateUpgradeNudge,
  roundCent,
} from './pricing-engine.js';

const TradeContext = createContext(null);

/**
 * Build a per-tier price map from the catalogue's already-public `tierPrices`
 * ladder, so the client-side cart preview (calculateTradeOrderPricing's
 * override branch) never needs the actual landed cost — only the wholesale
 * cost base is confidential; the resulting price at each tier is exactly
 * what the catalogue already shows everyone.
 */
function overridesFromTierPrices(product) {
  const isJaba = product?.priceLine === 'jaba';
  const overrides = {};
  for (const [tierKey, tier] of Object.entries(product?.tierPrices || {})) {
    overrides[tierKey] = isJaba ? tier.unitPriceExVat : tier.unitPriceIncVat;
  }
  return overrides;
}

export function TradeProvider({ children }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((msg, type = 'info') => {
    setNotification({ msg, type, id: Date.now() });
    setTimeout(() => setNotification(null), 4500);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trade/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
          setAccount(data.account);
          if (data.account?.addresses?.length > 0) {
            setSelectedAddress(data.account.addresses.find((a) => a.isDefault) || data.account.addresses[0]);
          }
        } else {
          setUser(null);
          setAccount(null);
        }
      }
    } catch (err) {
      console.error('Failed to load trade auth session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/trade/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.products || []);
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch wholesale catalog:', err);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      refreshAuth();
    });
  }, [refreshAuth]);

  // Catalogue is public — fetch it regardless of auth state.
  useEffect(() => {
    queueMicrotask(() => {
      fetchCatalog();
    });
  }, [fetchCatalog]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hh_trade_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          queueMicrotask(() => {
            setCart(parsed);
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('hh_trade_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  const login = async (identifier, password) => {
    const res = await fetch('/api/trade/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    setUser(data.user);
    setAccount(data.account);
    if (data.account?.addresses?.length > 0) {
      setSelectedAddress(data.account.addresses[0]);
    }
    showNotification(`Welcome back, ${data.user.name} (${data.account.tradingName})`, 'success');
    return data;
  };

  const logout = async () => {
    await fetch('/api/trade/auth', { method: 'DELETE' });
    setUser(null);
    setAccount(null);
    setCart([]);
    showNotification('Logged out from trade session', 'info');
  };

  const addToCart = (product, quantity = 1) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);

    const sku = product.sku || product.slug || String(product.wcId || product.id);
    const priceLine = product.priceLine || (product.categoryName?.toLowerCase().includes('jaba') ? 'jaba' : 'spirits');

    setCart((prev) => {
      const idx = prev.findIndex((i) => (i.sku && i.sku === sku) || i.id === product.id || i.id === product.wcId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: product.id || product.wcId,
          sku,
          name: product.name,
          image: product.image,
          categoryName: product.categoryName,
          priceLine,
          // Carried from the catalogue's public tier ladder — never the raw
          // landed cost — so the client-side preview prices the same tier
          // the same way the server checkout will (pricing-engine.js's
          // override branch).
          priceOverrides: overridesFromTierPrices(product),
          quantity,
        },
      ];
    });

    showNotification(`Added ${quantity}x ${product.name} to order`, 'success');
    return true;
  };

  const updateQuantity = (skuOrId, newQty, productFallback = null) => {
    const qty = Math.max(0, parseInt(newQty, 10) || 0);
    setCart((prev) => {
      if (qty === 0) {
        return prev.filter((i) => i.sku !== skuOrId && i.id !== skuOrId);
      }
      const existingIdx = prev.findIndex((i) => i.sku === skuOrId || i.id === skuOrId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], quantity: qty };
        return updated;
      }

      // If item is not yet in cart, find product from fallback or catalog
      const product =
        productFallback ||
        catalog.find((p) => p.sku === skuOrId || p.id === skuOrId);

      if (product) {
        const sku = product.sku || product.id || skuOrId;
        const priceLine =
          product.priceLine ||
          (product.categoryName?.toLowerCase().includes('jaba') ? 'jaba' : 'spirits');

        return [
          ...prev,
          {
            id: product.id || product.wcId || sku,
            sku,
            name: product.name,
            image: product.image || '/images/bottle-placeholder.png',
            categoryName: product.categoryName || '',
            priceLine,
            priceOverrides: overridesFromTierPrices(product),
            quantity: qty,
          },
        ];
      }

      return prev;
    });
  };

  const removeItem = (skuOrId) => {
    setCart((prev) => prev.filter((i) => i.sku !== skuOrId && i.id !== skuOrId));
    showNotification('Item removed from trade cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const loadTemplateIntoCart = (templateItems) => {
    if (!Array.isArray(templateItems)) return;
    setCart((prev) => {
      const copy = [...prev];
      for (const item of templateItems) {
        const sku = item.sku;
        const idx = copy.findIndex((i) => i.sku === sku);
        if (idx >= 0) {
          copy[idx].quantity += item.quantity;
        } else {
          copy.push({
            id: item.sku,
            sku: item.sku,
            name: item.name,
            image: item.image || '/images/bottle-placeholder.png',
            categoryName: item.categoryName || '',
            priceLine: item.priceLine || 'spirits',
            prkCostIncVat: item.prkCostIncVat || 0,
            quantity: item.quantity,
          });
        }
      }
      return copy;
    });
    showNotification('Template items loaded into cart', 'success');
  };

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/trade/templates');
      if (res.ok) {
        const data = await res.json();
        if (data.templates) {
          setTemplates(data.templates);
        }
      }
    } catch (err) {
      console.error('Failed to refresh trade templates:', err);
    }
  }, []);

  const saveTemplate = async (templateData) => {
    try {
      const isUpdate = !!templateData.id;
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch('/api/trade/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template');
      }
      await refreshTemplates();
      showNotification(
        isUpdate ? `Template "${templateData.name}" updated` : `Template "${templateData.name}" created`,
        'success'
      );
      return data.template;
    } catch (err) {
      showNotification(err.message || 'Failed to save template', 'error');
      throw err;
    }
  };

  const deleteTemplate = async (templateId) => {
    try {
      const res = await fetch(`/api/trade/templates?id=${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete template');
      }
      await refreshTemplates();
      showNotification('Template deleted successfully', 'info');
      return true;
    } catch (err) {
      showNotification(err.message || 'Failed to delete template', 'error');
      throw err;
    }
  };

  const cartPricing = useMemo(() => {
    if (!cart.length) {
      return {
        items: [],
        totalBottles: 0,
        subtotalExVat: 0,
        vatTotal: 0,
        subtotalIncVat: 0,
        deliveryFee: 0,
        grandTotal: 0,
        minOrderCheck: { passed: false, message: 'Minimum wholesale order is 12 bottles or KES 10,000 ex-VAT', bottleDeficit: 12, valueDeficit: 10000 },
        delivery: { isNairobi: true, isFreeDelivery: false, amountNeededForFree: 25000 },
        savingsVsBaseTier: 0,
      };
    }

    return calculateTradeOrderPricing({
      items: cart,
      tierOverride: account?.tierOverride || null,
      isNairobi: selectedAddress?.city?.toLowerCase()?.includes('nairobi') ?? true,
      city: selectedAddress?.city || 'Nairobi',
      referralCredit: account?.referralCredit || 0,
    });
  }, [cart, account, selectedAddress]);

  const value = {
    user,
    account,
    loading,
    cart,
    setCart,
    catalog,
    templates,
    selectedAddress,
    setSelectedAddress,
    cartPricing,
    notification,
    showNotification,
    login,
    logout,
    refreshAuth,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    loadTemplateIntoCart,
    refreshTemplates,
    saveTemplate,
    deleteTemplate,
  };

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>;
}

export function useTrade() {
  const context = useContext(TradeContext);
  if (!context) {
    throw new Error('useTrade must be used within a TradeProvider');
  }
  return context;
}

