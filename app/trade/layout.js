'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import { TradeProvider, useTrade } from '@/lib/trade/trade-context.js';

function TradePortalShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, account, logout, cart, cartPricing } = useTrade();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logo, setLogo] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        queueMicrotask(() => {
          setLogo(data.logo || null);
          setLoaded(true);
        });
      })
      .catch(() => setLoaded(true));
  }, []);

  // Licence expiry check: within 30 days
  const isLicenceExpiringSoon = account?.licenceExpiry && (() => {
    const exp = new Date(account.licenceExpiry);
    const now = new Date();
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 30;
  })();

  const isLicenceExpired = account?.licenceExpiry && new Date(account.licenceExpiry) < new Date();

  const isPublicPage = pathname === '/trade' || pathname === '/trade/login' || pathname === '/trade/apply';

  // Navigation Links organized into logical procurement & accounting groups
  const navSections = [
    {
      title: 'Procurement & Ordering',
      links: [
        {
          href: '/trade/dashboard',
          label: 'Dashboard',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          href: '/trade/catalog',
          label: 'Wholesale Catalog',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          href: '/trade/order-pad',
          label: 'Bulk Order Pad',
          badge: 'Fast',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ),
        },
        {
          href: '/trade/templates',
          label: 'Starter Bundles',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Commercial & Financials',
      links: [
        {
          href: '/trade/orders',
          label: 'Order History & Tracking',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
        },
        {
          href: '/trade/invoices',
          label: 'VAT Tax Invoices',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          href: '/trade/statements',
          label: 'Statement of Account',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
        },
        {
          href: '/trade/reports',
          label: 'Spend Analytics',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          href: '/trade/quotes',
          label: 'Special Quotations',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const totalCartBottles = cart.reduce((acc, i) => acc + (i.quantity || 0), 0);

  // ----------------------------------------------------
  // Layout 1: Unauthenticated / Public Landing & Login Shell
  // ----------------------------------------------------
  if (!user || !account || isPublicPage) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF7F5] text-[#231F20]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        <header className="sticky top-0 z-40 bg-[#1c1917] text-white border-b border-white/10 shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/trade" className="flex items-center gap-3">
                {loaded && logo ? (
                  <img src={logo} alt="Happy Hour Logo" className="max-h-10 w-auto object-contain" />
                ) : (
                  <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-sans">
                    HAPPY HOUR
                  </span>
                )}
                <span className="bg-[#840038] text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest border border-pink-400/30">
                  B2B TRADE
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <Link href="/trade" className={`transition-colors ${pathname === '/trade' ? 'text-pink-300 font-bold' : 'text-gray-300 hover:text-white'}`}>
                Overview
              </Link>
              <Link href="/trade/apply" className={`transition-colors ${pathname === '/trade/apply' ? 'text-pink-300 font-bold' : 'text-gray-300 hover:text-white'}`}>
                Open Account
              </Link>
              <Link
                href="/trade/login"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#840038] hover:bg-[#6b002c] shadow transition-all"
              >
                Trade Sign In →
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full">
          {children}
        </main>

        <Footer />
        <TradeNotificationToast />
      </div>
    );
  }

  // ----------------------------------------------------
  // Layout 2: Authenticated Dedicated B2B Portal Shell with Modern Sidebar
  // ----------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#FAF7F5] text-[#231F20]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Modern Left Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-[#1c1917] text-white flex flex-col justify-between border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Logo & Active Account Profile Header */}
        <div className="p-5 space-y-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <Link href="/trade/dashboard" className="flex items-center gap-2.5">
              {loaded && logo ? (
                <img src={logo} alt="Happy Hour Logo" className="max-h-9 w-auto object-contain" />
              ) : (
                <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                  HAPPY HOUR
                </span>
              )}
              <span className="bg-[#840038] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest border border-pink-400/30">
                B2B TRADE
              </span>
            </Link>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* Active Account Identity Card */}
          <div className="bg-[#24211e] p-3.5 rounded-2xl border border-white/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs font-black uppercase tracking-tight text-white truncate">
                  {account.tradingName}
                </h2>
                <p className="text-[11px] text-gray-400 truncate">
                  {user.name} ({user.role})
                </p>
              </div>
              <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#840038] text-white">
                {user.seatType}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
              <span className="text-gray-400 font-medium">Terms:</span>
              <span className="font-mono font-bold text-emerald-400">
                {account.creditEnabled
                  ? `Net 14 (KES ${(account.creditLimit - (account.creditUsed || 0)).toLocaleString()} Avail)`
                  : 'Prepayment / Cash'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                {section.title}
              </span>

              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                        isActive
                          ? 'bg-[#840038] text-white shadow-md font-bold'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={isActive ? 'text-white' : 'text-gray-400'}>
                          {link.icon}
                        </span>
                        <span>{link.label}</span>
                      </div>

                      {link.badge && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-400 text-gray-950 font-black">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Sidebar: Dedicated Specialist & Switch/Signout */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-[#171514]">
          {account.accountManager && (
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 text-xs text-gray-300">
              <img
                src={account.accountManager.avatar}
                alt={account.accountManager.name}
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] uppercase font-bold text-gray-400 block leading-tight">Your Specialist</span>
                <p className="text-[11px] font-bold text-white truncate">{account.accountManager.name}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors text-[11px] font-medium flex items-center gap-1"
            >
              <span>← Consumer Shop</span>
            </Link>

            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-colors text-[11px] font-bold flex items-center gap-1"
              title="Sign Out"
            >
              <span>Sign Out</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Licence Expiry Ribbon (if active) */}
        {isLicenceExpiringSoon && (
          <div className="bg-amber-500 text-black px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Liquor licence expires on <strong>{account.licenceExpiry}</strong>. Submit renewed document to your Account Manager ({account.accountManager?.name}) to avoid ordering restrictions.</span>
            </div>
          </div>
        )}

        {isLicenceExpired && (
          <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              <span>⚠️ Liquor licence expired. Spirits ordering is locked. Jaba non-alcoholic juices remain available.</span>
            </div>
          </div>
        )}

        {/* Clean, Streamlined Top App Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 sm:px-8 h-16 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
              title="Open Navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#840038] block">
                {account.tradingName} · Wholesale Portal
              </span>
            </div>
          </div>

          {/* Right Header Quick Controls */}
          <div className="flex items-center gap-3">
            <Link
              href="/trade/order-pad"
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <span>+ Quick Order Pad</span>
            </Link>

            {/* Wholesale Cart Pill with Live Pricing */}
            <Link
              href="/trade/cart"
              className="flex items-center gap-2.5 bg-[#840038] hover:bg-[#6b002c] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 border border-pink-400/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>{totalCartBottles} Btls</span>
              <span className="border-l border-white/30 pl-2.5 font-sans">
                KES {(cartPricing?.grandTotal || 0).toLocaleString()}
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content Workspace */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <Footer />
        <TradeNotificationToast />
      </div>
    </div>
  );
}

function TradeNotificationToast() {
  const { notification } = useTrade();
  if (!notification) return null;

  const bg = notification.type === 'error' ? 'bg-red-600' : notification.type === 'success' ? 'bg-emerald-600' : 'bg-[#840038]';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`${bg} text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold border border-white/20 max-w-md`}>
        <span>{notification.msg}</span>
      </div>
    </div>
  );
}

export default function TradeLayout({ children }) {
  return (
    <TradeProvider>
      <TradePortalShell>
        {children}
      </TradePortalShell>
    </TradeProvider>
  );
}
