'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

export default function FeaturedCarousel({ products = [], onAddToCart }) {
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
          setSlides(data);
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
    const timer = setInterval(nextSlide, 5000);
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
    if (diff > 50) nextSlide();
    if (diff < -50) prevSlide();
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (slides.length === 0) return null;

  const currentSlide = slides[currentIndex];
  const linkedProduct = currentSlide?.productId
    ? products.find((p) => String(p.id) === String(currentSlide.productId) || String(p.wcId) === String(currentSlide.productId))
    : null;

  const displayPrice = linkedProduct
    ? (linkedProduct.price || linkedProduct.originalPrice)
    : currentSlide.customPrice;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-lg border border-gray-100 group bg-gray-900 my-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides Container */}
      <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Image */}
              <div className="relative w-full h-full">
                {slide.image ? (
                  <Image
                    src={slide.image}
                    alt={slide.title || 'Featured Slide'}
                    fill
                    priority={idx === 0}
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#840037] to-[#5b0024]" />
                )}

                {/* Dark Gradient Overlay for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent md:bg-gradient-to-r md:from-black/90 md:via-black/50 md:to-transparent" />
              </div>

              {/* Slide Content Overlay */}
              <div className="absolute inset-0 z-20 flex flex-col justify-end md:justify-center p-4 sm:p-6 md:p-10 max-w-2xl text-white">
                {slide.badge && (
                  <span
                    className="inline-block self-start px-2.5 py-1 rounded-md text-[10px] md:text-xs font-extrabold uppercase tracking-widest mb-2 shadow-sm"
                    style={{ backgroundColor: '#840037', color: '#ffffff', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {slide.badge}
                  </span>
                )}

                <h2
                  className="text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight drop-shadow-sm mb-1.5"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {slide.title}
                </h2>

                {slide.subtitle && (
                  <p
                    className="text-xs sm:text-sm md:text-base text-gray-200 line-clamp-2 mb-3 max-w-lg font-medium"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {slide.subtitle}
                  </p>
                )}

                {/* Dynamic Price & CTA */}
                <div className="flex items-center gap-3 mt-1">
                  {displayPrice !== null && displayPrice !== undefined && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-white/70 font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        {linkedProduct ? 'Special Price' : 'Starting From'}
                      </span>
                      <span className="text-base sm:text-xl font-extrabold text-amber-300" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        KSh {Number(displayPrice).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {linkedProduct ? (
                    <button
                      onClick={() => onAddToCart?.(linkedProduct.id)}
                      disabled={linkedProduct.inStock === false}
                      className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-extrabold text-[#840037] bg-white hover:bg-amber-300 hover:text-gray-900 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {linkedProduct.inStock === false ? 'OUT OF STOCK' : 'QUICK ADD'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const el = document.getElementById('products-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-extrabold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md active:scale-95"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {slide.buttonText || 'Order Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (Visible on hover / desktop) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-80 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-80 md:opacity-0 md:group-hover:opacity-100"
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
        <div className="absolute bottom-2.5 right-4 z-30 flex items-center gap-1.5 bg-black/30 backdrop-blur-xs px-2.5 py-1 rounded-full">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`transition-all rounded-full ${
                i === currentIndex ? 'w-5 h-1.5 bg-amber-300' : 'w-1.5 h-1.5 bg-white/60 hover:bg-white'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
