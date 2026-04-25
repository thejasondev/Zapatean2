// ============================================
// ZAPATEAN2 — TypeScript Interfaces & Types
// ============================================

/** Transport profiles supported by OpenRouteService */
export type TransportProfile = 'driving-car' | 'cycling-regular' | 'foot-walking' | 'cycling-electric';

/** UI-facing transport option with label and icon */
export interface TransportOption {
  id: TransportProfile;
  label: string;
  icon: string;
  /** Display label for UI */
  displayName: string;
}

/** All available transport options */
export const TRANSPORT_OPTIONS: TransportOption[] = [
  { id: 'driving-car', label: 'auto', icon: '🚗', displayName: 'Auto' },
  { id: 'cycling-electric', label: 'moto', icon: '🏍️', displayName: 'Moto' },
  { id: 'cycling-regular', label: 'bici', icon: '🚲', displayName: 'Bici' },
  { id: 'foot-walking', label: 'pie', icon: '🚶', displayName: 'Pie' },
];

/** Geographic coordinate */
export interface LatLng {
  lat: number;
  lng: number;
}

/** User position from Geolocation API */
export interface UserPosition extends LatLng {
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

/** Map viewport state */
export interface MapView {
  center: LatLng;
  zoom: number;
}

/** Route parameters for calculation */
export interface RouteParams {
  profile: TransportProfile;
  origin: LatLng | null;
  destination: LatLng | null;
}

/** Decoded route from ORS API */
export interface RouteResult {
  /** Polyline coordinates for rendering on map */
  coordinates: [number, number][];
  /** Distance in meters */
  distance: number;
  /** Duration in seconds */
  duration: number;
  /** Route bounding box [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** Turn-by-turn instructions */
  instructions: RouteInstruction[];
}

/** Single route instruction step */
export interface RouteInstruction {
  /** Distance for this segment in meters */
  distance: number;
  /** Duration for this segment in seconds */
  duration: number;
  /** Instruction text (e.g., "Turn left onto Calle 23") */
  text: string;
  /** Instruction type code */
  type: number;
}

/** Province data for GeoJSON layer */
export interface ProvinceProperties {
  name: string;
  code: string;
  active: boolean;
}

/** App theme mode */
export type ThemeMode = 'day' | 'night';

/** Bottom sheet states */
export type SheetState = 'collapsed' | 'half' | 'expanded';

/** Geocoding result from Nominatim */
export interface GeocodingResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

/** Cuba geographic bounds for constraining the map */
export const CUBA_BOUNDS = {
  north: 23.28,
  south: 19.72,
  east: -74.08,
  west: -85.10,
} as const;

/** Default map center (center of Cuba) */
export const CUBA_CENTER: LatLng = {
  lat: 21.9,
  lng: -79.5,
};

/** Default zoom level */
export const DEFAULT_ZOOM = 7;

/** Zoom level when focusing on an active province */
export const PROVINCE_ZOOM = 11;

/** Stadia Maps tile URLs */
export const TILE_URLS = {
  day: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
  night: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
} as const;

/** Stadia Maps attribution */
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>';
