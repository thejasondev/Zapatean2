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
  /** Default price per km in CUP */
  defaultPricePerKm: number;
}

/** All available transport options */
export const TRANSPORT_OPTIONS: TransportOption[] = [
  { id: 'driving-car', label: 'auto', icon: '🚗', displayName: 'Auto', defaultPricePerKm: 25 },
  { id: 'cycling-electric', label: 'moto', icon: '🏍️', displayName: 'Moto', defaultPricePerKm: 15 },
  { id: 'cycling-regular', label: 'bici', icon: '🚲', displayName: 'Bici', defaultPricePerKm: 0 },
  { id: 'foot-walking', label: 'pie', icon: '🚶', displayName: 'Pie', defaultPricePerKm: 0 },
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

// ============================================
// DELIVERY / MESSENGER TYPES
// ============================================

/** Single delivery stop in a multi-stop route */
export interface DeliveryStop {
  id: string;
  position: LatLng;
  label: string;
  order: number;
  completed: boolean;
}

/** Cost configuration per transport (user-editable, persisted) */
export interface CostConfig {
  /** Price per km for each profile (CUP) */
  pricePerKm: Record<TransportProfile, number>;
  /** Fuel price per liter in CUP (for moto/auto) */
  fuelPricePerLiter: number;
  /** Fuel consumption in km per liter (for moto) */
  motoKmPerLiter: number;
  /** Fuel consumption in km per liter (for auto) */
  autoKmPerLiter: number;
}

/** Default cost configuration */
export const DEFAULT_COST_CONFIG: CostConfig = {
  pricePerKm: {
    'driving-car': 25,
    'cycling-electric': 15,
    'cycling-regular': 0,
    'foot-walking': 0,
  },
  fuelPricePerLiter: 132,
  motoKmPerLiter: 35,
  autoKmPerLiter: 12,
};

/** Calculated trip cost */
export interface TripCost {
  /** Total cost in CUP */
  totalCup: number;
  /** Fuel used in liters */
  fuelLiters: number;
  /** Fuel cost portion in CUP */
  fuelCostCup: number;
  /** Price per km used */
  pricePerKm: number;
}

/** Saved favorite route */
export interface FavoriteRoute {
  id: string;
  name: string;
  stops: DeliveryStop[];
  totalDistance: number;
  totalDuration: number;
  estimatedCost: number;
  profile: TransportProfile;
  createdAt: number;
}

// ============================================
// GEOGRAPHY CONSTANTS
// ============================================

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

/** Max number of delivery stops */
export const MAX_STOPS = 8;

// ============================================
// MAP TILES
// ============================================

/** Stadia Maps tile URLs */
export const TILE_URLS = {
  day: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
  night: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
} as const;

/** Stadia Maps attribution */
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>';

// ============================================
// UI TYPES
// ============================================

/** App theme mode */
export type ThemeMode = 'day' | 'night';

/** Bottom sheet states */
export type SheetState = 'collapsed' | 'half' | 'expanded';

/** Bottom sheet tabs */
export type SheetTab = 'route' | 'cost' | 'favorites';

/** Geocoding result from Nominatim */
export interface GeocodingResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}
