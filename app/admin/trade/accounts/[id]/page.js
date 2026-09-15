'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  pending: 'bg-amber-50 text-amber-800 border-amber-200/60',
  suspended: 'bg-red-50 text-red-700 border-red-200/60',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function kes(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

export default function AdminTradeAccountDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/trade/accounts/${id}/detail`)
      .then((r) => {
        if (!r.ok) throw new Error('Account not found');
        return r.json();
      })
      .then((res) => {
        if (res.success) setData(res);
        else throw new Error(res.error || 'Failed to load account');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-[#840038] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-3">
        <p className="text-sm font-bold text-red-600">{error || 'Account not found'}</p>
        <Link href="/admin/trade" className="text-xs font-bold text-[#840038] hover:underline">← Back to Trade Hub</Link>
      </div>
    );
  }

  const { account, statement } = data;
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const quotes = Array.isArray(data.quotes) ? data.quotes : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/trade" className="text-xs font-bold text-gray-500 hover:text-[#840038]">← Back to Trade Hub</Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{account.tradingName}</h1>
            <StatusBadge status={account.status} />
            <span className="text-[10px] font-bold uppercase text-[#840038] bg-pink-50 px-2 py-0.5 rounded-md">{account.segment}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{account.legalName}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
            <span>KRA PIN: <strong className="font-mono">{account.kraPin || 'N/A'}</strong></span>
            <span>Licence: <strong className="font-mono">{account.licenceNo || 'N/A'}</strong></span>
            <span>Account Manager: <strong>{account.accountManager?.name || 'Unassigned'}</strong></span>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Credit Limit', value: kes(statement.creditLimit) },
          { label: 'Available Credit', value: kes(statement.creditAvailable) },
          { label: 'Closing Balance', value: kes(statement.closingBalance) },
          { label: '31-60 Days Overdue', value: kes(statement.aging.days31_60) },
          { label: '60+ Days Overdue', value: kes(statement.aging.days60Plus) },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4">
            <p className="text-[10px] uppercase font-bold text-gray-400">{stat.label}</p>
            <p className="text-base font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      {statement.isCreditHold && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl">
          ⚠️ Credit Hold — this account has invoices over 30 days past due.
        </div>
      )}

      {/* Orders / Invoices */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Order & Invoice History</h2>
        </div>
        {orders.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-8">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{o.orderNumber}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{o.invoiceNumber}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{o.createdAt?.split('T')[0]}</td>
                    <td className="py-3 px-3 capitalize text-gray-700">{o.status}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900">{kes(o.grandTotal)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <a href={`/api/admin/trade/invoices/${o.id}/pdf`} className="text-[#840038] font-bold hover:underline mr-3">Invoice ↓</a>
                      <a href={`/api/admin/trade/delivery-notes/${o.id}/pdf`} className="text-gray-600 font-bold hover:underline">Delivery Note ↓</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quotes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Quotes</h2>
        </div>
        {quotes.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-8">No quotes for this account.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50/80 uppercase text-[10px] text-gray-500 font-bold border-b border-gray-100">
                  <th className="py-3 px-4">Quote</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Value</th>
                  <th className="py-3 px-4 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4 font-bold text-gray-900">{q.quoteNumber}</td>
                    <td className="py-3 px-3 text-gray-600">{q.createdAt?.split('T')[0]}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{q.status}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900">{kes(q.grandTotal)}</td>
                    <td className="py-3 px-4 text-right">
                      <a href={`/api/admin/trade/quotes/${q.id}/pdf`} className="text-[#840038] font-bold hover:underline">Download ↓</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
