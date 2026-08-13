'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function AccountModal({ isOpen, onClose, onReorder }) {
  const { user, phase, phone: authPhone, otpMeta, submitPhone, verifyOtp, resendOtp, cancelOtp, completeProfileAtCheckout, updateEmail, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'profile'
  const [inputPhone, setInputPhone] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [landmarkInput, setLandmarkInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const otpRefs = useRef([]);

  const isOtpPhase = phase === 'otp_pending';

  // Countdown for resend
  useEffect(() => {
    if (!isOtpPhase || !isOpen) return;
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOtpPhase, isOpen]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (isOtpPhase && isOpen && otpRefs.current[0]) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [isOtpPhase, isOpen]);

  // Sync inputs with user state
  useEffect(() => {
    if (user) {
      setNameInput(user.name || '');
      setLandmarkInput(user.landmark || '');
      setEmailInput(user.email || '');
    }
  }, [user]);

  // Load orders when modal is open and user is logged in
  const fetchOrders = useCallback(async () => {
    const custId = user?.customerId;
    const ph = user?.phone || authPhone;
    if (!custId && !ph) return;

    setLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (custId) params.set('customer', custId);
      if (ph) params.set('phone', ph);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [user, authPhone]);

  useEffect(() => {
    if (isOpen && user) {
      fetchOrders();
    }
  }, [isOpen, user, fetchOrders]);

  if (!isOpen) return null;

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!inputPhone.trim()) return;
    setLoadingAuth(true);
    setAuthError('');
    try {
      const result = await submitPhone(inputPhone.trim());
      if (result?.error) {
        setAuthError(result.error);
      }
    } catch (err) {
      setAuthError('Sign in failed. Please check your phone number.');
    } finally {
      setLoadingAuth(false);
    }
  };

  // OTP handlers
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (otpError) setOtpError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (digit && index === 5) {
      const code = [...newDigits.slice(0, 5), digit].join('');
      if (code.length === 6) handleOtpVerify(code);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < pasted.length && i < 6; i++) newDigits[i] = pasted[i];
      setOtpDigits(newDigits);
      if (pasted.length === 6) handleOtpVerify(pasted);
      else otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleOtpVerify = async (code) => {
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
    } catch {
      setOtpError('Verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpResend = async () => {
    if (countdown > 0) return;
    setOtpError('');
    setOtpDigits(['', '', '', '', '', '']);
    const result = await resendOtp();
    if (result?.error) setOtpError(result.error);
    else setCountdown(60);
  };

  const handleOtpBack = () => {
    cancelOtp();
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setInputPhone('');
    setLoadingAuth(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      if (nameInput.trim() || landmarkInput.trim()) {
        await completeProfileAtCheckout({
          name: nameInput.trim(),
          landmark: landmarkInput.trim(),
          zone: user?.zone || '',
        });
      }
      if (emailInput.trim() && emailInput.trim() !== user?.email) {
        await updateEmail(emailInput.trim());
      }
      setEditingProfile(false);
    } catch {
      alert('Failed to update profile');
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">Completed</span>;
      case 'processing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">Processing</span>;
      case 'pending':
      case 'on-hold':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">Pending</span>;
      case 'cancelled':
      case 'failed':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-100 text-gray-800">{status || 'Received'}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] border border-gray-100">
        {/* Modal Header */}
        <div className="p-5 pb-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#840037] text-white flex items-center justify-center font-extrabold text-base shadow-sm">
              {user?.name ? (
                user.name.charAt(0).toUpperCase()
              ) : (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {user ? user.name || 'My Account' : 'Sign In / Account'}
              </h2>
              {user?.phone && (
                <p className="text-xs font-semibold text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {user.phone}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Guest Authentication Prompt / OTP Verification */}
        {!user ? (
          <div className="p-6 space-y-5">
            {!isOtpPhase ? (
              /* Phone Entry */
              <>
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#840037] mx-auto flex items-center justify-center">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Sign In with Phone Number
                  </h3>
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    We&apos;ll send a verification code to your email on file
                  </p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={inputPhone}
                      onChange={(e) => { setInputPhone(e.target.value); setAuthError(''); }}
                      placeholder="e.g. 0712345678"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-300 text-sm font-semibold focus:ring-2 focus:ring-[#840037] focus:outline-none"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    />
                  </div>

                  {authError && (
                    <p className="text-xs text-red-600 text-center font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{authError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full py-3.5 rounded-2xl text-xs font-extrabold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md active:scale-95 disabled:opacity-50"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {loadingAuth ? 'Sending code...' : 'CONTINUE WITH PHONE'}
                  </button>
                </form>
              </>
            ) : (
              /* OTP Verification */
              <>
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#840037] mx-auto flex items-center justify-center">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    Enter verification code
                  </h3>
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {otpMeta?.emailSent ? (
                      <>Sent to <strong className="text-[#840037]">{otpMeta.maskedEmail}</strong></>
                    ) : (
                      <>Enter your verification code{otpMeta?.devCode ? <> — <strong className="text-[#840037]">Dev: {otpMeta.devCode}</strong></> : null}</>
                    )}
                  </p>
                </div>

                {/* 6-digit OTP inputs */}
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
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
                      className="w-11 h-13 text-center font-extrabold text-lg rounded-xl border-2 focus:outline-none transition-all"
                      style={{
                        borderColor: otpError ? '#ba1a1a' : digit ? '#840037' : '#d1d5db',
                        color: '#191c1d',
                        fontFamily: 'Montserrat, sans-serif',
                        boxShadow: digit ? '0 0 6px rgba(132,0,55,0.15)' : 'none',
                      }}
                      disabled={otpLoading}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-xs text-red-600 text-center font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{otpError}</p>
                )}

                <button
                  onClick={() => handleOtpVerify(otpDigits.join(''))}
                  disabled={otpDigits.join('').length !== 6 || otpLoading}
                  className="w-full py-3.5 rounded-2xl text-xs font-extrabold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md active:scale-95 disabled:opacity-50"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {otpLoading ? 'Verifying...' : 'VERIFY & SIGN IN'}
                </button>

                <div className="flex items-center justify-between">
                  <button onClick={handleOtpBack} className="text-xs font-bold text-gray-500 hover:text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    ← Change number
                  </button>
                  <button
                    onClick={handleOtpResend}
                    disabled={countdown > 0}
                    className="text-xs font-bold disabled:opacity-40"
                    style={{ fontFamily: 'Montserrat, sans-serif', color: '#840037' }}
                  >
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Authenticated User Interface */
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-3 text-xs font-extrabold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'border-[#840037] text-[#840037] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" />
                </svg>
                <span>Order History ({orders.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-3 text-xs font-extrabold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'border-[#840037] text-[#840037] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                <span>Profile & Delivery</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'orders' ? (
                loadingOrders ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 mx-auto flex items-center justify-center">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/>
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      No Past Orders Found
                    </h4>
                    <p className="text-xs text-gray-400 max-w-xs mx-auto">
                      Your completed orders will show up here. Place your first order today!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3 hover:border-pink-200 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-extrabold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                              Order #{ord.number || ord.id}
                            </span>
                            <p className="text-[11px] text-gray-400 font-medium">
                              {new Date(ord.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {getStatusBadge(ord.status)}
                        </div>

                        {/* Line Items */}
                        <div className="space-y-1.5 pt-2 border-t border-gray-100">
                          {ord.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700 font-medium truncate max-w-[200px]">
                                {item.quantity}x {item.name}
                              </span>
                              <span className="font-extrabold text-gray-900">
                                KSh {parseFloat(item.total || item.price * item.quantity).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Total & Reorder Button */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total</span>
                            <p className="text-sm font-extrabold text-[#840037]" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                              KSh {parseFloat(ord.total).toLocaleString()}
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              onReorder?.(ord.items);
                              onClose();
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Re-order</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Profile Tab */
                <div className="space-y-4">
                  {!editingProfile ? (
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Customer Details</h4>
                        <button
                          onClick={() => setEditingProfile(true)}
                          className="text-xs font-extrabold text-[#840037] hover:underline"
                        >
                          Edit Profile
                        </button>
                      </div>

                      <div className="space-y-2 text-xs" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Full Name</span>
                          <span className="font-extrabold text-gray-900">{user.name || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Phone Number</span>
                          <span className="font-extrabold text-gray-900">{user.phone}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Email Address</span>
                          <span className="font-extrabold text-gray-900">{user.email || 'Not provided'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Default Delivery Landmark</span>
                          <span className="font-extrabold text-gray-900">{user.landmark || 'Not provided'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveProfile} className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="e.g. James Kamau"
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="james@example.com"
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                          Delivery Landmark / House No.
                        </label>
                        <input
                          type="text"
                          value={landmarkInput}
                          onChange={(e) => setLandmarkInput(e.target.value)}
                          placeholder="e.g. Westlands Commercial Center, Fl 2"
                          className="w-full px-3 py-2 border rounded-xl text-xs bg-white"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(false)}
                          className="flex-1 py-2 text-xs font-bold rounded-xl bg-gray-200 text-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 text-xs font-extrabold rounded-xl bg-[#840037] text-white"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      onClose();
                    }}
                    className="w-full py-3 rounded-2xl text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-center"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Sign Out of Account
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
