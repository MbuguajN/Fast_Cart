'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { CATEGORIES } from '@/lib/products';

export default function CategoryDock({ activeCategory, onCategoryChange, products = [], categories: customCategories, showOutOfStock = true, className = '' }) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const availableCategories = useMemo(() => {
    if (!products || products.length === 0) return [];

    // Map of product category IDs/slugs and names to available counts
    const productCatCounts = new Map();
    for (const p of products) {
      if (!showOutOfStock && p.inStock === false) continue;
      if (p.category) {
        const catKey = String(p.category).toLowerCase().trim();
        productCatCounts.set(catKey, (productCatCounts.get(catKey) || 0) + 1);
      }
      if (p.categoryName) {
        const nameKey = String(p.categoryName).toLowerCase().trim();
        productCatCounts.set(nameKey, (productCatCounts.get(nameKey) || 0) + 1);
      }
    }

    // Known base categories
    const baseCategories = [
      { id: 'fast6', label: 'Fast 6', icon: 'bolt' },
      ...CATEGORIES.filter((c) => c.id !== 'fast6'),
    ];

    // Merge custom categories from API if present
    if (customCategories && Array.isArray(customCategories)) {
      for (const cat of customCategories) {
        const slug = (cat.slug || cat.name || '').toLowerCase().trim();
        if (slug && !baseCategories.some((c) => c.id === slug || c.id === cat.wcId)) {
          baseCategories.push({
            id: slug,
            label: cat.name || cat.label,
            icon: null,
          });
        }
      }
    }

    // STRICT FILTER: Only return categories that have AT LEAST 1 available product
    return baseCategories.filter((c) => {
      if (c.id === 'fast6') {
        return products.some((p) => showOutOfStock || p.inStock !== false);
      }

      const cId = String(c.id).toLowerCase().trim();
      const cLabel = String(c.label).toLowerCase().trim();

      const countById = productCatCounts.get(cId) || 0;
      const countByLabel = productCatCounts.get(cLabel) || 0;

      const directMatch = products.some((p) => {
        if (!showOutOfStock && p.inStock === false) return false;
        const pCat = String(p.category || '').toLowerCase().trim();
        const pCatName = String(p.categoryName || '').toLowerCase().trim();
        return pCat === cId || pCatName === cLabel || (pCat && cId && (pCat.includes(cId) || cId.includes(pCat)));
      });

      return countById > 0 || countByLabel > 0 || directMatch;
    });
  }, [products, customCategories, showOutOfStock]);

  // If activeCategory is not in availableCategories, fallback to first available category
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.id === activeCategory)) {
      onCategoryChange?.(availableCategories[0].id);
    }
  }, [availableCategories, activeCategory, onCategoryChange]);

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
  }, [availableCategories]);

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

  if (availableCategories.length === 0) return null;

  return (
    <div className={`relative group ${className}`}>
      {/* Left Arrow Button */}
      {showLeftArrow && (
        <button
          onClick={() => scrollBy(-250)}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-[#840037] hover:text-white transition-all active:scale-95"
          aria-label="Scroll categories left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Categories Scroll Container */}
      <section
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="flex gap-2 md:gap-3 overflow-x-auto hide-scrollbar bg-gray-50 border border-gray-100 cursor-grab active:cursor-grabbing select-none"
        style={{ padding: '10px 14px', borderRadius: '0.75rem' }}
      >
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 md:px-4 md:py-2 rounded-full whitespace-nowrap text-[13px] md:text-[14px] transition-all active:scale-95 hover:shadow-sm flex-shrink-0"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              backgroundColor: activeCategory === cat.id ? '#840037' : '#ffffff',
              color: activeCategory === cat.id ? '#ffffff' : '#4b5563',
              border: activeCategory === cat.id ? 'none' : '1px solid #e5e7eb',
              boxShadow: activeCategory === cat.id ? '0 2px 6px rgba(132,0,55,0.25)' : 'none',
            }}
          >
            {cat.icon && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
              </svg>
            )}
            {cat.label}
          </button>
        ))}
      </section>

      {/* Right Arrow Button */}
      {showRightArrow && (
        <button
          onClick={() => scrollBy(250)}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 text-gray-700 flex items-center justify-center hover:bg-[#840037] hover:text-white transition-all active:scale-95"
          aria-label="Scroll categories right"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
