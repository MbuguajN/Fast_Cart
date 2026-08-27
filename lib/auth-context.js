'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Client-side auth state.
 *
 * The server is the only authority on who is signed in. This context holds a
 * cached copy of `/api/auth/session` for rendering; it is never the proof of
 * anything. Nothing is read back out of storage to establish identity — the
 * previous version restored `{ verified: true, customerId }` straight from
 * localStorage, which meant editing one key logged you in as any customer.
 *
 * The session itself lives in an httpOnly cookie that JavaScript cannot read
 * or forge.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Phases: loading | guest | otp_pending | needs_password | authenticated
  const [phase, setPhase] = useState('loading');
  const [phone, setPhone] = useState('');
  const [otpMeta, setOtpMeta] = useState(null);

  /** Ask the server who we are. The only thing that can set `authenticated`. */
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      const data = await res.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setPhone(data.user.phone || '');
        setPhase('authenticated');
        return data.user;
      }
    } catch {
      // Network failure — fall through to guest rather than trusting a cache.
    }

    setUser(null);
    setPhase('guest');
    return null;
  }, []);

  useEffect(() => {
    // Nothing is restored from local storage. `phase` stays 'loading' until
    // the server answers, so the UI never renders a signed-in state that the
    // server has not confirmed.
    refreshSession();
  }, [refreshSession]);

  const lookupPhone = useCallback(async (phoneNumber) => {
    const res = await fetch('/api/auth/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneNumber }),
    });
    return res.json();
  }, []);

  // Step 1: submit phone → triggers OTP send
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

      // No deliverable email on file — fall back to password login via CoCart.
      if (!data.emailSent) {
        setOtpMeta({
          hasAccount: Boolean(data.hasAccount),
          emailSent: false,
          maskedEmail: '',
          devCode: null,
          needsPassword: true,
        });
        setPhase('needs_password');
        return { sent: false, needsPassword: true, hasAccount: Boolean(data.hasAccount) };
      }

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

  // Step 2a: verify OTP → server sets the session cookie
  const verifyOtp = useCallback(async (code) => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();

      if (!res.ok || !data.verified) {
        return {
          error: data.error || 'Invalid code',
          remaining: data.remaining,
          expired: data.expired,
          locked: data.locked,
        };
      }

      setOtpMeta(null);
      // Re-read from the server rather than assembling a session locally.
      const session = await refreshSession();
      return { success: true, session };
    } catch {
      return { error: 'Verification failed. Please try again.' };
    }
  }, [phone, refreshSession]);

  // Step 2b: phone + password via CoCart
  const loginWithPassword = useCallback(async (password) => {
    if (!phone) return { error: 'No phone number' };
    try {
      const res = await fetch('/api/cocart/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        return { error: data.error || 'Invalid phone number or password' };
      }

      setOtpMeta(null);
      const session = await refreshSession();
      return { success: true, session };
    } catch {
      return { error: 'Login failed. Please try again.' };
    }
  }, [phone, refreshSession]);

  const resendOtp = useCallback(async () => {
    if (!phone) return { error: 'No phone number' };
    return submitPhone(phone);
  }, [phone, submitPhone]);

  const cancelOtp = useCallback(() => {
    setPhone('');
    setOtpMeta(null);
    setPhase('guest');
  }, []);

  const completeProfileAtCheckout = useCallback(async (profileData) => {
    const { name, landmark, zone, zonePrice } = profileData;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, landmark, zone }),
      });

      if (!res.ok) return null;

      // The server re-issues the session with the new customer ID.
      const session = await refreshSession();
      return session ? { ...session, zonePrice: zonePrice || 0 } : null;
    } catch {
      return null;
    }
  }, [refreshSession]);

  /**
   * Local-only profile edit (delivery landmark, zone) for the current render.
   * Anything that must persist goes through an API route and a refreshSession.
   */
  const updateProfile = useCallback(async (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    return updated;
  }, [user]);

  /**
   * Email changes are a two-step flow: the first call sends a code to the new
   * address, the second commits it.
   */
  const updateEmail = useCallback(async (email, code) => {
    const res = await fetch('/api/auth/update-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(code ? { email, code } : { email }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update email');

    if (data.verificationSent) {
      return { verificationSent: true, email: data.email };
    }

    await refreshSession();
    return { success: true, email: data.email };
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      // Clear locally regardless; the cookie expires server-side either way.
    }
    setUser(null);
    setPhone('');
    setOtpMeta(null);
    setPhase('guest');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, phase, phone, otpMeta,
      lookupPhone, submitPhone, verifyOtp, loginWithPassword,
      resendOtp, cancelOtp, refreshSession,
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
