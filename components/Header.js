'use client';

import { useState, useEffect } from 'react';

export default function Header({ location, onLocationSet, onSearch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        queueMicrotask(() => setLogo(data.logo || null));
      })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 w-full z-50" style={{ backgroundColor: 'rgba(132, 0, 55, 0.9)', backdropFilter: 'blur(12px)' }}>
      <div className="flex justify-between items-center px-4 md:px-16 h-14 w-full max-w-7xl mx-auto pt-6 pb-2">
        <div className="flex items-center gap-4">
          <div className="w-28 h-12 flex items-center pl-2 pb-2">
            {logo ? (
              <img src={logo} alt="Logo" className="max-h-10 w-auto object-contain" />
            ) : (
              <span
                className="text-[18px] font-bold tracking-tight text-white"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                LiquorDash
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 pb-1">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-white/80 font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Delivery to
            </span>
            <span className="text-[13px] text-white font-bold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {location?.text || 'Kilimani, Rose Avenue'}
            </span>
          </div>
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
      <div className="px-4 md:px-16 pb-3 w-full max-w-7xl mx-auto">
        <div className="relative group">
          <div className="w-full h-10 bg-white border border-gray-200 rounded-lg flex items-center px-3 focus-within:ring-2 focus-within:ring-white/50 transition-all duration-300">
            <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              className="w-full h-full bg-transparent border-none text-gray-900 placeholder-gray-500 text-sm px-3 focus:ring-0 outline-none"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
              placeholder="Search for drinks, mixers or snacks..."
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); onSearch?.(e.target.value); }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); onSearch?.(''); }}
                className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" style={{ color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg className="w-5 h-5 flex-shrink-0 cursor-pointer hover:opacity-80 transition-colors" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
