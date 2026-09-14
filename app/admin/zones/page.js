'use client';

import { useState, useEffect, useCallback } from 'react';
import { ZONE_MAP } from '@/lib/zone-map';

const FALLBACK_ZONE_COUNT = Object.keys(ZONE_MAP).length;

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Mirrors lib/shipping.js#normalizeAddress so admin-entered names match the same way a customer's address does. */
function normalizeKeyword(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZonePrice, setNewZonePrice] = useState(300);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zones');
      const data = await res.json();
      queueMicrotask(() => {
        setZones(data.zones || []);
        setUsingFallback(!!data.usingFallback);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLoadDefaults = async () => {
    if (zones.length > 0 && !confirm('This replaces every zone below with the rate-card defaults. Continue?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToDefaults: true }),
      });
      const data = await res.json();
      setZones(data.zones || []);
      setUsingFallback(false);
    } finally {
      setLoading(false);
    }
  };

  const updateZoneField = (id, field, value) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, [field]: value } : z)));
  };

  const updateLocation = (zoneId, idx, field, value) => {
    setZones((prev) => prev.map((z) => {
      if (z.id !== zoneId) return z;
      const locations = z.locations.map((loc, i) => (i === idx ? { ...loc, [field]: value } : loc));
      return { ...z, locations };
    }));
  };

  const addLocation = (zoneId) => {
    setZones((prev) => prev.map((z) => (z.id === zoneId
      ? { ...z, locations: [...z.locations, { name: '', keywords: [], price: z.zonePrice || 300 }] }
      : z)));
  };

  const removeLocation = (zoneId, idx) => {
    setZones((prev) => prev.map((z) => (z.id === zoneId
      ? { ...z, locations: z.locations.filter((_, i) => i !== idx) }
      : z)));
  };

  const saveZone = async (zone) => {
    setSavingId(zone.id);
    try {
      const locations = zone.locations
        .filter((l) => l.name.trim())
        .map((l) => ({
          name: l.name.trim(),
          price: Number(l.price) || Number(zone.zonePrice) || 300,
          keywords: [normalizeKeyword(l.name)],
        }));
      const res = await fetch('/api/admin/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: zone.id,
          name: zone.name.trim(),
          zonePrice: Number(zone.zonePrice) || 300,
          locations,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      await load();
    } catch (err) {
      alert(err.message || 'Failed to save zone');
    } finally {
      setSavingId(null);
    }
  };

  const deleteZoneRow = async (id) => {
    if (!confirm('Delete this entire zone and all its locations?')) return;
    await fetch(`/api/admin/zones?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      const res = await fetch('/api/admin/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slugify(newZoneName),
          name: newZoneName.trim(),
          zonePrice: Number(newZonePrice) || 300,
          locations: [],
        }),
      });
      if (!res.ok) throw new Error('Failed to create zone');
      setShowAddZone(false);
      setNewZoneName('');
      setNewZonePrice(300);
      load();
    } catch (err) {
      alert(err.message || 'Failed to create zone');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Delivery Zones
          </h1>
          <p className="text-xs text-gray-500 max-w-2xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            Manually-priced delivery zones and per-location fees. This table is what customers see when they set their
            delivery location and at checkout. When it&apos;s empty, the storefront falls back to the built-in rate card.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadDefaults}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            {usingFallback ? 'Load Rate Card Into This Table' : 'Reset to Rate Card Defaults'}
          </button>
          <button
            onClick={() => setShowAddZone(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:bg-[#6b002c] transition-all cursor-pointer"
            style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
          >
            + Add Zone
          </button>
        </div>
      </div>

      {usingFallback && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          <span>⚠️</span>
          <span>
            No zones have been synced from WooCommerce or edited here yet — the storefront is currently using the
            built-in rate-card fallback ({FALLBACK_ZONE_COUNT} zones). Click <strong>Load Rate Card Into This Table</strong> to
            start editing it, or wait for the next WooCommerce sync.
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse bg-gray-200" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-600" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            No zones configured yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {zones.map((zone) => (
            <div key={zone.id} className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={zone.name}
                  onChange={(e) => updateZoneField(zone.id, 'name', e.target.value)}
                  className="text-sm font-bold text-gray-900 border border-transparent hover:border-gray-200 focus:border-[#840037] rounded-lg px-2 py-1 flex-1 min-w-[160px]"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                />
                <div className="flex items-center gap-1.5 text-xs text-gray-500" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  <span>Default fee KSh</span>
                  <input
                    type="number"
                    value={zone.zonePrice}
                    onChange={(e) => updateZoneField(zone.id, 'zonePrice', e.target.value)}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-900"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{zone.id}</span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => saveZone(zone)}
                    disabled={savingId === zone.id}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {savingId === zone.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => deleteZoneRow(zone.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    Delete Zone
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {zone.locations.map((loc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={loc.name}
                      onChange={(e) => updateLocation(zone.id, idx, 'name', e.target.value)}
                      placeholder="Location / estate name"
                      className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      <span>KSh</span>
                      <input
                        type="number"
                        value={loc.price}
                        onChange={(e) => updateLocation(zone.id, idx, 'price', e.target.value)}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-900"
                      />
                    </div>
                    <button
                      onClick={() => removeLocation(zone.id, idx)}
                      className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove location"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addLocation(zone.id)}
                  className="text-[11px] font-bold text-[#840037] hover:underline"
                >
                  + Add location
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleAddZone}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                New Delivery Zone
              </h2>
              <button type="button" onClick={() => setShowAddZone(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer">
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Zone Name</label>
              <input
                type="text"
                required
                autoFocus
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="e.g. Outer Ring Road"
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Default Delivery Fee (KSh)</label>
              <input
                type="number"
                value={newZonePrice}
                onChange={(e) => setNewZonePrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-sm"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button type="button" onClick={() => setShowAddZone(false)} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] shadow-sm cursor-pointer">
                Create Zone
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
