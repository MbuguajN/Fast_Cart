'use client';

import { useState, useEffect } from 'react';
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
  return bestScore >= 2 ? { zone: bestZone, location: bestLocation } : null;
}

export default function CheckoutModal({ cart, products, user, locationData, onClose, onOrderSuccess, onRemoveItem, onCompleteProfile, onUpdateLocation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('confirm');
  const [buildingName, setBuildingName] = useState('');
  const [userName, setUserName] = useState(user?.name || '');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState('');
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [zones, setZones] = useState([]);

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(d => setZones(d.zones || [])).catch(() => {});
  }, []);

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
  const baseDeliveryFee = selectedLocation?.price ?? user?.zonePrice ?? 300;
  const deliveryVat = Math.round(baseDeliveryFee * 0.16);
  const deliveryFee = baseDeliveryFee + deliveryVat;
  const grandTotal = subtotal + deliveryFee;

  const handleAutoDetect = () => {
    if (!('geolocation' in navigator)) {
      setError('Location not available on this device');
      return;
    }
    setDetectingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: { 'User-Agent': 'LiquorDash/1.0' },
          });
          const data = await res.json();
          const addr = data.address || {};
          const parts = [];
          if (addr.road) parts.push(addr.road);
          if (addr.neighbourhood && !addr.suburb?.toLowerCase().includes(addr.neighbourhood.toLowerCase())) parts.push(addr.neighbourhood);
          if (addr.suburb && addr.suburb !== addr.neighbourhood) parts.push(addr.suburb);
          if (addr.city && !parts.some(p => p.toLowerCase() === addr.city.toLowerCase())) parts.push(addr.city);
          const text = parts.length > 0 ? parts.join(', ') : (data.display_name || '').split(',').slice(0, 5).map(s => s.trim()).filter(Boolean).join(', ');

          setDetectedAddress(text);

          if (zones.length > 0) {
            const matched = matchZoneByKeywords(
              `${addr.neighbourhood || ''} ${addr.suburb || ''} ${addr.road || ''} ${addr.city || ''}`,
              zones
            );
            if (matched) {
              setSelectedZone(matched.zone);
              setSelectedLocation(matched.location);
              if (onUpdateLocation) {
                onUpdateLocation({ landmark: text, zone: matched.zone.name, zonePrice: matched.location.price ?? matched.zone.zonePrice });
              }
            }
          }
        } catch {
          setError('Could not detect address. Try again or type manually.');
        }
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
        setError('Location access denied. Please enable location or type your address.');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const deliveryAddress = detectedAddress || locationData?.text || '';
  const canPay = userName.trim() && buildingName.trim();

  const handlePay = async () => {
    if (!userName.trim()) { setError('Please enter your name'); return; }
    if (!buildingName.trim()) { setError('Please enter your building name or house number'); return; }
    haptic('medium');
    setLoading(true);
    setError('');
    setStep('processing');

    try {
      let customerId = user?.customerId;

      // Silent WC customer creation if needed
      if (!customerId) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: user?.phone || '',
            name: userName.trim(),
            landmark: deliveryAddress || buildingName.trim(),
            zone: selectedZone?.name || user?.zone || '',
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
              zone: selectedZone?.name || user?.zone || '',
              zonePrice: baseDeliveryFee,
              customerId,
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
            phone: user?.phone || '',
          },
          customerId: customerId || 0,
          customerNote: '',
          email: user?.email || '',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Order failed (${res.status})`);
      }

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md p-6 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: '#f5f5dc',
          borderRadius: '0.75rem 0.75rem 0 0',
          border: '1px solid #E9ECEF',
        }}
      >
        {step === 'processing' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(132, 0, 55, 0.1)' }}>
              <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#E9ECEF', borderTopColor: '#840037' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
              Redirecting to Paystack...
            </h3>
            <p className="text-sm" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
              You&apos;ll be taken to the secure payment page
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                  Checkout
                </h2>
                <p className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F1F3F5' }}>
                <svg className="w-4 h-4" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-3">
              {/* Items */}
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.id);
                if (!product) return null;
                const variant = item.variantId ? product.variations?.find((v) => v.wcId === item.variantId) : null;
                const itemPrice = variant ? parseFloat(variant.price) : product.price;
                const variantLabel = variant?.attributes?.map((a) => a.value).join(' / ') || '';
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: '#fff', border: '1px solid #E9ECEF' }}>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                      {(variant?.image || product.image) ? (
                        <img src={variant?.image || product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">🍹</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{product.name}</p>
                      <p className="text-[11px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                        {variantLabel && <span>{variantLabel} · </span>}Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                      KSh {(itemPrice * item.quantity).toLocaleString()}
                    </p>
                    <button onClick={() => onRemoveItem(item.id)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F1F3F5' }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="#5f5e5e" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Name */}
              {!user?.name && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => { setUserName(e.target.value); setError(''); }}
                    placeholder="e.g. James Mwangi"
                    className="w-full bg-white border-none focus:ring-0 focus:outline-none outline-none text-sm"
                    style={{ borderRadius: '10px', border: '2px solid #debfc3', padding: '10px 12px', fontFamily: 'Montserrat, sans-serif', color: '#191c1d' }}
                  />
                </div>
              )}

              {/* Location */}
              <div className="rounded-xl p-3" style={{ backgroundColor: '#F1F3F5' }}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#840037' }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Delivery Location</span>
                </div>

                {detectedAddress ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate font-medium" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>{detectedAddress}</p>
                      {selectedLocation && (
                        <p className="text-[10px]" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>
                          {selectedZone?.name} — KSh {selectedLocation.price ?? selectedZone?.zonePrice ?? 300}
                        </p>
                      )}
                    </div>
                    <button onClick={() => { setDetectedAddress(''); setSelectedZone(null); setSelectedLocation(null); }} className="text-[11px] font-semibold flex-shrink-0" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <button onClick={handleAutoDetect} disabled={detectingLocation} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all" style={{ backgroundColor: '#fff', border: '1px solid #debfc3', color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>
                    {detectingLocation ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#debfc3', borderTopColor: '#840037' }} />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                        Auto-detect my location
                      </>
                    )}
                  </button>
                )}

                {detectedAddress && (
                  <input
                    type="text"
                    value={detectedAddress}
                    onChange={(e) => setDetectedAddress(e.target.value)}
                    className="w-full mt-2 bg-white border-none focus:ring-0 focus:outline-none outline-none text-xs"
                    style={{ borderRadius: '8px', border: '1px solid #debfc3', padding: '8px 10px', fontFamily: 'Montserrat, sans-serif', color: '#191c1d' }}
                  />
                )}
              </div>

              {/* Building */}
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>
                  Building / House Number *
                </label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => { setBuildingName(e.target.value); setError(''); }}
                  placeholder="e.g. Blue Rose Apartments, Apt 4B"
                  className="w-full bg-white border-none focus:ring-0 focus:outline-none outline-none text-sm"
                  style={{ borderRadius: '10px', border: '2px solid #debfc3', padding: '10px 12px', fontFamily: 'Montserrat, sans-serif', color: '#191c1d' }}
                />
              </div>

              {/* Price Breakdown */}
              <div className="p-3 rounded-xl space-y-1.5" style={{ backgroundColor: '#fff', border: '1px solid #E9ECEF' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Subtotal ({totalItems} items)</span>
                  <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>KSh {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: '#5f5e5e', fontFamily: 'Montserrat, sans-serif' }}>Delivery + VAT</span>
                  <span className="text-xs font-semibold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>KSh {deliveryFee.toLocaleString()}</span>
                </div>
                <div className="h-px" style={{ backgroundColor: '#E9ECEF' }} />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: '#191c1d', fontFamily: 'Montserrat, sans-serif' }}>Total</span>
                  <span className="text-base font-bold" style={{ color: '#840037', fontFamily: 'Montserrat, sans-serif' }}>KSh {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)', color: '#ba1a1a', fontFamily: 'Montserrat, sans-serif' }}>
                {error}
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePay}
              disabled={loading || !canPay}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: canPay ? '#840037' : 'rgba(132,0,55,0.5)', color: '#fff', fontFamily: 'Montserrat, sans-serif' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
                  </svg>
                  Pay KSh {grandTotal.toLocaleString()}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
