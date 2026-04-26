// ============================================
// ZAPATEAN2 — Nanostores Global State
// ============================================

import { atom } from 'nanostores';
import type {
  UserPosition,
  MapView,
  RouteParams,
  RouteResult,
  ThemeMode,
  SheetState,
  SheetTab,
  LatLng,
  GeocodingResult,
  DeliveryStop,
  CostConfig,
  FavoriteRoute,
  TripRecord,
  AvoidZone,
} from './types';
import { CUBA_CENTER, DEFAULT_ZOOM, DEFAULT_COST_CONFIG, MAX_STOPS } from './types';

// ---- User Position (GPS) ----
export const $userPosition = atom<UserPosition | null>(null);

// ---- Map Viewport ----
export const $mapView = atom<MapView>({
  center: CUBA_CENTER,
  zoom: DEFAULT_ZOOM,
});

// ---- Route Parameters ----
export const $routeParams = atom<RouteParams>({
  profile: 'driving-car',
  origin: null,
  destination: null,
});

// ---- Calculated Route (primary profile with geometry) ----
export const $currentRoute = atom<RouteResult | null>(null);

// ---- All Profile Results (distance + duration for each transport) ----
export interface ProfileResult {
  profile: string;
  distance: number;
  duration: number;
}
export const $allProfileResults = atom<ProfileResult[]>([]);

// ---- Route Loading State ----
export const $isRouteLoading = atom<boolean>(false);

// ---- Theme ----
const storedTheme =
  typeof window !== 'undefined'
    ? (localStorage.getItem('zapatean-theme') as ThemeMode | null)
    : null;

export const $theme = atom<ThemeMode>(storedTheme ?? 'day');

// Sync theme to DOM and localStorage
if (typeof window !== 'undefined') {
  $theme.subscribe((theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zapatean-theme', theme);
  });
}

// ---- Bottom Sheet State ----
export const $sheetState = atom<SheetState>('collapsed');
export const $activeTab = atom<SheetTab>('route');

// ---- GPS Watch ID ----
export const $gpsWatchId = atom<number | null>(null);

// ---- Origin/Destination selection mode ----
export type SelectionMode = 'origin' | 'destination' | null;
export const $selectionMode = atom<SelectionMode>(null);

// ---- Geocoding search results ----
export const $searchResults = atom<GeocodingResult[]>([]);
export const $isSearching = atom<boolean>(false);

// ---- Error state ----
export const $error = atom<string | null>(null);

// ============================================
// DELIVERY STOPS (Multi-Stop / Messenger Mode)
// ============================================

export const $stops = atom<DeliveryStop[]>([]);

let stopCounter = 0;

/** Generate a simple unique ID */
function generateId(): string {
  return `stop_${Date.now()}_${++stopCounter}`;
}

/** Add a new delivery stop */
export function addStop(position: LatLng, label?: string): DeliveryStop | null {
  const current = $stops.get();
  if (current.length >= MAX_STOPS) return null;

  const stop: DeliveryStop = {
    id: generateId(),
    position,
    label: label || `Parada ${current.length + 1}`,
    order: current.length,
    completed: false,
  };

  $stops.set([...current, stop]);
  return stop;
}

/** Remove a delivery stop by ID */
export function removeStop(id: string) {
  const current = $stops.get();
  const rest = current.filter((s) => s.id !== id);
  const relabeled = rest.map((s, idx) => ({
    ...s,
    order: idx,
    label: s.label.startsWith('Punto') || s.label.startsWith('Parada') 
             ? `Parada ${idx + 1}` 
             : s.label,
  }));
  $stops.set(relabeled);
}

export function renameStop(id: string, newLabel: string) {
  const current = $stops.get();
  const updated = current.map((s) => 
    s.id === id ? { ...s, label: newLabel } : s
  );
  $stops.set(updated);
}

/** Reorder stops (after optimization or manual drag) */
export function reorderStops(newOrder: DeliveryStop[]): void {
  $stops.set(newOrder.map((s, i) => ({ ...s, order: i })));
}

/** Clear all stops */
export function clearStops(): void {
  $stops.set([]);
  stopCounter = 0;
}

/** Toggle stop completed state */
export function toggleStopCompleted(id: string): void {
  $stops.set(
    $stops.get().map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
  );
}

// ============================================
// COST CONFIGURATION
// ============================================

export const $costConfig = atom<CostConfig>(DEFAULT_COST_CONFIG);

/** Update cost config and persist */
export function updateCostConfig(patch: Partial<CostConfig>): void {
  const current = $costConfig.get();
  $costConfig.set({ ...current, ...patch });
}

// ============================================
// FAVORITES
// ============================================

export const $favorites = atom<FavoriteRoute[]>([]);

// ============================================
// WALLET / EARNINGS (Fase 2)
// ============================================

export const $tripRecords = atom<TripRecord[]>([]);

// ============================================
// AVOID ZONES (Fase 2)
// ============================================

export const $avoidZones = atom<AvoidZone[]>([]);

// ============================================
// HELPERS
// ============================================

/** Set origin */
export function setOrigin(point: LatLng) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, origin: point });
}

/** Set destination */
export function setDestination(point: LatLng) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, destination: point });
}

/** Set transport profile */
export function setProfile(profile: RouteParams['profile']) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, profile });
}

/** Clear route and stops */
export function clearRoute() {
  $currentRoute.set(null);
  $allProfileResults.set([]);
  $routeParams.set({
    ...$routeParams.get(),
    origin: null,
    destination: null,
  });
  clearStops();
  $error.set(null);
}

/** Toggle theme */
export function toggleTheme() {
  $theme.set($theme.get() === 'day' ? 'night' : 'day');
}
