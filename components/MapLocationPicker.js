'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import 'leaflet/dist/leaflet.css';

// Nairobi CBD — a reasonable default before GPS/search narrows it down.
const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 };
const DEFAULT_ZOOM = 14;
const PIN_ZOOM = 17;

// A plain SVG pin instead of Leaflet's default marker images, which need a
// bundler asset-path workaround to resolve correctly in Next.js.
const PIN_HTML = `
  <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#840037"/>
    <circle cx="18" cy="18" r="7" fill="#fff"/>
  </svg>
`;

/**
 * Thin imperative wrapper around Leaflet — plain `leaflet`, not
 * `react-leaflet`, so the map's own drag/zoom state is never fought over
 * with React's render cycle. The parent drives it only through the `pick`
 * ref method (search result, GPS fix); everything else is the map's own.
 */
const MapLocationPicker = forwardRef(function MapLocationPicker({ initialCenter, onMove }, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start = initialCenter || DEFAULT_CENTER;
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: initialCenter ? PIN_ZOOM : DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = L.divIcon({
        html: PIN_HTML,
        className: '',
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      const marker = L.marker([start.lat, start.lng], { icon, draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        onMoveRef.current?.(lat, lng);
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        onMoveRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      // A dialog-mounted map often measures itself at zero size before the
      // modal's own layout settles.
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    /** Move the pin and recentre the map — used by search results and GPS. */
    pick(lat, lng) {
      if (!mapRef.current || !markerRef.current) return;
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], PIN_ZOOM);
    },
  }), []);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default MapLocationPicker;
