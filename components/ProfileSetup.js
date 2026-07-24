'use client';

import { useState, useEffect } from 'react';
import { NEIGHBORHOODS } from '@/lib/products';

export default function ProfileSetup({ phone, onSubmit, onBack }) {
  const [name, setName] = useState('');
  const [landmark, setLandmark] = useState('');
  const [email, setEmail] = useState('');
  const [selectedHood, setSelectedHood] = useState('');
  const [gpsStatus, setGpsStatus] = useState('detecting');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      queueMicrotask(() => setGpsStatus('unavailable'));
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      if (active) queueMicrotask(() => setGpsStatus('timeout'));
    }, 3000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        clearTimeout(timeout);
        const { latitude, longitude } = position.coords;
        const text = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        queueMicrotask(() => {
          setLandmark(text);
          setGpsStatus('found');
        });
      },
      () => {
        if (!active) return;
        clearTimeout(timeout);
        queueMicrotask(() => setGpsStatus('unavailable'));
      },
      { timeout: 3000, enableHighAccuracy: false }
    );

    return () => { active = false; clearTimeout(timeout); };
  }, []);

  const handleSelectHood = (hood) => {
    setSelectedHood(hood);
    setLandmark(hood);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!landmark.trim()) {
      setError('Please enter your delivery location');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), landmark: landmark.trim(), email: email.trim() });
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ backgroundColor: '#f5f5dc' }}>
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 mb-6" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-sm font-semibold">Back</span>
        </button>

        <div className="rounded-2xl p-6 shadow-sm overflow-hidden" style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'rgba(132, 0, 55, 0.1)' }}>👋</div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Welcome, new friend!</h2>
              <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>We&apos;ll remember you for next time</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Your Name <span style={{ color: '#ba1a1a' }}>*</span>
              </label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. James Mwangi"
                className="w-full min-w-0 px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all box-border"
                style={{ backgroundColor: '#F1F3F5', borderColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }} />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Delivery Location / Landmark <span style={{ color: '#ba1a1a' }}>*</span>
              </label>
              <div className="relative">
                <input type="text" value={landmark} onChange={(e) => { setLandmark(e.target.value); setSelectedHood(''); setError(''); }}
                  placeholder={gpsStatus === 'detecting' ? 'Detecting location...' : 'e.g. Rose Ave near Yaya, Gate 4B'}
                  className="w-full min-w-0 px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all pr-10 box-border"
                  style={{ backgroundColor: '#F1F3F5', borderColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {gpsStatus === 'detecting' && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />}
                  {gpsStatus === 'found' && <span className="text-sm" style={{ color: '#4CAF50' }}>✓</span>}
                  {(gpsStatus === 'timeout' || gpsStatus === 'unavailable') && <span className="text-sm" style={{ color: '#8b7075' }}>📍</span>}
                </div>
              </div>
              {gpsStatus === 'detecting' && <p className="text-[11px] mt-1" style={{ color: '#8b7075' }}>Auto-detecting your GPS location...</p>}
              {gpsStatus === 'found' && <p className="text-[11px] mt-1" style={{ color: '#4CAF50' }}>Location detected! You can edit it below.</p>}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {NEIGHBORHOODS.map((hood) => (
                <button key={hood} type="button" onClick={() => handleSelectHood(hood)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{ backgroundColor: selectedHood === hood ? '#840037' : '#F1F3F5', color: selectedHood === hood ? '#ffffff' : '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                  {hood}
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                Email <span className="text-xs font-normal" style={{ color: '#8b7075' }}>(optional)</span>
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="james@example.com"
                className="w-full min-w-0 px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all box-border"
                style={{ backgroundColor: '#F1F3F5', borderColor: '#E9ECEF', color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }} />
            </div>

            {error && <p className="text-sm mb-3" style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}>{error}</p>}

            <button type="submit" disabled={loading || !name.trim() || !landmark.trim()}
              className="w-full py-4 rounded-xl text-base font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{ backgroundColor: '#840037', color: '#ffffff', fontFamily: 'Montserrat, sans-serif' }}>
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Setting up...
                </div>
              ) : "Let's Go!"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
