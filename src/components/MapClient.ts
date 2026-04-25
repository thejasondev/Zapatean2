// ============================================
// ZAPATEAN2 — Leaflet Map Client (Island Component)
// ============================================

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  CUBA_CENTER,
  CUBA_BOUNDS,
  DEFAULT_ZOOM,
  TILE_URLS,
  TILE_ATTRIBUTION,
} from '../lib/types';
import type { ThemeMode, LatLng } from '../lib/types';
import {
  $theme,
  $mapView,
  $userPosition,
  $currentRoute,
  $routeParams,
  $sheetState,
} from '../lib/stores';
import { setDestination, setOrigin } from '../lib/stores';
import { vibrateTap, vibrateConfirm } from '../lib/haptics';
import { calculateAllProfiles } from '../lib/routing';

// ---- Fix Leaflet marker icon paths ----
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/markers/marker-icon-2x.png',
  iconUrl: '/markers/marker-icon.png',
  shadowUrl: '/markers/marker-shadow.png',
});

// ---- Module State ----
let map: L.Map | null = null;
let tileLayer: L.TileLayer | null = null;
let routePolyline: L.Polyline | null = null;
let userMarker: L.CircleMarker | null = null;
let userAccuracyCircle: L.Circle | null = null;
let originMarker: L.Marker | null = null;
let destinationMarker: L.Marker | null = null;

// ---- Custom Icons ----
const originIcon = L.divIcon({
  className: 'origin-marker',
  html: `<div style="
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    background: var(--color-brand-500, #3b82f6);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  ">
    <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = L.divIcon({
  className: 'destination-marker',
  html: `<div style="position: relative; width: 32px; height: 40px; display: flex; flex-direction: column; align-items: center;">
    <!-- Sleek Red Teardrop Map Pin -->
    <svg viewBox="0 0 24 30" width="32" height="40" style="filter: drop-shadow(0px 8px 10px rgba(220, 38, 38, 0.4));">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.058 11.233 17.564 11.666 17.935a.502.502 0 00.668 0C12.767 29.564 24 20.058 24 12c0-6.627-5.373-12-12-12z" fill="#ef4444"/>
      <path d="M12 3a9 9 0 019 9c0 5.926-7.518 13.568-9 14.86C10.518 25.568 3 17.926 3 12a9 9 0 019-9z" fill="#dc2626"/>
      <path d="M12 2A10 10 0 002 12c0 6.643 8.354 15.19 9.68 16.485a.5.5 0 00.64 0C13.646 27.19 22 18.643 22 12A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16z" fill="#b91c1c" opacity="0.3"/>
      <!-- White Star inside -->
      <polygon points="12,5 14.16,9.38 19,10.08 15.5,13.5 16.33,18.3 12,16.02 7.67,18.3 8.5,13.5 5,10.08 9.84,9.38" fill="white" transform="translate(0, 1.5) scale(0.85)"/>
    </svg>
  </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

// ============================================
// INITIALIZATION
// ============================================

export function initMap(container: HTMLElement): L.Map {
  map = L.map(container, {
    center: [CUBA_CENTER.lat, CUBA_CENTER.lng],
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
    attributionControl: true,
    maxBounds: L.latLngBounds(
      [CUBA_BOUNDS.south - 1, CUBA_BOUNDS.west - 1],
      [CUBA_BOUNDS.north + 1, CUBA_BOUNDS.east + 1]
    ),
    minZoom: 6,
    maxZoom: 18,
  });

  // Set initial tile layer based on theme
  const currentTheme = $theme.get();
  setTileLayer(currentTheme);

  // ---- Map click: auto-route from GPS to tapped point ----
  map.on('click', (e: L.LeafletMouseEvent) => {
    const destination: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    const userPos = $userPosition.get();

    if (userPos) {
      // GPS is active → origin = user position, destination = tap point
      const origin: LatLng = { lat: userPos.lat, lng: userPos.lng };
      setOrigin(origin);
      setDestination(destination);
      updateOriginMarker(origin);
      updateDestinationMarker(destination);
      vibrateTap();

      // Auto-open sheet and calculate route for all profiles
      $sheetState.set('half');
      calculateAllProfiles(origin, destination);
    } else {
      // No GPS → just set as destination marker for now
      setDestination(destination);
      updateDestinationMarker(destination);
      vibrateTap();
      $sheetState.set('half');
    }
  });

  // Sync map movement to store
  map.on('moveend', () => {
    if (!map) return;
    const center = map.getCenter();
    $mapView.set({
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
    });
  });

  // Subscribe to theme changes
  $theme.subscribe((theme) => {
    setTileLayer(theme);
  });

  // Subscribe to user position changes
  $userPosition.subscribe((pos) => {
    if (pos && map) {
      updateUserMarker(pos.lat, pos.lng, pos.accuracy);
    }
  });

  // Subscribe to route changes (draw the primary route)
  $currentRoute.subscribe((route) => {
    if (route && map) {
      drawRoute(route.coordinates);
      vibrateConfirm();
    } else {
      clearRoutePolyline();
    }
  });

  // Subscribe to route params for markers
  $routeParams.subscribe((params) => {
    if (params.origin) {
      updateOriginMarker(params.origin);
    } else {
      clearOriginMarker();
    }
    if (params.destination) {
      updateDestinationMarker(params.destination);
    } else {
      clearDestinationMarker();
    }
  });

  return map;
}

// ============================================
// TILE LAYER MANAGEMENT
// ============================================

function setTileLayer(theme: ThemeMode): void {
  if (!map) return;

  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  const url = theme === 'night' ? TILE_URLS.night : TILE_URLS.day;
  tileLayer = L.tileLayer(url, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 18,
    detectRetina: true,
  }).addTo(map);
}

// ============================================
// USER POSITION MARKER
// ============================================

function updateUserMarker(lat: number, lng: number, accuracy: number): void {
  if (!map) return;

  if (userMarker) {
    userMarker.setLatLng([lat, lng]);
    userAccuracyCircle?.setLatLng([lat, lng]);
    userAccuracyCircle?.setRadius(accuracy);
  } else {
    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      color: 'white',
      weight: 3,
      className: 'gps-pulse',
    }).addTo(map);

    userAccuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      color: '#3b82f6',
      weight: 1,
      opacity: 0.2,
    }).addTo(map);
  }
}

