'use client';

import { useMemo } from 'react';
import { CATEGORIES } from '@/lib/products';

export default function CategoryDock({ activeCategory, onCategoryChange, products = [], className = '' }) {
  const availableCategories = useMemo(() => {
    if (products.length === 0) return CATEGORIES;

    const productCats = new Set(products.map((p) => p.category).filter(Boolean));
    const matched = CATEGORIES.filter((c) => c.id === 'fast6' || productCats.has(c.id));

    if (matched.length <= 1) return CATEGORIES;
    return matched;
  }, [products]);

  return (
    <section
      className={`flex gap-2 overflow-x-auto hide-scrollbar bg-gray-50 border border-gray-100 ${className}`}
      style={{ padding: '8px 12px', borderRadius: '0.75rem' }}
    >
      {availableCategories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap text-[13px] transition-all active:scale-95"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            backgroundColor: activeCategory === cat.id ? '#840037' : '#ffffff',
            color: activeCategory === cat.id ? '#ffffff' : '#636262',
            border: activeCategory === cat.id ? 'none' : '1px solid #e5e7eb',
            boxShadow: activeCategory === cat.id ? '0 2px 4px rgba(132,0,55,0.2)' : 'none',
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
  );
}
