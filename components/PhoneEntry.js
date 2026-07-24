'use client';

import { useState, useRef } from 'react';

export default function PhoneEntry({ onSubmit }) {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const isValid = digits.length >= 9;

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    setDigits(raw);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (digits.length < 9) {
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(digits);
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: '#f5f5dc' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🍹</div>
          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
          >
            LiquorDash
          </h1>
          <p
            className="text-sm"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            Fast drinks, delivered in minutes
          </p>
        </div>

        <div
          className="rounded-2xl p-6 shadow-sm overflow-hidden"
          style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}
        >
          <h2
            className="text-lg font-bold mb-1"
            style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
          >
            What&apos;s your number?
          </h2>
          <p
            className="text-sm mb-5"
            style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            We&apos;ll check if you have an existing account
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex items-center gap-2 px-3 py-3 rounded-xl flex-shrink-0"
                style={{ backgroundColor: '#F1F3F5' }}
              >
                <span className="text-lg">🇰🇪</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
                >
                  +254
                </span>
              </div>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                value={digits}
                onChange={handleChange}
                placeholder="712 345 678"
                maxLength={10}
                className="flex-1 min-w-0 px-4 py-3 rounded-xl text-lg border focus:outline-none focus:ring-2 transition-all box-border"
                style={{
                  backgroundColor: '#F1F3F5',
                  borderColor: error ? '#ba1a1a' : isValid ? '#840037' : '#E9ECEF',
                  color: '#191c1d',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              />
            </div>

            {error && (
              <p
                className="text-sm mb-3"
                style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full py-4 rounded-xl text-base font-bold transition-all active:scale-[0.98]"
              style={{
                backgroundColor: isValid ? '#840037' : '#E9ECEF',
                color: isValid ? '#ffffff' : '#8b7075',
                fontFamily: 'Montserrat, sans-serif',
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking...
                </div>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: '#8b7075', fontFamily: 'Montserrat, sans-serif' }}
        >
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}
