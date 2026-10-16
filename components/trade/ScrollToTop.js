'use client';

import React, { useEffect, useState } from 'react';

/** Floating "back to top" button, shown once the page has been scrolled a fair way. */
export default function ScrollToTop({ threshold = 600 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  const scrollUp = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    // Sits above the floating cart pill (bottom-6) so the two never overlap.
    <button
      type="button"
      onClick={scrollUp}
      aria-label="Scroll to top"
      title="Back to top"
      className="fixed bottom-24 right-4 sm:right-6 z-40 w-11 h-11 rounded-full bg-[#840038] hover:bg-[#6b002c] text-white shadow-xl ring-4 ring-black/5 flex items-center justify-center transition-all active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
