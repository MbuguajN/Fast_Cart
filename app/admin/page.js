'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const KPI_CONFIGS = [
  { key: 'products', label: 'Products', icon: '📦', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { key: 'categories', label: 'Categories', icon: '📂', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { key: 'brands', label: 'Brands', icon: '🏷️', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { key: 'outOfStock', label: 'Out of Stock', icon: '⚠️', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, productsRes] = await Promise.all([
        fetch('/api/admin/stats').catch(() => null),
        fetch('/api/admin/products').catch(() => null),
      ]);

      if (statsRes?.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (productsRes?.ok) {
        const products = await productsRes.json();
        if (Array.isArray(products)) {
          const low = products
            .filter((p) => p.stockStatus === 'instock' && p.stockQuantity != null && p.stockQuantity <= 5)
            .sort((a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0))
            .slice(0, 8);
          setLowStock(low);
        }
      }

      // Try to get recent orders
      try {
        const ordersRes = await fetch('/api/admin/orders?per_page=5');
        if (ordersRes?.ok) {
          const ordersData = await ordersRes.json();
          setRecentOrders(Array.isArray(ordersData) ? ordersData.slice(0, 5) : ordersData.orders?.slice(0, 5) || []);
        }
      } catch {
        // orders API may not exist yet
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      loadDashboard();
    } catch {
      setSyncResult({ error: 'Sync failed' });
    }
    setSyncing(false);
  };

  const statusColor = (status) => {
    const map = {
      'processing': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
      'completed': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
      'pending': { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
      'cancelled': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
      'on-hold': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
      'refunded': { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
    };
    return map[status] || { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.lastSync ? `Last synced ${new Date(stats.lastSync).toLocaleString()}` : 'Welcome back'}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 shadow-sm hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #840037, #b8004f)', fontFamily: 'Inter, sans-serif' }}
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Syncing...' : 'Sync WooCommerce'}
        </button>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {syncResult.error ? (
            <span>⚠️ {syncResult.error}</span>
          ) : (
            <span>✅ Synced {syncResult.products} products, {syncResult.categories} categories, {syncResult.brands} brands</span>
          )}
          <button onClick={() => setSyncResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CONFIGS.map((kpi) => (
          <div
            key={kpi.key}
            className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
            style={{ background: kpi.gradient }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-10 text-6xl flex items-center justify-center -mr-2 -mt-2">
              {kpi.icon}
            </div>
            <p className="text-xs font-medium opacity-80" style={{ fontFamily: 'Inter, sans-serif' }}>{kpi.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              {loading ? '—' : (stats[kpi.key] ?? '0')}
            </p>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-[#840037] hover:underline">View All →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-xs text-gray-400 italic py-6 text-center">No recent orders to display</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map((order) => {
                const sc = statusColor(order.status);
                return (
                  <div key={order.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">#{order.id || order.number}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: sc.bg, color: sc.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {order.billing?.first_name || order.customerName || 'Guest'} · {order.billing?.phone || order.phone || ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                      KSh {parseFloat(order.total || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
              Low Stock Alerts
            </h2>
            <Link href="/admin/products" className="text-xs font-medium text-[#840037] hover:underline">Manage →</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="px-5 pb-5">
              <p className="text-xs text-gray-400 italic py-6 text-center">All products are well stocked 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStock.map((p) => (
                <div key={p.wcId} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  {p.image && <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.categoryName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: (p.stockQuantity || 0) <= 2 ? '#fef2f2' : '#fffbeb',
                      color: (p.stockQuantity || 0) <= 2 ? '#dc2626' : '#d97706',
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (p.stockQuantity || 0) <= 2 ? '#dc2626' : '#d97706' }} />
                    {p.stockQuantity ?? 0} left
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Manage Products', href: '/admin/products', icon: '📦', desc: `${stats.products || 0} items` },
            { label: 'View Orders', href: '/admin/orders', icon: '📋', desc: 'Recent activity' },
            { label: 'Edit Banners', href: '/admin/slides', icon: '🖼️', desc: 'Homepage slides' },
            { label: 'Settings', href: '/admin/settings', icon: '⚙️', desc: 'Store config' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group"
            >
              <span className="text-2xl">{action.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800 group-hover:text-[#840037] transition-colors">{action.label}</p>
                <p className="text-[10px] text-gray-400">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
