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
  LatLng,
  GeocodingResult,
} from './types';
import { CUBA_CENTER, DEFAULT_ZOOM } from './types';

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

// ---- Helper: set origin ----
export function setOrigin(point: LatLng) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, origin: point });
}

// ---- Helper: set destination ----
export function setDestination(point: LatLng) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, destination: point });
}

// ---- Helper: set transport profile ----
export function setProfile(profile: RouteParams['profile']) {
  const params = $routeParams.get();
  $routeParams.set({ ...params, profile });
}

// ---- Helper: clear route ----
export function clearRoute() {
  $currentRoute.set(null);
  $allProfileResults.set([]);
  $routeParams.set({
    ...$routeParams.get(),
    origin: null,
    destination: null,
  });
  $error.set(null);
}

// ---- Helper: toggle theme ----
export function toggleTheme() {
  $theme.set($theme.get() === 'day' ? 'night' : 'day');
}
