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
      setPhase('entry');
    }
  }, []);

  const submitPhone = useCallback(async (phoneNumber) => {
    setPhone(phoneNumber);
    setPhase('loading');
    try {
      const res = await fetch('/api/auth/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      const result = await res.json();
      if (result.found) {
        const session = {
          phone: phoneNumber,
          name: [result.customer.first_name, result.customer.last_name].filter(Boolean).join(' '),
          landmark: result.customer.meta_data?.find(m => m.key === 'landmark_hint')?.value || result.customer.shipping?.address_1 || '',
          email: result.customer.email || '',
          customerId: result.customer.id,
        };
        setUser(session);
        writeSession(session);
        setPhase('authenticated');
      } else {
        setPhase('profile_setup');
      }
    } catch {
      setPhase('entry');
    }
  }, []);

  const completeProfile = useCallback(async (profileData) => {
    const { name, landmark, email, zone, zonePrice } = profileData;
    setPhase('loading');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, landmark, email, zone, zonePrice }),
      });
      const data = await res.json();
      const session = { phone, name, landmark, email: email || '', zone: zone || '', zonePrice: zonePrice || 0, customerId: data.customerId };
      setUser(session);
      writeSession(session);
      setPhase('authenticated');
      return session;
    } catch {
      setPhase('profile_setup');
      return null;
    }
  }, [phone]);

  const resetToEntry = useCallback(() => {
    setPhase('entry');
    setPhone('');
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    writeSession(updated);
    return updated;
  }, [user]);

  const logout = useCallback(() => {
    setUser(null);
    writeSession(null);
    setPhase('entry');
  }, []);

  return (
    <AuthContext.Provider value={{ user, phase, phone, submitPhone, completeProfile, resetToEntry, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
