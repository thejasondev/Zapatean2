// ============================================
// ZAPATEAN2 — Client-Side Routing Engine
// Calls our own /api/route proxy (API key is server-side only)
// ============================================

import type { LatLng, RouteResult, TransportProfile, RouteInstruction } from './types';
import { TRANSPORT_OPTIONS } from './types';
import { $currentRoute, $isRouteLoading, $error, $allProfileResults } from './stores';

/** Result for a single profile */
export interface ProfileRouteResult {
  profile: TransportProfile;
  distance: number;
  duration: number;
}

/**
 * Calculate a full route (with geometry) via our server-side proxy.
 */
export async function calculateRoute(
  origin: LatLng,
  destination: LatLng,
  profile: TransportProfile
): Promise<RouteResult | null> {
  $isRouteLoading.set(true);
  $error.set(null);

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        profile,
        mode: 'full',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
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
      properties.segments?.[0]?.steps || []
    ).map((step: any) => ({
      distance: step.distance,
      duration: step.duration,
      text: step.instruction,
      type: step.type,
    }));

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
    return routeResult;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Error desconocido al calcular la ruta';

    $error.set(message);
    $currentRoute.set(null);
    console.error('[Zapatean2] Routing error:', err);
    return null;
  } finally {
    $isRouteLoading.set(false);
  }
}

/**
 * Fetch only distance + duration for a given profile (lightweight).
 */
async function fetchProfileSummary(
  origin: LatLng,
  destination: LatLng,
  profile: TransportProfile
): Promise<ProfileRouteResult | null> {
  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        destination,
        profile,
        mode: 'summary',
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const summary = data.routes?.[0]?.summary;
    if (!summary) return null;

    return {
      profile,
      distance: summary.distance,
      duration: summary.duration,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate routes for ALL transport profiles simultaneously.
 * Primary profile gets full geometry, others get summaries.
 */
export async function calculateAllProfiles(
  origin: LatLng,
  destination: LatLng
): Promise<void> {
  $isRouteLoading.set(true);
  $error.set(null);
  $allProfileResults.set([]);

  const profiles = TRANSPORT_OPTIONS.map((opt) => opt.id);

  const promises = profiles.map(async (profile) => {
    if (profile === 'driving-car') {
      const result = await calculateRoute(origin, destination, profile);
      if (result) {
        return {
          profile,
          distance: result.distance,
          duration: result.duration,
        } as ProfileRouteResult;
      }
      return null;
    }
    return fetchProfileSummary(origin, destination, profile);
  });

  const results = await Promise.all(promises);
  const validResults = results.filter(Boolean) as ProfileRouteResult[];

  $allProfileResults.set(validResults);
  $isRouteLoading.set(false);
}

/**
 * Format distance for display.
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Format duration for display.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}
