'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TradeLandingPage() {
  const segments = [
    {
      title: 'HORECA & Bars',
      desc: 'Hotels, cocktail lounges, and rooftop venues enjoying Tier 3 volume rates, scheduled receiving dock drops, and monthly credit settlement.',
      icon: '🍸',
      badge: 'Hotels & Nightlife',
    },
    {
      title: 'Corporate Offices',
      desc: 'Friday happy hours, boardroom entertainment, client gifting, and celebration restocks with itemized KRA VAT invoices for tax deductions.',
      icon: '🏢',
      badge: 'Enterprises',
    },
    {
      title: 'Events & Caterers',
      desc: 'High-volume festival and wedding procurement with pre-event consignment terms, chilled delivery vans, and 1-click quote approvals.',
      icon: '🎪',
      badge: 'Festivals & Catering',
    },
    {
      title: 'Retail & Stockists',
      desc: 'Liquor stores, high-end grocers, and specialty merchants sourcing authentic Pernod Ricard spirits and artisanal Jaba elixirs.',
      icon: '🏪',
      badge: 'Stockists',
    },
    {
      title: 'Private Residences',
      desc: 'Embassy residences, country estates, and collector cellars receiving discreet temperature-controlled private deliveries.',
      icon: '🏡',
      badge: 'Diplomatic & Estates',
    },
  ];

  const [logo, setLogo] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-16 py-8 sm:py-12 text-[#231F20]">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1c1917] rounded-3xl p-8 sm:p-16 text-white text-center sm:text-left relative overflow-hidden shadow-2xl border border-white/10">
          <div className="max-w-2xl space-y-6 relative z-10">
            <div className="flex flex-wrap items-center gap-3">
              {logo && (
                <img src={logo} alt="Happy Hour Logo" className="max-h-10 w-auto object-contain" />
              )}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#840038] text-white text-xs font-black uppercase tracking-widest border border-pink-400/30">
                <span>★ Pernod Ricard Wholesale Partner · Nairobi</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-tight font-sans">
              Direct Wholesale Spirits &amp; Craft Juices for Kenyan Trade
            </h1>

            <p className="text-sm sm:text-base text-gray-300 font-medium leading-relaxed">
              Serving hotels, restaurants, bars, enterprises, and caterers across Nairobi Metro and regional Kenya. Transparent quantity tiers, Net 14 credit terms, gapless KRA VAT invoices, and rapid delivery.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/trade/apply"
                className="w-full sm:w-auto px-8 py-4 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 text-center"
              >
                Apply for Trade Account →
              </Link>
              <Link
                href="/trade/login"
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-2xl border border-white/20 transition-all active:scale-95 text-center"
              >
                Sign In to Trade Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Segment Strips */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center sm:text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Tailored Commercial Terms
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20] mt-1">
            Built for Every Trade Sector
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {segments.map((seg) => (
            <div
              key={seg.title}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <span className="text-2xl">{seg.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-50 text-[#840038]">
                  {seg.badge}
                </span>
              </div>
              <h3 className="text-lg font-black uppercase text-gray-900">{seg.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{seg.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4-Step Process */}
      <section className="bg-white py-16 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
              Seamless Procurement
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#231F20]">
              How the Trade Portal Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
                01
              </div>
              <h4 className="text-sm font-bold uppercase text-gray-900">Apply &amp; Verify</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Submit business credentials (KRA PIN, liquor licence). Verified within 2 business hours.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
                02
              </div>
              <h4 className="text-sm font-bold uppercase text-gray-900">Unlock Live Pricing</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Access wholesale quantity ladders (+10%, +7%, +4% markups) on bulk order pad.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
                03
              </div>
              <h4 className="text-sm font-bold uppercase text-gray-900">Same-Day Dispatch</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Orders placed by 12:00 EAT delivered same afternoon across Nairobi Metro in dedicated vans.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[#840038] text-white flex items-center justify-center font-black text-sm">
                04
              </div>
              <h4 className="text-sm font-bold uppercase text-gray-900">Net 14 Settlement</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Gapless KRA VAT invoices with 14-day credit terms, Paybill integration, and statement ledger.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

