'use client';

import { useState } from 'react';
import { createOrder } from '@/lib/woocommerce';
import { haptic } from '@/lib/haptic';

const PAYMENT_METHODS = [
  {
    id: 'mpesa',
    name: 'M-Pesa',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
    ),
    description: 'STK Push to your phone',
    color: '#4CAF50',
  },
  {
    id: 'apple_pay',
    name: 'Apple Pay',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
    description: 'FaceID / TouchID',
    color: '#000000',
  },
  {
    id: 'google_pay',
    name: 'Google Pay',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
      </svg>
    ),
    description: 'Biometric authentication',
    color: '#4285F4',
  },
];

export default function CheckoutModal({ cart, products, user, locationData, onClose, onOrderSuccess }) {
  const [selectedMethod, setSelectedMethod] = useState('mpesa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stkSent, setStkSent] = useState(false);

  const totalPrice = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    haptic('medium');
    setLoading(true);
    setError('');

    try {
      const order = await createOrder({
        cart,
        paymentMethod: selectedMethod,
        locationData,
        customerId: user?.customerId,
        customerNote: `Landmark: ${locationData.text || 'GPS provided'}`,
      });

      if (selectedMethod === 'mpesa' && order.stkPrompt) {
        setStkSent(true);
        setLoading(false);
        return;
      }

      haptic('success');
      onOrderSuccess(order);
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md p-6 shadow-2xl animate-slide-up overflow-hidden"
        style={{
          backgroundColor: '#f5f5dc',
          borderRadius: '0.75rem 0.75rem 0 0',
          border: '1px solid #E9ECEF',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              className="text-xl font-bold"
              style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
            >
              Checkout
            </h2>
            <p
              className="text-xs"
              style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
            >
              {totalItems} {totalItems === 1 ? 'item' : 'items'} · KSh {totalPrice.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#F1F3F5' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Delivery Info */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl mb-5"
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

        {/* STK Push Confirmation State */}
        {stkSent ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#4CAF50' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
            </div>
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
            >
              Check Your Phone
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
            >
              An M-Pesa STK Push has been sent to<br />
              <strong>{user?.phone || 'your phone'}</strong>
            </p>
            <p
              className="text-xs"
              style={{ color: '#8b7075', fontFamily: 'Montserrat, sans-serif' }}
            >
              Enter your 4-digit PIN on the OS prompt to complete payment
            </p>
            <button
              onClick={onClose}
              className="mt-6 text-sm font-semibold underline"
              style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
            >
              Cancel & Back to Menu
            </button>
          </div>
        ) : (
          <>
            {/* Payment Methods */}
            <div className="mb-5">
              <p
                className="text-xs mb-3 uppercase tracking-wider"
                style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
              >
                Pay with
              </p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => { setSelectedMethod(method.id); setError(''); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: selectedMethod === method.id ? 'rgba(132, 0, 55, 0.08)' : '#ffffff',
                      border: `2px solid ${selectedMethod === method.id ? '#840037' : '#E9ECEF'}`,
                      fontFamily: 'Montserrat, sans-serif',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: method.color + '10', color: method.color }}
                    >
                      {method.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p
                        className="text-sm font-bold"
                        style={{ color: '#191c1d' }}
                      >
                        {method.name}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: '#5f5e5e' }}
                      >
                        {method.description}
                      </p>
                    </div>
                    {selectedMethod === method.id && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#840037' }}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
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

            {/* Total */}
            <div
              className="flex items-center justify-between mb-4 p-3 rounded-xl"
              style={{ backgroundColor: '#F1F3F5' }}
            >
              <span
                className="text-sm"
                style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
              >
                Total
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
              >
                KSh {totalPrice.toLocaleString()}
              </span>
            </div>

            {/* Pay Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
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
                  {selectedMethod === 'mpesa'
                    ? `Pay KSh ${totalPrice.toLocaleString()} via M-Pesa`
                    : selectedMethod === 'apple_pay'
                    ? 'Pay with Apple Pay'
                    : 'Pay with Google Pay'
                  }
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
