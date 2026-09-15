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

  // Email Modal State
  const [emailModalQuote, setEmailModalQuote] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailNotes, setEmailNotes] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Decline Modal State
  const [declineModalQuote, setDeclineModalQuote] = useState(null);
  const [declineReason, setDeclineReason] = useState('price_too_high');
  const [declineNotes, setDeclineNotes] = useState('');
  const [declining, setDeclining] = useState(false);

  // Request Bespoke Quote Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [requestItems, setRequestItems] = useState([{ sku: '', quantity: 12 }]);
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchQuotes = () => {
    fetch('/api/trade/quotes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setQuotes(data.quotes || []);
      })
      .finally(() => setLoadingQuotes(false));
  };

  const fetchCatalog = () => {
    fetch('/api/trade/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCatalogProducts(data.products || []);
          if (data.products?.length > 0 && !requestItems[0].sku) {
            setRequestItems([{ sku: data.products[0].sku, quantity: 12 }]);
          }
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (user && account) {
      fetchQuotes();
      fetchCatalog();
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

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailModalQuote || !recipientEmail) return;

    try {
      setSendingEmail(true);
      const res = await fetch(`/api/trade/quotes/${emailModalQuote.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          customNotes: emailNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send quote email');

      showNotification(`Quotation PDF emailed successfully to ${recipientEmail}`, 'success');
      setEmailModalQuote(null);
      setEmailNotes('');
    } catch (err) {
      showNotification(err.message || 'Email delivery failed', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDeclineQuote = async (e) => {
    e.preventDefault();
    if (!declineModalQuote) return;

    try {
      setDeclining(true);
      const res = await fetch(`/api/trade/quotes/${declineModalQuote.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode: declineReason,
          notes: declineNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline quote');

      showNotification('Quote status updated to declined.', 'success');
      setDeclineModalQuote(null);
      setDeclineNotes('');
      fetchQuotes();
    } catch (err) {
      showNotification(err.message || 'Failed to decline quote', 'error');
    } finally {
      setDeclining(false);
    }
  };

  const handleAddRequestItem = () => {
    const firstSku = catalogProducts[0]?.sku || '';
    setRequestItems([...requestItems, { sku: firstSku, quantity: 12 }]);
  };

  const handleRemoveRequestItem = (idx) => {
    if (requestItems.length <= 1) return;
    setRequestItems(requestItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...requestItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setRequestItems(updated);
  };

  const handleSubmitQuoteRequest = async (e) => {
    e.preventDefault();
    const validItems = requestItems
      .filter((i) => i.sku && Number(i.quantity) > 0)
      .map((i) => ({ sku: i.sku, quantity: parseInt(i.quantity, 10) }));

    if (validItems.length === 0) {
      showNotification('Please select at least one item with a valid quantity', 'error');
      return;
    }

    try {
      setSubmittingRequest(true);
      const res = await fetch('/api/trade/quotes/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: validItems,
          requestedDeliveryDate: targetDeliveryDate,
          notes: requestNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quote request');

      showNotification('Bespoke volume quote requested! An Account Specialist is preparing your quotation.', 'success');
      setShowRequestModal(false);
      setRequestNotes('');
      setTargetDeliveryDate('');
      fetchQuotes();
    } catch (err) {
      showNotification(err.message || 'Failed to request quote', 'error');
    } finally {
      setSubmittingRequest(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
            Sales Proposals &amp; Bespoke Pricing
          </span>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-0.5">
            Trade Quotations
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Bespoke volume quotes issued by your Fast Cart Account Manager with guaranteed pricing &amp; 1-click order conversion.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className="px-5 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <span>+</span> Request Bespoke Quote
          </button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-200 text-center space-y-4">
          <div className="text-4xl">📝</div>
          <h3 className="text-base font-bold uppercase text-gray-800">No Active Quotes</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Need a bespoke volume quote for a major festival, hotel banqueting, or corporate event?
          </p>
          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className="px-6 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm"
          >
            Request Your First Bespoke Quote
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {quotes.map((q) => {
            const isAccepted = q.status === 'accepted';
            const isDeclined = q.status === 'declined';
            const isExpired = q.validUntil && new Date(q.validUntil) < new Date();
            const canAction = !isAccepted && !isDeclined && !isExpired;

            return (
              <div key={q.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-lg text-[#840038]">{q.quoteNumber}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          isAccepted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isDeclined
                            ? 'bg-red-100 text-red-800'
                            : isExpired
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isExpired && !isAccepted && !isDeclined ? 'Expired' : q.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Valid Until:{' '}
                      <strong className={isExpired ? 'text-red-600 font-bold' : 'text-gray-800'}>
                        {new Date(q.validUntil).toLocaleDateString()}
                      </strong>{' '}
                      · Total Volume: <strong>{q.totalBottles} units</strong>
                    </p>
                    {q.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl mt-2 border border-gray-100">
                        <strong>Specialist Note:</strong> {q.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right space-y-3">
                    <div className="text-2xl font-black text-gray-900 font-sans">
                      KES {q.grandTotal?.toLocaleString()}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {/* Download PDF */}
                      <a
                        href={`/api/trade/quotes/${q.id}/pdf`}
                        download
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        title="Download official PDF quotation"
                      >
                        <span>📄</span> PDF
                      </a>

                      {/* Email Quote */}
                      <button
                        type="button"
                        onClick={() => {
                          setEmailModalQuote(q);
                          setRecipientEmail(user?.email || '');
                        }}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                        title="Email quotation PDF to yourself or accounting"
                      >
                        <span>✉️</span> Email
                      </button>

                      {/* Decline Quote */}
                      {canAction && (
                        <button
                          type="button"
                          onClick={() => setDeclineModalQuote(q)}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition"
                          title="Decline this quotation"
                        >
                          Decline
                        </button>
                      )}

                      {/* Accept Quote */}
                      {canAction && (
                        <button
                          type="button"
                          disabled={acceptingId === q.id}
                          onClick={() => handleAcceptQuote(q.id)}
                          className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                          {acceptingId === q.id ? 'Converting...' : 'Accept & Order →'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Table of items */}
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
                          <td className="py-2.5 text-right font-mono text-gray-600">
                            KES {item.unitPriceIncVat?.toLocaleString()}
                          </td>
                          <td className="py-2.5 text-right font-mono font-bold text-gray-900">
                            KES {item.lineTotalIncVat?.toLocaleString()}
                          </td>
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

      {/* MODAL: EMAIL QUOTE */}
      {emailModalQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase">Email Quotation</h3>
                <p className="text-xs text-gray-500 font-mono">{emailModalQuote.quoteNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailModalQuote(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Optional Note / Reference
                </label>
                <textarea
                  rows={2}
                  value={emailNotes}
                  onChange={(e) => setEmailNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                  placeholder="For attention of procurement / accounting team..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalQuote(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase rounded-xl disabled:opacity-50"
                >
                  {sendingEmail ? 'Sending...' : 'Send Email with PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DECLINE QUOTE */}
      {declineModalQuote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase">Decline Quotation</h3>
                <p className="text-xs text-gray-500 font-mono">{declineModalQuote.quoteNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalQuote(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeclineQuote} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Reason for Declining
                </label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                >
                  <option value="price_too_high">Price higher than expected</option>
                  <option value="budget_cancelled">Project / Event budget cancelled</option>
                  <option value="bought_elsewhere">Sourced from another supplier</option>
                  <option value="specs_changed">Quantities or product specs changed</option>
                  <option value="other">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Feedback for Account Specialist
                </label>
                <textarea
                  rows={3}
                  value={declineNotes}
                  onChange={(e) => setDeclineNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                  placeholder="Share details so we can tailor future pricing..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeclineModalQuote(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Keep Quote
                </button>
                <button
                  type="submit"
                  disabled={declining}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase rounded-xl disabled:opacity-50"
                >
                  {declining ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REQUEST BESPOKE QUOTE */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase">Request Bespoke Volume Quote</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Get custom bulk tier pricing for events, venues, or scheduled deliveries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitQuoteRequest} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-gray-700">Requested Items</label>
                  <button
                    type="button"
                    onClick={handleAddRequestItem}
                    className="text-xs font-bold text-[#840038] hover:underline"
                  >
                    + Add Another Product
                  </button>
                </div>

                {requestItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
                    <div className="flex-1">
                      <select
                        value={item.sku}
                        onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                      >
                        {catalogProducts.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs text-center bg-white border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:border-[#840038]"
                        placeholder="Qty"
                      />
                    </div>

                    {requestItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRequestItem(idx)}
                        className="p-1 text-red-500 hover:text-red-700 font-bold text-sm"
                        title="Remove row"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    Target Delivery / Event Date
                  </label>
                  <input
                    type="date"
                    value={targetDeliveryDate}
                    onChange={(e) => setTargetDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    Fulfillment Destination
                  </label>
                  <input
                    type="text"
                    defaultValue={account?.deliveryAddress?.street || 'Default venue address'}
                    disabled
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Event Specifics / Instructions
                </label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-hidden focus:border-[#840038]"
                  placeholder="E.g. VIP bar stocking, need delivery by 10 AM with seal verification..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-6 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submittingRequest ? 'Submitting...' : 'Submit Quote Request →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

