/**
 * POST /api/route
 *
 * Server-side proxy for OpenRouteService API.
 * The ORS API key NEVER leaves the server — it's only accessed
 * via `import.meta.env.ORS_API_KEY` (no PUBLIC_ prefix).
 *
 * Supports both 2-point and multi-stop routes.
 *
 * Request body:
 * {
 *   coordinates: { lat: number, lng: number }[],  // 2+ points
 *   profile: TransportProfile,
 *   mode: 'full' | 'summary'
 * }
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

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

  // Support both legacy (origin/destination) and new (coordinates array) formats
  let coordinates: { lat: number; lng: number }[];

  if (body.coordinates && Array.isArray(body.coordinates)) {
    coordinates = body.coordinates;
  } else if (body.origin && body.destination) {
    coordinates = [body.origin, body.destination];
  } else {
    return new Response(
      JSON.stringify({ error: 'Coordenadas requeridas' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { profile, mode = 'full', avoidZones = [] } = body;

  // ---- Validation ----
  if (coordinates.length < 2 || coordinates.length > 10) {
    return new Response(
      JSON.stringify({ error: 'Se requieren entre 2 y 10 coordenadas' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!VALID_PROFILES.has(profile)) {
    return new Response(
      JSON.stringify({ error: `Perfil de transporte inválido: ${profile}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Coordinate bounds check (Cuba region)
  const isValidCoord = (lat: number, lng: number) =>
    lat >= 18 && lat <= 25 && lng >= -87 && lng <= -73;

  for (const coord of coordinates) {
    if (!coord?.lat || !coord?.lng || !isValidCoord(coord.lat, coord.lng)) {
      return new Response(
        JSON.stringify({ error: 'Coordenadas fuera de la región de Cuba' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // ---- Avoid Zones to GeoJSON MultiPolygon ----
  let options: any = undefined;
  if (avoidZones && Array.isArray(avoidZones) && avoidZones.length > 0) {
    const polygons = avoidZones.map((zone: any) => {
      const lat = zone.lat;
      const lng = zone.lng;
      const r = zone.radiusMeters || 100;
      const dy = r / 111320;
      const dx = r / (111320 * Math.cos((lat * Math.PI) / 180));
      return [[
        [lng - dx, lat - dy],
        [lng + dx, lat - dy],
        [lng + dx, lat + dy],
        [lng - dx, lat + dy],
        [lng - dx, lat - dy]
      ]];
    });
    options = {
      avoid_polygons: {
        type: 'MultiPolygon',
        coordinates: polygons
      }
    };
  }

  // ---- Build ORS request ----
  const format = mode === 'full' ? 'geojson' : 'json';
  const orsUrl = `${ORS_BASE_URL}/${profile}/${format}`;

  const orsCoordinates = coordinates.map((c) => [c.lng, c.lat]);

  try {
    const requestBody: any = {
      coordinates: orsCoordinates,
      instructions: mode === 'full',
      language: 'es',
    };
    if (options) requestBody.options = options;

    const orsResponse = await fetch(orsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify(requestBody),
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
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
