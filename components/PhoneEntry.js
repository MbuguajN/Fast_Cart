'use client';

import { useState, useRef, useEffect } from 'react';

export default function PhoneEntry({ onSubmit }) {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ logo: null, background: null });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const inputRef = useRef(null);

  const isValid = digits.length >= 9;

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        queueMicrotask(() => {
          setSettings(data);
          setSettingsLoaded(true);
        });
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

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
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
    >
      {/* Header with background image or solid color */}
      <header
        className="flex flex-col items-center justify-center w-full px-6 relative overflow-hidden"
        style={{ flex: '0 0 55%', zIndex: 0 }}
      >
        {/* Background layer */}
        {settings.background ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${settings.background})` }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(132, 0, 55, 0.85)' }}
            />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: '#840037' }} />
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          <div style={{ marginBottom: 'clamp(12px, 3vh, 20px)' }}>
            <div
              className="rounded-xl flex items-center justify-center overflow-hidden"
              style={{ width: 'clamp(100px, 28vw, 160px)', height: 'clamp(100px, 28vw, 160px)' }}
            >
              {settingsLoaded && settings.logo && (
                <img
                  src={settings.logo}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
          <p className="text-white/80 font-medium text-center" style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(14px, 3.8vw, 18px)' }}>
            Fast drinks, delivered in minutes
          </p>
        </div>
      </header>

      <main
        className="flex flex-col items-center w-full bg-white overflow-hidden relative"
        style={{ flex: '0 0 48%', borderRadius: 'clamp(24px, 6vw, 40px) clamp(24px, 6vw, 40px) 0 0', minHeight: 0, marginTop: '-20px', zIndex: 1 }}
      >
        <div className="w-full flex flex-col items-center flex-1 overflow-y-auto justify-between" style={{ padding: 'clamp(16px, 4vh, 28px) clamp(20px, 5vw, 24px) clamp(12px, 2vh, 20px)' }}>
          {/* Item 1: Heading */}
          <div className="text-center">
            <h2 className="font-bold tracking-tight text-center" style={{ fontFamily: 'Montserrat, sans-serif', color: '#840037', fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 'clamp(2px, 0.5vh, 4px)' }}>
              What&apos;s your number?
            </h2>
            <p className="text-center" style={{ fontFamily: 'Montserrat, sans-serif', color: '#574145', fontSize: 'clamp(12px, 3.2vw, 15px)' }}>
              We&apos;ll check if you have an existing account
            </p>
          </div>

          {/* Item 2: Inputs */}
          <div className="flex w-full" style={{ gap: 'clamp(8px, 2vw, 12px)', height: 'clamp(44px, 11vw, 52px)' }}>
            <div className="relative h-full" style={{ width: '33%' }}>
              <button
                type="button"
                className="w-full h-full flex items-center justify-between bg-white font-semibold transition-all"
                style={{
                  color: '#191c1d',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 'clamp(12px, 3.2vw, 15px)',
                  borderRadius: '12px',
                  border: '2px solid #debfc3',
                  padding: '0 clamp(10px, 2.5vw, 16px)',
                  boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: 'pulse-border 2s ease-in-out infinite',
                }}
              >
                <span className="flex items-center" style={{ gap: 'clamp(4px, 1vw, 8px)' }}>
                  <span className="font-bold">KE</span>
                  <span style={{ color: '#574145' }}>+254</span>
                </span>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 'clamp(12px, 3vw, 16px)', height: 'clamp(12px, 3vw, 16px)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="relative h-full" style={{ flex: 1 }}>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                value={digits}
                onChange={handleChange}
                placeholder="712 345 678"
                maxLength={10}
                className="w-full h-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none"
                style={{
                  borderRadius: '12px',
                  border: `2px solid ${error ? '#ba1a1a' : '#debfc3'}`,
                  padding: '0 clamp(10px, 2.5vw, 16px)',
                  fontSize: 'clamp(14px, 4vw, 18px)',
                  boxShadow: error
                    ? '0 0 8px rgba(186,26,26,0.2), 0 0 20px rgba(186,26,26,0.1)'
                    : '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                  animation: error ? 'pulse-border-error 2s ease-in-out infinite' : 'pulse-border 2s ease-in-out infinite',
                  color: '#191c1d',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-center"
              style={{ fontFamily: 'Montserrat, sans-serif', color: '#ba1a1a', fontSize: 'clamp(11px, 3vw, 14px)' }}
            >
              {error}
            </p>
          )}

          {/* Item 3: Button */}
          <form onSubmit={handleSubmit} noValidate className="w-full">
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full text-white font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                height: 'clamp(44px, 11vw, 52px)',
                backgroundColor: '#840037',
                borderRadius: '12px',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 'clamp(14px, 3.8vw, 16px)',
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking...
                </div>
              ) : (
                <>
                  <span>Continue</span>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 'clamp(16px, 4vw, 20px)', height: 'clamp(16px, 4vw, 20px)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <footer className="text-center w-full">
            <p className="text-center leading-relaxed" style={{ fontFamily: 'Montserrat, sans-serif', color: '#574145', fontSize: 'clamp(10px, 2.8vw, 12px)', maxWidth: '280px', margin: '0 auto' }}>
              By continuing, you agree to our{' '}
              <a className="font-semibold hover:underline" style={{ color: '#840037' }} href="#">Terms of Service</a>
              {' '}&amp;{' '}
              <a className="font-semibold hover:underline" style={{ color: '#840037' }} href="#">Privacy Policy</a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
