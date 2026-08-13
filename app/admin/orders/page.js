'use client';

import { useState, useEffect, useCallback } from 'react';

const STATUS_OPTIONS = [
  { value: 'any', label: 'All Orders' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const statusStyle = (status) => {
  const map = {
    'processing': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'completed': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
    'pending': { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
    'on-hold': { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'cancelled': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
    'refunded': { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
    'failed': { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444' },
  };
  return map[status] || { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('any');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, page: currentPage, per_page: 15 });
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      setOrders([]);
    }
    setLoading(false);
  }, [statusFilter, currentPage]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch {
      alert('Failed to update order status');
    }
    setUpdatingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage WooCommerce orders</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
            className="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              backgroundColor: statusFilter === opt.value ? '#0f0f1a' : '#f3f4f6',
              color: statusFilter === opt.value ? '#ffffff' : '#6b7280',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200/80">
          <p className="text-sm font-semibold text-gray-400">No orders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const sc = statusStyle(order.status);
            const isExpanded = expandedId === order.id;
            const customerName = [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || 'Guest';
            const date = order.date_created ? new Date(order.date_created).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden transition-shadow hover:shadow-sm">
                {/* Order row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">#{order.number || order.id}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: sc.bg, color: sc.text }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{customerName} · {order.billing?.phone || 'No phone'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">KSh {parseFloat(order.total || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{date}</p>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 space-y-4">
                    {/* Items */}
                    <div className="mt-4">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-2">Items</p>
                      <div className="space-y-2">
                        {order.line_items?.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 py-1.5">
                            {item.image && <img src={item.image} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                              <p className="text-[10px] text-gray-400">×{item.quantity}</p>
                            </div>
                            <span className="text-xs font-semibold text-gray-700">KSh {parseFloat(item.total || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Contact</p>
                        <p className="text-xs text-gray-700">{order.billing?.phone || '—'}</p>
                        <p className="text-xs text-gray-500">{order.billing?.email || '—'}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-xl">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Payment</p>
                        <p className="text-xs text-gray-700">{order.payment_method_title || '—'}</p>
                      </div>
                    </div>

                    {order.customer_note && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 mb-1">Customer Note</p>
                        <p className="text-xs text-amber-900">{order.customer_note}</p>
                      </div>
                    )}

                    {/* Status update */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Update Status:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {['processing', 'completed', 'cancelled'].filter(s => s !== order.status).map((s) => {
                          const ssc = statusStyle(s);
                          return (
                            <button
                              key={s}
                              onClick={() => updateStatus(order.id, s)}
                              disabled={updatingId === order.id}
                              className="text-[10px] font-semibold px-3 py-1 rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                              style={{ backgroundColor: ssc.bg, color: ssc.text }}
                            >
                              {updatingId === order.id ? '...' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500 px-3">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
