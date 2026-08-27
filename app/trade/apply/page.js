'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TradeApplyPage() {
  const [formData, setFormData] = useState({
    tradingName: '',
    legalName: '',
    segment: 'horeca',
    contactName: '',
    role: '',
    email: '',
    phone: '',
    kraPin: '',
    licenceNo: '',
    licenceExpiry: '',
    deliveryAddress: '',
    city: 'Nairobi',
    deliveryWindow: '08:00 - 12:00 EAT',
    estimatedMonthlyCases: '10-25',
    termsAccepted: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.termsAccepted) {
      setError('You must accept the Trade Wholesale Terms & Conditions to apply.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch('/api/trade/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6 text-[#231F20]">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
          Application Received
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
          Thank you for applying for a Happy Hour B2B Trade Account. Our vetting team is reviewing your KRA PIN and business details. You will receive an SMS and email with login credentials within 2 business hours.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/trade/login"
            className="px-6 py-3 bg-[#840038] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow hover:bg-[#6b002c]"
          >
            Go to Trade Login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-[#231F20]">
      <div className="border-b border-gray-200 pb-4">
        <Link href="/trade" className="text-xs font-bold text-[#840038] uppercase hover:underline">
          ← Back to Trade Overview
        </Link>
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#231F20] mt-1">
          B2B Trade Account Application
        </h1>
        <p className="text-xs text-gray-500 font-medium mt-1">
          Open a verified wholesale procurement account for direct distributor pricing and Net 14 credit terms.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-10 rounded-3xl border border-gray-200 shadow-sm space-y-8">
        {/* Business Information */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-[#840038] tracking-wider border-b border-gray-100 pb-2">
            1. Business Identification
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Trading Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Sankara Hotel Lounge"
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Registered Legal Entity Name</label>
              <input
                type="text"
                placeholder="e.g. Westlands Hospitality PLC"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Business Segment *</label>
              <select
                value={formData.segment}
                onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:ring-2 focus:ring-[#840038]"
              >
                <option value="horeca">Hotel, Restaurant, Bar / Club</option>
                <option value="corporate">Corporate Office / Enterprise</option>
                <option value="events">Event Organizer / Caterer</option>
                <option value="retail">Retail Liquor Store / Stockist</option>
                <option value="residence">Private Residence / Diplomatic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">KRA PIN (For Tax Invoices)</label>
              <input
                type="text"
                placeholder="e.g. P051123456Z"
                value={formData.kraPin}
                onChange={(e) => setFormData({ ...formData, kraPin: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium font-mono uppercase focus:ring-2 focus:ring-[#840038]"
              />
            </div>
          </div>
        </div>

        {/* Contact & Seat Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-[#840038] tracking-wider border-b border-gray-100 pb-2">
            2. Primary Account Administrator
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Contact Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. David Kimani"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Designation / Role *</label>
              <input
                type="text"
                required
                placeholder="e.g. Beverage Director"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Business Email *</label>
              <input
                type="email"
                required
                placeholder="e.g. david@hotel.co.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Direct Phone / WhatsApp *</label>
              <input
                type="tel"
                required
                placeholder="e.g. +254 711 222 333"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>
          </div>
        </div>

        {/* Liquor Licence (if applicable) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-[#840038] tracking-wider border-b border-gray-100 pb-2">
            3. Regulatory Compliance (Spirits Gating)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Liquor Licence Number</label>
              <input
                type="text"
                placeholder="e.g. LQ-NRB-2025-9922"
                value={formData.licenceNo}
                onChange={(e) => setFormData({ ...formData, licenceNo: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium font-mono focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Licence Expiry Date</label>
              <input
                type="date"
                value={formData.licenceExpiry}
                onChange={(e) => setFormData({ ...formData, licenceExpiry: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:ring-2 focus:ring-[#840038]"
              />
            </div>
          </div>
        </div>

        {/* Receiving Dock & Terms */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase text-[#840038] tracking-wider border-b border-gray-100 pb-2">
            4. Delivery Receiving Dock
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Delivery Address Line *</label>
              <input
                type="text"
                required
                placeholder="e.g. Westlands Woodvale Grove, Gate 2 receiving"
                value={formData.deliveryAddress}
                onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">City / Region *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-700 mb-1">Preferred Receiving Window</label>
              <select
                value={formData.deliveryWindow}
                onChange={(e) => setFormData({ ...formData, deliveryWindow: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium bg-white focus:ring-2 focus:ring-[#840038]"
              >
                <option value="08:00 - 12:00 EAT">Morning (08:00 - 12:00 EAT)</option>
                <option value="12:00 - 16:00 EAT">Afternoon (12:00 - 16:00 EAT)</option>
                <option value="16:00 - 20:00 EAT">Evening (16:00 - 20:00 EAT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* T&Cs consent */}
        <div
          onClick={() => setFormData((prev) => ({ ...prev, termsAccepted: !prev.termsAccepted }))}
          className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 select-none ${
            formData.termsAccepted
              ? 'bg-pink-50/80 border-[#840038] shadow-sm'
              : 'bg-gray-50/80 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="pt-0.5 shrink-0">
            <input
              id="termsCheckbox"
              type="checkbox"
              checked={formData.termsAccepted}
              onChange={(e) => {
                e.stopPropagation();
                setFormData((prev) => ({ ...prev, termsAccepted: e.target.checked }));
              }}
              className="w-5 h-5 rounded cursor-pointer accent-[#840038] focus:ring-[#840038]"
            />
          </div>
          <div className="text-xs text-gray-700 leading-relaxed">
            I agree to the <strong className="text-[#840038]">Happy Hour B2B Wholesale Terms &amp; Conditions (v2026.1)</strong>, confirming minimum orders of 12 bottles / KES 10,000 ex-VAT and authorizing business credential verification with the Kenya Revenue Authority and relevant County Liquor Licensing Boards.
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {submitting ? 'Submitting Application...' : 'Submit Trade Account Application →'}
        </button>
      </form>
    </div>
  );
}

