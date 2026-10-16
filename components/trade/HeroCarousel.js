'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const ROTATE_MS = 5500;

function SlideLink({ href, className, children, label }) {
  if (!href) return <div className={className}>{children}</div>;
  const external = /^https:\/\//i.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>{children}</a>
  ) : (
    <Link href={href} className={className} aria-label={label}>{children}</Link>
  );
}

/**
 * Promotional image carousel for the trade landing hero. Auto-rotates, pauses on
 * hover/focus/touch, swipes on phones, and does not auto-rotate for visitors who
 * prefer reduced motion.
 */
export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef(null);
  const count = slides.length;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count <= 1 || paused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;
  const slide = slides[Math.min(index, count - 1)];

  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const dx = touchStart.current - e.changedTouches[0].clientX;
    touchStart.current = null;
    if (Math.abs(dx) > 45) go(index + (dx > 0 ? 1 : -1));
  };

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-roledescription="carousel"
      aria-label="Promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { setPaused(true); touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { setPaused(false); onTouchEnd(e); }}
    >
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-[#1c1917] aspect-[16/9] sm:aspect-[8/3]">
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <SlideLink href={s.link} className="block w-full h-full" label={s.title || 'Promotion'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt={s.title || 'Promotion'} className="absolute inset-0 w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            </SlideLink>
          </div>
        ))}

        {(slide.title || slide.subtitle || slide.badge || (slide.buttonText && slide.link)) && (
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 bg-gradient-to-t from-black/75 via-black/40 to-transparent text-white pointer-events-none">
            <div className="max-w-2xl space-y-2">
              {slide.badge && (
                <span className="inline-block px-3 py-1 rounded-full bg-[#840038] text-[10px] font-black uppercase tracking-widest">{slide.badge}</span>
              )}
              {slide.title && <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tight leading-tight">{slide.title}</h2>}
              {slide.subtitle && <p className="text-xs sm:text-sm text-gray-200 font-medium">{slide.subtitle}</p>}
              {slide.buttonText && slide.link && (
                <span className="inline-block mt-1 px-5 py-2.5 bg-[#840038] text-white text-xs font-black uppercase tracking-wider rounded-2xl">{slide.buttonText} →</span>
              )}
            </div>
          </div>
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous promotion"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next promotion"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {slides.map((s, i) => (
                <button key={s.id} type="button" onClick={() => go(i)} aria-label={`Show promotion ${i + 1}`} aria-current={i === index}
                  className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
