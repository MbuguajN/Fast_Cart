'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeLoginPage() {
  const router = useRouter();
  const { login } = useTrade();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logo, setLogo] = useState(null);

  React.useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  const demoAccounts = [
    { label: 'Nairobi Serena Hotel (Owner / Director)', id: 'usr_serena_owner', note: 'Full Net 14 credit terms, high volume' },
    { label: 'Nairobi Serena Hotel (Buyer Seat)', id: 'usr_serena_buyer', note: 'Subject to purchase ceiling approval' },
    { label: 'Sankara Hotel (Tier 2 Contract Override)', id: 'usr_sankara_owner', note: 'Pinned Tier 2 wholesale pricing' },
    { label: 'Capital Club East Africa (VIP Lounge)', id: 'usr_capital_owner', note: 'Premium single malts & champagne' },
    { label: 'Artcaffé Grand (Restaurant Group)', id: 'usr_artcaffe_buyer', note: 'High mixer & cocktail volume' },
    { label: 'The Alchemist Westlands (Expiring Licence Warning)', id: 'usr_westlands_buyer', note: 'Licence expiring in 9 days' },
    { label: 'Acme Advisory (Corporate / No Liquor Licence)', id: 'usr_acme_buyer', note: 'Spirits restricted, Jaba juices enabled' },
  ];

  const handleLogin = async (idToUse) => {
    try {
      setLoading(true);
      setError(null);
      await login(idToUse || identifier);
      router.push('/trade/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-8 text-[#231F20]">
      <div className="text-center space-y-3">
        {logo && (
          <div className="flex justify-center mb-2">
            <img src={logo} alt="Happy Hour Logo" className="max-h-12 w-auto object-contain" />
          </div>
        )}
        <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
          Wholesale Access Portal
        </span>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
          Trade Sign In
        </h1>
        <p className="text-xs text-gray-500 font-medium">
          Enter your registered trade email, phone number, or select a demo account below.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Main Login Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin(identifier);
        }}
        className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
            Email or Phone Number
          </label>
          <input
            type="text"
            required
            placeholder="e.g. david.kimani@serenahotels.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Authenticating...' : 'Sign In →'}
        </button>
      </form>

      {/* 1-Click Demo Switcher */}
      <div className="bg-pink-50/50 p-6 rounded-3xl border border-pink-200 space-y-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#840038] block text-center">
          ⚡ 1-Click Test Account Switcher
        </span>
        <div className="space-y-2">
          {demoAccounts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleLogin(d.id)}
              className="w-full text-left p-3 rounded-xl bg-white border border-pink-100 hover:border-[#840038] hover:bg-white/80 transition-all text-xs group"
            >
              <div className="font-bold text-gray-900 group-hover:text-[#840038]">{d.label}</div>
              <div className="text-[10px] text-gray-500">{d.note}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-gray-500">
        Don&apos;t have an active trade account?{' '}
        <Link href="/trade/apply" className="font-bold text-[#840038] hover:underline">
          Apply online here
        </Link>
      </div>
    </div>
  );
}

