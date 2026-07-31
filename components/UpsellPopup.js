'use client';

import { useState } from 'react';
import { haptic } from '@/lib/haptic';

export default function UpsellPopup({ product, upsellProducts, onAddToCart, onDismiss }) {
  const [quantities, setQuantities] = useState(() => {
    const q = {};
    upsellProducts.forEach((p) => { q[p.id] = 0; });
    return q;
  });

  const hasSelections = Object.values(quantities).some((q) => q > 0);
  const totalSelected = Object.values(quantities).reduce((a, b) => a + b, 0);

  const updateQuantity = (productId, delta) => {
    haptic('light');
    setQuantities((prev) => {
      const newQty = Math.max(0, (prev[productId] || 0) + delta);
      return { ...prev, [productId]: newQty };
    });
  };

  const handleAddSelected = () => {
    haptic('medium');
    Object.entries(quantities).forEach(([id, qty]) => {
      if (qty > 0) {
        for (let i = 0; i < qty; i++) {
          onAddToCart(parseInt(id));
        }
      }
    });
    onDismiss();
  };

  const handleSkip = () => {
    haptic('light');
    onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-slide-up flex flex-col"
        style={{ backgroundColor: '#ffffff', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-3 text-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #840037 0%, #5b0024 100%)' }}
        >
          <h3
            className="text-white text-base font-bold mb-1 break-words"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            {product.name}
          </h3>
          <p
            className="text-white/80 text-xs font-semibold uppercase tracking-wider"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Goes well with
          </p>
        </div>

        {/* Scrollable Upsell List */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
          <div className="space-y-3">
            {upsellProducts.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  backgroundColor: quantities[item.id] > 0 ? 'rgba(132, 0, 55, 0.04)' : '#f8f9fa',
                  border: `1.5px solid ${quantities[item.id] > 0 ? '#840037' : '#E9ECEF'}`,
                }}
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl text-gray-300">🍹</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold mb-0.5"
                    style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {item.name}
                  </p>
                  {item.brandName && (
                    <p
                      className="text-[10px] mb-1"
                      style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      {item.brandName}
                    </p>
                  )}
                  <p
                    className="text-sm font-bold"
                    style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    KSh {parseFloat(item.price).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    disabled={quantities[item.id] === 0}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25"
                    style={{
                      backgroundColor: quantities[item.id] > 0 ? '#840037' : '#F1F3F5',
                      color: quantities[item.id] > 0 ? '#ffffff' : '#5f5e5e',
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span
                    className="text-sm font-bold w-6 text-center"
                    style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {quantities[item.id] || 0}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{ backgroundColor: '#840037', color: '#ffffff' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-2 flex-shrink-0 space-y-2">
          {hasSelections && (
            <button
              onClick={handleAddSelected}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
              style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
            >
              Add {totalSelected} {totalSelected === 1 ? 'item' : 'items'} to cart
            </button>
          )}
          <button
            onClick={handleSkip}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              color: '#5f5e5e',
              backgroundColor: '#F1F3F5',
              fontFamily: 'Montserrat, sans-serif',
            }}
          >
            {hasSelections ? 'Add selected only' : 'No thanks'}
          </button>
        </div>
      </div>
    </div>
  );
}
