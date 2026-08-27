'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeVatInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, account, loading, showNotification } = useTrade();

  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [error, setError] = useState(null);
  const [logo, setLogo] = useState(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customNotes, setCustomNotes] = useState('');
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
      fetch(`/api/trade/invoices/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error('Invoice not found or access denied');
          return r.json();
        })
        .then((data) => {
          if (data.success) {
            setInvoice(data.invoice);
            setRecipientEmail(user.email || 'finance@customer.co.ke');
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingInvoice(false));
    }
  }, [id, user, account, loading, router]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleSendInvoiceEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail) return;

    try {
      setSendingEmail(true);
      const res = await fetch(`/api/trade/invoices/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          customNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email invoice');

      showNotification(`Tax Invoice sent successfully to ${recipientEmail}!`, 'success');
      setEmailModalOpen(false);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading || loadingInvoice) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Generating VAT Invoice...</span>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-[#231F20]">
        <h1 className="text-xl font-bold uppercase text-red-600">Invoice Unavailable</h1>
        <p className="text-xs text-gray-500">{error || 'Invoice record could not be loaded.'}</p>
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
            <span className="px-3 py-1 bg-white text-[#840038] rounded-lg shadow-xs">
              Tax Invoice
            </span>
            <Link
              href={`/trade/delivery-notes/${id}`}
              className="px-3 py-1 text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
            >
              Delivery Note (GRN)
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <span>✉️ Email Invoice</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-2"
          >
            <span>🖨️ Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Official A4 Print Document Sheet */}
      <div className="bg-white p-8 sm:p-12 rounded-3xl border border-gray-300 shadow-xl space-y-8 print:border-none print:shadow-none print:p-0 print:m-0">
        {/* Document Header: Supplier & Tax Identification */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-[#840038] pb-6">
          <div className="space-y-2">
            {logo && (
              <img src={logo} alt="Happy Hour Logo" className="max-h-12 w-auto object-contain mb-1" />
            )}
            <h2 className="text-xl font-black uppercase tracking-tight text-[#840038] font-sans">
              {invoice.supplier.companyName}
            </h2>
            <p className="text-xs text-gray-600 font-medium">{invoice.supplier.physicalAddress}</p>
            <p className="text-xs text-gray-600">
              KRA PIN: <strong>{invoice.supplier.kraPin}</strong> · VAT No: <strong>{invoice.supplier.vatNumber}</strong>
            </p>
            <p className="text-xs text-gray-600">
              Email: {invoice.supplier.email} · Tel: {invoice.supplier.phone}
            </p>
          </div>

          <div className="text-left sm:text-right space-y-1 bg-pink-50/70 p-4 rounded-2xl border border-pink-200">
            <span className="text-xs font-black uppercase tracking-widest text-[#840038] block">
              TAX INVOICE
            </span>
            <div className="text-lg font-black font-mono text-gray-900">
              {invoice.invoiceNumber}
            </div>
            <p className="text-xs text-gray-600">Date: <strong>{invoice.issueDate}</strong></p>
            <p className="text-xs text-gray-600">Payment Due: <strong>{invoice.dueDate}</strong></p>
            <p className="text-xs text-gray-500 font-mono text-[10px]">{invoice.etrControlNumber || 'ETR-KRA-VERIFIED'}</p>
          </div>
        </div>

        {/* Billed To & Delivery Addresses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 border-b border-gray-200 pb-6 text-xs">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">
              Billed To (Customer):
            </span>
            <p className="text-sm font-bold text-gray-900">{invoice.customer.legalName}</p>
            <p className="text-gray-600">Trading Name: <strong>{invoice.customer.tradingName}</strong></p>
            <p className="text-gray-600">KRA PIN: <strong className="font-mono">{invoice.customer.kraPin}</strong></p>
            <p className="text-gray-600">Liquor Licence: <strong className="font-mono">{invoice.customer.licenceNo || 'N/A'}</strong></p>
            <p className="text-gray-600">PO Reference: <strong className="font-mono">{invoice.poReference || 'N/A'}</strong></p>
          </div>

          <div className="space-y-1.5 sm:text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">
              Delivery Destination:
            </span>
            <p className="font-bold text-gray-900">{invoice.customer.deliveryAddress?.label}</p>
            <p className="text-gray-600">{invoice.customer.deliveryAddress?.addressLine}</p>
            <p className="text-gray-600">{invoice.customer.deliveryAddress?.city}, Kenya</p>
            <p className="text-gray-600">Attn: {invoice.customer.deliveryAddress?.contactName} ({invoice.customer.deliveryAddress?.phone})</p>
          </div>
        </div>

        {/* Itemized Invoice Table with Mixed-VAT Footing */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100 uppercase text-[10px] text-gray-700 font-bold border-b border-gray-300">
                <th className="py-3 px-3">Item / Description</th>
                <th className="py-3 px-2 text-center">Tier</th>
                <th className="py-3 px-2 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Unit (Ex-VAT)</th>
                <th className="py-3 px-3 text-right">VAT (16%)</th>
                <th className="py-3 px-3 text-right">Unit (Inc-VAT)</th>
                <th className="py-3 px-4 text-right">Total (Inc-VAT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 font-medium">
              {(invoice.lines || invoice.items || []).map((line, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 px-3">
                    <div className="font-bold text-gray-900">{line.name}</div>
                    <span className="font-mono text-[10px] text-gray-400">{line.sku}</span>
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-[#840038]">
                    {line.tierKey || 'T1'}
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-gray-900">
                    {line.quantity}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-700">
                    KES {line.unitPriceExVat?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-500">
                    KES {line.vatAmountPerUnit?.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-gray-700">
                    KES {line.unitPriceIncVat?.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                    KES {line.lineTotalIncVat?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Settlement Instructions & Grand Footing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t-2 border-gray-200">
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs space-y-2">
            <span className="font-bold uppercase tracking-wider text-gray-700 block">
              Settlement &amp; Bank Instructions (Net 14)
            </span>
            <p className="text-gray-600">
              Corporate M-Pesa Paybill: <strong>{invoice.supplier.paybill}</strong> · Account: <strong>{invoice.invoiceNumber}</strong>
            </p>
            <div className="text-gray-600 space-y-0.5 border-t border-gray-200 pt-2">
              <p>Bank: <strong>{invoice.supplier.bankDetails.bank}</strong> ({invoice.supplier.bankDetails.branch})</p>
              <p>Account Name: <strong>{invoice.supplier.bankDetails.accountName}</strong></p>
              <p>Account No: <strong className="font-mono">{invoice.supplier.bankDetails.accountNumber}</strong></p>
              <p>Swift Code: <strong className="font-mono">{invoice.supplier.bankDetails.swiftCode}</strong></p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
              <span>Goods Subtotal (Ex-VAT)</span>
              <span className="font-mono font-bold text-gray-900">KES {invoice.subtotalExVat?.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
              <span>Kenya Standard VAT (16%)</span>
              <span className="font-mono font-bold text-gray-900">KES {invoice.vatTotal?.toLocaleString()}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-gray-100 text-gray-600">
              <span>Delivery &amp; Handling</span>
              <span className="font-mono font-bold text-gray-900">
                {invoice.deliveryFee === 0 ? 'FREE (Nairobi Metro)' : `KES ${invoice.deliveryFee?.toLocaleString()}`}
              </span>
            </div>

            {invoice.referralCredit > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-100 text-[#840038]">
                <span>Referral Credit Applied</span>
                <span className="font-mono font-bold">- KES {invoice.referralCredit?.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between py-3 border-t-2 border-[#840038] items-baseline">
              <span className="text-sm font-black uppercase text-gray-900">Total Amount Due</span>
              <span className="text-2xl font-black text-[#840038] font-sans">
                KES {invoice.grandTotal?.toLocaleString()}
              </span>
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
                <h3 className="text-base font-bold uppercase text-gray-900">Email Tax Invoice</h3>
                <p className="text-xs text-gray-500">Send KRA tax invoice directly to accounts payable</p>
              </div>
              <button onClick={() => setEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSendInvoiceEmail} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. finance@hotel.co.ke"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#840038]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Additional Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Approved monthly order as per contract #8841."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#840038]"
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
                  className="px-5 py-2 bg-[#840038] hover:bg-[#6b002c] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow transition-all disabled:opacity-50"
                >
                  {sendingEmail ? 'Sending...' : 'Dispatch Invoice Email →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
