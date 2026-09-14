'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function BottomNav({ cartCount = 0, onOpenCart, onOpenAccount, user: userProp }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser, logout } = useAuth();
  const user = userProp || authUser;

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMoreOpen(false);
  }

  // Prevent background scrolling when "More" drawer is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  const isHome = pathname === '/';
  const isBrands = pathname.startsWith('/brands') && !pathname.includes('/brands/jaba');
  const isJaba = pathname.includes('/jaba') || pathname.includes('/brands/jaba');
  const isMixology = pathname.startsWith('/mixology') || pathname.startsWith('/mix');
  const isOrders = pathname.startsWith('/orders');

  return (
    <>
      {/* Rigid Sticky Bottom Bar Container */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200/90 md:hidden bg-white/95 backdrop-blur-lg shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(env(safe-area-inset-bottom,0px),4px)]"
      >
        <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-1">
          {/* 1. Home Tab */}
          <Link
            href="/"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all active:scale-95 ${
              isHome ? 'text-[#840037] font-extrabold' : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
            <span className="text-[10px] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Home
            </span>
          </Link>

          {/* 2. Brands Tab - High Quality Brand Grid Icon */}
          <Link
            href="/brands"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all active:scale-95 ${
              isBrands ? 'text-[#840037] font-extrabold' : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity={isBrands ? '0.9' : '0.18'} />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity={isBrands ? '0.9' : '0.18'} />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity={isBrands ? '0.9' : '0.18'} />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill="currentColor" fillOpacity={isBrands ? '0.9' : '0.18'} />
            </svg>
            <span className="text-[10px] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Brands
            </span>
          </Link>

          {/* 3. Jaba Juice Tab - High Quality Energy Bottle Icon */}
          <Link
            href="/brands/jaba"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all active:scale-95 relative ${
              isJaba ? 'text-amber-500 font-extrabold' : 'text-gray-500 hover:text-amber-500 font-medium'
            }`}
          >
            <div className="relative">
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h6M10 2v3M14 2v3M7 8.5a2 2 0 012-1.5h6a2 2 0 012 1.5v11a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 017 19.5V8.5z" fill="currentColor" fillOpacity={isJaba ? '0.25' : '0.12'} />
                <path d="M13 9.5l-3 4.5h3.5l-1.5 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span className="text-[10px] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Jaba
            </span>
          </Link>

          {/* 4. Cart Tab */}
          <button
            type="button"
            onClick={() => onOpenCart?.()}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-gray-500 hover:text-[#840037] transition-all active:scale-95 relative"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#840037] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Cart
            </span>
          </button>

          {/* 5. More Tab */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-all active:scale-95 ${
              moreOpen || isOrders ? 'text-[#840037] font-extrabold' : 'text-gray-500 hover:text-gray-900 font-medium'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
            <span className="text-[10px] tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* "More" Slide-Up Bottom Sheet Drawer */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative bg-white rounded-t-3xl shadow-2xl z-10 max-h-[85vh] overflow-y-auto flex flex-col animate-slide-up border-t border-gray-100 pb-6">
            {/* Drag Bar & Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 pt-3 pb-3 border-b border-gray-100 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                <span className="w-8 h-1 bg-gray-300 rounded-full mx-auto" />
                <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Menu &amp; Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold active:scale-95 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Account / Sign-In Card */}
              <div className="bg-gradient-to-r from-[#840037] to-[#5b0024] rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center font-bold text-base text-white border border-white/30">
                    {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center font-bold text-base text-white border border-white/30 shrink-0">
                    {user?.name ? (
                      user.name.charAt(0).toUpperCase()
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-snug">
                      {user?.name || user?.phone || 'Guest Customer'}
                    </h4>
                    <p className="text-[11px] text-white/70">
                      {user ? (user.email || 'Logged In') : 'Sign in for faster checkout & tracking'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenAccount?.();
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-white text-[#840037] font-extrabold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {user ? 'Account' : 'Sign In'}
                </button>
              </div>

              {/* Primary Actions Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/orders"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#840037] hover:bg-[#840037]/5 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-[#840037] flex items-center justify-center text-lg">
                    📦
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-[#840037] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037]">
                      My Orders
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Track &amp; re-order
                    </div>
                  </div>
                </Link>

                <Link
                  href="/brands/jaba"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center text-lg">
                    ⚡
                  <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-950 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2h6M10 2v3M14 2v3M7 8.5a2 2 0 012-1.5h6a2 2 0 012 1.5v11a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 017 19.5V8.5z" fill="currentColor" fillOpacity="0.25" />
                      <path d="M13 9.5l-3 4.5h3.5l-1.5 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-black text-amber-950 group-hover:text-amber-800">
                      Jaba Juice
                    </div>
                    <div className="text-[10px] text-amber-700">
                      All 7 Flavours
                    </div>
                  </div>
                </Link>

                <Link
                  href="/brands"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#840037] hover:bg-[#840037]/5 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center text-lg">
                    🏷️
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037]">
                      All Brands
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Spirits, beers, wines
                    </div>
                  </div>
                </Link>

                <Link
                  href="/mixology"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-pink-200 bg-pink-50/40 hover:bg-pink-100/60 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-pink-200 text-[#840037] flex items-center justify-center text-lg">
                    🍹
                  <div className="w-10 h-10 rounded-xl bg-pink-200 text-[#840037] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-7v7m7-17l-7 8-7-8h14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 6h13" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037]">
                      Mixology
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Cocktails &amp; Recipes
                    </div>
                  </div>
                </Link>

                <Link
                  href="/trade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-100/50 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-200 text-[#840037] flex items-center justify-center text-lg">
                    🏢
                  <div className="w-10 h-10 rounded-xl bg-rose-200 text-[#840037] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037]">
                      B2B Trade
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Wholesale Portal
                    </div>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenCart?.();
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#840037] hover:bg-[#840037]/5 transition-all group text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-pink-100 text-[#840037] flex items-center justify-center text-lg">
                    🛒
                  <div className="w-10 h-10 rounded-xl bg-pink-100 text-[#840037] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 group-hover:text-[#840037]">
                      View Cart
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {cartCount} item{cartCount === 1 ? '' : 's'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Customer Support & Help */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Customer Care &amp; Contact
                </div>
                <div className="bg-gray-50 rounded-xl p-3 divide-y divide-gray-200 text-xs">
                  <a
                    href="https://wa.me/254700000000"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-2.5 hover:text-[#840037] font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <span>💬</span> WhatsApp Orders &amp; Support
                    <span className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>WhatsApp Orders &amp; Support</span>
                    </span>
                    <span className="text-gray-400">→</span>
                  </a>
                  <a
                    href="tel:+254700000000"
                    className="flex items-center justify-between py-2.5 hover:text-[#840037] font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <span>📞</span> Direct Hotline (24/7)
                    <span className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[#840037] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>Direct Hotline (24/7)</span>
                    </span>
                    <span className="text-gray-400">→</span>
                  </a>
                </div>
              </div>

              {/* Legal & Policy Links */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Information &amp; Policies
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-600 font-medium">
                  <Link
                    href="/refund-returns-policy"
                    className="p-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Refund &amp; Returns Policy</span>
                    <span className="flex items-center gap-2.5 text-gray-700">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H4m0 0l3 3m-3-3l3-3m5 14H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v6" />
                      </svg>
                      <span>Refund &amp; Returns Policy</span>
                    </span>
                    <span className="text-gray-400">›</span>
                  </Link>
                  <Link
                    href="/terms-conditions"
                    className="p-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Terms &amp; Conditions</span>
                    <span className="flex items-center gap-2.5 text-gray-700">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Terms &amp; Conditions</span>
                    </span>
                    <span className="text-gray-400">›</span>
                  </Link>
                  <Link
                    href="/privacy-policy"
                    className="p-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Privacy Policy</span>
                    <span className="flex items-center gap-2.5 text-gray-700">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Privacy Policy</span>
                    </span>
                    <span className="text-gray-400">›</span>
                  </Link>
                </div>
              </div>

              {/* Logout Option if Logged In */}
              {user && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      logout?.();
                      setMoreOpen(false);
                    }}
                    className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors text-center cursor-pointer"
                  >
                    Sign Out of Account
                  </button>
                </div>
              )}

              {/* Regulatory Tag */}
              <div className="pt-2 text-center text-[10px] text-gray-400 font-medium border-t border-gray-100">
                Happy Hour! Nairobi • 20-Min Chilled Delivery
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
