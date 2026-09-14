'use client';

/**
 * A guest's delivery location has no server-side home — there is no
 * customer record to attach it to until checkout registers one. Without
 * this it silently resets on every page navigation, because each page
 * mounts its own copy of the header/location state.
 */
const GUEST_LOCATION_KEY = 'fastcart:guestLocation';

export function readGuestLocation() {
  try {
    const raw = localStorage.getItem(GUEST_LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeGuestLocation(loc) {
  try {
    localStorage.setItem(GUEST_LOCATION_KEY, JSON.stringify(loc));
  } catch {
    // Best-effort only — a full or blocked store must not break location entry.
  }
}