// ============================================
// ROUTE RENDERING
// ============================================

function drawRoute(coordinates: [number, number][]): void {
  if (!map) return;

  clearRoutePolyline();

  // Route shadow
  const shadow = L.polyline(coordinates, {
    color: '#000',
    weight: 8,
    opacity: 0.15,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  // Main route line
  routePolyline = L.polyline(coordinates, {
    color: '#3b82f6',
    weight: 5,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  (routePolyline as any)._shadow = shadow;

  // Fit map to route bounds
  const bounds = routePolyline.getBounds();
  map.fitBounds(bounds, { padding: [60, 60, 280, 60] });
}

function clearRoutePolyline(): void {
  if (!map) return;

  if (routePolyline) {
    const shadow = (routePolyline as any)._shadow;
    if (shadow) map.removeLayer(shadow);
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
}

// ============================================
// ORIGIN / DESTINATION MARKERS
// ============================================

function updateOriginMarker(point: LatLng): void {
  if (!map) return;
  if (originMarker) {
    originMarker.setLatLng([point.lat, point.lng]);
  } else {
    originMarker = L.marker([point.lat, point.lng], { icon: originIcon }).addTo(map);
  }
}

function updateDestinationMarker(point: LatLng): void {
  if (!map) return;
  if (destinationMarker) {
    destinationMarker.setLatLng([point.lat, point.lng]);
  } else {
    destinationMarker = L.marker([point.lat, point.lng], { icon: destinationIcon }).addTo(map);
  }
}

function clearOriginMarker(): void {
  if (originMarker && map) {
    map.removeLayer(originMarker);
    originMarker = null;
  }
}

function clearDestinationMarker(): void {
  if (destinationMarker && map) {
    map.removeLayer(destinationMarker);
    destinationMarker = null;
  }
}

// ============================================
// PUBLIC API
// ============================================

/** Fly map to a specific location */
export function flyTo(lat: number, lng: number, zoom?: number): void {
  map?.flyTo([lat, lng], zoom ?? map.getZoom(), {
    duration: 1,
  });
}

/** Center map on user's current position */
export function centerOnUser(): void {
  const pos = $userPosition.get();
  if (pos && map) {
    flyTo(pos.lat, pos.lng, 15);
  }
}

/** Get the Leaflet map instance */
export function getMap(): L.Map | null {
  return map;
}

/** Clean up map instance */
export function destroyMap(): void {
  if (map) {
    map.remove();
    map = null;
    tileLayer = null;
    routePolyline = null;
    userMarker = null;
    userAccuracyCircle = null;
    originMarker = null;
    destinationMarker = null;
  }
}
