'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.logo) setLogo(data.logo);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      return;
    }

    fetch(`/api/trade/password/verify-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        setTokenValid(Boolean(data.valid));
        if (data.email) setUserEmail(data.email);
      })
      .catch(() => setTokenValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/trade/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16 space-y-6 text-[#231F20] animate-page-enter" style={{ fontFamily: 'Montserrat, sans-serif' }}>
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
          <span className="w-2 h-2 rounded-full bg-[#840038]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#840038]">
            B2B Business Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#231F20]">
          Set New Password
        </h1>
        {userEmail && (
          <p className="text-xs text-gray-500 font-medium">
            Resetting password for: <strong className="text-gray-900">{userEmail}</strong>
          </p>
        )}
      </div>

      {checking ? (
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#840038]/30 border-t-[#840038] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-gray-600">Verifying your secure reset link...</p>
        </div>
      ) : !tokenValid ? (
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ✕
          </div>
          <h2 className="text-base font-bold text-gray-900">Reset Link Expired or Invalid</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            This password reset link has either expired (links are valid for 30 minutes) or has already been used.
          </p>
          <div className="pt-2">
            <Link
              href="/trade/login"
              className="inline-block px-6 py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              Back to Business Login →
            </Link>
          </div>
        </div>
      ) : success ? (
        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <h2 className="text-base font-bold text-gray-900">Password Reset Successfully</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Your business portal credentials have been updated. You can now sign in to access your wholesale catalog and account dashboard.
          </p>
          <div className="pt-3">
            <Link
              href="/trade/login"
              className="inline-block w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md text-center"
            >
              Sign In to Business Portal →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
              <span className="shrink-0 text-sm">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-[#840038] focus:border-[#840038] outline-none transition-all"
            />
          </div>

          <div className="text-[11px] text-gray-500 space-y-1 bg-gray-50 p-3 rounded-xl">
            <div className="font-bold text-gray-700 uppercase text-[10px]">Password Requirements:</div>
            <div>• Minimum 12 characters</div>
            <div>• Cannot be purely digits or a single repeated character</div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 ${
              submitting ? 'opacity-85 cursor-wait' : 'cursor-pointer'
            }`}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Confirm New Password →</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-24 text-center">
          <div className="w-8 h-8 border-3 border-[#840038]/30 border-t-[#840038] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loading Password Reset...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

