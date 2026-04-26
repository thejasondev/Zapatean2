// ============================================
// ZAPATEAN2 — Client-Side Routing Engine
// Supports multi-stop routes via /api/route proxy
// ============================================

import type { LatLng, RouteResult, TransportProfile, RouteInstruction, DeliveryStop } from './types';
import { TRANSPORT_OPTIONS } from './types';
import { $currentRoute, $isRouteLoading, $error, $allProfileResults, $stops, $userPosition, reorderStops, $avoidZones } from './stores';
import { saveRouteCache, loadRouteCache } from './db';

/** Result for a single profile */
export interface ProfileRouteResult {
  profile: TransportProfile;
  distance: number;
  duration: number;
}

// Global controllers for throttling/debouncing
let activeAbortController: AbortController | null = null;
let calculateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================
// CORE: Calculate route (single or multi-stop)
// ============================================

/**
 * Calculate a full route between multiple coordinates.
 */
export async function calculateRoute(
  coordinates: LatLng[],
  profile: TransportProfile,
  signal?: AbortSignal
): Promise<RouteResult | null> {
  if (coordinates.length < 2) return null;

  $isRouteLoading.set(true);
  $error.set(null);

  const avoidZones = $avoidZones.get();
  const requestBody = { coordinates, profile, mode: 'full', avoidZones };
  const reqHash = JSON.stringify(requestBody);

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: reqHash,
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 429) {
         throw new Error('Límite de cálculos alcanzado. Espera un momento.');
      }
      throw new Error(errorData?.error || `Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) {
      throw new Error('No se encontró una ruta entre los puntos seleccionados');
    }

    const { properties, geometry } = feature;
    const summary = properties.summary;

    const instructions: RouteInstruction[] = (
      properties.segments || []
    ).flatMap((seg: any) =>
      (seg.steps || []).map((step: any) => ({
        distance: step.distance,
        duration: step.duration,
        text: step.instruction,
        type: step.type,
      }))
    );

    const routeResult: RouteResult = {
      coordinates: geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
      ),
      distance: summary.distance,
      duration: summary.duration,
      bbox: data.bbox || [0, 0, 0, 0],
      instructions,
    };

    $currentRoute.set(routeResult);
    
    // Save to Cache
    saveRouteCache({ hash: reqHash, timestamp: Date.now(), result: routeResult }).catch(() => {});

    return routeResult;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('[Zapatean2] Routing request aborted.');
      return null;
    }

    // Offline fallback check
    if (err instanceof TypeError && err.message.includes('fetch')) {
      const cached = await loadRouteCache(reqHash);
      if (cached && cached.result) {
        $currentRoute.set(cached.result);
        return cached.result;
      }
    }
    const message =
      err instanceof Error
        ? err.message
        : 'Error desconocido al calcular la ruta';

    $error.set(message);
    $currentRoute.set(null);
    console.error('[Zapatean2] Routing error:', err);
    return null;
  } finally {
    // Only set loading to false if this request wasn't aborted
    if (!signal?.aborted) {
      $isRouteLoading.set(false);
    }
  }
}

/**
 * Fetch only distance + duration for a given profile (lightweight).
 */
async function fetchProfileSummary(
  coordinates: LatLng[],
  profile: TransportProfile,
  signal?: AbortSignal
): Promise<ProfileRouteResult | null> {
  if (coordinates.length < 2) return null;

  const avoidZones = $avoidZones.get();
  const requestBody = { coordinates, profile, mode: 'summary', avoidZones };
  const reqHash = JSON.stringify(requestBody);

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: reqHash,
      signal,
    });

    if (!response.ok) throw new Error('API fetching error');

    const data = await response.json();
    const summary = data.routes?.[0]?.summary;
    if (!summary) return null;

    const result = {
      profile,
      distance: summary.distance,
      duration: summary.duration,
    };
    
    saveRouteCache({ hash: reqHash, timestamp: Date.now(), result }).catch(() => {});

    return result;
  } catch (err: any) {
    if (err.name !== 'AbortError') {
       if (err instanceof TypeError && err.message.includes('fetch')) {
         const cached = await loadRouteCache(reqHash);
         if (cached && cached.result) return cached.result;
       }
       console.error('[Zapatean2] Summary fetch failed', err);
    }
    return null;
  }
}

// ============================================
// MULTI-STOP: Build coordinates from GPS + stops
// ============================================

/**
 * Build the full coordinate chain: [GPS origin, stop1, stop2, ...]
 */
export function buildRouteCoordinates(): LatLng[] {
  const userPos = $userPosition.get();
  const stops = $stops.get();

  const coords: LatLng[] = [];

  // Origin = GPS position
  if (userPos) {
    coords.push({ lat: userPos.lat, lng: userPos.lng });
  }

  // Add stops in order
  stops
    .filter((s) => !s.completed)
    .sort((a, b) => a.order - b.order)
    .forEach((s) => coords.push(s.position));

  return coords;
}

/**
 * Debounced version of calculateAllProfiles. 
 * Use this from UI events (like Map clicks) to avoid hitting Rate Limits (HTTP 429).
 */
export function calculateAllProfilesDebounced(delayMs = 1200): void {
  if (calculateDebounceTimer) {
    clearTimeout(calculateDebounceTimer);
  }
  
  $isRouteLoading.set(true); // Immediate visual feedback that we received the command
  
  calculateDebounceTimer = setTimeout(() => {
    calculateAllProfiles();
  }, delayMs);
}

/**
 * Calculate routes for ALL transport profiles simultaneously.
 * Cancels any ongoing requests automatically.
 */
export async function calculateAllProfiles(
  coordinatesOverride?: LatLng[]
): Promise<void> {
  // 1) Cancel exactly before starting new set
  if (activeAbortController) {
    activeAbortController.abort();
  }
  
  // 2) Create new Abort Controller for this batch
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  const coordinates = coordinatesOverride || buildRouteCoordinates();

  if (coordinates.length < 2) {
    $error.set('Se necesitan al menos 2 puntos para calcular una ruta');
    $isRouteLoading.set(false);
    return;
  }

  $isRouteLoading.set(true);
  $error.set(null);

  const profiles = TRANSPORT_OPTIONS.map((opt) => opt.id);

  const promises = profiles.map(async (profile) => {
    if (profile === 'driving-car') {
      const result = await calculateRoute(coordinates, profile, signal);
      if (result) {
        return {
          profile,
          distance: result.distance,
          duration: result.duration,
        } as ProfileRouteResult;
      }
      return null;
    }
    return fetchProfileSummary(coordinates, profile, signal);
  });

  const results = await Promise.all(promises);
  
  // 3) Only apply results if this specific calculation wasn't aborted midway
  if (!signal.aborted) {
    const validResults = results.filter(Boolean) as ProfileRouteResult[];
    $allProfileResults.set(validResults);
    $isRouteLoading.set(false);
  }
}

// ============================================
// STOP ORDER OPTIMIZATION (Nearest Neighbor TSP)
// ============================================

/**
 * Optimize stop order using nearest neighbor heuristic.
 * Starts from the user's GPS position.
 */
export function optimizeStopOrder(): void {
  const userPos = $userPosition.get();
  const stops = $stops.get();

  if (stops.length < 2 || !userPos) return;

  const remaining = [...stops];
  const optimized: DeliveryStop[] = [];
  let current: LatLng = { lat: userPos.lat, lng: userPos.lng };

  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current, remaining[i].position);
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }

    const next = remaining.splice(closestIdx, 1)[0];
    optimized.push(next);
    current = next.position;
  }

  reorderStops(optimized);
}

/**
 * Haversine distance in meters (for TSP optimization).
 */
function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ============================================
// FORMAT HELPERS
// ============================================

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}
