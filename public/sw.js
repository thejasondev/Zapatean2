// ============================================
// ZAPATEAN2 — Service Worker (Offline-First PWA)
// ============================================

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `zapatean-static-${CACHE_VERSION}`;
const TILES_CACHE = `zapatean-tiles-${CACHE_VERSION}`;
const API_CACHE = `zapatean-api-${CACHE_VERSION}`;
const FONTS_CACHE = `zapatean-fonts-${CACHE_VERSION}`;

// App shell assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ---- Install: precache app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately (skip waiting)
  self.skipWaiting();
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('zapatean-') && !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// ---- Fetch: routing strategy ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Strategy 1: Stadia Map Tiles → CacheFirst (aggressive offline maps)
  if (url.hostname === 'tiles.stadiamaps.com') {
    event.respondWith(cacheFirst(request, TILES_CACHE, 30 * 24 * 60 * 60));
    return;
  }

  // Strategy 2: Google Fonts → CacheFirst (immutable)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONTS_CACHE, 365 * 24 * 60 * 60));
    return;
  }

  // Strategy 3: Our API routes → NetworkFirst with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Strategy 4: Nominatim geocoder → NetworkFirst
  if (url.hostname === 'nominatim.openstreetmap.org') {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Strategy 5: App shell (HTML, JS, CSS) → StaleWhileRevalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
});

// ---- Cache Strategies ----

/** CacheFirst: serve from cache, fallback to network */
async function cacheFirst(request, cacheName, maxAge) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: return a transparent 1x1 PNG for tiles
    if (request.url.includes('tiles.stadiamaps.com')) {
      return new Response(
        Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)),
        { headers: { 'Content-Type': 'image/png' } }
      );
    }
    return new Response('Offline', { status: 503 });
  }
}

/** NetworkFirst: try network, fallback to cache */
async function networkFirst(request, cacheName, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Sin conexión. Mostrando datos en caché.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** StaleWhileRevalidate: serve cache instantly, update in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}
