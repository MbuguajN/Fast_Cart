'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeDeliveryNotePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, account, loading, showNotification } = useTrade();

  const [deliveryNote, setDeliveryNote] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [error, setError] = useState(null);
  const [logo, setLogo] = useState(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (id && user && account) {
      fetch(`/api/trade/delivery-notes/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error('Delivery Note not found or access denied');
          return r.json();
        })
        .then((data) => {
          if (data.success) {
            setDeliveryNote(data.deliveryNote);
            setRecipientEmail(user.email || '');
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingDoc(false));
    }
  }, [id, user, account, loading, router]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail) return;

    try {
      setSendingEmail(true);
      const res = await fetch(`/api/trade/delivery-notes/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email delivery note');

      showNotification(`Delivery note sent to ${recipientEmail}!`, 'success');
      setEmailModalOpen(false);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading || loadingDoc) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Delivery Note Manifest...</span>
        </div>
      </div>
    );
  }

  if (error || !deliveryNote) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-[#231F20]">
        <h1 className="text-xl font-bold uppercase text-red-600">Document Unavailable</h1>
        <p className="text-xs text-gray-500">{error || 'Delivery note could not be loaded.'}</p>
        <Link href="/trade/orders" className="text-xs font-bold text-[#840038] hover:underline">
          ← Return to Orders List
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-[#231F20]">
      {/* Top Document Controls (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <Link href={`/trade/orders/${id}`} className="text-xs font-bold text-[#840038] uppercase hover:underline">
            ← Back to Order
          </Link>

          <div className="flex items-center gap-1.5 bg-gray-200/80 p-1 rounded-xl text-xs font-bold">
            <Link
              href={`/trade/invoices/${id}`}
              className="px-3 py-1 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
            >
              Tax Invoice
            </Link>
            <span className="px-3 py-1 bg-white text-emerald-800 rounded-lg shadow-xs">
              Delivery Note (GRN)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <span>✉️ Email Manifest</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-2"
          >
            <span>🖨️ Print Delivery Note</span>
          </button>
        </div>
      </div>

      {/* Official A4 Print Document Sheet */}
      <div className="bg-white p-8 sm:p-12 rounded-3xl border border-gray-300 shadow-xl space-y-8 print:border-none print:shadow-none print:p-0 print:m-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-emerald-800 pb-6">
          <div className="space-y-2">
            {logo && (
              <img src={logo} alt="Happy Hour Logo" className="max-h-12 w-auto object-contain mb-1" />
            )}
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 font-sans">
              {deliveryNote.supplier.companyName}
            </h2>
            <p className="text-xs text-gray-600 font-medium">{deliveryNote.supplier.physicalAddress}</p>
            <p className="text-xs text-gray-600">
              KRA PIN: <strong>{deliveryNote.supplier.kraPin}</strong> · Dispatch Bay: <strong>{deliveryNote.logistics.dispatchHub}</strong>
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1 bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-800 block">
              DELIVERY NOTE &amp; GRN
            </span>
            <div className="text-lg font-black font-mono text-gray-900">
              {deliveryNote.deliveryNoteNumber}
            </div>
            <p className="text-xs text-gray-600">Order: <strong>{deliveryNote.orderNumber}</strong></p>
            <p className="text-xs text-gray-600">Date: <strong>{deliveryNote.dispatchDate}</strong></p>
            <p className="text-xs text-emerald-700 font-bold font-mono">Seal: {deliveryNote.sealNumber}</p>
          </div>
        </div>

        {/* Customer & Receiving Dock Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-b border-gray-200 pb-6 text-xs">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">
              Delivered To:
            </span>
            <p className="text-sm font-bold text-gray-900">{deliveryNote.customer.tradingName}</p>
            <p className="text-gray-600">Entity: <strong>{deliveryNote.customer.legalName}</strong></p>
            <p className="text-gray-600">KRA PIN: <strong className="font-mono">{deliveryNote.customer.kraPin}</strong></p>
            <p className="text-gray-600">PO Reference: <strong className="font-mono">{deliveryNote.poReference}</strong></p>
          </div>

          <div className="space-y-1.5 sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">
              Receiving Dock &amp; Logistics:
            </span>
            <p className="font-bold text-gray-900">{deliveryNote.customer.deliveryAddress?.label}</p>
            <p className="text-gray-600">{deliveryNote.customer.deliveryAddress?.addressLine}</p>
            <p className="text-gray-600">Driver: <strong>{deliveryNote.logistics.driverName}</strong> ({deliveryNote.logistics.driverPhone})</p>
            <p className="text-gray-600">Vehicle: <strong>{deliveryNote.logistics.vehicleRegistration}</strong></p>
            <p className="text-emerald-700 font-bold">Temp Log: {deliveryNote.logistics.temperatureLog}</p>
          </div>
        </div>

        {/* Itemized Goods Received Checklist */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 uppercase text-[10px] text-gray-700 font-bold border-b border-gray-300">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Item / Description</th>
                <th className="py-3 px-2 text-center">Unit Size</th>
                <th className="py-3 px-3 text-center">Ordered Qty</th>
                <th className="py-3 px-3 text-center">Dispatched Qty</th>
                <th className="py-3 px-3 text-center">Received / Accepted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-medium">
              {deliveryNote.items.map((line, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 px-3 text-gray-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-gray-900">{line.name}</div>
                    <span className="font-mono text-[10px] text-gray-400">{line.sku}</span>
                  </td>
                  <td className="py-3 px-2 text-center text-gray-600">{line.unitSize}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">{line.orderedQuantity}</td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 bg-emerald-50/40">{line.dispatchedQuantity}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-gray-400 border-l border-gray-100">[ &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td colSpan="4" className="py-3 px-3 text-right uppercase text-[10px] text-gray-600">Total Cases / Bottles:</td>
                <td className="py-3 px-3 text-center font-black font-mono text-emerald-800 text-sm">{deliveryNote.totalBottles} Btls</td>
                <td className="py-3 px-3 text-center font-mono text-xs text-gray-500">Verified</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Security & Tamper-Evident Sign-off */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
          <span className="font-bold text-amber-900 uppercase tracking-wider block">Security &amp; Bottle Integrity Guarantee</span>
          <p className="text-amber-800 leading-relaxed">
            All bottles dispatched under temperature-controlled monitoring. Security seal <strong>{deliveryNote.sealNumber}</strong> must be intact upon handover. Any breakages or variances must be noted on this GRN before signing.
          </p>
        </div>

        {/* Dual Signatures & Stamp Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t-2 border-gray-300">
          <div className="p-5 rounded-2xl border border-gray-300 space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              1. Dispatched by Happy Hour Logistics:
            </span>
            <div className="space-y-3 text-xs">
              <div className="border-b border-gray-300 pb-1 flex justify-between">
                <span className="text-gray-500">Driver / Dispatcher:</span>
                <span className="font-bold text-gray-900">{deliveryNote.logistics.driverName}</span>
              </div>
              <div className="border-b border-gray-300 pb-1 flex justify-between">
                <span className="text-gray-500">Signature:</span>
                <span className="font-mono text-emerald-800 italic">Boniface O. ✓</span>
              </div>
              <div className="border-b border-gray-300 pb-1 flex justify-between">
                <span className="text-gray-500">Dispatch Time:</span>
                <span className="font-mono text-gray-700">{deliveryNote.dispatchDate} 08:30 EAT</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-gray-300 space-y-6 bg-gray-50/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              2. Received &amp; Verified by Customer Dock Officer:
            </span>
            <div className="space-y-4 text-xs">
              <div className="border-b border-gray-300 pb-1">
                <span className="text-gray-400 block text-[10px]">Receiving Officer Name:</span>
                <div className="h-5"></div>
              </div>
              <div className="border-b border-gray-300 pb-1">
                <span className="text-gray-400 block text-[10px]">Officer Signature &amp; Official Stamp:</span>
                <div className="h-8"></div>
              </div>
              <div className="border-b border-gray-300 pb-1">
                <span className="text-gray-400 block text-[10px]">Date &amp; Time Received:</span>
                <div className="h-5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl text-[#231F20]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold uppercase text-gray-900">Email Delivery Note</h3>
                <p className="text-xs text-gray-500">Send dispatch manifest to receiving dock</p>
              </div>
              <button onClick={() => setEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. receiving@hotel.co.ke"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-bold uppercase hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow transition-all disabled:opacity-50"
                >
                  {sendingEmail ? 'Dispatching...' : 'Send Delivery Note →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

