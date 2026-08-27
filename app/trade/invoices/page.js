'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeInvoicesListPage() {
  const router = useRouter();
  const { user, account, loading } = useTrade();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

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
        .finally(() => setLoadingOrders(false));
    }
  }, [user, account, loading, router]);

  if (loading || loadingOrders) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Invoices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Billing &amp; Tax Documents
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            VAT Invoices &amp; Delivery Notes
          </h1>
        </div>

        <Link
          href="/trade/statements"
          className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold uppercase text-gray-700 hover:bg-gray-50"
        >
          View Statement of Account →
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c1917] text-white uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Invoice #</th>
                <th className="py-3 px-4 font-bold">Order #</th>
                <th className="py-3 px-3 font-bold">Date Issued</th>
                <th className="py-3 px-3 font-bold">Due Date</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Grand Total</th>
                <th className="py-3 px-4 font-bold text-right">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-pink-50/30">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#840038]">
                    {o.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-gray-700">
                    {o.orderNumber}
                  </td>
                  <td className="py-3.5 px-3 text-gray-500">
                    {o.createdAt.split('T')[0]}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-gray-700">
                    {o.dueDate}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      o.paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-gray-900">
                    KES {o.grandTotal?.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/trade/delivery-notes/${o.id}`}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 rounded-lg text-[10px] font-bold transition-all"
                        title="View Delivery Note"
                      >
                        🚚 GRN
                      </Link>
                      <Link
                        href={`/trade/invoices/${o.id}`}
                        className="px-3 py-1 bg-[#840038] text-white hover:bg-[#6b002c] rounded-lg text-[10px] font-bold transition-all shadow-xs"
                      >
                        📄 Tax Invoice
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
