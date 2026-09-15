'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

const KPI_CONFIGS = [
  { key: 'products', label: 'Products', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg> },
  { key: 'revenue', label: 'Total Revenue', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, isCurrency: true },
  { key: 'orders', label: 'Total Orders', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg> },
  { key: 'outOfStock', label: 'Out of Stock', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [orders, setOrders] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [statsRes, productsRes, ordersRes] = await Promise.all([
        fetch('/api/admin/stats').catch(() => null),
        fetch('/api/admin/products').catch(() => null),
        fetch('/api/admin/trade/orders').catch(() => null),
      ]);

      let productsCount = 0;
      let outOfStockCount = 0;

      if (statsRes?.ok) {
        const data = await statsRes.json();
        productsCount = data.products || 0;
        outOfStockCount = data.outOfStock || 0;
        setStats((prev) => ({ ...prev, ...data }));
      }

      if (productsRes?.ok) {
        const products = await productsRes.json();
        if (Array.isArray(products)) {
          const low = products
            .filter((p) => p.stockStatus === 'instock' && p.stockQuantity != null && p.stockQuantity <= 5)
            .sort((a, b) => (a.stockQuantity || 0) - (b.stockQuantity || 0));
          setLowStock(low);
        }
      }

      if (ordersRes?.ok) {
        const ordersData = await ordersRes.json();
        const allOrders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || []);
        setOrders(allOrders);
        setRecentOrders(allOrders.slice(0, 8));
        
        // Calculate Revenue and Orders count
        const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
        setStats((prev) => ({
          ...prev,
          revenue: totalRevenue,
          orders: allOrders.length,
          products: prev.products || productsCount,
          outOfStock: prev.outOfStock || outOfStockCount,
        }));
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
      'dispatched': { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
      'delivered': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
      'confirmed': { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
    };
    return map[status] || { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' };
  };

  // Analytics Calculations
  const analytics = useMemo(() => {
    if (!orders.length) return null;

    // Last 7 days revenue chart data
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const revenueByDay = last7Days.reduce((acc, date) => ({ ...acc, [date]: 0 }), {});
    
    // Top selling logic
    const productSales = {};

    orders.forEach(o => {
      const date = new Date(o.createdAt || new Date()).toISOString().split('T')[0];
      if (revenueByDay[date] !== undefined) {
        revenueByDay[date] += Number(o.grandTotal || 0);
      }
      
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (!productSales[item.name]) productSales[item.name] = 0;
          productSales[item.name] += Number(item.quantity || 1);
        });
      }
    });

    const maxDailyRevenue = Math.max(...Object.values(revenueByDay), 1);
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxProductVolume = topProducts.length ? topProducts[0][1] : 1;

    return {
      revenueByDay: Object.entries(revenueByDay).map(([date, val]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        val,
        height: `${(val / maxDailyRevenue) * 100}%`
      })),
      topProducts: topProducts.map(([name, qty]) => ({
        name,
        qty,
        width: `${(qty / maxProductVolume) * 100}%`
      }))
    };
  }, [orders]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg> },
    { id: 'analytics', label: 'Analytics Insights', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
    { id: 'alerts', label: 'Stock Alerts', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>, badge: lowStock.length },
    { id: 'actions', label: 'Quick Actions', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg> },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[80vh] font-sans">
      
      {/* Vertical Navigation Sidebar */}
      <div className="w-full lg:w-64 shrink-0 space-y-2">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs mb-4">
          <div className="flex items-center gap-3 mb-2">
            <img src="/images/happy-hour-logo.png" alt="Happy Hour" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="text-sm font-black text-gray-900 tracking-tight">HAPPY HOUR</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin Hub</p>
            </div>
          </div>
        </div>

        <nav className="bg-white p-2 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#840038] text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </div>
              {tab.badge > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-white text-[#840038]' : 'bg-amber-100 text-amber-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sync Button in Sidebar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs mt-4">
          <p className="text-[10px] text-gray-500 mb-2 font-medium">WooCommerce Integration</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#840038] bg-pink-50 border border-pink-100 hover:bg-pink-100 transition-all disabled:opacity-60"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
          {syncResult && (
             <div className="mt-3 text-[10px] font-medium text-center">
               {syncResult.error ? (
                 <span className="text-red-600">{syncResult.error}</span>
               ) : (
                 <span className="text-emerald-600">✓ Sync successful</span>
               )}
             </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6 min-w-0">
        
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {KPI_CONFIGS.map((kpi) => (
                <div
                  key={kpi.key}
                  className="relative overflow-hidden rounded-2xl p-5 bg-white border border-gray-100 shadow-xs hover:shadow-md transition-shadow group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity flex items-center justify-center -mr-2 -mt-2 text-[#840038]">
                    {kpi.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-gray-50 p-1.5 rounded-lg text-gray-400">{kpi.icon}</span>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-2">
                    {loading ? '—' : kpi.isCurrency 
                      ? `KES ${(stats[kpi.key] || 0).toLocaleString()}` 
                      : (stats[kpi.key] ?? '0')}
                  </p>
                </div>
              ))}
            </div>

            {/* Recent Orders Overview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
                <Link href="/admin/trade" className="text-xs font-bold text-[#840038] hover:underline bg-pink-50 px-3 py-1.5 rounded-lg">View Trade Hub →</Link>
              </div>
              {recentOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No recent orders found</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentOrders.map((order) => {
                    const sc = statusColor(order.status);
                    return (
                      <div key={order.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center">
                            <span className="text-[10px] text-gray-400 font-bold">ORD</span>
                            <span className="text-xs font-black text-gray-800">#{order.orderNumber || order.id}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{order.accountName || order.billing?.first_name || 'Trade Client'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                                style={{ backgroundColor: sc.bg, color: sc.text }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                                {order.status}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gray-900">KES {parseFloat(order.grandTotal || order.total || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{order.items?.length || 0} lines</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
              <div>
                <h2 className="text-base font-black text-gray-900">Performance Analytics</h2>
                <p className="text-xs text-gray-500 mt-1">Revenue and volume insights based on recent trade orders.</p>
              </div>

              {!analytics ? (
                <div className="py-20 text-center text-sm text-gray-400 font-medium">Not enough data to generate analytics.</div>
              ) : (
                <div className="mt-8 space-y-10">
                  
                  {/* Revenue Chart */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#840038]"></span>
                      7-Day Revenue Trend
                    </h3>
                    <div className="h-48 flex items-end gap-2 sm:gap-4 mt-6">
                      {analytics.revenueByDay.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                          {/* Tooltip */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none z-10">
                            KES {day.val.toLocaleString()}
                          </div>
                          
                          {/* Bar */}
                          <div className="w-full bg-pink-50 rounded-t-lg relative overflow-hidden flex items-end justify-center h-full">
                            <div 
                              className="w-full bg-[#840038] rounded-t-lg transition-all duration-700 ease-out" 
                              style={{ height: day.height, minHeight: day.val > 0 ? '4px' : '0' }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500">{day.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Selling Products */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Top Selling Products (Volume)
                    </h3>
                    <div className="space-y-4">
                      {analytics.topProducts.map((prod, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-6 text-xs font-black text-gray-400 text-right">#{i + 1}</div>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="font-bold text-gray-800">{prod.name}</span>
                              <span className="font-bold text-[#840038]">{prod.qty} units</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: prod.width }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-amber-50/30">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Low Stock Alerts
                  </h2>
                  <p className="text-[10px] text-gray-500 mt-0.5">Products with 5 or fewer units in stock.</p>
                </div>
                <Link href="/admin/products" className="text-xs font-bold text-amber-700 hover:underline bg-amber-100 px-3 py-1.5 rounded-lg">Manage Stock →</Link>
              </div>
              
              {lowStock.length === 0 ? (
                <div className="px-5 pb-5">
                  <p className="text-xs text-gray-400 italic py-10 text-center font-medium">All products are well stocked 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lowStock.map((p) => (
                    <div key={p.wcId || p.sku} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                      {p.image ? (
                        <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-xs" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 font-medium">{p.categoryName || 'Uncategorized'} · SKU: {p.sku}</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-xs shadow-xs"
                        style={{
                          backgroundColor: (p.stockQuantity || 0) <= 2 ? '#fef2f2' : '#fffbeb',
                          color: (p.stockQuantity || 0) <= 2 ? '#dc2626' : '#d97706',
                          border: `1px solid ${(p.stockQuantity || 0) <= 2 ? '#fecaca' : '#fde68a'}`
                        }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (p.stockQuantity || 0) <= 2 ? '#dc2626' : '#d97706' }} />
                        {p.stockQuantity ?? 0} units left
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: ACTIONS */}
        {activeTab === 'actions' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6">
              <h2 className="text-sm font-black text-gray-900 mb-6 uppercase tracking-wider">Store Management</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[
                  { label: 'B2B Trade Hub', href: '/admin/trade', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>, desc: 'Orders, Margin Audit & Accounts', color: 'bg-blue-50 text-blue-600' },
                  { label: 'Products & Pricing', href: '/admin/products', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>, desc: 'Catalogue and stock levels', color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'Delivery Zones', href: '/admin/zones', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>, desc: 'Configure shipping regions', color: 'bg-purple-50 text-purple-600' },
                  { label: 'Homepage Banners', href: '/admin/slides', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>, desc: 'Edit marketing slides', color: 'bg-amber-50 text-amber-600' },
                  { label: 'Customers', href: '/admin/customers', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, desc: 'Retail user management', color: 'bg-cyan-50 text-cyan-600' },
                  { label: 'System Settings', href: '/admin/settings', icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>, desc: 'Global store configuration', color: 'bg-gray-50 text-gray-600' },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex flex-col p-5 rounded-2xl border border-gray-100 hover:border-[#840038] hover:shadow-md transition-all group"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${action.color} group-hover:scale-110 transition-transform`}>
                      {action.icon}
                    </div>
                    <p className="text-sm font-bold text-gray-900 group-hover:text-[#840038] transition-colors">{action.label}</p>
                    <p className="text-xs text-gray-500 font-medium mt-1">{action.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
