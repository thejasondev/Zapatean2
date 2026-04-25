/**
 * POST /api/route
 *
 * Server-side proxy for OpenRouteService API.
 * The ORS API key NEVER leaves the server — it's only accessed
 * via `import.meta.env.ORS_API_KEY` (no PUBLIC_ prefix).
 *
 * Request body:
 * {
 *   origin: { lat: number, lng: number },
 *   destination: { lat: number, lng: number },
 *   profile: TransportProfile,
 *   mode: 'full' | 'summary'
 * }
 *
 * - 'full': returns GeoJSON with geometry + instructions (for map rendering)
 * - 'summary': returns only distance + duration (lightweight)
 */

import type { APIRoute } from 'astro';

// This route runs ONLY on the server (hybrid mode)
export const prerender = false;

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

// Valid ORS profiles to prevent injection
const VALID_PROFILES = new Set([
  'driving-car',
  'cycling-regular',
  'cycling-electric',
  'foot-walking',
]);

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.ORS_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Servicio de rutas no configurado' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Cuerpo de solicitud inválido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { origin, destination, profile, mode = 'full' } = body;

  // ---- Input Validation ----
  if (
    !origin?.lat || !origin?.lng ||
    !destination?.lat || !destination?.lng
  ) {
    return new Response(
      JSON.stringify({ error: 'Coordenadas de origen y destino requeridas' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!VALID_PROFILES.has(profile)) {
    return new Response(
      JSON.stringify({ error: `Perfil de transporte inválido: ${profile}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ---- Coordinate bounds check (Cuba region only) ----
  const isValidCoord = (lat: number, lng: number) =>
    lat >= 18 && lat <= 25 && lng >= -87 && lng <= -73;

  if (!isValidCoord(origin.lat, origin.lng) || !isValidCoord(destination.lat, destination.lng)) {
    return new Response(
      JSON.stringify({ error: 'Coordenadas fuera de la región de Cuba' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ---- Build ORS request ----
  const format = mode === 'full' ? 'geojson' : 'json';
  const orsUrl = `${ORS_BASE_URL}/${profile}/${format}`;

  try {
    const orsResponse = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        instructions: mode === 'full',
        language: 'es',
      }),
    });

    if (!orsResponse.ok) {
      const errorData = await orsResponse.json().catch(() => null);
      const message = errorData?.error?.message || `Error ORS: ${orsResponse.status}`;
      console.error('[API /route] ORS error:', message);

      return new Response(
        JSON.stringify({ error: message }),
        {
          status: orsResponse.status >= 500 ? 502 : orsResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await orsResponse.json();

    // Set cache headers for offline support
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400', // 24h CDN + browser cache
      },
    });
  } catch (err) {
    console.error('[API /route] Fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'No se pudo conectar al servicio de rutas' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
