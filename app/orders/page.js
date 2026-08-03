'use client';

import { useState, useEffect, useCallback } from 'react';
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
      {/* Header */}
      <header
        className="fixed top-0 w-full z-50"
        style={{ backgroundColor: 'rgba(132, 0, 55, 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center justify-center px-4 w-full max-w-7xl mx-auto pt-8 pb-4">
          <h1 className="text-white text-lg font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            My Orders
          </h1>
        </div>
      </header>

      <main className="px-4 max-w-7xl mx-auto pt-[100px] space-y-4">
        {/* Date Filter */}
        <div
          className="p-4 rounded-xl border"
          style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
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
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-xs"
                style={{
                  borderRadius: '12px',
                  border: '2px solid #debfc3',
                  padding: '8px 4px',
                  boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: 'pulse-border 2s ease-in-out infinite',
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#191c1d',
                }}
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-xs"
                style={{
                  borderRadius: '12px',
                  border: '2px solid #debfc3',
                  padding: '8px 4px',
                  boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: 'pulse-border 2s ease-in-out infinite',
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#191c1d',
                }}
              />
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className="px-4 py-2 rounded-full whitespace-nowrap text-xs font-semibold transition-all"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                backgroundColor: filter === tab.id ? '#840037' : '#ffffff',
                color: filter === tab.id ? '#ffffff' : '#5f5e5e',
                border: filter === tab.id ? 'none' : '1px solid #E9ECEF',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: '#E9ECEF' }} />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-sm font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              No orders found
            </p>
            <p className="text-xs mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              {orders.length === 0 ? 'Your orders will appear here' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const status = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
              return (
                <div
                  key={order.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: '#E9ECEF', backgroundColor: '#ffffff' }}
                >
                  {/* Order Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F1F3F5' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                        Order #{order.number}
                      </p>
                      <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                        {formatDate(order.date)} at {formatTime(order.date)}
                      </p>
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                      style={{ backgroundColor: status.bg, color: status.text, fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F1F3F5' }}>
                            <span className="text-lg">🍾</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                            {item.name}
                          </p>
                          <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                          KSh {parseFloat(item.total).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer */}
                  <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#F1F3F5', backgroundColor: '#FAFAFA' }}>
                    <div className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                      {order.paymentMethod && <span>{order.paymentMethod}</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                        Total
                      </p>
                      <p className="text-sm font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                        KSh {parseFloat(order.total).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
