'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { readGuestLocation, writeGuestLocation } from '@/lib/guest-location';
import Header from '@/components/Header';
import LocationModal from '@/components/LocationModal';

export default function HeaderWithLocation(props) {
  const { user, updateProfile, completeProfileAtCheckout } = useAuth();
  // A guest's picked location has nowhere server-side to live, so it would
  // otherwise reset on every page navigation (each page mounts its own copy
  // of this component) — restore it from localStorage on first render.
  const [location, setLocation] = useState(() => readGuestLocation());
  const [showLocationModal, setShowLocationModal] = useState(false);

  const effectiveLocation = location || (user?.landmark
    ? { text: user.landmark, lat: null, lng: null, zone: user.zone, zonePrice: user.zonePrice, building: user.building }
    : null);

  return (
    <>
      <Header
        {...props}
        user={user}
        location={effectiveLocation}
        onLocationSet={() => setShowLocationModal(true)}
      />
      {showLocationModal && (
        <LocationModal
          currentLocation={effectiveLocation}
          onConfirm={async (newLoc) => {
            setLocation(newLoc);
            if (user) {
              // Persisted, not just held in memory: a signed-in customer's
              // profile is what checkout restores from on their next visit
              // (see lib/customer.js#findOrCreateCustomer). Writing it
              // straight to local `user` state only lasted until the next
              // session refresh silently reverted it to whatever old
              // address WooCommerce still had on file.
              const persisted = await completeProfileAtCheckout({
                name: user.name,
                landmark: newLoc.text,
                zone: newLoc.zone,
                zonePrice: newLoc.zonePrice,
              });
              if (!persisted) {
                // Non-fatal: fall back to a local-only update so the picked
                // location still reflects in this session's UI even if the
                // write to the profile failed.
                await updateProfile({ landmark: newLoc.text, zone: newLoc.zone, zonePrice: newLoc.zonePrice, building: newLoc.building });
              }
            } else {
              writeGuestLocation(newLoc);
            }
          }}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </>
  );
}
