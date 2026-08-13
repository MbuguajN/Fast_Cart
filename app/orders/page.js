'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';

const STATUS_COLORS = {
  pending: { bg: '#FFF3CD', text: '#856404' },
  processing: { bg: '#D1ECF1', text: '#0C5460' },
  'on-hold': { bg: '#FFE8CC', text: '#856404' },
  completed: { bg: '#D4EDDA', text: '#155724' },
  cancelled: { bg: '#F8D7DA', text: '#721C24' },
  refunded: { bg: '#E2E3E5', text: '#383D41' },
  failed: { bg: '#F8D7DA', text: '#721C24' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function OrdersContent() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (user?.phone && !phoneSearch) {
      setPhoneSearch(user.phone);
    }
  }, [user, phoneSearch]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user?.customerId) params.set('customer', user.customerId);
      if (phoneSearch.trim()) params.set('phone', phoneSearch.trim());
      if (dateFrom) params.set('after', dateFrom + 'T00:00:00');
      if (dateTo) params.set('before', dateTo + 'T23:59:59');

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      queueMicrotask(() => {
        setOrders(data.orders || []);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, [user?.customerId, phoneSearch, dateFrom, dateTo]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handlePhoneSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders();
  };

  const filteredOrders = orders.filter((o) => {
    if (filter === 'all') return true;
    return o.status?.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      {/* Top Header Nav */}
      <header className="fixed top-0 w-full z-50 shadow-md bg-[#840037] text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-sm hover:opacity-80 transition-opacity">
            <span>← Back to Store</span>
          </Link>
          <h1 className="font-extrabold text-base md:text-lg tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Order History & Tracking
          </h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16 w-full flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Sidebar: Lookup & Filter Controls */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Order Lookup
              </h2>

              <form onSubmit={handlePhoneSearchSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Customer Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneSearch}
                      onChange={(e) => setPhoneSearch(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="flex-1 px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#840037] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-white bg-[#840037] hover:bg-[#6b002c] transition-all"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </form>

              {/* Status Filter */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="block text-xs font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Filter by Status
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'completed', 'processing', 'pending', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilter(st)}
                      className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                        filter === st
                          ? 'bg-[#840037] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filters */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="block text-xs font-semibold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Filter by Date Range
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-xl text-xs text-gray-700"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-xl text-xs text-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Orders List */}
          <div className="md:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {phoneSearch ? `Orders for ${phoneSearch}` : 'Recent Orders'} ({filteredOrders.length})
              </h2>
              <button
                onClick={loadOrders}
                className="text-xs font-bold text-[#840037] hover:underline"
              >
                🔄 Refresh Orders
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-36 bg-white rounded-2xl border border-gray-200 animate-pulse" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center space-y-3">
                <span className="text-4xl">🛍️</span>
                <h3 className="text-base font-bold text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  No Matching Orders Found
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Try searching with a different phone number or adjusting your date filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const sc = STATUS_COLORS[order.status?.toLowerCase()] || { bg: '#E9ECEF', text: '#495057' };
                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Order Header */}
                      <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                              Order #{order.number || order.id}
                            </span>
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                              style={{ backgroundColor: sc.bg, color: sc.text }}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">
                            {formatDate(order.date)} at {formatTime(order.date)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Customer</span>
                          <p className="text-xs font-bold text-gray-900">{order.customerName || order.customerPhone}</p>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="p-4 space-y-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="w-9 h-9 object-cover rounded-lg border" />
                              )}
                              <div>
                                <span className="font-bold text-gray-900">{item.name}</span>
                                <p className="text-[11px] text-gray-500">Qty: {item.quantity}</p>
                              </div>
                            </div>
                            <span className="font-extrabold text-[#840037]">
                              KSh {parseFloat(item.total || item.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Order Footer */}
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          Payment: {order.paymentMethod}
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Total Amount</span>
                          <p className="text-base font-extrabold text-[#840037]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            KSh {parseFloat(order.total).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav cartCount={0} activeTab="orders" />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AuthProvider>
      <OrdersContent />
    </AuthProvider>
  );
}
