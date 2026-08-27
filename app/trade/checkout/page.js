'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeCheckoutPage() {
  const router = useRouter();
  const { cart, cartPricing, account, user, selectedAddress, setSelectedAddress, clearCart, showNotification } = useTrade();

  const [paymentMethod, setPaymentMethod] = useState(account?.creditEnabled ? 'pay_on_account' : 'mpesa_paybill');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [poReference, setPoReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-[#231F20]">
        <h1 className="text-xl font-bold uppercase">Cart is Empty</h1>
        <Link href="/trade/order-pad" className="text-xs font-bold text-[#840038] hover:underline">
          Return to Bulk Order Pad →
        </Link>
      </div>
    );
  }

  const creditLimit = account?.creditLimit || 0;
  const creditUsed = account?.creditUsed || 0;
  const grandTotal = cartPricing.grandTotal || 0;
  const creditHeadroom = Math.max(0, creditLimit - creditUsed);
  const isCreditExceeded = (creditUsed + grandTotal) > creditLimit;
  const creditShortfall = Math.max(0, (creditUsed + grandTotal) - creditLimit);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!selectedAddress) {
      setError('Please select or specify a delivery address.');
      return;
    }

    if (!cartPricing.minOrderCheck.passed) {
      setError(cartPricing.minOrderCheck.message);
      return;
    }

    if (paymentMethod === 'pay_on_account' && isCreditExceeded) {
      setError(`Credit limit exceeded by KES ${creditShortfall.toLocaleString()}. Please choose M-Pesa or Bank Transfer for this order.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/trade/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          deliveryAddress: selectedAddress,
          deliveryDate,
          poReference,
          notes,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place trade order');
      }

      clearCart();
      showNotification('Trade order successfully submitted!', 'success');
      router.push(`/trade/orders/${data.order.id}`);
    } catch (err) {
      setError(err.message || 'Order submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20]">
      <div className="border-b border-gray-200 pb-4">
        <Link href="/trade/cart" className="text-xs font-bold text-[#840038] uppercase hover:underline">
          ← Back to Trade Cart
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#231F20] mt-1">
          Trade Order Settlement &amp; Dispatch
        </h1>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Form (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
              1. Delivery Receiving Dock / Address
            </h2>

            <div className="space-y-3">
              {account?.addresses?.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                return (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">{addr.label}</span>
                        <p className="text-xs text-gray-600 mt-0.5">{addr.addressLine} ({addr.city})</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Contact: {addr.contactName} · {addr.phone} · Window: {addr.deliveryWindow}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-bold text-[#840038]">✓ Selected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Requested Delivery Date
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Client PO Reference (Prints on Invoice)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-SRN-99812"
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                Receiving / Driver Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Deliver via Security Gate 3, ask for Eric at main bar receiving."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
              />
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
              2. Settlement &amp; Payment Terms
            </h2>

            <div className="space-y-3">
              {account?.creditEnabled && (
                <div
                  onClick={() => setPaymentMethod('pay_on_account')}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'pay_on_account'
                      ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 uppercase">
                          Pay on Account (Net {account.creditTerms || 14} Days)
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Approved Credit
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Invoice issued today; payment due in {account.creditTerms || 14} days. Available Credit: KES {creditHeadroom.toLocaleString()}
                      </p>
                      {isCreditExceeded && (
                        <p className="text-xs font-bold text-red-600 mt-1">
                          ⚠️ Order value exceeds available credit limit by KES {creditShortfall.toLocaleString()}.
                        </p>
                      )}
                    </div>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'pay_on_account'}
                      onChange={() => setPaymentMethod('pay_on_account')}
                      className="mt-1 text-[#840038] focus:ring-[#840038]"
                    />
                  </div>
                </div>
              )}

              <div
                onClick={() => setPaymentMethod('mpesa_paybill')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'mpesa_paybill'
                    ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-900 uppercase block">
                      M-Pesa Corporate Paybill (Immediate)
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Paybill: <strong>400200</strong> · Account: <strong>HAPPYHOUR</strong>
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'mpesa_paybill'}
                    onChange={() => setPaymentMethod('mpesa_paybill')}
                    className="mt-1 text-[#840038] focus:ring-[#840038]"
                  />
                </div>
              </div>

              <div
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'bank_transfer'
                    ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-gray-900 uppercase block">
                      Direct Bank Transfer (RTGS / Electronic Funds Transfer)
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Standard Chartered Bank Kenya · Acc No: 0108099221100 · Dispatched upon confirmation.
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => setPaymentMethod('bank_transfer')}
                    className="mt-1 text-[#840038] focus:ring-[#840038]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Summary (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-md space-y-6">
          <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
            Order Total
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Volume</span>
              <span className="font-bold text-gray-900">{cartPricing.totalBottles} bottles</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Goods Value (Ex-VAT)</span>
              <span className="font-mono font-bold text-gray-900">KES {cartPricing.subtotalExVat.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>VAT (16% Kenya Standard)</span>
              <span className="font-mono font-bold text-gray-900">KES {cartPricing.vatTotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Delivery Fee</span>
              <span className="font-mono font-bold text-emerald-600">
                {cartPricing.delivery.isFreeDelivery ? 'FREE (Nairobi Metro)' : `KES ${cartPricing.deliveryFee.toLocaleString()}`}
              </span>
            </div>

            {cartPricing.referralCredit > 0 && (
              <div className="flex justify-between text-[#840038]">
                <span>Referral Credit</span>
                <span className="font-mono font-bold">- KES {cartPricing.referralCredit.toLocaleString()}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
              <span className="text-sm font-bold uppercase text-gray-900">Total Payable</span>
              <span className="text-2xl font-black text-[#840038] font-sans">
                KES {cartPricing.grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Placing Trade Order...' : 'Confirm & Place Trade Order →'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

