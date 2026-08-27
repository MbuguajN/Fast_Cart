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
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (user && account) {
      fetchCatalog();
    }
  }, [user, account, fetchCatalog]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hh_trade_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch (e) {}
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

    const isSpirits = product.priceLine === 'spirits' || (!product.priceLine && !product.categoryName?.toLowerCase().includes('jaba'));
    if (isSpirits) {
      if (!account?.licenceNo) {
        showNotification('Liquor licence required to order spirits lines.', 'error');
        return false;
      }
      if (account.licenceExpiry && new Date(account.licenceExpiry) < new Date()) {
        showNotification('Liquor licence expired. Cannot add spirits.', 'error');
        return false;
      }
    }

    const sku = product.sku || product.slug || String(product.wcId || product.id);
    const prkCost = Number(product.prkCostIncVat || product.cost || 0);
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
          prkCostIncVat: prkCost,
          quantity,
        },
      ];
    });

    showNotification(`Added ${quantity}x ${product.name} to order`, 'success');
    return true;
  };

  const updateQuantity = (skuOrId, newQty) => {
    const qty = Math.max(0, parseInt(newQty, 10) || 0);
    setCart((prev) => {
      if (qty === 0) {
        return prev.filter((i) => i.sku !== skuOrId && i.id !== skuOrId);
      }
      return prev.map((i) => (i.sku === skuOrId || i.id === skuOrId ? { ...i, quantity: qty } : i));
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
        minOrderCheck: { passed: false, bottleDeficit: 12, valueDeficit: 10000 },
        delivery: { isNairobi: true, isFreeDelivery: false, amountNeededForFree: 25000 },
        economics: { grossProfit: 0, grossMarginPercent: 0 },
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

