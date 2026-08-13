'use client';

import { useRef, useState, useEffect } from 'react';

export default function BrandsBar({ brands = [], selectedBrand, onSelectBrand, onClearBrand }) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const updateScrollState = () => {
    if (!scrollRef.current) return;
    const { scrollLeft: sl, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(sl > 5);
    setShowRightArrow(sl < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState);
      window.addEventListener('resize', updateScrollState);
      return () => {
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [brands]);

  const scrollBy = (offset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  if (!brands || brands.length === 0) return null;

  return (
    <section className="relative space-y-1 bg-gray-50 border border-gray-100 p-2.5 rounded-xl group">
      {/* Header text */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => onClearBrand?.()}
          className="text-[11px] md:text-[12px] tracking-widest uppercase font-bold hover:opacity-70 transition-opacity"
          style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
        >
          {selectedBrand ? `Filtering: ${selectedBrand}` : 'Popular Brands'}
        </button>
        {selectedBrand && (
          <button
            onClick={() => onClearBrand?.()}
            className="text-[11px] font-semibold underline hover:opacity-80"
            style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
          >
            Clear
          </button>
        )}
        <div className="h-[1px] flex-grow ml-4" style={{ backgroundColor: '#840037', opacity: 0.2 }} />
      </div>

      {/* Left Arrow Button */}
      {showLeftArrow && (
        <button
          onClick={() => scrollBy(-250)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-[#840037] hover:text-white transition-all active:scale-95"
          aria-label="Scroll brands left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Brands Scroll Container */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="flex gap-4 md:gap-6 overflow-x-auto hide-scrollbar py-1 cursor-grab active:cursor-grabbing select-none"
      >
        {brands.map((brand) => {
          const isSelected = selectedBrand === brand.name;
          const logoUrl = brand.logo || brand.image;
          return (
            <button
              key={brand.id || brand.name}
              onClick={() => onSelectBrand?.(brand.name)}
              className="flex flex-col items-center gap-1.5 min-w-[64px] md:min-w-[72px] transition-all active:scale-95 hover:scale-105 flex-shrink-0"
            >
              <div
                className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-sm flex items-center justify-center transition-all overflow-hidden p-1.5"
                style={{ border: isSelected ? '2.5px solid #840037' : '1px solid #e5e7eb' }}
              >
                {logoUrl ? (
                  <img
                    alt={`${brand.name} Logo`}
                    className="w-full h-full object-contain"
                    src={logoUrl}
                    onError={(e) => {
                      // Fallback to initial avatar on error
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="w-full h-full rounded-full items-center justify-center text-white text-sm md:text-base font-bold"
                  style={{
                    backgroundColor: brand.color || '#840037',
                    fontFamily: 'Montserrat, sans-serif',
                    display: logoUrl ? 'none' : 'flex',
                  }}
                >
                  {brand.name?.charAt(0) || '?'}
                </div>
              </div>
              <span
                className="text-[10px] md:text-[11px] text-gray-700 truncate max-w-[80px]"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: isSelected ? 700 : 500 }}
              >
                {brand.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Arrow Button */}
      {showRightArrow && (
        <button
          onClick={() => scrollBy(250)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-[#840037] hover:text-white transition-all active:scale-95"
          aria-label="Scroll brands right"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </section>
  );
}
