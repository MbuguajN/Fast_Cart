'use client';

import { useState, useRef, useEffect, useCallback, Component } from 'react';
import dynamic from 'next/dynamic';
import { reverseGeocodeViaProxy, searchAddressViaProxy } from '@/lib/geo-client';
import { matchZoneByKeywords, cleanAreaName } from '@/lib/zone-match-client';

const MapLocationPicker = dynamic(() => import('@/components/MapLocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-100">
      Loading map…
    </div>
  ),
});

function addressFromReverseGeocode(data) {
  const addr = data?.address || {};
  const neighbourhood = cleanAreaName(addr.neighbourhood);
  const suburb = cleanAreaName(addr.suburb);
  const parts = [];
  if (addr.road) parts.push(addr.road);
  if (neighbourhood && !suburb?.toLowerCase().includes(neighbourhood.toLowerCase())) parts.push(neighbourhood);
  if (suburb && suburb !== neighbourhood) parts.push(suburb);
  if (addr.city && !parts.some((p) => p.toLowerCase() === addr.city.toLowerCase())) parts.push(addr.city);
  if (parts.length > 0) return parts.join(', ');
  return (data?.display_name || '').split(',').slice(0, 4).map((s) => s.trim()).filter(Boolean).join(', ');
}

function feeFor(zone, location) {
  return location?.price ?? zone?.zonePrice ?? null;
}

