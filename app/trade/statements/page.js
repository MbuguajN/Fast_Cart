'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeStatementPage() {
  const router = useRouter();
  const { user, account, loading } = useTrade();
  const [statement, setStatement] = useState(null);
  const [loadingStatement, setLoadingStatement] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (user && account) {
      fetch('/api/trade/statements')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setStatement(data.statement);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingStatement(false));
    }
  }, [user, account, loading, router]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading || loadingStatement) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Account Statement...</span>
        </div>
      </div>
    );
  }

  if (!statement) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4 print:hidden">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Financial Ledger
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Statement of Account
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Statement generated as at {statement.statementDate} for {statement.account.tradingName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-2"
          >
            <span>🖨️ Print Statement</span>
          </button>
        </div>
      </div>

      {statement.isCreditHold && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
          <span>⚠️ CREDIT HOLD ACTIVE: Account has overdue invoices exceeding 30 days. Subsequent orders require prepayment until balance is cleared.</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Invoiced</span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-gray-900">
            KES {statement.totalInvoiced.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Lifetime cumulative trade billings</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Settled</span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-emerald-600">
            KES {statement.totalPaid.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Total payments reconciled</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current Outstanding Balance</span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-[#840038]">
            KES {statement.closingBalance.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Amount due under Net 14 terms</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Credit Headroom Available</span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-gray-900">
            KES {statement.creditAvailable.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400">Limit: KES {statement.creditLimit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase text-[#231F20] tracking-wider">
          Invoice Aging Schedule
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Current (0–14 Days)</span>
            <p className="text-lg font-bold text-gray-900 font-mono mt-1">
              KES {statement.aging.current.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-[10px] font-bold text-gray-500 uppercase">15–30 Days</span>
            <p className="text-lg font-bold text-gray-900 font-mono mt-1">
              KES {statement.aging.days1_30.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase">31–60 Days (Overdue)</span>
            <p className="text-lg font-bold text-amber-800 font-mono mt-1">
              KES {statement.aging.days31_60.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <span className="text-[10px] font-bold text-red-700 uppercase">60+ Days (Critical)</span>
            <p className="text-lg font-bold text-red-800 font-mono mt-1">
              KES {statement.aging.days60Plus.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-base font-bold uppercase text-[#231F20]">
            Itemized Invoices &amp; Payments Ledger
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c1917] text-white uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-bold">Date</th>
                <th className="py-3 px-4 font-bold">Invoice #</th>
                <th className="py-3 px-3 font-bold">PO Ref</th>
                <th className="py-3 px-3 font-bold">Due Date</th>
                <th className="py-3 px-3 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Invoiced (KES)</th>
                <th className="py-3 px-4 font-bold text-right">Paid (KES)</th>
                <th className="py-3 px-4 font-bold text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {statement.invoices.map((inv, idx) => (
                <tr key={idx} className="hover:bg-pink-50/30">
                  <td className="py-3 px-4 text-gray-500">{inv.date}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#840038]">{inv.invoiceNumber}</td>
                  <td className="py-3 px-3 font-mono text-gray-500">{inv.poReference || '—'}</td>
                  <td className="py-3 px-3 font-mono text-gray-700">{inv.dueDate}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">{inv.totalAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{inv.paidAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-gray-900">{inv.balanceDue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

