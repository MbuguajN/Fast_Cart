'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeSignupPage() {
  const router = useRouter();
  const { user, account, cart, refreshAuth } = useTrade();

  const [step, setStep] = useState(1); // 1 = Registration Details, 2 = 6-digit OTP Verification
  const [logo, setLogo] = useState(null);

  // Step 1 fields
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const otpInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitiateSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const { name, email, phone, password } = form;

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    if (!password || password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/trade/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate signup');
      }

      setStep(2);
      setCountdown(60);
      setSuccessMsg(`We sent a 6-digit verification code to ${email.trim()}`);
    } catch (err) {
      setError(err.message || 'Signup initiation failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/trade/signup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      // Re-hydrate user & account session in trade context
      if (typeof refreshAuth === 'function') {
        await refreshAuth();
      }

      // Check if cart has items
      const hasCartItems =
        (Array.isArray(cart) && cart.length > 0) ||
        (() => {
          try {
            const raw = localStorage.getItem('hh_trade_cart');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return false;
          }
        })();

      if (hasCartItems) {
        router.push('/trade/checkout');
      } else {
        router.push('/trade/order-pad');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check your code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    try {
      setResending(true);
      setError(null);
      setSuccessMsg(null);

      const res = await fetch('/api/trade/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code');
      }

      setCountdown(60);
      setSuccessMsg('A new verification code has been dispatched to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend code. Please try again shortly.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="max-w-lg mx-auto px-4 py-12 sm:py-16 space-y-8 text-[#231F20] animate-page-enter"
      style={{ fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* Header & Logo */}
      <div className="text-center space-y-3">
        {logo ? (
          <div className="flex justify-center mb-2">
            <img src={logo} alt="Happy Hour Logo" className="max-h-12 w-auto object-contain" />
          </div>
        ) : (
          <div className="text-2xl font-black uppercase tracking-wider text-[#840038]">
            HAPPY HOUR
          </div>
        )}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 border border-pink-200">
          <span className="w-2 h-2 rounded-full bg-[#840038] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            Instant Wholesale Registration
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
          {step === 1 ? 'Create Your Account' : 'Verify Your Email'}
        </h1>
        <p className="text-xs text-gray-500 font-medium max-w-sm mx-auto">
          {step === 1
            ? 'Sign up for bulk purchasing, wholesale tier pricing, and same-day delivery across Nairobi.'
            : `Enter the 6-digit verification code sent to ${form.email}`}
        </p>
      </div>

      {/* Active Session Notification */}
      {user && account && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-1.5">
              <span>✓</span> Currently active session
            </div>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
              {account.segment}
            </span>
          </div>
          <p className="text-gray-700">
            Signed in as <strong>{user.name}</strong> ({account.tradingName})
          </p>
          <div className="pt-2 flex items-center gap-3">
            <Link
              href="/trade/order-pad"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-xs transition-all active:scale-95"
            >
              Go to Order Pad →
            </Link>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in">
          <span className="shrink-0 text-sm">⚠️</span>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Success / Info Message */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 text-[#840038] text-xs font-semibold flex items-start gap-2 animate-in fade-in">
          <span className="shrink-0 text-sm">✉️</span>
          <div className="flex-1">{successMsg}</div>
        </div>
      )}

      {step === 1 ? (
        /* Step 1: Registration Details Form */
        <form
          onSubmit={handleInitiateSignup}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-5"
        >
          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. David Mwangi"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="e.g. david@example.com"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              placeholder="e.g. 0712 345 678"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold uppercase text-gray-700">
                Password
              </label>
              <span className="text-[10px] text-gray-400 font-medium">
                Min 12 characters
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoComplete="new-password"
                placeholder="Create a secure password (min 12 chars)"
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 rounded transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 ${
              loading ? 'opacity-85 cursor-wait' : 'cursor-pointer'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Generating Verification Code...</span>
              </>
            ) : (
              <span>Continue to Verification →</span>
            )}
          </button>
        </form>
      ) : (
        /* Step 2: 6-Digit OTP Verification Form */
        <form
          onSubmit={handleVerifyOtp}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in duration-200"
        >
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 border border-pink-200 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#840038]">
                Instant Verification
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900">Enter Your 6-Digit Code</h2>
            <p className="text-xs text-gray-600">
              Check your inbox at <strong>{form.email}</strong>
            </p>
          </div>

          {/* 6-Digit Code Visual Input */}
          <div className="space-y-3">
            <div
              className="flex justify-center gap-2 sm:gap-3 cursor-text"
              onClick={() => otpInputRef.current?.focus()}
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const char = otpCode[idx] || '';
                const isCurrent = otpCode.length === idx;
                return (
                  <div
                    key={idx}
                    className={`w-11 h-14 sm:w-12 sm:h-16 flex items-center justify-center rounded-2xl border-2 text-2xl font-black font-mono transition-all select-none ${
                      char
                        ? 'border-[#840038] bg-pink-50/50 text-[#840038] shadow-xs'
                        : isCurrent
                        ? 'border-[#840038] ring-2 ring-[#840038]/20 bg-white'
                        : 'border-gray-200 bg-gray-50/60 text-gray-400'
                    }`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>

            {/* Hidden Input for Keyboard & Paste Interaction */}
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtpCode(val);
              }}
              className="sr-only"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className={`w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 ${
              loading || otpCode.length !== 6 ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Activating Wholesale Account...</span>
              </>
            ) : (
              <span>Verify & Start Shopping →</span>
            )}
          </button>

          {/* Resend & Back controls */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtpCode('');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-gray-500 hover:text-gray-800 font-semibold underline cursor-pointer"
            >
              ← Edit Details
            </button>

            {countdown > 0 ? (
              <span className="text-gray-400 font-medium">
                Resend code in {countdown}s
              </span>
            ) : (
              <button
                type="button"
                disabled={resending}
                onClick={handleResend}
                className="text-[#840038] hover:underline font-bold cursor-pointer"
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Footer Navigation */}
      <div className="space-y-2 text-center text-xs text-gray-500">
        <div>
          Already have a trade or business account?{' '}
          <Link href="/trade/login" className="font-bold text-[#840038] hover:underline">
            Sign in here →
          </Link>
        </div>
        <div>
          Need Net 14 credit terms or corporate invoicing?{' '}
          <Link href="/trade/apply" className="font-semibold text-gray-700 hover:underline">
            Submit a business credit application
          </Link>
        </div>
      </div>
    </div>
  );
}
