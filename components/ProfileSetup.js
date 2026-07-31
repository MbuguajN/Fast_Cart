'use client';

import { useState, useEffect } from 'react';

function normalizeAddress(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAreaName(text) {
  return text
    .replace(/\bward\b/gi, '')
    .replace(/\bdivision\b/gi, '')
    .replace(/\blocation\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,$/g, '')
    .trim();
}

function matchZone(neighbourhood, suburb, road, city, zones) {
  if (!zones.length) return null;

  const tryMatch = (text) => {
    if (!text) return null;
    const normalized = normalizeAddress(text);
    let bestZone = null;
    let bestLocation = null;
    let bestScore = 0;

    for (const zone of zones) {
      for (const loc of zone.locations || []) {
        let score = 0;
        for (const kw of loc.keywords) {
          if (normalized.includes(kw)) {
            score += kw.length;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestZone = zone;
          bestLocation = loc;
        }
      }
    }

    return bestZone ? { zone: bestZone, location: bestLocation, score: bestScore } : null;
  };

  const cleanN = cleanAreaName(neighbourhood || '');
  const cleanS = cleanAreaName(suburb || '');

  let r = tryMatch(cleanN);
  if (r && r.score >= 2) return r;

  r = tryMatch(cleanS);
  if (r && r.score >= 2) return r;

  r = tryMatch(`${cleanN} ${cleanS}`);
  if (r && r.score >= 2) return r;

  r = tryMatch(`${road || ''} ${cleanN} ${city || ''}`);
  if (r && r.score >= 2) return r;

  return null;
}

export default function ProfileSetup({ phone, onSubmit, onBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationText, setLocationText] = useState('');
  const [step, setStep] = useState('detecting');
  const [expandedZone, setExpandedZone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/zones')
      .then((r) => r.json())
      .then((data) => {
        queueMicrotask(() => {
          setZones(data.zones || []);
          setZonesLoading(false);
        });
      })
      .catch(() => {
        queueMicrotask(() => setZonesLoading(false));
      });
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator) || zones.length === 0) {
      queueMicrotask(() => setStep('browse_zones'));
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      if (active) queueMicrotask(() => setStep('browse_zones'));
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) return;
        clearTimeout(timeout);
        const { latitude, longitude } = position.coords;

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
          headers: { 'User-Agent': 'LiquorDash/1.0' },
        })
          .then((r) => r.json())
          .then((data) => {
            if (!active) return;
            const addr = data.address;
            const parts = [];

            const road = addr.road || '';
            const neighbourhood = addr.neighbourhood || '';
            const suburb = addr.suburb || '';
            const city = addr.city || addr.town || addr.village || '';
            const county = addr.county || '';

            if (road) parts.push(road);
            if (neighbourhood && !suburb.toLowerCase().includes(neighbourhood.toLowerCase())) parts.push(neighbourhood);
            if (suburb && suburb !== neighbourhood) parts.push(suburb);
            if (city && !parts.some(p => p.toLowerCase() === city.toLowerCase())) parts.push(city);
            if (county && !parts.some(p => p.toLowerCase() === county.toLowerCase())) parts.push(county);

            let text = parts.length > 0 ? parts.join(', ') : '';

            if (!text && data.display_name) {
              text = data.display_name.split(',').slice(0, 5).map(s => s.trim()).filter(Boolean).join(', ');
            }

            const matched = matchZone(
              addr.neighbourhood,
              addr.suburb,
              addr.road,
              addr.city || addr.town,
              zones
            );

            queueMicrotask(() => {
              setLocationText(text);
              if (matched) {
                setSelectedZone(matched.zone);
                setSelectedLocation(matched.location);
                setStep('zone_matched');
              } else {
                setStep('browse_zones');
              }
            });
          })
          .catch(() => {
            if (!active) return;
            queueMicrotask(() => setStep('browse_zones'));
          });
      },
      () => {
        if (!active) return;
        clearTimeout(timeout);
        queueMicrotask(() => setStep('browse_zones'));
      },
      { timeout: 5000, enableHighAccuracy: false }
    );

    return () => { active = false; clearTimeout(timeout); };
  }, [zones]);

  const handleLocationPick = (zone, loc) => {
    setSelectedZone(zone);
    setSelectedLocation(loc);
    setLocationText(loc.name);
    setStep('ready');
  };

  const deliveryPrice = selectedLocation?.price ?? selectedZone?.zonePrice ?? 300;
  const canSubmit = name.trim() && locationText.trim() && selectedZone;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        landmark: locationText.trim(),
        email: email.trim(),
        zone: selectedZone.name,
        zonePrice: deliveryPrice,
      });
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: '#840037', height: '100dvh', maxHeight: '100dvh' }}>
      {/* Header with back button */}
      <header className="flex-shrink-0 w-full px-6 pt-8 pb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-white font-semibold hover:opacity-80 transition-opacity" style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 'clamp(13px, 3.5vw, 15px)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
      </header>

      {/* Main Content */}
      <main
        className="flex-1 w-full bg-white flex flex-col overflow-y-auto"
        style={{ borderRadius: 'clamp(20px, 5vw, 32px) clamp(20px, 5vw, 32px) 0 0' }}
      >
        <div className="w-full flex flex-col flex-1" style={{ padding: 'clamp(20px, 5vh, 32px) clamp(20px, 5vw, 24px) clamp(16px, 3vh, 24px)' }}>
          {/* Welcome */}
          <div className="flex items-start gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#edeeef' }}
            >
              <span className="text-2xl">👋</span>
            </div>
            <div>
              <h2
                className="text-xl font-bold tracking-tight mb-0.5"
                style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}
              >
                Welcome, new friend!
              </h2>
              <p
                className="text-sm"
                style={{ color: '#574145', fontFamily: 'Montserrat, sans-serif' }}
              >
                We&apos;ll remember you for next time
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col" style={{ gap: 'clamp(16px, 4vh, 24px)' }}>
            {/* Name */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}
              >
                Your Name <span style={{ color: '#ba1a1a' }}>*</span>
              </label>
              <div className="relative" style={{ height: 'clamp(48px, 12vw, 56px)' }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(''); }}
                  placeholder="e.g. James Mwangi"
                  className="w-full h-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none"
                  style={{
                    borderRadius: '12px',
                    border: '2px solid #debfc3',
                    padding: '0 clamp(10px, 2.5vw, 16px)',
                    boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                    animation: 'pulse-border 2s ease-in-out infinite',
                    color: '#191c1d',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                />
              </div>
            </div>

            {/* Delivery Location */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}
              >
                Delivery Location <span style={{ color: '#ba1a1a' }}>*</span>
              </label>

              {step === 'detecting' && (
                    <div
                      className="flex items-center gap-3 bg-white"
                      style={{ height: 'clamp(48px, 12vw, 56px)', borderRadius: '12px', border: '2px solid #debfc3', padding: '0 clamp(10px, 2.5vw, 16px)', boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)', animation: 'pulse-border 2s ease-in-out infinite' }}
                    >
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
                  <span className="text-sm" style={{ color: '#574145', fontFamily: 'Montserrat, sans-serif' }}>Detecting your location...</span>
                </div>
              )}

              {step === 'zone_matched' && selectedZone && (
                <>
                  <div
                    className="flex items-center justify-between px-4 border"
                    style={{
                      height: 'clamp(56px, 14vw, 64px)',
                      backgroundColor: 'rgba(174, 242, 194, 0.2)',
                      borderColor: '#aef2c2',
                      borderRadius: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#004b29' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#004b29', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>
                          {selectedLocation?.name || selectedZone.name}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,75,41,0.8)', fontFamily: 'Montserrat, sans-serif' }}>
                          {selectedZone.name} Zone
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#004b29', fontFamily: 'Montserrat, sans-serif' }}>
                      KSh {deliveryPrice}
                    </span>
                  </div>
                  <div className="relative mt-2" style={{ height: 'clamp(48px, 12vw, 56px)' }}>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => { setLocationText(e.target.value); setError(''); }}
                      placeholder="Your address"
                      className="w-full h-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none"
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #debfc3',
                        padding: '0 clamp(10px, 2.5vw, 16px)',
                        boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                        animation: 'pulse-border 2s ease-in-out infinite',
                        color: '#191c1d',
                        fontFamily: 'Montserrat, sans-serif',
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => { setSelectedZone(null); setSelectedLocation(null); setStep('browse_zones'); }}
                    className="text-sm font-semibold mt-2 hover:underline"
                    style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                    Not your location?
                  </button>
                </>
              )}

              {step === 'browse_zones' && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {zonesLoading ? (
                    <div
                      className="flex items-center gap-3 bg-white"
                      style={{ height: 'clamp(48px, 12vw, 56px)', borderRadius: '12px', border: '2px solid #debfc3', padding: '0 clamp(10px, 2.5vw, 16px)', boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)', animation: 'pulse-border 2s ease-in-out infinite' }}
                    >
                      <span className="text-sm" style={{ color: '#574145', fontFamily: 'Montserrat, sans-serif' }}>Loading zones...</span>
                    </div>
                  ) : zones.length === 0 ? (
                    <div
                      className="flex items-center gap-3 bg-white"
                      style={{ height: 'clamp(48px, 12vw, 56px)', borderRadius: '12px', border: '2px solid #debfc3', padding: '0 clamp(10px, 2.5vw, 16px)', boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)', animation: 'pulse-border 2s ease-in-out infinite' }}
                    >
                      <span className="text-sm" style={{ color: '#574145', fontFamily: 'Montserrat, sans-serif' }}>No delivery zones available</span>
                    </div>
                  ) : (
                    zones.map((zone) => {
                      const isExpanded = expandedZone === zone.id;
                      return (
                        <div key={zone.id} className="border overflow-hidden" style={{ borderColor: '#debfc3', borderRadius: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                            className="w-full flex items-center justify-between px-4 hover:bg-gray-50 transition-all text-left"
                            style={{ height: 'clamp(48px, 12vw, 56px)' }}
                          >
                            <div className="flex items-center gap-2">
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#574145' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-sm font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>{zone.name}</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-1.5">
                              {zone.locations.map((loc) => (
                                <button
                                  key={loc.name}
                                  type="button"
                                  onClick={() => handleLocationPick(zone, loc)}
                                  className="w-full flex items-center justify-between px-4 border hover:border-[#840037]/40 hover:bg-red-50/50 transition-all text-left"
                                  style={{ height: 'clamp(44px, 11vw, 52px)', borderColor: '#E9ECEF', borderRadius: '8px' }}
                                >
                                  <span className="text-sm" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{loc.name}</span>
                                  <span className="text-sm font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>KSh {loc.price}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {step === 'ready' && selectedZone && (
                <>
                  <div
                    className="flex items-center justify-between px-4 border"
                    style={{
                      height: 'clamp(56px, 14vw, 64px)',
                      backgroundColor: 'rgba(174, 242, 194, 0.2)',
                      borderColor: '#aef2c2',
                      borderRadius: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#004b29' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#004b29', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}>
                          {selectedLocation?.name || selectedZone.name}
                        </div>
                        <div className="text-xs" style={{ color: 'rgba(0,75,41,0.8)', fontFamily: 'Montserrat, sans-serif' }}>
                          {selectedZone.name} Zone
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#004b29', fontFamily: 'Montserrat, sans-serif' }}>
                      KSh {deliveryPrice}
                    </span>
                  </div>
                  <div className="relative mt-2" style={{ height: 'clamp(48px, 12vw, 56px)' }}>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => { setLocationText(e.target.value); setError(''); }}
                      placeholder="Confirm your address"
                      className="w-full h-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none"
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #debfc3',
                        padding: '0 clamp(10px, 2.5vw, 16px)',
                        boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                        animation: 'pulse-border 2s ease-in-out infinite',
                        color: '#191c1d',
                        fontFamily: 'Montserrat, sans-serif',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-end mt-2">
                    <button type="button" onClick={() => { setSelectedZone(null); setSelectedLocation(null); setStep('browse_zones'); }}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                      Not your location?
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                className="block text-sm font-semibold mb-1.5"
                style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.05em' }}
              >
                Email <span className="font-normal" style={{ color: '#574145' }}>(optional)</span>
              </label>
              <div className="relative" style={{ height: 'clamp(48px, 12vw, 56px)' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="james@example.com"
                  className="w-full h-full bg-white border-none focus:ring-0 focus:outline-none transition-all outline-none"
                  style={{
                    borderRadius: '12px',
                    border: '2px solid #debfc3',
                    padding: '0 clamp(10px, 2.5vw, 16px)',
                    boxShadow: '0 0 8px rgba(132,0,55,0.15), 0 0 20px rgba(132,0,55,0.08)',
                    animation: 'pulse-border 2s ease-in-out infinite',
                    color: '#191c1d',
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* Error */}
            {error && (
              <p className="text-sm text-center" style={{ color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: 'clamp(48px, 12vw, 56px)',
                backgroundColor: canSubmit ? '#840037' : 'rgba(132, 0, 55, 0.6)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 'clamp(14px, 3.8vw, 16px)',
                borderRadius: 0,
              }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Setting up...
                </div>
              ) : (
                <span>Let&apos;s Go!</span>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
