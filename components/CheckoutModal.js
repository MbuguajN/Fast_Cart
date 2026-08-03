'use client';

import { useState } from 'react';
import { createOrder } from '@/lib/woocommerce';
import { haptic } from '@/lib/haptic';

export default function CheckoutModal({ cart, products, user, locationData, onClose, onOrderSuccess, onRemoveItem }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('confirm');
  const [buildingName, setBuildingName] = useState('');

  const subtotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const baseDeliveryFee = user?.zonePrice || 300;
  const deliveryVat = Math.round(baseDeliveryFee * 0.16);
  const deliveryFee = baseDeliveryFee + deliveryVat;
  const grandTotal = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (!buildingName.trim()) {
      setError('Please enter your building name or house number');
      return;
    }
    haptic('medium');
    setLoading(true);
    setError('');
    setStep('processing');

    try {
      const order = await createOrder({
        cart,
        paymentMethod: 'paystack',
        locationData: {
          ...locationData,
          text: `${locationData.text || ''} - ${buildingName.trim()}`,
          name: user?.name || '',
          phone: user?.phone || '',
        },
        customerId: user?.customerId,
        customerNote: '',
        email: user?.email || '',
      });

      if (order.authorization_url) {
        window.location.href = order.authorization_url;
        return;
      }

      haptic('success');
      onOrderSuccess(order);
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
      setLoading(false);
      setStep('confirm');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md p-6 shadow-2xl animate-slide-up overflow-hidden max-h-[85vh] flex flex-col"
        style={{
          backgroundColor: '#f5f5dc',
          borderRadius: '0.75rem 0.75rem 0 0',
          border: '1px solid #E9ECEF',
        }}
      >
        {step === 'processing' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(132, 0, 55, 0.1)' }}>
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
            </div>
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
            >
              Redirecting to Paystack...
            </h3>
            <p
              className="text-sm"
              style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
            >
              You&apos;ll be taken to the secure payment page
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Order Summary
                </h2>
                <p
                  className="text-xs"
                  style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                >
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F1F3F5' }}
                  title="Minimize"
                >
                  <svg className="w-4 h-4" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Items */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.id);
                if (!product) return null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">🍹</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                      >
                        {product.name}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                      >
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p
                      className="text-sm font-bold flex-shrink-0"
                      style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                    >
                      KSh {(product.price * item.quantity).toLocaleString()}
                    </p>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{ backgroundColor: '#F1F3F5' }}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Delivery Info */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl mb-3"
              style={{ backgroundColor: '#F1F3F5' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs truncate"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
                >
                  {locationData.text || 'GPS coordinates'}
                </p>
                {user?.name && (
                  <p
                    className="text-[10px]"
                    style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {user.name} · {user.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Building / House Number */}
            <div className="mb-3">
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="Building name / house number"
                className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-sm"
                style={{
                  borderRadius: '12px',
                  border: '2px solid #debfc3',
                  padding: '10px clamp(10px, 2.5vw, 16px)',
                  boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: 'pulse-border 2s ease-in-out infinite',
                  fontFamily: 'Montserrat, sans-serif',
                  color: '#191c1d',
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                * This will help us find you
              </p>
            </div>

            {/* Price Breakdown */}
            <div
              className="p-4 rounded-xl mb-4 space-y-2"
              style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Subtotal ({totalItems} items) inc. VAT
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  KSh {subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Delivery inc. VAT
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  KSh {deliveryFee.toLocaleString()}
                </span>
              </div>
              <div className="h-px" style={{ backgroundColor: '#E9ECEF' }} />
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-bold"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  Total
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                >
                  KSh {grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {error && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: 'rgba(186, 26, 26, 0.08)',
                  border: '1px solid rgba(186, 26, 26, 0.2)',
                  color: '#ba1a1a',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {error}
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || !buildingName.trim()}
              className="w-full py-4 rounded-xl text-base font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#840037',
                color: '#ffffff',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  Pay KSh {grandTotal.toLocaleString()} inclusive of delivery
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
