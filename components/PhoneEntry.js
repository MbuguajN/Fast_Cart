'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function PhoneEntry({ onSubmit }) {
  const { phase, otpMeta, verifyOtp, resendOtp, cancelOtp } = useAuth();
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState({ logo: null, background: null });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const inputRef = useRef(null);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const otpRefs = useRef([]);

  const isValid = digits.length >= 9;
  const isOtpPhase = phase === 'otp_pending';

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

  // Countdown for resend
  useEffect(() => {
    if (!isOtpPhase) return;
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOtpPhase]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (isOtpPhase && otpRefs.current[0]) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [isOtpPhase]);

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
    setError('');
    try {
      const result = await onSubmit(digits);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
      // If successful, phase changes to otp_pending (handled by auth-context)
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (otpError) setOtpError('');

    // Auto-advance
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const code = [...newDigits.slice(0, 5), digit].join('');
      if (code.length === 6) {
        handleOtpSubmit(code);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newDigits[i] = pasted[i];
      }
      setOtpDigits(newDigits);
      if (pasted.length === 6) {
        handleOtpSubmit(pasted);
      } else {
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
      }
    }
  };

  const handleOtpSubmit = async (code) => {
    if (!code || code.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const result = await verifyOtp(code);
      if (result?.error) {
        setOtpError(result.error);
        setOtpDigits(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
      // If successful, phase changes to authenticated
    } catch {
      setOtpError('Verification failed. Try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtpError('');
    setOtpDigits(['', '', '', '', '', '']);
    const result = await resendOtp();
    if (result?.error) {
      setOtpError(result.error);
    } else {
      setCountdown(60);
    }
  };

  const handleBack = () => {
    cancelOtp();
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setLoading(false);
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

          {!isOtpPhase ? (
            /* ─── Phone Entry Screen ─── */
            <>
              {/* Item 1: Heading */}
              <div className="text-center">
                <h2 className="font-bold tracking-tight text-center" style={{ fontFamily: 'Montserrat, sans-serif', color: '#840037', fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 'clamp(2px, 0.5vh, 4px)' }}>
                  What&apos;s your number?
                </h2>
                <p className="text-center" style={{ fontFamily: 'Montserrat, sans-serif', color: '#574145', fontSize: 'clamp(12px, 3.2vw, 15px)' }}>
                  We&apos;ll send a verification code to confirm it&apos;s you
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
                      Sending code...
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
            </>
          ) : (
            /* ─── OTP Verification Screen ─── */
            <>
              {/* Heading */}
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#840037] flex items-center justify-center shadow-xs">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                </div>
                <h2 className="font-bold tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif', color: '#840037', fontSize: 'clamp(18px, 5vw, 24px)', marginBottom: 'clamp(2px, 0.5vh, 6px)' }}>
                  Verify your number
                </h2>
                <p style={{ fontFamily: 'Montserrat, sans-serif', color: '#574145', fontSize: 'clamp(11px, 3vw, 14px)', lineHeight: 1.5 }}>
                  {otpMeta?.emailSent ? (
                    <>We sent a 6-digit code to <strong style={{ color: '#840037' }}>{otpMeta.maskedEmail}</strong></>
                  ) : (
                    <>Enter the verification code{otpMeta?.devCode ? <> — <strong style={{ color: '#840037' }}>Dev: {otpMeta.devCode}</strong></> : null}</>
                  )}
                </p>
              </div>

              {/* OTP Input Boxes */}
              <div className="flex justify-center" style={{ gap: 'clamp(6px, 2vw, 10px)' }} onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="text-center font-bold bg-white transition-all focus:outline-none"
                    style={{
                      width: 'clamp(40px, 11vw, 52px)',
                      height: 'clamp(48px, 13vw, 60px)',
                      borderRadius: '12px',
                      border: `2px solid ${otpError ? '#ba1a1a' : digit ? '#840037' : '#debfc3'}`,
                      fontSize: 'clamp(20px, 5.5vw, 26px)',
                      color: '#191c1d',
                      fontFamily: 'Montserrat, sans-serif',
                      boxShadow: digit ? '0 0 8px rgba(132,0,55,0.2)' : 'none',
                    }}
                    disabled={otpLoading}
                  />
                ))}
              </div>

              {/* Error */}
              {otpError && (
                <p className="text-center" style={{ fontFamily: 'Montserrat, sans-serif', color: '#ba1a1a', fontSize: 'clamp(11px, 3vw, 14px)' }}>
                  {otpError}
                </p>
              )}

              {/* Verify Button */}
              <button
                onClick={() => handleOtpSubmit(otpDigits.join(''))}
                disabled={otpDigits.join('').length !== 6 || otpLoading}
                className="w-full text-white font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  height: 'clamp(44px, 11vw, 52px)',
                  backgroundColor: '#840037',
                  borderRadius: '12px',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 'clamp(14px, 3.8vw, 16px)',
                }}
              >
                {otpLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  <span>Verify &amp; Continue</span>
                )}
              </button>

              {/* Resend + Back */}
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={handleBack}
                  className="font-semibold"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#574145', fontSize: 'clamp(11px, 3vw, 13px)' }}
                >
                  ← Change number
                </button>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0}
                  className="font-semibold disabled:opacity-40"
                  style={{ fontFamily: 'Montserrat, sans-serif', color: '#840037', fontSize: 'clamp(11px, 3vw, 13px)' }}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </button>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
