'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

const DEMO_PASSWORD = 'HappyHour2026!';

export default function TradeLoginPage() {
  const router = useRouter();
  const { user, account, login, logout } = useTrade();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDemoId, setActiveDemoId] = useState(null);
  const [error, setError] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  const demoAccounts = [
    {
      id: 'usr_serena_owner',
      label: 'Nairobi Serena Hotel (Owner / Director)',
      contact: 'Angela Mutua · Finance Director',
      email: 'angela.mutua@serenahotels.com',
      note: 'Full Net 14 credit terms, high volume',
      tier: 'Net 14 Credit (KES 500k)',
    },
    {
      id: 'usr_serena_buyer',
      label: 'Nairobi Serena Hotel (Buyer Seat)',
      contact: 'David Kimani · Beverage Manager',
      email: 'david.kimani@serenahotels.com',
      note: 'Subject to purchase ceiling approval',
      tier: 'Ceiling KES 250k',
    },
    {
      id: 'usr_serena_viewer',
      label: 'Nairobi Serena Hotel (Auditor / Viewer)',
      contact: 'Grace Wanjiku · Internal Auditor',
      email: 'grace.wanjiku@serenahotels.com',
      note: 'Read-only invoices, statements and audit ledger',
      tier: 'Audit Seat',
    },
    {
      id: 'usr_sankara_owner',
      label: 'Sankara Hotel (Tier 2 Contract Override)',
      contact: 'Kelvin Mwangi · Director of Procurement',
      email: 'kelvin.mwangi@sankaranairobi.com',
      note: 'Pinned Tier 2 wholesale pricing ladder',
      tier: 'Tier 2 Contract',
    },
    {
      id: 'usr_capital_owner',
      label: 'Capital Club East Africa (VIP Lounge)',
      contact: 'Michael Ndungu · Director of F&B',
      email: 'michael.ndungu@capitalclubea.com',
      note: 'Premium single malts & champagne allocation',
      tier: 'VIP Allocation',
    },
    {
      id: 'usr_artcaffe_buyer',
      label: 'Artcaffé Grand (Restaurant Group)',
      contact: 'Sarah Njoroge · Central Beverage Manager',
      email: 'sarah.njoroge@artcaffe.co.ke',
      note: 'High mixer & craft Jaba cocktail volume',
      tier: 'High-volume HORECA',
    },
    {
      id: 'usr_westlands_buyer',
      label: 'The Alchemist Westlands (Expiring Licence Warning)',
      contact: 'Eric Omondi · Bar Manager',
      email: 'eric@alchemist.co.ke',
      note: 'Demonstrates liquor licence renewal alert banner',
      tier: 'Prepayment / Cash',
    },
    {
      id: 'usr_acme_buyer',
      label: 'Acme Advisory (Corporate / No Liquor Licence)',
      contact: 'Faith Chebet · Office Operations',
      email: 'faith.chebet@acmeadvisory.co.ke',
      note: 'Alcohol restricted, craft Jaba juices enabled',
      tier: 'Corporate Non-Liquor',
    },
  ];

  const handleLogin = async (idToUse, passwordToUse) => {
    try {
      setLoading(true);
      setError(null);

      const finalIdentifier = (idToUse || identifier).trim();
      const finalPassword = passwordToUse !== undefined ? passwordToUse : password;

      if (!finalIdentifier) {
        setError('Please enter your email, phone number, or User ID.');
        setLoading(false);
        return;
      }

      if (!finalPassword) {
        setError('Please enter your password.');
        setLoading(false);
        return;
      }

      await login(finalIdentifier, finalPassword);
      router.push('/trade/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
      setActiveDemoId(null);
    }
  };

  const handleDemoSelect = (d) => {
    setActiveDemoId(d.id);
    setIdentifier(d.email || d.id);
    setPassword(DEMO_PASSWORD);
    handleLogin(d.id, DEMO_PASSWORD);
  };

  const copyDemoPassword = () => {
    navigator.clipboard.writeText(DEMO_PASSWORD);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2200);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12 sm:py-16 space-y-8 text-[#231F20] animate-page-enter" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Header & Logo */}
      <div className="text-center space-y-3">
        {logo ? (
          <div className="flex justify-center mb-2">
            <img src={logo} alt="Happy Hour Logo" className="max-h-12 w-auto object-contain" />
          </div>
        ) : (
          <div className="text-2xl font-black uppercase tracking-wider text-[#840038]">
            HAPPY HOUR
          </div>
        )}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
          <span className="w-2 h-2 rounded-full bg-[#840038] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Wholesale Access Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
          Trade Sign In
        </h1>
        <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto">
          Access quantity discount ladders, KRA VAT invoices, Net 14 credit settlement, and same-day commercial dispatch.
        </p>
      </div>

      {/* Active Session Notification (if already logged in) */}
      {user && account && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-1.5">
              <span>✓</span> Currently active session
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
              {user.seatType}
            </span>
          </div>
          <p className="text-gray-700">
            Signed in as <strong>{user.name}</strong> ({account.tradingName} — {user.role})
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/trade/dashboard"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-xs transition-all active:scale-95"
            >
              Enter Dashboard →
            </Link>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-semibold text-[11px] transition-all"
            >
              Switch Account
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
          <span className="shrink-0 text-sm">⚠️</span>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Main Login Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-5"
      >
        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
            Email, Phone or User ID
          </label>
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="e.g. david.kimani@serenahotels.com or usr_serena_buyer"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold uppercase text-gray-700">
              Password
            </label>
            <button
              type="button"
              onClick={copyDemoPassword}
              className="text-[10px] text-[#840038] hover:underline font-bold"
              title="Click to copy standard demo password"
            >
              {copiedPassword ? '✓ Copied Demo Password' : 'Demo Password: HappyHour2026!'}
            </button>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Enter your trade portal password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign In to Portal →</span>
          )}
        </button>
      </form>

      {/* 1-Click Demo Switcher */}
      <div className="bg-pink-50/60 p-6 rounded-3xl border border-pink-200 space-y-4 shadow-xs">
        <div className="text-center space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038] block">
            ⚡ 1-Click Test Account Switcher
          </span>
          <p className="text-[11px] text-gray-600">
            Click any trade test seat below to authenticate immediately into that profile.
          </p>
        </div>

        <div className="space-y-2.5">
          {demoAccounts.map((d) => {
            const isSelected = activeDemoId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                disabled={loading}
                onClick={() => handleDemoSelect(d)}
                className={`w-full text-left p-3.5 rounded-2xl bg-white border transition-all text-xs group cursor-pointer ${
                  isSelected
                    ? 'border-[#840038] ring-2 ring-[#840038]/30 shadow-md'
                    : 'border-pink-100 hover:border-[#840038] hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-gray-900 group-hover:text-[#840038] transition-colors leading-snug">
                    {d.label}
                  </div>
                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-100 text-[#840038]">
                    {isSelected ? 'Signing in...' : d.tier}
                  </span>
                </div>

                <div className="text-[11px] text-gray-600 mt-1 font-medium">
                  {d.contact}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-between">
                  <span>{d.note}</span>
                  <span className="font-mono text-gray-500 group-hover:text-[#840038]">1-Click Sign In →</span>
                </div>
              </button>
            );
          })}
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
