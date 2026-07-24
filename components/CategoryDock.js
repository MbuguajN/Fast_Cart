'use client';

import { CATEGORIES } from '@/lib/products';

export default function CategoryDock({ activeCategory, onCategoryChange }) {
  return (
    <section
      className="flex gap-2 overflow-x-auto hide-scrollbar"
      style={{
        backgroundColor: 'rgba(132, 0, 55, 0.06)',
        padding: '8px 12px',
        borderRadius: '0.75rem',
      }}
    >
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          className="flex items-center gap-1 px-5 py-1.5 rounded-full whitespace-nowrap text-[13px] font-semibold transition-all active:scale-95"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            backgroundColor: activeCategory === cat.id ? '#840037' : '#F1F3F5',
            color: activeCategory === cat.id ? '#ffffff' : '#191c1d',
          }}
        >
          {cat.icon && (
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
          )}
          {cat.label}
        </button>
      ))}
    </section>
  );
}
