'use client';

import { useState, useEffect, useRef } from 'react';
import { haptic } from '@/lib/haptic';

function matchZoneByKeywords(text, zones) {
  const normalized = text.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  let bestZone = null;
  let bestLocation = null;
  let bestScore = 0;
  for (const zone of zones) {
    for (const loc of zone.locations || []) {
      let score = 0;
      for (const kw of loc.keywords) {
        if (normalized.includes(kw)) score += kw.length;
      }
      if (score > bestScore) { bestScore = score; bestZone = zone; bestLocation = loc; }
    }
  }
  return bestScore >= 2 ? { zone: bestZone, location: bestLocation, address: text } : null;
}

function reverseGeocode(lat, lon) {
  return fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
    headers: { 'User-Agent': 'LiquorDash/1.0' },
  }).then(r => r.json()).then(data => {
    const addr = data.address || {};
    const parts = [];
    if (addr.road) parts.push(addr.road);
    if (addr.neighbourhood && !addr.suburb?.toLowerCase().includes(addr.neighbourhood.toLowerCase())) parts.push(addr.neighbourhood);
    if (addr.suburb && addr.suburb !== addr.neighbourhood) parts.push(addr.suburb);
    if (addr.city && !parts.some(p => p.toLowerCase() === addr.city.toLowerCase())) parts.push(addr.city);
    const text = parts.length > 0 ? parts.join(', ') : (data.display_name || '').split(',').slice(0, 5).map(s => s.trim()).filter(Boolean).join(', ');
    return { text, raw: addr };
  });
}

