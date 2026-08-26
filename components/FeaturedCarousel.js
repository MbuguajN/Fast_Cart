'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function FeaturedCarousel({ products = [] }) {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    fetch('/api/slides')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSlides(data.filter((s) => s.active !== false));
        }
      })
      .catch(() => {});
  }, []);

  const nextSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isHovered) return;
    const timer = setInterval(nextSlide, 5500);
    return () => clearInterval(timer);
  }, [slides.length, isHovered, nextSlide]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) nextSlide();
    if (diff < -45) prevSlide();
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full rounded-2xl md:rounded-3xl overflow-hidden shadow-xl border border-gray-200/80 group bg-gray-950 my-3 select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Container - Wide Cinematic Aspect Ratio */}
      <div className="relative w-full aspect-[21/9] min-h-[190px] sm:min-h-[250px] md:min-h-[320px] lg:min-h-[380px]">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;

          // Resolve Target Link
          const linkedProduct = slide.productId
            ? products.find((p) => String(p.id) === String(slide.productId) || String(p.wcId) === String(slide.productId))
            : null;

          const targetUrl = slide.link || slide.targetUrl || (linkedProduct ? `/product/${linkedProduct.slug}` : '/brands');
          const bgImg = slide.backgroundImage || slide.image;
          const overlayImg = slide.overlayImage || slide.image;

          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Entire Banner is Clickable */}
              <Link
                href={targetUrl}
                className="block w-full h-full relative cursor-pointer group"
                title={slide.title || 'Featured Deal'}
              >
                {/* 1. Background Image Layer */}
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                  {bgImg ? (
                    <img
                      src={bgImg}
                      alt={slide.title || 'Background'}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-[0.92]"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#840037] via-[#5b0024] to-[#2b001a]" />
                  )}

                  {/* Ambient Vignette Overlay */}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                </div>

                {/* 2. Centered Overlay Image (Containing Bottle, Title, Price, & CTA Button) */}
                {overlayImg && (
                  <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6 z-20">
                    <img
                      src={overlayImg}
                      alt={slide.title || 'Offer Overlay'}
                      className="w-full h-full max-h-full max-w-full object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.85)] group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}

                {/* 3. Fallback Content Overlay (Rendered if no distinct overlay image) */}
                {!overlayImg && (
                  <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center p-6 text-white space-y-2">
                    {slide.badge && (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-[#840037] text-white shadow-md">
                        {slide.badge}
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-black drop-shadow-md tracking-tight uppercase" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p className="text-xs sm:text-sm md:text-base text-gray-200 max-w-md font-medium">
                        {slide.subtitle}
                      </p>
                    )}
                    <div className="pt-2">
                      <span className="px-6 py-2.5 rounded-full bg-white text-[#840037] font-black text-xs uppercase tracking-wider shadow-lg group-hover:bg-amber-300 transition-colors">
                        {slide.buttonText || 'BUY NOW'}
                      </span>
                    </div>
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-11 md:h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md active:scale-90 cursor-pointer opacity-80 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-11 md:h-11 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md active:scale-90 cursor-pointer opacity-80 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 z-30 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentIndex(i);
              }}
              className={`transition-all rounded-full cursor-pointer ${
                i === currentIndex ? 'w-6 h-1.5 bg-amber-400 shadow-xs' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
