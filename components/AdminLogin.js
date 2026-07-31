'use client';

import { useState } from 'react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = '/admin';
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch {
      setError('Login failed. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f5f5dc' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
        style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(132,0,55,0.1)' }}>
            <svg className="w-7 h-7" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
            Admin Login
          </h1>
          <p className="text-xs mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
            LiquorDash Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-sm"
              style={{
                borderRadius: '12px',
                border: '2px solid #debfc3',
                padding: '10px 14px',
                boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                animation: 'pulse-border 2s ease-in-out infinite',
                fontFamily: 'Montserrat, sans-serif',
                color: '#191c1d',
              }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none text-sm"
              style={{
                borderRadius: '12px',
                border: '2px solid #debfc3',
                padding: '10px 14px',
                boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                animation: 'pulse-border 2s ease-in-out infinite',
                fontFamily: 'Montserrat, sans-serif',
                color: '#191c1d',
              }}
            />
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