export default function CheckoutModal({ cart, products, user, locationData, onClose, onOrderSuccess, onRemoveItem, onCompleteProfile, onLookupPhone, onUpdateLocation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('confirm');
  const [buildingName, setBuildingName] = useState('');
  const [userName, setUserName] = useState(user?.name || '');
  const [userPhone, setUserPhone] = useState(user?.phone || '');
  const [phoneLookupDone, setPhoneLookupDone] = useState(!!user?.phone);
  const [looking, setLooking] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.landmark || locationData?.text || '');
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [zones, setZones] = useState([]);
  const [expandedZone, setExpandedZone] = useState(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsAddress, setGpsAddress] = useState('');
  const [gpsMatch, setGpsMatch] = useState(null);
  const [locationMismatch, setLocationMismatch] = useState(false);
  const hasRestoredRef = useRef(false);

  // Load zones
  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(d => setZones(d.zones || [])).catch(() => {});
  }, []);

  // Restore saved zone from session
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (zones.length === 0) return;
    if (!user?.zone && !user?.landmark) {
      fireGps();
      hasRestoredRef.current = true;
      return;
    }
    if (user?.zone) {
      const match = zones.find(z => z.name === user.zone);
      if (match) {
        setSelectedZone(match);
        if (user.landmark) {
          setDeliveryAddress(user.landmark);
          const landmarkLower = user.landmark.toLowerCase();
          const matchedLoc = match.locations?.find(loc =>
            loc.keywords?.some(kw => landmarkLower.includes(kw))
          );
          setSelectedLocation(matchedLoc || null);
        }
      }
    }
    hasRestoredRef.current = true;
  }, [zones, user?.zone, user?.landmark]);

  const fireGps = () => {
    if (!('geolocation' in navigator)) return;
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { text, raw } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setGpsAddress(text);
          if (zones.length > 0) {
            const matched = matchZoneByKeywords(text, zones);
            if (matched) {
              setGpsMatch(matched);
              if (selectedZone && selectedZone.name !== matched.zone.name) {
                setLocationMismatch(true);
              } else if (!selectedZone) {
                setSelectedZone(matched.zone);
                setSelectedLocation(matched.location);
                setDeliveryAddress(matched.address);
                if (onUpdateLocation) {
                  onUpdateLocation({ landmark: matched.address, zone: matched.zone.name, zonePrice: matched.location.price ?? matched.zone.zonePrice });
                }
              }
            }
          }
        } catch {
          // Geocode failed
        } finally {
          setDetectingGps(false);
        }
      },
      () => setDetectingGps(false),
      { timeout: 8000 }
    );
  };

  const handlePhoneLookup = async () => {
    if (!userPhone || userPhone.length < 10) return;
    setLooking(true);
    setError('');
    try {
      const data = await onLookupPhone(userPhone);
      setPhoneLookupDone(true);
      if (data?.found && data?.user) {
        if (data.user.name) setUserName(data.user.name);
        if (data.user.landmark) setDeliveryAddress(data.user.landmark);
        if (data.user.zone && zones.length > 0) {
          const match = zones.find(z => z.name === data.user.zone);
          if (match) {
            setSelectedZone(match);
            if (data.user.landmark) {
              const matchedLoc = match.locations?.find(loc =>
                loc.keywords?.some(kw => data.user.landmark.toLowerCase().includes(kw))
              );
              setSelectedLocation(matchedLoc || null);
            }
          }
        }
        if (gpsMatch && data.user.zone && data.user.zone !== gpsMatch.zone.name) {
          setLocationMismatch(true);
        }
      }
    } catch {
      // Lookup failed
    } finally {
      setLooking(false);
    }
  };

  const handleLocationPick = (zone, loc) => {
    setSelectedZone(zone);
    setSelectedLocation(loc);
    setDeliveryAddress(loc.name);
    setExpandedZone(null);
    setEditingAddress(false);
    setLocationMismatch(false);
    if (onUpdateLocation) {
      onUpdateLocation({ landmark: loc.name, zone: zone.name, zonePrice: loc.price ?? zone.zonePrice });
    }
  };

  const handleUseGpsLocation = () => {
    if (gpsMatch) {
      setDeliveryAddress(gpsMatch.address || gpsAddress);
      setSelectedZone(gpsMatch.zone);
      setSelectedLocation(gpsMatch.location);
      setLocationMismatch(false);
      setEditingAddress(false);
      if (onUpdateLocation) {
        onUpdateLocation({ landmark: gpsMatch.address || gpsAddress, zone: gpsMatch.zone.name, zonePrice: gpsMatch.location.price ?? gpsMatch.zone.zonePrice });
      }
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return sum;
    if (item.variantId) {
      const variant = product.variations?.find((v) => v.wcId === item.variantId);
      return sum + (variant ? parseFloat(variant.price) * item.quantity : product.price * item.quantity);
    }
    return sum + (product.price * item.quantity);
  }, 0);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const baseDeliveryFee = selectedLocation?.price ?? selectedZone?.zonePrice ?? user?.zonePrice ?? 300;
  const deliveryVat = Math.round(baseDeliveryFee * 0.16);
  const deliveryFee = baseDeliveryFee + deliveryVat;
  const grandTotal = subtotal + deliveryFee;

  const hasPhone = !!user?.phone || phoneLookupDone;
  const hasLocation = !!deliveryAddress;
  const canPay = hasPhone && userName.trim() && buildingName.trim() && hasLocation;

  const handlePay = async () => {
    if (!hasPhone) { setError('Please enter your phone number'); return; }
    if (!userName.trim()) { setError('Please enter your name'); return; }
    if (!buildingName.trim()) { setError('Please enter your building name or house number'); return; }
    if (!hasLocation) { setError('Please select your delivery location'); return; }
    haptic('medium');
    setLoading(true);
    setError('');
    setStep('processing');

    try {
      let customerId = user?.customerId;

      if (!customerId) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: userPhone,
            name: userName.trim(),
            landmark: deliveryAddress || buildingName.trim(),
            zone: selectedZone?.name || '',
            zonePrice: baseDeliveryFee,
          }),
        });
        const regData = await regRes.json();
        if (regRes.ok && regData.customerId) {
          customerId = regData.customerId;
          if (onCompleteProfile) {
            await onCompleteProfile({
              name: userName.trim(),
              landmark: deliveryAddress || buildingName.trim(),
              zone: selectedZone?.name || '',
              zonePrice: baseDeliveryFee,
              customerId,
              phone: userPhone,
            });
          }
        }
      }

      const fullAddress = deliveryAddress ? `${deliveryAddress} - ${buildingName.trim()}` : buildingName.trim();

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          paymentMethod: 'paystack',
          locationData: {
            text: fullAddress,
            name: userName.trim(),
            phone: userPhone,
            zone: selectedZone?.name || '',
          },
          customerId: customerId || 0,
          customerNote: '',
          email: user?.email || '',
          deliveryFee,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Order failed (${res.status})`);

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      haptic('success');
      onOrderSuccess(data);
    } catch (err) {
      console.error('Checkout failed:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setLoading(false);
      setStep('confirm');
    }
  };

  const inputStyle = { borderRadius: '10px', border: '2px solid #debfc3', padding: '10px 12px', fontFamily: 'Montserrat, sans-serif', color: '#191c1d' };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-4xl p-5 md:p-6 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] md:max-h-[85vh] flex flex-col rounded-t-[1.5rem] md:rounded-2xl"
        style={{ backgroundColor: '#f5f5dc', border: '1px solid #E9ECEF' }}>

        {step === 'processing' ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(132, 0, 55, 0.1)' }}>
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Redirecting to Paystack...</h3>
            <p className="text-sm" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>You&apos;ll be taken to the secure payment page</p>
          </div>
        ) : (
          <>
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200/80 mb-3">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Checkout</h2>
                <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>{totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ backgroundColor: '#F1F3F5' }}>
                <svg className="w-4 h-4" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Scrollable Layout (2-column on desktop) */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-4">

                {/* Left Column: Cart Items & Price Summary */}
                <div className="md:col-span-6 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500 hidden md:block" style={{ fontFamily: 'Montserrat, sans-serif' }}>Order Items</h3>
                  <div className="space-y-2 max-h-60 md:max-h-72 overflow-y-auto pr-1">
                    {cart.map((item) => {
                      const product = products.find((p) => p.id === item.id);
                      if (!product) return null;
                      const variant = item.variantId ? product.variations?.find((v) => v.wcId === item.variantId) : null;
                      const itemPrice = variant ? parseFloat(variant.price) : product.price;
                      const variantLabel = variant?.attributes?.map((a) => a.value).join(' / ') || '';
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl shadow-xs" style={{ backgroundColor: '#fff', border: '1px solid #E9ECEF' }}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50 relative">
                            {(variant?.image || product.image) ? (
                              <img src={variant?.image || product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">🍹</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-semibold truncate" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{product.name}</p>
                            <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                              {variantLabel && <span>{variantLabel} · </span>}Qty: {item.quantity}
                            </p>
                          </div>
                          <p className="text-xs md:text-sm font-bold flex-shrink-0" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>KSh {(itemPrice * item.quantity).toLocaleString()}</p>
                          <button onClick={() => onRemoveItem(item.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-red-50 hover:text-red-600 transition-colors" style={{ backgroundColor: '#F1F3F5' }}>
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Price Breakdown */}
                  <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: '#fff', border: '1px solid #E9ECEF' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Subtotal ({totalItems} items)</span>
                      <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>KSh {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Delivery + VAT</span>
                      <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>KSh {deliveryFee.toLocaleString()}</span>
                    </div>
                    <div className="h-px" style={{ backgroundColor: '#E9ECEF' }} />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Total</span>
                      <span className="text-base font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>KSh {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Customer Details & Delivery Form */}
                <div className="md:col-span-6 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500 hidden md:block" style={{ fontFamily: 'Montserrat, sans-serif' }}>Delivery Details</h3>

                  {/* Phone */}
                  {!user?.phone && (
                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Phone Number *</label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={userPhone}
                          onChange={(e) => { setUserPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); setPhoneLookupDone(false); setLocationMismatch(false); }}
                          onBlur={() => { if (userPhone.length === 10) handlePhoneLookup(); }}
                          placeholder="0712345678"
                          className="flex-1 bg-white border-none focus:ring-0 focus:outline-none outline-none text-sm"
                          style={inputStyle}
                        />
                        {userPhone.length === 10 && !phoneLookupDone && (
                          <button onClick={handlePhoneLookup} disabled={looking}
                            className="px-3 rounded-xl text-xs font-semibold text-white flex-shrink-0 disabled:opacity-50 hover:bg-[#6b002c] transition-colors"
                            style={{ backgroundColor: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                            {looking ? '...' : 'Check'}
                          </button>
                        )}
                      </div>
                      {looking && <p className="text-[10px] mt-1" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Looking up your account...</p>}
                    </div>
                  )}

                  {/* Name */}
                  {hasPhone && !user?.name && (
                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Your Name *</label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => { setUserName(e.target.value); setError(''); }}
                        placeholder="e.g. James Mwangi"
                        className="w-full bg-white border-none focus:ring-0 focus:outline-none outline-none text-sm"
                        style={inputStyle}
                      />
                    </div>
                  )}

                  {/* Delivery Location */}
                  <div className="rounded-xl p-3.5" style={{ backgroundColor: '#F1F3F5' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Delivery Location</span>
                      {detectingGps && (
                        <span className="text-[10px] flex items-center gap-1 ml-auto" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                          <div className="w-2.5 h-2.5 border-2 rounded-full animate-spin" style={{ borderColor: '#debfc3', borderTopColor: '#840037' }} />
                          Detecting...
                        </span>
                      )}
                    </div>

                    {/* Has location — show it */}
                    {hasLocation && !editingAddress ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate font-medium" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{deliveryAddress}</p>
                            {selectedZone && (
                              <p className="text-[10px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                                {selectedZone.name} — KSh {baseDeliveryFee}
                              </p>
                            )}
                          </div>
                          <button onClick={() => setEditingAddress(true)} className="text-[11px] font-semibold flex-shrink-0 hover:underline" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>Change</button>
                        </div>

                        {/* Location mismatch prompt */}
                        {locationMismatch && (
                          <button
                            onClick={handleUseGpsLocation}
                            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all animate-pulse"
                            style={{ backgroundColor: 'rgba(132,0,55,0.08)', border: '1px dashed #840037', color: '#840037', fontFamily: 'Montserrat, sans-serif' }}
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06z"/>
                            </svg>
                            Not your location? Use detected: {gpsAddress.slice(0, 30)}...
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Zone browser */
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {zones.length === 0 ? (
                          <p className="text-xs py-2" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Loading zones...</p>
                        ) : (
                          zones.map((zone) => {
                            const isExpanded = expandedZone === zone.id;
                            return (
                              <div key={zone.id} className="border overflow-hidden" style={{ borderColor: '#debfc3', borderRadius: '10px', backgroundColor: '#fff' }}>
                                <button type="button" onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                                  className="w-full flex items-center justify-between px-3 hover:bg-gray-50 transition-all text-left"
                                  style={{ height: '40px' }}>
                                  <div className="flex items-center gap-2">
                                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#574145' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{zone.name}</span>
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="px-3 pb-2 space-y-1">
                                    {zone.locations.map((loc) => (
                                      <button key={loc.name} type="button" onClick={() => handleLocationPick(zone, loc)}
                                        className="w-full flex items-center justify-between px-3 border hover:border-[#840037]/40 hover:bg-red-50/50 transition-all text-left"
                                        style={{ height: '36px', borderColor: '#E9ECEF', borderRadius: '8px' }}>
                                        <span className="text-[11px]" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{loc.name}</span>
                                        <span className="text-[11px] font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>KSh {loc.price}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {editingAddress && (
                          <button onClick={() => setEditingAddress(false)} className="text-[11px] font-semibold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                            ← Back to current location
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Building */}
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Building / House Number *</label>
                    <input
                      type="text"
                      value={buildingName}
                      onChange={(e) => { setBuildingName(e.target.value); setError(''); }}
                      placeholder="e.g. Blue Rose Apartments, Apt 4B"
                      className="w-full bg-white border-none focus:ring-0 focus:outline-none outline-none text-sm"
                      style={inputStyle}
                    />
                  </div>
                </div>

              </div>
            </div>

            {error && (
              <div className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)', color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}>{error}</div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePay}
              disabled={loading || !canPay}
              className="w-full py-3.5 rounded-xl text-sm md:text-base font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#6b002c] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
              style={{ backgroundColor: canPay ? '#840037' : 'rgba(132,0,55,0.5)', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}>
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
              ) : (
                <><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>Pay KSh {grandTotal.toLocaleString()}</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
