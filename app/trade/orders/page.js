'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeOrdersPage() {
  const router = useRouter();
  const { user, account, loading } = useTrade();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (user && account) {
      fetch('/api/trade/orders')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setOrders(data.orders || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingOrders(false));
    }
  }, [user, account, loading, router]);

  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const q = (searchQuery || '').trim().toLowerCase();
    const orderNum = (o.orderNumber || '').toLowerCase();
    const invNum = (o.invoiceNumber || '').toLowerCase();
    const poRef = (o.poReference || '').toLowerCase();
    const matchQuery = !q || orderNum.includes(q) || invNum.includes(q) || poRef.includes(q);
    return matchStatus && matchQuery;
  });

  const exportCsv = () => {
    if (!orders.length) return;
    const headers = ['Order Number', 'Invoice Number', 'Date', 'Status', 'Payment Terms', 'Payment Status', 'Bottles', 'Subtotal Ex-VAT', 'VAT', 'Delivery', 'Grand Total', 'PO Reference'];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      o.invoiceNumber,
      o.createdAt.split('T')[0],
      o.status,
      o.paymentTerms,
      o.paymentStatus,
      o.totalBottles,
      o.subtotalExVat,
      o.vatTotal,
      o.deliveryFee,
      o.grandTotal,
      o.poReference || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trade-orders-${account.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || loadingOrders) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Order History
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Trade Orders &amp; Tracking
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-1.5"
          >
            <span>📥 Export CSV</span>
          </button>
          <Link
            href="/trade/order-pad"
            className="px-4 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow transition-all"
          >
            + New Order
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search order number, invoice, or PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['all', 'confirmed', 'picking', 'dispatched', 'delivered', 'awaiting_approval'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-[#840038] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c1917] text-white uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Order #</th>
                <th className="py-3 px-4 font-bold">Invoice #</th>
                <th className="py-3 px-3 font-bold">Date</th>
                <th className="py-3 px-3 font-bold">PO Ref</th>
                <th className="py-3 px-3 font-bold text-center">Bottles</th>
                <th className="py-3 px-3 font-bold text-center">Fulfillment Status</th>
                <th className="py-3 px-3 font-bold text-center">Payment</th>
                <th className="py-3 px-4 font-bold text-right">Grand Total</th>
                <th className="py-3 px-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500 text-xs">
                    No trade orders matching your query.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-pink-50/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#840038]">
                      {o.orderNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">
                      {o.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-[11px]">
                      {o.createdAt.split('T')[0]}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-500 text-[11px]">
                      {o.poReference || '—'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-gray-800">
                      {o.totalBottles}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        o.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : o.status === 'dispatched'
                          ? 'bg-blue-100 text-blue-800'
                          : o.status === 'awaiting_approval'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        o.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-gray-900">
                      KES {o.grandTotal?.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/trade/orders/${o.id}`}
                        className="px-3 py-1 bg-gray-100 hover:bg-[#840038] hover:text-white rounded-lg text-[11px] font-bold transition-all inline-block"
                      >
                        View Details →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

