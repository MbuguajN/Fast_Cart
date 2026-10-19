'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeCheckoutPage() {
  const router = useRouter();
  const { cart, cartPricing, account, user, selectedAddress, setSelectedAddress, clearCart, showNotification } = useTrade();

  const [paymentMethod, setPaymentMethod] = useState(account?.creditEnabled ? 'pay_on_account' : 'paystack');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [poReference, setPoReference] = useState('');
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState({ stockHoldMinutes: 15, nirvanaContact: {}, bankTransfer: { enabled: false } });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Guest checkout — no account/login required. Filled in directly instead
  // of picking from a saved address list.
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [guestAddressLine, setGuestAddressLine] = useState('');
  const [guestCity, setGuestCity] = useState('Nairobi');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/trade/checkout-options')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && !cancelled) setOptions(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const hasSpirits = cart.some((i) => i.priceLine === 'spirits');
  const deliveryCity = account ? selectedAddress?.city : guestCity;

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

    // Nirvana is information only — nothing to place.
    if (paymentMethod === 'nirvana') return;

    if (!account) {
      if (!buyerName.trim() || !buyerPhone.trim() || !buyerEmail.trim()) {
        setError('Please fill in your name, phone and email.');
        return;
      }
      if (!guestAddressLine.trim() || !guestCity.trim()) {
        setError('Please fill in a delivery address.');
        return;
      }
    } else if (!selectedAddress) {
      setError('Please select or specify a delivery address.');
      return;
    }

    if (hasSpirits && !ageConfirmed) {
      setError('Please confirm you are of legal drinking age to order spirits.');
      return;
    }

    if (!cartPricing.minOrderCheck.passed) {
      setError(cartPricing.minOrderCheck.message);
      return;
    }

    if (paymentMethod === 'pay_on_account' && isCreditExceeded) {
      setError(`Credit limit exceeded by KES ${creditShortfall.toLocaleString()}. Please choose Pay Now for this order.`);
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
          deliveryAddress: account
            ? selectedAddress
            : { addressLine: guestAddressLine, city: guestCity, contactName: buyerName, phone: buyerPhone },
          deliveryDate,
          poReference,
          notes,
          paymentMethod,
          ageConfirmed,
          honeypot,
          submissionDurationMs: Date.now() - mountedAt,
          ...(!account ? { buyerName, buyerPhone, buyerEmail } : {}),
        }),
      });

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        data = { error: text?.slice(0, 150) || `Server error (${res.status})` };
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to place trade order');
      }

      // Paystack redirect flow
      if (data.paystack?.authorization_url) {
        showNotification('Redirecting to secure payment...', 'info');
        window.location.href = data.paystack.authorization_url;
        return; // Don't clear cart — let the callback handle it
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20] animate-page-enter">
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
        {/* Anti-bot honeypot field - invisible to humans, catches bots */}
        <div className="opacity-0 absolute top-0 left-0 h-0 w-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
          <label htmlFor="company_tax_fax">Leave this field blank</label>
          <input
            id="company_tax_fax"
            type="text"
            name="company_tax_fax"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* Left: Form (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {!account && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
                Your Details
              </h2>
              <p className="text-xs text-gray-500">
                No account needed to order. <Link href="/trade/login" className="font-bold text-[#840038] hover:underline">Sign in</Link> if you already have one.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                />
              </div>
            </div>
          )}

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold uppercase text-[#231F20] border-b border-gray-100 pb-3">
              1. Delivery Receiving Dock / Address
            </h2>

            {account ? (
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    required
                    placeholder="Street, building, floor..."
                    value={guestAddressLine}
                    onChange={(e) => setGuestAddressLine(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">City / Town</label>
                  <input
                    type="text"
                    required
                    value={guestCity}
                    onChange={(e) => setGuestCity(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white"
                  />
                </div>
              </div>
            )}

            {deliveryCity && deliveryCity.toLowerCase() !== 'nairobi' && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-2xl text-xs flex items-start gap-2">
                <span className="text-base">📍</span>
                <div>
                  <strong>Regional Fulfillment ({deliveryCity}):</strong>
                  <p className="mt-0.5 text-[11px] text-blue-700">
                    Deliveries outside Nairobi are fulfilled via regional road freight or secured courier. Delivery schedule and freight cost will be confirmed directly by your Account Specialist prior to dispatch.
                  </p>
                </div>
              </div>
            )}

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
                onClick={() => setPaymentMethod('paystack')}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  paymentMethod === 'paystack'
                    ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 uppercase block">
                        Pay Now — Card / M-Pesa
                      </span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                        Instant
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pay securely via Visa, Mastercard, or M-Pesa. Order confirmed immediately upon payment. Your stock is reserved for {options.stockHoldMinutes} minutes while you pay.
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'paystack'}
                    onChange={() => setPaymentMethod('paystack')}
                    className="mt-1 text-[#840038] focus:ring-[#840038]"
                  />
                </div>
              </div>

              {/* Nirvana Africa logbook loan — information only. No order, no payment,
                  no stock movement: Nirvana vets and funds it off-site. Never sent to
                  /api/trade/checkout (the API rejects it). */}
              <div
                data-testid="nirvana-option"
                onClick={() => { if (account) setPaymentMethod('nirvana'); }}
                className={`p-5 rounded-2xl border transition-all ${
                  account ? 'cursor-pointer' : 'cursor-default'
                } ${
                  paymentMethod === 'nirvana'
                    ? 'bg-pink-50/50 border-[#840038] ring-2 ring-[#840038]'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 uppercase block">
                        Logbook Loan — Nirvana Africa
                      </span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                        Stock funding
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Need to fund a large order, such as stock for an event? Nirvana Africa can finance it against your vehicle logbook.
                    </p>
                    {!account && (
                      <p className="text-xs text-amber-800 mt-2">
                        You need a trade account to use this option.{' '}
                        <Link href="/trade/apply" className="font-bold text-[#840038] hover:underline">Create an account</Link>
                        {' '}or{' '}
                        <Link href="/trade/login" className="font-bold text-[#840038] hover:underline">sign in</Link>.
                      </p>
                    )}
                    {account && paymentMethod === 'nirvana' && (
                      <div className="mt-3 space-y-2 text-xs text-gray-700">
                        <p className="font-bold uppercase text-[10px] text-gray-600">What Nirvana will ask for</p>
                        <ul className="list-disc pl-5 space-y-0.5">
                          <li>Original vehicle logbook</li>
                          <li>Copy of your national ID</li>
                          <li>KRA PIN</li>
                          <li>Valuation of the vehicle by Nirvana&apos;s assessors</li>
                          <li>Colour passport-size photo</li>
                        </ul>
                        <p>
                          Nirvana vets and approves each application, which takes longer than a normal order.
                          <strong> Nothing is charged and no stock is reserved</strong> until it is arranged.
                        </p>
                        <p>
                          To get started, contact{' '}
                          <strong>{options.nirvanaContact?.name || 'your Happy Hour account manager'}</strong>
                          {options.nirvanaContact?.phone ? <> on <strong>{options.nirvanaContact.phone}</strong></> : null}
                          {options.nirvanaContact?.email ? <> or <strong>{options.nirvanaContact.email}</strong></> : null}.
                        </p>
                      </div>
                    )}
                  </div>
                  {account && (
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'nirvana'}
                      onChange={() => setPaymentMethod('nirvana')}
                      className="mt-1 text-[#840038] focus:ring-[#840038]"
                    />
                  )}
                </div>
              </div>

              {options.bankTransfer?.enabled && (
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
                        {options.bankTransfer.bankName} · {options.bankTransfer.accountName} · Acc No:{' '}
                        <strong>{options.bankTransfer.accountNumber}</strong>
                        {options.bankTransfer.branch ? ` · ${options.bankTransfer.branch}` : ''} · Dispatched upon confirmation.
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
              )}
            </div>
          </div>

          {hasSpirits && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded accent-[#840038] focus:ring-[#840038]"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  I confirm I am 18 years or older and legally permitted to purchase alcohol.
                </span>
              </label>
            </div>
          )}
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
              disabled={submitting || paymentMethod === 'nirvana'}
              className={`w-full py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2.5 ${
                submitting ? 'opacity-85 cursor-wait' : paymentMethod === 'nirvana' ? 'disabled:opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              )}
              <span>
                {submitting
                  ? (paymentMethod === 'paystack' ? 'Connecting to Secure Payment...' : 'Processing Wholesale Order...')
                  : paymentMethod === 'nirvana'
                    ? 'Contact us to arrange funding'
                    : (paymentMethod === 'paystack' ? 'Pay & Place Wholesale Order →' : 'Confirm & Place Wholesale Order →')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

