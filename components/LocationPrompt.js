'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function LocationPrompt({ onDismiss, onUpdate }) {
  const { user } = useAuth();
  const [gpsZone, setGpsZone] = useState(null);
  const [gpsLocation, setGpsLocation] = useState('');
  const [checking, setChecking] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setChecking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
          headers: { 'User-Agent': 'LiquorDash/1.0' },
        })
          .then((r) => r.json())
          .then(async (data) => {
            const addr = data.address;
            const parts = [];
            if (addr.road) parts.push(addr.road);
            if (addr.neighbourhood) parts.push(addr.neighbourhood);
            if (addr.suburb) parts.push(addr.suburb);
            if (addr.city || addr.town) parts.push(addr.city || addr.town);
            const text = parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 4).join(', ') || '';

            const zonesRes = await fetch('/api/zones');
            const zonesData = await zonesRes.json();
            const zones = zonesData.zones || [];

            const normalized = text.toLowerCase();
            let matched = null;
            for (const zone of zones) {
              for (const loc of zone.locations || []) {
                for (const kw of loc.keywords) {
                  if (normalized.includes(kw)) {
                    matched = { zone, location: loc };
                    break;
                  }
                }
                if (matched) break;
              }
              if (matched) break;
            }

            setGpsLocation(text);
            setGpsZone(matched);
            setChecking(false);
          })
          .catch(() => setChecking(false));
      },
      () => setChecking(false),
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  const savedZone = user?.zone || '';
  const currentZone = gpsZone?.zone?.name || '';
  const isDifferent = currentZone && savedZone && currentZone !== savedZone;

  if (checking) return null;
  if (!isDifferent) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    const zonePrice = gpsZone?.location?.price ?? gpsZone?.zone?.zonePrice ?? 300;
    try {
      await onUpdate({
        zone: currentZone,
        zonePrice,
        landmark: gpsLocation,
      });
    } catch {}
    setUpdating(false);
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: '#ffffff', border: '1px solid #E9ECEF' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(132,0,55,0.1)' }}>
            <svg className="w-5 h-5" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
              Location Changed
            </p>
            <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              We detected you&apos;re in a different area
            </p>
          </div>
        </div>

        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#F1F3F5' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Current zone</span>
          </div>
          <p className="text-sm font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>{currentZone}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>{gpsLocation}</p>
        </div>

        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#F1F3F5' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Saved zone</span>
          </div>
          <p className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{savedZone}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#F1F3F5', color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}
          >
            Keep Current
          </button>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
          >
            {updating ? 'Updating...' : 'Update Zone'}
          </button>
        </div>
      </div>
    </div>
  );
}
