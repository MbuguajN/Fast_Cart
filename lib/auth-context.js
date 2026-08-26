'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'liquordash_session';

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Phases: loading | guest | otp_pending | needs_password | authenticated
  const [phase, setPhase] = useState('loading');
  const [phone, setPhone] = useState('');
  const [otpMeta, setOtpMeta] = useState(null); // { hasAccount, emailSent, maskedEmail, devCode, needsPassword }

  useEffect(() => {
    const saved = readSession();
    if (saved?.phone) {
      setUser(saved);
      setPhone(saved.phone);
      setPhase('authenticated');
    } else {
      setPhase('guest');
    }
  }, []);

  const lookupPhone = useCallback(async (phoneNumber) => {
    const res = await fetch('/api/auth/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber }),
    });
    return res.json();
  }, []);

  // Step 1: Submit phone → triggers OTP send
  const submitPhone = useCallback(async (phoneNumber) => {
    setPhone(phoneNumber);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || 'Failed to send code', cooldown: data.cooldown };
      }

      // If OTP couldn't be emailed (no email on file / new user),
      // switch to password-based login via CoCart
      if (!data.emailSent && data.hasAccount) {
        setOtpMeta({
          hasAccount: true,
          emailSent: false,
          maskedEmail: '',
          devCode: null,
          needsPassword: true,
        });
        setPhase('needs_password');
        return { sent: false, needsPassword: true, hasAccount: true };
      }

      // If it's a brand new user with no account and no email,
      // also route to password login (they'll need to register on WC first)
      if (!data.emailSent && !data.hasAccount) {
        setOtpMeta({
          hasAccount: false,
          emailSent: false,
          maskedEmail: '',
          devCode: null,
          needsPassword: true,
        });
        setPhase('needs_password');
        return { sent: false, needsPassword: true, hasAccount: false };
      }

      // OTP was emailed successfully — proceed with OTP verification
      setOtpMeta({
        hasAccount: data.hasAccount,
        emailSent: data.emailSent,
        maskedEmail: data.maskedEmail || '',
        devCode: data.devCode || null,
        needsPassword: false,
      });
      setPhase('otp_pending');
      return { sent: true, ...data };
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  }, []);

  // Step 2a: Verify OTP code → creates session
  const verifyOtp = useCallback(async (code) => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (!res.ok || !data.verified) {
        return { error: data.error || 'Invalid code', remaining: data.remaining, expired: data.expired, locked: data.locked };
      }

      // OTP verified successfully
      if (data.found && data.customer) {
        const session = {
          phone,
          name: [data.customer.first_name, data.customer.last_name].filter(Boolean).join(' '),
          landmark: data.customer.meta_data?.find(m => m.key === 'landmark_hint')?.value || data.customer.shipping?.address_1 || '',
          zone: data.customer.meta_data?.find(m => m.key === 'delivery_zone')?.value || '',
          email: data.customer.email || '',
          customerId: data.customer.id,
          needsDetails: !data.customer.first_name,
          verified: true,
          authMethod: 'otp',
        };
        setUser(session);
        writeSession(session);
        setPhase('authenticated');
        setOtpMeta(null);
        return { success: true, session };
      } else {
        // New customer — verified phone but no existing profile
        const session = {
          phone,
          name: '',
          landmark: '',
          zone: '',
          email: '',
          customerId: null,
          needsDetails: true,
          verified: true,
          authMethod: 'otp',
        };
        setUser(session);
        writeSession(session);
        setPhase('authenticated');
        setOtpMeta(null);
        return { success: true, session };
      }
    } catch {
      return { error: 'Verification failed. Please try again.' };
    }
  }, [phone]);

  // Step 2b: Login with phone + password via CoCart
  const loginWithPassword = useCallback(async (password) => {
    if (!phone) return { error: 'No phone number' };
    try {
      const res = await fetch('/api/cocart/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        return { error: data.error || 'Invalid phone number or password' };
      }

      const session = {
        ...data.session,
        phone: data.session.phone || phone,
      };
      setUser(session);
      writeSession(session);
      setPhase('authenticated');
      setOtpMeta(null);
      return { success: true, session };
    } catch {
      return { error: 'Login failed. Please try again.' };
    }
  }, [phone]);

  // Resend OTP
  const resendOtp = useCallback(async () => {
    if (!phone) return { error: 'No phone number' };
    return submitPhone(phone);
  }, [phone, submitPhone]);

  // Cancel OTP / password and go back to guest
  const cancelOtp = useCallback(() => {
    setPhone('');
    setOtpMeta(null);
    setPhase('guest');
  }, []);

  const completeProfileAtCheckout = useCallback(async (profileData) => {
    const { name, landmark, zone, zonePrice } = profileData;
    try {
      if (user?.customerId) {
        const updated = { ...user, name, landmark, zone, zonePrice: zonePrice || 0, needsDetails: false };
        setUser(updated);
        writeSession(updated);
        return updated;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, landmark, zone, zonePrice }),
      });
      const data = await res.json();
      const session = { phone, name, landmark, zone: zone || '', zonePrice: zonePrice || 0, email: '', customerId: data.customerId, needsDetails: false, verified: true };
      setUser(session);
      writeSession(session);
      return session;
    } catch {
      return null;
    }
  }, [phone, user]);

  const updateProfile = useCallback(async (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    writeSession(updated);
    return updated;
  }, [user]);

  const updateEmail = useCallback(async (email) => {
    const customerId = user?.customerId;
    if (!customerId || !email) return;
    const res = await fetch('/api/auth/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, customerId }),
    });
    if (!res.ok) throw new Error('Failed to update email');
    const updated = { ...user, email: email.trim().toLowerCase() };
    setUser(updated);
    writeSession(updated);
    return updated;
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    setPhone('');
    setOtpMeta(null);
    writeSession(null);
    setPhase('guest');
    // TODO(security): Consider calling CoCart /logout endpoint to invalidate server session
  }, []);

  return (
    <AuthContext.Provider value={{
      user, phase, phone, otpMeta,
      lookupPhone, submitPhone, verifyOtp, loginWithPassword,
      resendOtp, cancelOtp,
      completeProfileAtCheckout, updateProfile, updateEmail, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
