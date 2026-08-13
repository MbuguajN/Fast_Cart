'use client';

import { useState } from 'react';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    setLoading(true);
    setError('');
    setCustomer(null);
    setOrders([]);

    try {
      // Lookup customer by phone
      const res = await fetch(`/api/auth/lookup?phone=${encodeURIComponent(search.trim())}`);
      const data = await res.json();

      if (data.customer) {
        setCustomer(data.customer);
        setOrders(data.orders || []);
      } else {
        setError('No customer found with that phone number or email.');
      }
    } catch {
      setError('Search failed. Try again.');
    }
    setLoading(false);
  };

  const statusStyle = (status) => {
    const map = {
      'processing': { bg: '#fef3c7', text: '#92400e' },
      'completed': { bg: '#d1fae5', text: '#065f46' },
      'pending': { bg: '#e0e7ff', text: '#3730a3' },
      'cancelled': { bg: '#fee2e2', text: '#991b1b' },
    };
    return map[status] || { bg: '#f3f4f6', text: '#4b5563' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Customers</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search and view customer profiles by phone number</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Enter phone number (e.g., 0722123456)"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white border border-gray-200 outline-none focus:border-[#840037]/40 focus:ring-2 focus:ring-[#840037]/10 transition-all"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #840037, #b8004f)' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-200">
          {error}
        </div>
      )}

      {/* Customer profile */}
      {customer && (
        <div className="space-y-5">
          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #840037, #b8004f)' }}>
                {(customer.first_name || customer.billing?.first_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {[customer.first_name || customer.billing?.first_name, customer.last_name || customer.billing?.last_name].filter(Boolean).join(' ') || 'Guest Customer'}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {(customer.billing?.phone || customer.phone) && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {customer.billing?.phone || customer.phone}
                    </span>
                  )}
                  {(customer.email || customer.billing?.email) && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {customer.email || customer.billing?.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
            </div>
          </div>

          {/* Order history */}
          <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
            <div className="p-5 pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>Order History</h3>
            </div>
            {orders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No orders found</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const sc = statusStyle(order.status);
                  return (
                    <div key={order.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">#{order.id}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: sc.bg, color: sc.text }}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {order.date_created ? new Date(order.date_created).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                          {order.line_items ? ` · ${order.line_items.length} item${order.line_items.length !== 1 ? 's' : ''}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        KSh {parseFloat(order.total || 0).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
