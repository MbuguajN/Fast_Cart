'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import BottomNav from '@/components/BottomNav';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isGuest = !user?.customerId;

  const loadOrders = useCallback(async () => {
    if (!user?.customerId) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ customer: user.customerId });
      if (dateFrom) params.set('after', dateFrom + 'T00:00:00');
      if (dateTo) params.set('before', dateTo + 'T23:59:59');

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      queueMicrotask(() => {
        setOrders(data.orders || []);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, [user?.customerId, dateFrom, dateTo]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const interval = setInterval(loadOrders, 60000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['pending', 'processing', 'on-hold'].includes(o.status);
    if (filter === 'completed') return o.status === 'completed';
    return true;
  });

  const handleClearDates = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Responsive Header */}
      <header
        className="fixed top-0 w-full z-50 shadow-md"
        style={{ backgroundColor: 'rgba(132, 0, 55, 0.95)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center justify-between px-4 md:px-8 w-full max-w-7xl mx-auto h-16">
          <Link href="/" className="flex items-center gap-2 text-white hover:text-white/80 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Store
            </span>
          </Link>
          <h1 className="text-white text-base md:text-lg font-bold tracking-wide" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            My Orders
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>
      </header>

      <main className="px-4 md:px-8 max-w-7xl mx-auto pt-[90px] md:pt-[100px]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Left Sidebar: Filters */}
          <div className="md:col-span-4 space-y-4">
            <div
              className="p-5 rounded-2xl border shadow-xs"
              style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                  Filter by date
                </p>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={handleClearDates}
                    className="text-xs font-semibold underline"
                    style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-xs"
                    style={{
                      borderRadius: '12px',
                      border: '2px solid #debfc3',
                      padding: '10px 12px',
                      fontFamily: 'Montserrat, sans-serif',
                      color: '#191c1d',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-xs"
                    style={{
                      borderRadius: '12px',
                      border: '2px solid #debfc3',
                      padding: '10px 12px',
                      fontFamily: 'Montserrat, sans-serif',
                      color: '#191c1d',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Status Tabs */}
            <div className="p-4 rounded-2xl border bg-white" style={{ borderColor: '#E9ECEF' }}>
              <p className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Status Filter
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'active', label: 'Active' },
                  { id: 'completed', label: 'Completed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className="px-4 py-2 rounded-full text-xs font-semibold transition-all hover:shadow-xs"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      backgroundColor: filter === tab.id ? '#840037' : '#f8f9fa',
                      color: filter === tab.id ? '#ffffff' : '#5f5e5e',
                      border: filter === tab.id ? 'none' : '1px solid #E9ECEF',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Main Column: Orders List */}
          <div className="md:col-span-8">
            {isGuest ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 p-8">
                <div className="text-5xl mb-4">👤</div>
                <p className="text-base font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                  Login to view your orders
                </p>
                <p className="text-xs mt-1 mb-6" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                  Enter your phone number at checkout to track orders here
                </p>
                <Link href="/" className="inline-block px-6 py-3 rounded-xl text-xs font-bold text-white shadow-md hover:bg-[#6b002c] transition-all" style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                  Start Shopping
                </Link>
              </div>
            ) : loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ backgroundColor: '#E9ECEF' }} />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100 p-8">
                <div className="text-5xl mb-4">📦</div>
                <p className="text-base font-bold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                  No orders found
                </p>
                <p className="text-xs mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                  {orders.length === 0 ? 'Your orders will appear here' : 'Try adjusting your date or status filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => {
                  const status = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border shadow-xs overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
                    >
                      {/* Order Header */}
                      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: '#F1F3F5' }}>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                            Order #{order.number}
                          </p>
                          <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                            {formatDate(order.date)} at {formatTime(order.date)}
                          </p>
                        </div>
                        <span
                          className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: status.bg, color: status.text, fontFamily: 'Montserrat, sans-serif' }}
                        >
                          {order.status}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="px-5 py-4 space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F1F3F5' }}>
                                <span className="text-lg">🍾</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-semibold truncate" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                                {item.name}
                              </p>
                              <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                                Quantity: {item.quantity}
                              </p>
                            </div>
                            <span className="text-xs md:text-sm font-bold flex-shrink-0" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                              KSh {parseFloat(item.total).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Order Footer */}
                      <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: '#F1F3F5', backgroundColor: '#FAFAFA' }}>
                        <div className="text-[11px] font-medium" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                          {order.paymentMethod && <span>Payment: {order.paymentMethod}</span>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                            Order Total
                          </p>
                          <p className="text-base font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
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
