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
import type { ThemeMode, LatLng, DeliveryStop, AvoidZone } from '../lib/types';
import {
  $theme,
  $mapView,
  $userPosition,
  $currentRoute,
  $stops,
  $sheetState,
  $activeTab,
  addStop,
  $avoidZones,
} from '../lib/stores';
import { vibrateTap, vibrateConfirm } from '../lib/haptics';
import { calculateAllProfilesDebounced } from '../lib/routing';

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
let routeShadow: L.Polyline | null = null;
let userMarker: L.CircleMarker | null = null;
let userAccuracyCircle: L.Circle | null = null;
let stopMarkers: Map<string, L.Marker> = new Map();

// ---- Numbered Stop Icon ----
function createStopIcon(number: number, completed: boolean): L.DivIcon {
  const bgColor = completed ? '#22c55e' : '#ef4444';
  const borderColor = completed ? '#16a34a' : '#dc2626';

  return L.divIcon({
    className: 'stop-marker',
    html: `<div style="
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      background: ${bgColor};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 12px rgba(0,0,0,0.35);
      color: white;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
    ">${number}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

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

  // Set initial tile layer
  setTileLayer($theme.get());

  // ---- Map click: add delivery stop ----
  map.on('click', (e: L.LeafletMouseEvent) => {
    const position: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
    const userPos = $userPosition.get();

    if (!userPos) {
      // No GPS → open sheet with warning
      $sheetState.set('half');
      $activeTab.set('route');
      vibrateTap();
      return;
    }

    // Add as delivery stop
    const stop = addStop(position);
    if (!stop) {
      // Max stops reached
      vibrateTap();
      return;
    }

    vibrateTap();
    $sheetState.set('half');
    $activeTab.set('route');

    // Auto-calculate if we have at least 1 stop
    calculateAllProfilesDebounced();
  });

  // ---- Map context menu: add avoid zone ----
  map.on('contextmenu', (e: L.LeafletMouseEvent) => {
    vibrateTap();
    const zone: AvoidZone = {
      id: `zone_${Date.now()}`,
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      radiusMeters: 80 // Size of a general block
    };
    $avoidZones.set([...$avoidZones.get(), zone]);
    calculateAllProfilesDebounced();
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

  // ---- Subscriptions ----

  // Theme
  $theme.subscribe((theme) => setTileLayer(theme));

  // User position
  $userPosition.subscribe((pos) => {
    if (pos && map) updateUserMarker(pos.lat, pos.lng, pos.accuracy);
  });

  // Route polyline
  $currentRoute.subscribe((route) => {
    if (route && map) {
      drawRoute(route.coordinates);
      vibrateConfirm();
    } else {
      clearRoutePolyline();
    }
  });

  // Delivery stops → numbered markers
  $stops.subscribe((stops) => {
    syncStopMarkers(stops);
  });

  // Avoid Zones
  let avoidZoneLayers: Map<string, L.Circle> = new Map();
  $avoidZones.subscribe((zones) => {
    if (!map) return;
    
    // Remove deleted zones
    const currentIds = new Set(zones.map((z) => z.id));
    for (const [id, layer] of avoidZoneLayers) {
      if (!currentIds.has(id)) {
        map.removeLayer(layer);
        avoidZoneLayers.delete(id);
      }
    }

    // Add new ones
    for (const zone of zones) {
      if (!avoidZoneLayers.has(zone.id)) {
        const circle = L.circle([zone.lat, zone.lng], {
          radius: zone.radiusMeters,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.35,
          weight: 2,
        }).addTo(map);

        circle.on('click', (e) => {
          L.DomEvent.stopPropagation(e as Event);
          if (confirm('¿Eliminar esta Zona a Evitar?')) {
            vibrateTap();
            $avoidZones.set($avoidZones.get().filter(z => z.id !== zone.id));
            calculateAllProfilesDebounced();
          }
        });

        avoidZoneLayers.set(zone.id, circle);
      }
    }
  });

  return map;
}

// ============================================
// TILE LAYER MANAGEMENT
// ============================================

function setTileLayer(theme: ThemeMode): void {
  if (!map) return;

  if (tileLayer) map.removeLayer(tileLayer);

  const baseUrl = theme === 'night' ? TILE_URLS.night : TILE_URLS.day;
  const stadiaKey = import.meta.env.PUBLIC_STADIA_API_KEY;
  const url = stadiaKey ? `${baseUrl}?api_key=${stadiaKey}` : baseUrl;

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
// STOP MARKERS (Numbered)
// ============================================

function syncStopMarkers(stops: DeliveryStop[]): void {
  if (!map) return;

  // Remove markers that no longer exist
  const currentIds = new Set(stops.map((s) => s.id));
  for (const [id, marker] of stopMarkers) {
    if (!currentIds.has(id)) {
      map.removeLayer(marker);
      stopMarkers.delete(id);
    }
  }

  // Add or update markers
  for (const stop of stops) {
    const icon = createStopIcon(stop.order + 1, stop.completed);
    const existing = stopMarkers.get(stop.id);

    if (existing) {
      existing.setLatLng([stop.position.lat, stop.position.lng]);
      existing.setIcon(icon);
    } else {
      const marker = L.marker([stop.position.lat, stop.position.lng], { icon }).addTo(map!);
      stopMarkers.set(stop.id, marker);
    }
  }
}

// ============================================
// ROUTE RENDERING
// ============================================

function drawRoute(coordinates: [number, number][]): void {
  if (!map) return;

  clearRoutePolyline();

  // Route shadow
  routeShadow = L.polyline(coordinates, {
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

  // Fit map to route bounds
  const bounds = routePolyline.getBounds();
  map.fitBounds(bounds, { padding: [50, 50, 280, 50] });
}

function clearRoutePolyline(): void {
  if (!map) return;

  if (routeShadow) { map.removeLayer(routeShadow); routeShadow = null; }
  if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
}

// ============================================
// PUBLIC API
// ============================================

/** Fly map to a specific location */
export function flyTo(lat: number, lng: number, zoom?: number): void {
  map?.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 1 });
}

/** Center map on user's current position */
export function centerOnUser(): void {
  const pos = $userPosition.get();
  if (pos && map) flyTo(pos.lat, pos.lng, 15);
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
    routeShadow = null;
    userMarker = null;
    userAccuracyCircle = null;
    stopMarkers.clear();
  }
}
