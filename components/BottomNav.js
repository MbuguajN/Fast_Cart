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
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 hover:bg-rose-100/50 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-rose-200 text-[#840037] flex items-center justify-center text-lg">
                    🏢
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
                    </span>
                    <span className="text-gray-400">→</span>
                  </a>
                  <a
                    href="tel:+254700000000"
                    className="flex items-center justify-between py-2.5 hover:text-[#840037] font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <span>📞</span> Direct Hotline (24/7)
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
                    <span className="text-gray-400">›</span>
                  </Link>
                  <Link
                    href="/terms-conditions"
                    className="p-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Terms &amp; Conditions</span>
                    <span className="text-gray-400">›</span>
                  </Link>
                  <Link
                    href="/privacy-policy"
                    className="p-2.5 rounded-lg hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Privacy Policy</span>
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
