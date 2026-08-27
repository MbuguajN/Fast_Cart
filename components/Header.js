'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header({ location, onLocationSet, onSearch, cartCount = 0, onOpenCart, onOpenAccount, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [logo, setLogo] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();

  const isJaba = pathname?.includes('/jaba') || pathname?.includes('/brands/jaba');
  const isBrands = pathname?.startsWith('/brands') && !pathname?.includes('/brands/jaba');
  const isMixology = pathname?.startsWith('/mixology') || pathname?.startsWith('/mix');
  const isTrade = pathname?.startsWith('/trade');

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

  return (
    <header className="sticky top-0 w-full z-50 shadow-md" style={{ backgroundColor: 'rgba(132, 0, 55, 0.95)', backdropFilter: 'blur(12px)' }}>
      {/* Mobile Layout (< md) */}
      <div className="md:hidden">
        <div className="flex justify-between items-center px-4 h-14 w-full pt-4 pb-1">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center">
              {loaded && logo ? (
                <img src={logo} alt="Logo" className="max-h-9 w-auto object-contain" />
              ) : (
                <span className="text-white font-extrabold text-lg tracking-wider" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  LiquorDash
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile Mixology Link */}
            <Link
              href="/mixology"
              className={`text-[11px] font-bold transition-all px-2 py-1 rounded-lg ${
                isMixology ? 'text-white bg-white/20' : 'text-pink-200 hover:text-white'
              }`}
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Mixology
            </Link>

            {/* Mobile B2B Trade Link */}
            <Link
              href="/trade"
              className={`text-[11px] font-bold transition-all px-2 py-1 rounded-lg ${
                isTrade ? 'text-white bg-white/20' : 'text-pink-200 hover:text-white'
              }`}
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Trade
            </Link>

            <button
              type="button"
              className="flex items-center gap-1.5 cursor-pointer bg-white/10 hover:bg-white/20 active:scale-95 px-2.5 py-1 rounded-full transition-all text-left"
              onClick={() => onLocationSet?.(null)}
              title="Change Delivery Location"
            >
              <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-wider text-white/70 font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  Deliver to
                </span>
                <span className="text-[11px] text-white font-bold truncate max-w-[100px]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {location?.text ? location.text.split(',')[0] : 'Set Location'}
                </span>
              </div>
            </button>

            {/* Profile Button */}
            <button
              onClick={() => onOpenAccount?.()}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white text-xs font-bold transition-all overflow-hidden border border-white/20"
              title={user ? `${user.name || user.phone} - Account` : 'Sign In'}
            >
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="px-4 pb-3 pt-1">
          <div className="w-full h-9 bg-white/95 border border-transparent rounded-full flex items-center px-3 shadow-inner">
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              className="w-full h-full bg-transparent border-none text-gray-900 placeholder-gray-500 text-xs px-2 focus:ring-0 outline-none"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
              placeholder="Search drinks, mixers..."
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); onSearch?.(e.target.value); }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); onSearch?.(''); }} className="text-gray-400 text-xs">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout (≥ md): Logo -> Clean Nav Links -> Search Bar -> Delivery Address -> User Account -> Cart */}
      <div className="hidden md:flex justify-between items-center px-8 h-20 max-w-7xl mx-auto w-full gap-6">
        {/* 1. Left: Brand Logo */}
        <div className="flex items-center flex-shrink-0">
          <Link href="/" className="flex items-center hover:opacity-95 transition-opacity" title="Happy Hour / LiquorDash Home">
            {loaded && logo ? (
              <img src={logo} alt="Logo" className="max-h-14 w-auto object-contain" />
            ) : (
              <span className="text-white font-extrabold text-2xl tracking-wider uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                HAPPY HOUR!
              </span>
            )}
          </Link>
        </div>

        {/* 2. Clean, Refined Navigation Links */}
        <nav className="flex items-center gap-6 flex-shrink-0">
          <Link
            href="/brands/jaba"
            className={`text-xs font-bold uppercase tracking-wider transition-colors pb-1 border-b-2 ${
              isJaba
                ? 'text-amber-300 border-amber-300'
                : 'text-white/90 hover:text-white border-transparent hover:border-white/40'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Jaba
          </Link>

          <Link
            href="/brands"
            className={`text-xs font-bold uppercase tracking-wider transition-colors pb-1 border-b-2 ${
              isBrands
                ? 'text-white border-white'
                : 'text-white/90 hover:text-white border-transparent hover:border-white/40'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Brands
          </Link>

          <Link
            href="/mixology"
            className={`text-xs font-bold uppercase tracking-wider transition-colors pb-1 border-b-2 ${
              isMixology
                ? 'text-white border-white font-black'
                : 'text-white/90 hover:text-white border-transparent hover:border-white/40'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Mixology
          </Link>

          <Link
            href="/trade"
            className={`text-xs font-bold uppercase tracking-wider transition-colors pb-1 border-b-2 ${
              isTrade
                ? 'text-pink-200 border-pink-300'
                : 'text-white/90 hover:text-pink-200 border-transparent hover:border-pink-300/60'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            B2B Trade
          </Link>
        </nav>

        {/* 3. Center Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative group">
            <div className="w-full h-11 bg-white/95 hover:bg-white border border-transparent focus-within:border-white rounded-full flex items-center px-4 shadow-inner transition-all duration-300">
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                className="w-full h-full bg-transparent border-none text-gray-900 placeholder-gray-500 text-sm px-3 focus:ring-0 outline-none"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
                placeholder="Search for drinks, mixers, wine..."
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); onSearch?.(e.target.value); }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); onSearch?.(''); }}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Right: Delivering To, User Account, Cart */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Delivering To Indicator */}
          <button
            type="button"
            onClick={() => onLocationSet?.(null)}
            className="flex items-center gap-2 cursor-pointer bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-2 rounded-full transition-all text-left group border border-white/15"
            title="Click to set or change your delivery address"
          >
            <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase tracking-widest text-white/70 font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Delivering to
              </span>
              <span className="text-xs text-white font-bold truncate max-w-[120px]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {location?.text ? location.text.split(',')[0] : 'Set Location'}
              </span>
            </div>
            <svg className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User Account / Profile Button */}
          <button
            onClick={() => onOpenAccount?.()}
            className="text-white text-xs font-semibold hover:text-white/80 transition-all flex items-center gap-2 bg-white/10 hover:bg-white/20 active:scale-95 px-3.5 py-2.5 rounded-full border border-white/15 cursor-pointer"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
            title={user ? `${user.name || user.phone} - View Account & Orders` : 'Sign in to view orders and profile'}
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] text-white overflow-hidden">
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <svg className="w-3.5 h-3.5 text-white/90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="truncate max-w-[80px] text-xs font-bold leading-tight">
                {user ? (user.name || user.phone) : 'Sign In'}
              </span>
            </div>
          </button>

          {/* Cart Button */}
          <button
            onClick={() => onOpenCart?.()}
            className="flex items-center gap-2 bg-white text-[#840037] hover:bg-amber-300 hover:text-gray-950 px-4 py-2.5 rounded-full font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="bg-[#840037] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
