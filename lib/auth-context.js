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
  const [phase, setPhase] = useState('loading');
  const [phone, setPhone] = useState('');

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

  const submitPhone = useCallback(async (phoneNumber) => {
    setPhone(phoneNumber);
    try {
      const result = await lookupPhone(phoneNumber);
      if (result.found) {
        const session = {
          phone: phoneNumber,
          name: [result.customer.first_name, result.customer.last_name].filter(Boolean).join(' '),
          landmark: result.customer.meta_data?.find(m => m.key === 'landmark_hint')?.value || result.customer.shipping?.address_1 || '',
          zone: result.customer.meta_data?.find(m => m.key === 'delivery_zone')?.value || '',
          email: result.customer.email || '',
          customerId: result.customer.id,
          needsDetails: !result.customer.first_name,
        };
        setUser(session);
        writeSession(session);
        setPhase('authenticated');
        return session;
      } else {
        const session = {
          phone: phoneNumber,
          name: '',
          landmark: '',
          zone: '',
          email: '',
          customerId: null,
          needsDetails: true,
        };
        setUser(session);
        writeSession(session);
        setPhase('authenticated');
        return session;
      }
    } catch {
      return null;
    }
  }, [lookupPhone]);

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
      const session = { phone, name, landmark, zone: zone || '', zonePrice: zonePrice || 0, email: '', customerId: data.customerId, needsDetails: false };
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
    writeSession(null);
    setPhase('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ user, phase, phone, lookupPhone, submitPhone, completeProfileAtCheckout, updateProfile, updateEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
