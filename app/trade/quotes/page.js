'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeQuotesPage() {
  const router = useRouter();
  const { user, account, loading, showNotification } = useTrade();
  const [quotes, setQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);

  const fetchQuotes = () => {
    fetch('/api/trade/quotes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setQuotes(data.quotes || []);
      })
      .finally(() => setLoadingQuotes(false));
  };

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (user && account) {
      fetchQuotes();
    }
  }, [user, account, loading, router]);

  const handleAcceptQuote = async (quoteId) => {
    try {
      setAcceptingId(quoteId);
      const res = await fetch(`/api/trade/quotes/${quoteId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept quote');

      showNotification('Quote accepted and converted to active trade order!', 'success');
      router.push(`/trade/orders/${data.order.id}`);
    } catch (err) {
      showNotification(err.message || 'Quote conversion failed', 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading || loadingQuotes) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Official Quotes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Sales Proposals
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Trade Quotations
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Bespoke volume quotes issued by your Account Manager. 1-click conversion to active order.
          </p>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-3">
          <div className="text-3xl">📝</div>
          <h3 className="text-base font-bold uppercase text-gray-800">No Active Quotes</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Need a bespoke volume quote for a major festival or corporate event? Contact your dedicated Account Specialist.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {quotes.map((q) => {
            const isAccepted = q.status === 'accepted';
            return (
              <div key={q.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-lg text-[#840038]">{q.quoteNumber}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {q.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Valid Until: <strong className="text-gray-800">{new Date(q.validUntil).toLocaleDateString()}</strong> · Total Volume: <strong>{q.totalBottles} bottles</strong>
                    </p>
                    {q.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl mt-2 border border-gray-100">
                        Note from specialist: {q.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right space-y-2">
                    <div className="text-2xl font-black text-gray-900 font-sans">
                      KES {q.grandTotal?.toLocaleString()}
                    </div>
                    {!isAccepted && (
                      <button
                        type="button"
                        disabled={acceptingId === q.id}
                        onClick={() => handleAcceptQuote(q.id)}
                        className="px-6 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
                      >
                        {acceptingId === q.id ? 'Converting...' : 'Accept Quote & Order →'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100">
                        <th className="pb-2">SKU / Item</th>
                        <th className="pb-2 text-center">Tier</th>
                        <th className="pb-2 text-center">Qty</th>
                        <th className="pb-2 text-right">Unit Price</th>
                        <th className="pb-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {q.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-bold text-gray-800">{item.name}</td>
                          <td className="py-2.5 text-center text-[#840038] font-bold">{item.tierKey}</td>
                          <td className="py-2.5 text-center font-bold text-gray-700">{item.quantity}</td>
                          <td className="py-2.5 text-right font-mono text-gray-600">KES {item.unitPriceIncVat?.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-gray-900">KES {item.lineTotalIncVat?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