export default function LocationModal({ currentLocation, onConfirm, onClose }) {
  const [step, setStep] = useState('pick'); // 'pick' -> 'zone' -> 'details'
  const [position, setPosition] = useState(
    currentLocation?.lat != null && currentLocation?.lng != null
      ? { lat: currentLocation.lat, lng: currentLocation.lng }
      : null
  );
  const [addressText, setAddressText] = useState(currentLocation?.text || '');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [expandedZone, setExpandedZone] = useState(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(currentLocation?.building || '');
  const [mapFailed, setMapFailed] = useState(false);

  const mapRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const geocodeTokenRef = useRef(0);

  useEffect(() => {
    fetch('/api/zones').then((r) => r.json()).then((d) => setZones(d.zones || [])).catch(() => {});
  }, []);

  // A fresh address (pin drop, search pick) always proposes a new zone
  // suggestion — any zone the customer had manually chosen for a previous
  // address no longer applies to this one.
  const applyAddress = useCallback((text, zonesList) => {
    setAddressText(text);
    setSuggestionDismissed(false);
    const list = zonesList || zones;
    const match = list.length > 0 ? matchZoneByKeywords(text, list) : null;
    setSelectedZone(match?.zone || null);
    setSelectedLocation(match?.location || null);
  }, [zones]);

  const handlePinMove = useCallback(async (lat, lng) => {
    setPosition({ lat, lng });
    setResolving(true);
    const token = ++geocodeTokenRef.current;
    try {
      const data = await reverseGeocodeViaProxy(lat, lng);
      if (token !== geocodeTokenRef.current) return; // a newer move superseded this one
      const text = data ? addressFromReverseGeocode(data) : '';
      if (text) applyAddress(text);
    } finally {
      if (token === geocodeTokenRef.current) setResolving(false);
    }
  }, [applyAddress]);

  const handleUseMyLocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.pick(latitude, longitude);
        handlePinMove(latitude, longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddressViaProxy(value.trim());
      setSearchResults(results);
      setSearching(false);
    }, 400);
  };

  const handlePickSearchResult = (result) => {
    setSearchQuery('');
    setSearchResults([]);
    mapRef.current?.pick(result.lat, result.lon);
    setPosition({ lat: result.lat, lng: result.lon });
    const shortLabel = result.label.split(',').slice(0, 4).join(',');
    applyAddress(shortLabel);
  };

  const handlePickZoneLocation = (zone, loc) => {
    setSelectedZone(zone);
    setSelectedLocation(loc);
    setSuggestionDismissed(true);
    setExpandedZone(null);
    if (!addressText) setAddressText(loc.name);
  };

  const fee = feeFor(selectedZone, selectedLocation);
  const hasZone = !!selectedZone;

  const handleSave = () => {
    if (step !== 'details') return;
    if (!addressText.trim() || !hasZone) return;
    onConfirm({
      text: addressText.trim(),
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      zone: selectedZone.name,
      zonePrice: fee,
      building: building.trim(),
    });
    onClose();
  };

  const stepTitles = {
    pick: 'Drop a pin on your exact building',
    zone: 'Confirm your delivery zone & fee',
    details: 'Add your building & house number',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <div className="flex items-start justify-between p-6 sm:p-7 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pink-50 text-[#840037] flex items-center justify-center shadow-xs shrink-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Delivery Location</h2>
              <p className="text-xs text-gray-500 font-medium">{stepTitles[step]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center font-bold text-xs transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-7 pb-2">
          {step === 'pick' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search for an area, street, or estate…"
                  className="w-full rounded-2xl px-4 py-3 text-sm border border-gray-200 focus:border-[#840037] focus:ring-2 focus:ring-[#840037]/10 focus:outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                />
                {searching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 rounded-full animate-spin border-gray-200 border-t-[#840037]" />
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1.5 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handlePickSearchResult(r)}
                        className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-pink-50 hover:text-[#840037] transition-colors border-b border-gray-50 last:border-0"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold text-[#840037] bg-pink-50 hover:bg-pink-100 transition-colors disabled:opacity-60"
              >
                {locating ? (
                  <>
                    <div className="w-3 h-3 border-2 rounded-full animate-spin border-pink-200 border-t-[#840037]" />
                    Finding you…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06z"/>
                    </svg>
                    Use My Current Location
                  </>
                )}
              </button>

              {/* Map */}
              {!mapFailed && (
                <div className="rounded-2xl overflow-hidden border border-gray-200 h-56 relative">
                  <ErrorBoundaryMap onError={() => setMapFailed(true)}>
                    <MapLocationPicker ref={mapRef} initialCenter={position} onMove={handlePinMove} />
                  </ErrorBoundaryMap>
                </div>
              )}

              {/* Resolved address preview */}
              {addressText && (
                <div className="rounded-2xl p-3 bg-gray-50 border border-gray-100 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#840037] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{resolving ? 'Locating…' : addressText}</p>
                    <p className="text-[11px] text-gray-400">Next, confirm your delivery zone and fee</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep('zone')}
                className="text-[11px] font-bold text-gray-400 hover:text-[#840037] underline decoration-dotted"
              >
                Skip the map — pick my delivery zone directly
              </button>
            </div>
          )}

          {step === 'zone' && (
            <div className="space-y-4">
              {addressText && (
                <div className="rounded-2xl p-3 bg-gray-50 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-900 truncate">{addressText}</p>
                  <button
                    type="button"
                    onClick={() => setStep('pick')}
                    className="text-[11px] font-bold text-[#840037] hover:underline mt-0.5"
                  >
                    ← Change pin
                  </button>
                </div>
              )}

              {selectedZone && !suggestionDismissed && (
                <div className="rounded-2xl p-3.5 bg-pink-50 border border-pink-200 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#840037] uppercase tracking-wide">Suggested zone</p>
                    <p className="text-xs font-semibold text-gray-900 mt-0.5">
                      {selectedLocation ? `${selectedLocation.name} — ${selectedZone.name}` : selectedZone.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSuggestionDismissed(true)}
                    className="shrink-0 text-[11px] font-bold text-gray-500 hover:text-gray-800"
                  >
                    Not this
                  </button>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                  {selectedZone ? 'Or choose a different zone' : 'Choose your delivery zone'}
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {zones.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">Loading zones…</p>
                  ) : (
                    zones.map((zone) => {
                      const isExpanded = expandedZone === zone.id;
                      const isZoneSelected = selectedZone?.id === zone.id || selectedZone?.name === zone.name;
                      return (
                        <div key={zone.id} className={`border rounded-xl overflow-hidden ${isZoneSelected ? 'border-[#840037]/40' : 'border-gray-200'}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-xs font-semibold text-gray-900 truncate">{zone.name}</span>
                            </div>
                            {isZoneSelected && !isExpanded && (
                              <span className="shrink-0 text-[10px] font-bold text-[#840037]">
                                {selectedLocation ? selectedLocation.name : 'Selected'}
                              </span>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-1.5 pt-1">
                              {(zone.locations || []).map((loc) => {
                                const isSelected = selectedZone?.name === zone.name && selectedLocation?.name === loc.name;
                                return (
                                  <button
                                    key={loc.name}
                                    type="button"
                                    onClick={() => handlePickZoneLocation(zone, loc)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                                      isSelected
                                        ? 'border-[#840037] bg-pink-50'
                                        : 'border-gray-200 hover:border-[#840037]/40 hover:bg-red-50/40'
                                    }`}
                                  >
                                    <span className="text-[11px] text-gray-800">{loc.name}</span>
                                    <span className="text-[11px] font-bold text-[#840037]">KSh {loc.price}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {hasZone ? (
                <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <svg className="w-6 h-6 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 4a1 1 0 000 2v9a2 2 0 002 2h1.05a2.5 2.5 0 004.9 0h3.1a2.5 2.5 0 004.9 0H20a1 1 0 001-1v-4a1 1 0 00-.29-.71l-3-3A1 1 0 0017 8h-1V5a1 1 0 00-1-1H3zm12 5V6h-1v4h4.586L17 8.414V9h-2z" />
                  </svg>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Estimated delivery</p>
                    <p className="text-sm font-black text-emerald-900">KSh {fee?.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 text-center py-1">
                  Pick a zone above to see your delivery fee.
                </p>
              )}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div className="rounded-2xl p-3.5 bg-gray-50 border border-gray-100">
                <p className="text-xs font-semibold text-gray-900">{addressText}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {selectedLocation ? `${selectedLocation.name} — ` : ''}{selectedZone?.name} · KSh {fee?.toLocaleString()} delivery
                </p>
                <button
                  type="button"
                  onClick={() => setStep('zone')}
                  className="text-[11px] font-bold text-[#840037] hover:underline mt-1.5"
                >
                  ← Change zone
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                  Building / House Number
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                  placeholder="e.g. Apex Apartments, House 4B"
                  className="w-full rounded-2xl px-4 py-3.5 text-sm border border-gray-200 focus:border-[#840037] focus:ring-2 focus:ring-[#840037]/10 focus:outline-none transition-all text-gray-900 placeholder-gray-400 font-medium"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  You can confirm this again at checkout if it changes.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 sm:p-7 pt-4">
          {step === 'pick' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('zone')}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md active:scale-95"
              >
                Continue
              </button>
            </>
          )}
          {step === 'zone' && (
            <>
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!hasZone}
                onClick={() => setStep('details')}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                Continue
              </button>
            </>
          )}
          {step === 'details' && (
            <>
              <button
                type="button"
                onClick={() => setStep('zone')}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-2xl py-3 text-xs font-bold text-white bg-[#840037] hover:bg-[#6b002c] transition-all shadow-md active:scale-95"
              >
                Save Address
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Leaflet touches the DOM directly; if a tile load or container measurement
 * throws, this keeps the rest of the modal (search, quick picks) usable
 * instead of taking down the whole dialog.
 */
class ErrorBoundaryMap extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
