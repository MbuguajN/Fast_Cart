'use client';

import { createContext, useContext, useState, useCallback, useSyncExternalStore } from 'react';

const AuthContext = createContext(null);
const STORAGE_KEY = 'liquordash_session';

let cachedRaw = undefined;
let cachedSnapshot = undefined;

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    cachedSnapshot = raw ? JSON.parse(raw) : null;
    return cachedSnapshot;
  } catch {
    return null;
  }
}

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return null;
}

function writeSession(session) {
  cachedRaw = undefined;
  cachedSnapshot = undefined;
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const saved = useSyncExternalStore(subscribe, readSession, getServerSnapshot);

  const [user, setUser] = useState(saved);
  const [phase, setPhase] = useState(saved?.phone ? 'authenticated' : 'entry');
  const [phone, setPhone] = useState(saved?.phone || '');

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
    const { name, landmark, email } = profileData;
    setPhase('loading');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, landmark, email }),
      });
      const data = await res.json();
      const session = { phone, name, landmark, email: email || '', customerId: data.customerId };
      setUser(session);
      writeSession(session);
      setPhase('authenticated');
      return session;
    } catch {
      setPhase('profile_setup');
      return null;
    }
  }, [phone]);

  const logout = useCallback(() => {
    setUser(null);
    writeSession(null);
    setPhase('entry');
  }, []);

  return (
    <AuthContext.Provider value={{ user, phase, phone, submitPhone, completeProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
