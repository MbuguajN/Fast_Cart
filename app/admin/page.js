'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, categories: 0, brands: 0, outOfStock: 0 });
  const [syncStatus, setSyncStatus] = useState({ lastSync: null, syncStatus: 'idle' });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [productsRes, brandsRes, syncRes] = await Promise.all([
        fetch('/api/admin/products').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/brands').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/sync', { method: 'HEAD' }).then((r) => r.json()).catch(() => ({})),
      ]);

      const products = Array.isArray(productsRes) ? productsRes : [];
      const brands = Array.isArray(brandsRes) ? brandsRes : [];
      const outOfStock = products.filter((p) => p.stockStatus === 'outofstock').length;
      const categories = [...new Set(products.map((p) => p.categoryName).filter(Boolean))];

      queueMicrotask(() => {
        setStats({
          products: products.length,
          categories: categories.length,
          brands: brands.length,
          outOfStock,
        });
        setSyncStatus(syncRes);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ ok: true, message: `Synced ${data.products} products, ${data.brands} brands, ${data.categories} categories` });
        loadStats();
      } else {
        setSyncResult({ ok: false, message: data.error || 'Sync failed' });
      }
    } catch (err) {
      setSyncResult({ ok: false, message: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const cards = [
    { label: 'Products', value: stats.products, color: '#840037', bg: 'rgba(132,0,55,0.1)' },
    { label: 'Categories', value: stats.categories, color: '#5b0024', bg: 'rgba(91,0,36,0.1)' },
    { label: 'Brands', value: stats.brands, color: '#5f5e5e', bg: 'rgba(95,94,94,0.1)' },
    { label: 'Out of Stock', value: stats.outOfStock, color: '#dc3545', bg: 'rgba(220,53,69,0.1)' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-xl font-bold"
          style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
        >
          Dashboard
        </h1>
        <button
          onClick={triggerSync}
          disabled={syncing}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{
            backgroundColor: syncing ? '#ccc' : '#840037',
            fontFamily: 'Montserrat, sans-serif',
            opacity: syncing ? 0.7 : 1,
          }}
        >
          {syncing ? 'Syncing…' : 'Sync WooCommerce'}
        </button>
      </div>

      {syncResult && (
        <div
          className="mb-4 p-3 rounded-lg text-sm font-semibold"
          style={{
            backgroundColor: syncResult.ok ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)',
            color: syncResult.ok ? '#28a745' : '#dc3545',
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          {syncResult.message}
        </div>
      )}

      {syncStatus.lastSync && (
        <p className="text-xs mb-4" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
          Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#E9ECEF' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className="p-4 rounded-xl"
              style={{ backgroundColor: c.bg }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: c.color, fontFamily: 'Montserrat, sans-serif' }}>
                {c.label}
              </p>
              <p className="text-2xl font-bold" style={{ color: c.color, fontFamily: 'Montserrat, sans-serif' }}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
