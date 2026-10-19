'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import Link from 'next/link';
import { useTrade } from '@/lib/trade/trade-context.js';

export default function TradeSettingsPage() {
  const { user: authUser, account: authAccount, showNotification, refreshAuth } = useTrade();

  const [activeTab, setActiveTab] = useState('business'); // 'business' | 'personal' | 'security' | 'team'
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // ── Tab 1: Business Form ─────────────────────────────────────────────
  const [businessForm, setBusinessForm] = useState({
    tradingName: '',
    legalName: '',
    kraPin: '',
    licenceNo: '',
    licenceExpiry: '',
    licenceDocUrl: '',
    primaryAddress: {
      label: '',
      addressLine: '',
      city: 'Nairobi',
      deliveryWindow: '08:00 - 17:00 EAT',
      contactName: '',
      phone: '',
    },
  });
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessMsg, setBusinessMsg] = useState(null);
  const [businessError, setBusinessError] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ── Tab 2: Personal Form ─────────────────────────────────────────────
  const [personalForm, setPersonalForm] = useState({
    name: '',
    phone: '',
    role: '',
  });
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMsg, setPersonalMsg] = useState(null);
  const [personalError, setPersonalError] = useState(null);

  // ── Tab 3: Security Form ─────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetLinkMsg, setResetLinkMsg] = useState(null);
  const [resetLinkError, setResetLinkError] = useState(null);

  const fileInputId = useId();

  // Load profile from API
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch('/api/trade/profile');
      if (!res.ok) {
        throw new Error('Failed to load profile details');
      }
      const data = await res.json();
      setProfileData(data);

      // Populate Business Form
      if (data.account) {
        const primaryAddr = data.account.addresses?.find((a) => a.id === data.account.defaultAddressId || a.isDefault) ||
          data.account.addresses?.[0] || {};

        setBusinessForm({
          tradingName: data.account.tradingName || '',
          legalName: data.account.legalName || data.account.tradingName || '',
          kraPin: data.account.kraPin || '',
          licenceNo: data.account.licenceNo || '',
          licenceExpiry: data.account.licenceExpiry || '',
          licenceDocUrl: data.account.licenceDocUrl || '',
          primaryAddress: {
            label: primaryAddr.label || 'Primary Receiving Dock',
            addressLine: primaryAddr.addressLine || '',
            city: primaryAddr.city || 'Nairobi',
            deliveryWindow: primaryAddr.deliveryWindow || '08:00 - 17:00 EAT',
            contactName: primaryAddr.contactName || '',
            phone: primaryAddr.phone || '',
          },
        });
      }

      // Populate Personal Form
      if (data.user) {
        setPersonalForm({
          name: data.user.name || '',
          phone: data.user.phone || '',
          role: data.user.role || '',
        });
      }

      // If user is non-owner, default to personal tab
      if (data.isOwner === false && activeTab === 'business') {
        setActiveTab('personal');
      }
    } catch (err) {
      console.error('Error fetching trade profile:', err);
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Handle Licence Document Upload
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingDoc(true);
      setBusinessError(null);
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/trade/apply/upload', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setBusinessForm((prev) => ({ ...prev, licenceDocUrl: data.fileUrl }));
      showNotification?.('Licence document uploaded. Click Save to apply.', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      setBusinessError(err.message || 'Could not upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit Business Details
  const handleSaveBusiness = async (e) => {
    e.preventDefault();
    setSavingBusiness(true);
    setBusinessMsg(null);
    setBusinessError(null);

    try {
      const res = await fetch('/api/trade/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          business: {
            tradingName: businessForm.tradingName,
            legalName: businessForm.legalName,
            kraPin: businessForm.kraPin,
            licenceNo: businessForm.licenceNo,
            licenceExpiry: businessForm.licenceExpiry || null,
            licenceDocUrl: businessForm.licenceDocUrl || null,
            primaryAddress: businessForm.primaryAddress,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update business details');
      }

      setBusinessMsg('Business registration and tax details saved successfully');
      showNotification?.('Business details updated', 'success');
      await refreshAuth();
      await loadProfile();
    } catch (err) {
      setBusinessError(err.message);
    } finally {
      setSavingBusiness(false);
    }
  };

  // Submit Personal Details
  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setSavingPersonal(true);
    setPersonalMsg(null);
    setPersonalError(null);

    try {
      const res = await fetch('/api/trade/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          personal: {
            name: personalForm.name,
            phone: personalForm.phone,
            role: personalForm.role,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update personal profile');
      }

      setPersonalMsg('Personal contact details saved successfully');
      showNotification?.('Personal profile updated', 'success');
      await refreshAuth();
      await loadProfile();
    } catch (err) {
      setPersonalError(err.message);
    } finally {
      setSavingPersonal(false);
    }
  };

  // Submit Password Change
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters');
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch('/api/trade/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordMsg('Password changed successfully');
      showNotification?.('Password updated', 'success');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // Request Password Reset Link Email
  const handleSendResetLink = async () => {
    if (!profileData?.user?.email) return;

    setSendingResetLink(true);
    setResetLinkMsg(null);
    setResetLinkError(null);

    try {
      const res = await fetch('/api/trade/password/reset-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: profileData.user.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setResetLinkMsg('Password reset instructions have been sent to your email.');
      showNotification?.('Reset instructions dispatched', 'success');
    } catch (err) {
      setResetLinkError(err.message);
    } finally {
      setSendingResetLink(false);
    }
  };

  if (loading && !profileData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#840038] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Loading Account Settings...</span>
        </div>
      </div>
    );
  }

  if (fetchError && !profileData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl">
          <h2 className="font-bold text-lg mb-2">Unable to load settings</h2>
          <p className="text-sm">{fetchError}</p>
          <button
            onClick={loadProfile}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(profileData?.isOwner);
  const account = profileData?.account || authAccount || {};
  const user = profileData?.user || authUser || {};
  const seats = profileData?.seats || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-[#231F20] animate-page-enter">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-[#840038] text-white">
              {account.tradingName || 'Wholesale Account'}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                isOwner ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {user.seatType === 'owner' ? 'Owner / Director' : user.seatType?.toUpperCase() || 'SEAT'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-gray-900 mt-2">
            Account &amp; Business Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage your company tax details, primary receiving bay, personal contact profile, and security.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/trade/dashboard"
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Tab Navigation Controls */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'business'
              ? 'border-[#840038] text-[#840038]'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <span>🏢</span>
          <span>Business &amp; Tax</span>
          {isOwner && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-pink-100 text-[#840038]">
              Owner
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'personal'
              ? 'border-[#840038] text-[#840038]'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <span>👤</span>
          <span>Personal Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'security'
              ? 'border-[#840038] text-[#840038]'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <span>🔒</span>
          <span>Security &amp; Password</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'team'
                ? 'border-[#840038] text-[#840038]'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <span>👥</span>
            <span>Team Seats ({seats.length})</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: BUSINESS & TAX DETAILS ──────────────────────────────── */}
      {activeTab === 'business' && (
        <div className="space-y-6">
          {!isOwner && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
              <span className="text-amber-600 text-lg">ℹ</span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Read-Only Mode (Account Owner Privileges Required)
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  Only the account owner who created this wholesale account can modify tax credentials, legal name, and primary delivery addresses. Please contact your account owner to request changes.
                </p>
              </div>
            </div>
          )}

          {businessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span>✓</span>
              <span>{businessMsg}</span>
            </div>
          )}

          {businessError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span>⚠</span>
              <span>{businessError}</span>
            </div>
          )}

          <form onSubmit={handleSaveBusiness} className="space-y-6">
            {/* Card: Company Registration & Compliance */}
            <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                    Business Entity &amp; Tax Compliance
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ensures automated electronic tax invoices (ETR/TIMS) and delivery notes are legally compliant.
                  </p>
                </div>
                {isOwner && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    Owner Access
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Trading / Venue Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    required
                    value={businessForm.tradingName}
                    onChange={(e) => setBusinessForm({ ...businessForm, tradingName: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="e.g. The Alchemist Westlands"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Display name shown across invoices and delivery notes.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Registered Legal Entity Name
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={businessForm.legalName}
                    onChange={(e) => setBusinessForm({ ...businessForm, legalName: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="e.g. Alchemist Hospitality Limited"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Official registered company name on certificate of incorporation.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    KRA PIN (Kenya Revenue Authority) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    required
                    value={businessForm.kraPin}
                    onChange={(e) => setBusinessForm({ ...businessForm, kraPin: e.target.value.toUpperCase().trim() })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-mono tracking-wider focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 uppercase"
                    placeholder="P051234567Z"
                    maxLength={11}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Format: letter P, 9 digits, letter (11 chars). Used for VAT inputs on official invoices.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    County Liquor Licence Number
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={businessForm.licenceNo}
                    onChange={(e) => setBusinessForm({ ...businessForm, licenceNo: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="e.g. LQ-NRB-2026-00421"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Required for commercial alcohol procurement in Kenya.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Liquor Licence Expiry Date
                  </label>
                  <input
                    type="date"
                    disabled={!isOwner}
                    value={businessForm.licenceExpiry}
                    onChange={(e) => setBusinessForm({ ...businessForm, licenceExpiry: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Keep current to avoid interruption to credit facilities.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Renewed Licence Certificate (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {businessForm.licenceDocUrl ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={businessForm.licenceDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2.5 rounded-xl bg-pink-50 text-[#840038] text-xs font-bold hover:underline flex items-center gap-1.5 border border-pink-200"
                        >
                          <span>📄</span>
                          <span>View Current Document</span>
                        </a>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setBusinessForm({ ...businessForm, licenceDocUrl: '' })}
                            className="text-xs text-red-600 hover:text-red-800 font-bold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ) : (
                      isOwner && (
                        <div className="relative">
                          <label
                            htmlFor={fileInputId}
                            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span>📎</span>
                            <span>{uploadingDoc ? 'Uploading...' : 'Upload Certificate PDF'}</span>
                          </label>
                          <input
                            id={fileInputId}
                            type="file"
                            accept=".pdf,image/*"
                            disabled={uploadingDoc}
                            onChange={handleDocUpload}
                            className="sr-only"
                          />
                        </div>
                      )
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Uploaded certificates are archived with compliance for credit account review.
                  </p>
                </div>
              </div>
            </div>

            {/* Card: Primary Delivery Address & Receiving Bay */}
            <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                    Primary Receiving Bay &amp; Delivery Location
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Default commercial dispatch address. (Secondary branch receiving docks remain preserved).
                  </p>
                </div>
                {account.addresses?.length > 1 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {account.addresses.length} Total Addresses Configured
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Location Label / Bay Name
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={businessForm.primaryAddress.label}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        primaryAddress: { ...businessForm.primaryAddress, label: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="e.g. Central Goods In / Cellar Bay"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Town / City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    required
                    value={businessForm.primaryAddress.city}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        primaryAddress: { ...businessForm.primaryAddress, city: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="Nairobi"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Free commercial delivery applies to Nairobi deliveries meeting the wholesale threshold.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Physical Street Address, Building &amp; Landmark <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    required
                    value={businessForm.primaryAddress.addressLine}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        primaryAddress: { ...businessForm.primaryAddress, addressLine: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="e.g. Ground Floor Receiving Dock, Delta Towers, Chiromo Road, Westlands"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Receiving Hours / Delivery Window
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={businessForm.primaryAddress.deliveryWindow}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        primaryAddress: { ...businessForm.primaryAddress, deliveryWindow: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                    placeholder="08:00 - 15:00 EAT"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Receiving Contact Person &amp; Mobile Phone
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      disabled={!isOwner}
                      value={businessForm.primaryAddress.contactName}
                      onChange={(e) =>
                        setBusinessForm({
                          ...businessForm,
                          primaryAddress: { ...businessForm.primaryAddress, contactName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-3 rounded-2xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                      placeholder="Attn: Cellar Lead"
                    />
                    <input
                      type="tel"
                      disabled={!isOwner}
                      value={businessForm.primaryAddress.phone}
                      onChange={(e) =>
                        setBusinessForm({
                          ...businessForm,
                          primaryAddress: { ...businessForm.primaryAddress, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-3 rounded-2xl border border-gray-200 text-xs focus:ring-2 focus:ring-[#840038] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 font-medium"
                      placeholder="+254711..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="px-8 py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingBusiness && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{savingBusiness ? 'Saving Changes...' : 'Save Business Details'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── TAB 2: PERSONAL PROFILE ────────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {personalMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span>✓</span>
              <span>{personalMsg}</span>
            </div>
          )}

          {personalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
              <span>⚠</span>
              <span>{personalError}</span>
            </div>
          )}

          <form onSubmit={handleSavePersonal} className="space-y-6">
            <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                  Personal Contact Details
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update your name, contact phone number, and job title for portal communications and order dispatch.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalForm.name}
                    onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium"
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email || ''}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Email serves as your authenticated seat ID and can only be altered by an administrator.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium"
                    placeholder="+254711..."
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Used by dispatch drivers for delivery verification and delivery confirmation SMS.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Job Title / Role in Organization
                  </label>
                  <input
                    type="text"
                    value={personalForm.role}
                    onChange={(e) => setPersonalForm({ ...personalForm, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium"
                    placeholder="e.g. Beverage Director, General Manager"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Portal Seat Type
                  </label>
                  <div className="py-2.5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                        user.seatType === 'owner'
                          ? 'bg-purple-100 text-purple-800'
                          : user.seatType === 'buyer'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.seatType === 'owner' ? 'Owner / Director' : user.seatType?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Seat permissions are configured during account provisioning.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPersonal}
                className="px-8 py-3.5 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {savingPersonal && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{savingPersonal ? 'Saving Profile...' : 'Save Personal Details'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 3: SECURITY & PASSWORD ─────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Card: Change Password */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Change Account Password
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Passwords are encrypted using scrypt. Must be at least 12 characters.
              </p>
            </div>

            {passwordMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span>✓</span>
                <span>{passwordMsg}</span>
              </div>
            )}

            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span>⚠</span>
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-5 max-w-xl">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium pr-10"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600 font-bold"
                  >
                    {showCurrent ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  New Password (12+ characters) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium pr-10"
                    placeholder="At least 12 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600 font-bold"
                  >
                    {showNew ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordForm.newPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className={`h-1.5 flex-1 rounded-full ${
                        passwordForm.newPassword.length >= 12 ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-[11px] font-bold text-gray-500">
                      {passwordForm.newPassword.length}/12 chars{' '}
                      {passwordForm.newPassword.length >= 12 ? '✓ Policy Met' : '(Too short)'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:ring-2 focus:ring-[#840038] focus:border-transparent font-medium pr-10"
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3 text-xs text-gray-400 hover:text-gray-600 font-bold"
                  >
                    {showConfirm ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordForm.confirmPassword && (
                  <p
                    className={`text-[11px] mt-1 font-bold ${
                      passwordForm.newPassword === passwordForm.confirmPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {passwordForm.newPassword === passwordForm.confirmPassword
                      ? '✓ Passwords match'
                      : 'Passwords do not match'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="px-6 py-3 bg-[#840038] hover:bg-[#6b002c] text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {savingPassword && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{savingPassword ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>
          </div>

          {/* Card: Reset Link by Email */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                Email Password Reset Link
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Do not know your current password or prefer a secure reset link sent to your registered email address?
              </p>
            </div>

            {resetLinkMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span>✓</span>
                <span>{resetLinkMsg}</span>
              </div>
            )}

            {resetLinkError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
                <span>⚠</span>
                <span>{resetLinkError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-gray-600">
                A single-use 30-minute password reset link will be sent to <strong>{user.email}</strong>.
              </p>
              <button
                type="button"
                onClick={handleSendResetLink}
                disabled={sendingResetLink}
                className="px-5 py-3 border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-black uppercase tracking-wider rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {sendingResetLink && (
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                )}
                <span>{sendingResetLink ? 'Sending Link...' : 'Email Me Reset Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: TEAM SEATS OVERVIEW ─────────────────────────────────── */}
      {activeTab === 'team' && isOwner && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                  Registered Team Seats
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Audit all staff members and purchasing agents registered under {account.tradingName}.
                </p>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                {seats.length} Authorized Seat{seats.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Seat / User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Seat Type</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {seats.map((seat) => (
                    <tr key={seat.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-pink-100 text-[#840038] font-bold flex items-center justify-center text-xs shrink-0">
                            {seat.name?.slice(0, 1) || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{seat.name}</span>
                            <span className="text-[11px] text-gray-500">{seat.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-700">{seat.role}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            seat.seatType === 'owner'
                              ? 'bg-purple-100 text-purple-700'
                              : seat.seatType === 'buyer'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {seat.seatType === 'owner' ? 'Owner / Director' : seat.seatType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600 font-mono text-[11px]">{seat.phone || '—'}</td>
                      <td className="py-3 px-3">
                        {seat.isLocked ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                            Locked
                          </span>
                        ) : seat.mustChangePassword ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Reset Pending
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-[11px]">
                        {seat.createdAt ? new Date(seat.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Account Manager Box */}
            <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#840038]">
                  Need to Provision More Team Seats?
                </h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  To invite additional buyers, beverage managers, or accounting auditors with custom ordering limits, reach out to your dedicated Key Account Manager.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs font-bold text-gray-900 block">
                  {account.accountManager?.name || 'Paulette Chege'}
                </span>
                <span className="text-[11px] text-gray-500 block">
                  {account.accountManager?.phone || '+254 711 234 567'}
                </span>
                <a
                  href={`mailto:${account.accountManager?.email || 'trade@myhappyhour.co.ke'}`}
                  className="text-[11px] text-[#840038] font-bold hover:underline"
                >
                  {account.accountManager?.email || 'trade@myhappyhour.co.ke'}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

