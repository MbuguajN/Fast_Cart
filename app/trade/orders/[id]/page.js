'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

const TRACKING_STEPS = [
  { key: 'confirmed', label: 'Order Confirmed', desc: 'Order verified & inventory allocated' },
  { key: 'picking', label: 'Warehouse Picking', desc: 'Bonded cellar picking & packing' },
  { key: 'dispatched', label: 'Dispatched in Transit', desc: 'En route with temperature-controlled van' },
  { key: 'delivered', label: 'Delivered & Received', desc: 'Signed at receiving dock' },
];

export default function SingleTradeOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, account, loading, showNotification } = useTrade();

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !account)) {
      router.push('/trade/login');
      return;
    }

    if (id && user && account) {
      fetch(`/api/trade/orders/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error('Order not found or unauthorized');
          return r.json();
        })
        .then((data) => {
          if (data.success) {
            setOrder(data.order);
            setRecipientEmail(user.email || '');
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingOrder(false));
    }
  }, [id, user, account, loading, router]);

  const handleApproval = async (action) => {
    try {
      setApproving(true);
      const res = await fetch(`/api/trade/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');

      setOrder(data.order);
      showNotification(data.message, 'success');
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setApproving(false);
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
        body: JSON.stringify({ recipientEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to email invoice');

      showNotification(`Tax Invoice emailed to ${recipientEmail}!`, 'success');
      setEmailModalOpen(false);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading || loadingOrder) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Order Details...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <h1 className="text-xl font-bold uppercase text-red-600">Unable to Load Order</h1>
        <p className="text-xs text-gray-500">{error || 'Order record not found.'}</p>
        <Link href="/trade/orders" className="text-xs font-bold text-[#840038] hover:underline">
          ← Return to Orders List
        </Link>
      </div>
    );
  }

  const currentStepIndex = (() => {
    if (order.status === 'awaiting_approval') return 0;
    if (order.status === 'confirmed') return 0;
    if (order.status === 'picking') return 1;
    if (order.status === 'dispatched') return 2;
    if (order.status === 'delivered') return 3;
    return 0;
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-[#231F20]">
      {/* Header & Document Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <Link href="/trade/orders" className="text-xs font-bold text-[#840038] uppercase hover:underline">
            ← Back to Order History
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
              {order.orderNumber}
            </h1>
            <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded ${
              order.status === 'delivered'
                ? 'bg-emerald-100 text-emerald-800'
                : order.status === 'dispatched'
                ? 'bg-blue-100 text-blue-800'
                : order.status === 'awaiting_approval'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Invoice: <span className="font-mono font-bold text-gray-800">{order.invoiceNumber}</span> · PO Ref: <span className="font-mono">{order.poReference || 'N/A'}</span> · Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Commercial Documents Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEmailModalOpen(true)}
            className="px-3.5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>✉️ Email Invoice</span>
          </button>

          <Link
            href={`/trade/delivery-notes/${order.id}`}
            className="px-3.5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <span>🚚 Delivery Note (GRN)</span>
          </Link>

          <Link
            href={`/trade/invoices/${order.id}`}
            className="px-4 py-2.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <span>📄 VAT Tax Invoice</span>
          </Link>
        </div>
      </div>

      {order.status === 'awaiting_approval' && (
        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-900 font-black text-sm uppercase">
              <span>⚠️ Order Exceeds Account Purchase Ceiling</span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              This order of KES {order.grandTotal.toLocaleString()} was placed by <strong>{order.orderedBy?.name}</strong> and requires owner authorization before release.
            </p>
          </div>
          {user.seatType === 'owner' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={approving}
                onClick={() => handleApproval('reject')}
                className="px-4 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-bold uppercase rounded-xl transition-all"
              >
                Reject Order
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={() => handleApproval('approve')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-xl shadow transition-all"
              >
                Approve &amp; Release →
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-3 py-1.5 rounded-xl">
              Awaiting Account Owner Approval
            </span>
          )}
        </div>
      )}

      {order.status !== 'cancelled' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#840038]">
                Real-Time Fulfillment
              </span>
              <h2 className="text-lg font-bold uppercase text-[#231F20]">Live Dispatch Pipeline</h2>
            </div>
            {order.driverInfo && (
              <div className="text-xs text-gray-600 bg-pink-50/70 px-3 py-1.5 rounded-xl border border-pink-200">
                Driver: <strong>{order.driverInfo.name}</strong> ({order.driverInfo.phone}) · Van: {order.driverInfo.vehicle}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
            {TRACKING_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.key} className="space-y-2 relative">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-tight ${isCurrent ? 'text-[#840038]' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 pl-10 leading-snug">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-base font-bold uppercase text-[#231F20]">
              Line Items &amp; Quantity Pricing Tiers
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 uppercase text-[10px] text-gray-500">
                  <th className="py-3 px-6">SKU / Product</th>
                  <th className="py-3 px-3 text-center">Tier</th>
                  <th className="py-3 px-3 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-6 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {order.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      <span className="text-[11px] font-mono text-gray-400">{item.sku}</span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-pink-100 text-[#840038] text-[10px] font-bold">
                        {item.tierKey || 'Base'}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center font-bold text-gray-800">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-4 text-right font-mono text-gray-700">
                      KES {item.unitPriceIncVat?.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-[#840038]">
                      KES {item.lineTotalIncVat?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
            Financial Summary
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Volume</span>
              <span className="font-bold text-gray-900">{order.totalBottles} bottles</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Goods Subtotal (Ex-VAT)</span>
              <span className="font-mono font-bold text-gray-900">KES {order.subtotalExVat?.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>16% Kenya Standard VAT</span>
              <span className="font-mono font-bold text-gray-900">KES {order.vatTotal?.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span className="font-mono font-bold text-emerald-600">
                {order.deliveryFee === 0 ? 'FREE' : `KES ${order.deliveryFee?.toLocaleString()}`}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-bold uppercase text-gray-900">Grand Total</span>
              <span className="text-2xl font-black text-[#840038] font-sans">
                KES {order.grandTotal?.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Terms</span>
              <span className="font-bold text-gray-800 uppercase">{order.paymentTerms}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Status</span>
              <span className="font-bold uppercase text-emerald-700">{order.paymentStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment Due Date</span>
              <span className="font-mono font-bold text-gray-800">{order.dueDate}</span>
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
                <p className="text-xs text-gray-500">Send KRA tax invoice to finance / accounts</p>
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
                  placeholder="e.g. accounts@hotel.co.ke"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#840038]"
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
                  {sendingEmail ? 'Dispatching...' : 'Send Invoice Email →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
