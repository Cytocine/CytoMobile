/**
 * CytoSwing service worker
 * -------------------------------------------------------------
 * Strategy:
 *  - App shell (HTML/JS/CSS/manifest/icons)  -> cache-first, so the
 *    dashboard itself opens instantly and works offline.
 *  - Google Fonts                            -> stale-while-revalidate.
 *  - Alpaca Markets API (live price/candle
 *    data, order/account data)               -> network-only, NEVER
 *    cached. Serving stale trading data would be actively dangerous.
 *  - Everything else                         -> network-first, falling
 *    back to cache when offline.
 *
 * Bump CACHE_VERSION whenever index.html/app files change so clients
 * pick up the new build instead of a stale cached copy.
 */

const CACHE_VERSION = 'cytoswing-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

// Hosts whose responses must always be fetched fresh from the network
// and must never be served from (or written to) any cache.
const NEVER_CACHE_HOSTS = ['data.alpaca.markets', 'api.alpaca.markets', 'paper-api.alpaca.markets'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cytoswing-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept POST/PUT etc.

  const url = new URL(request.url);

  // 1) Live market/account data — always network, never cached.
  if (NEVER_CACHE_HOSTS.includes(url.hostname)) {
    event.respondWith(fetch(request));
    return;
  }

  // 2) Google Fonts — stale-while-revalidate.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3) Same-origin navigation / app shell — cache-first, network fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4) Anything else — network-first, cache fallback if offline.
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline and not cached: fall back to the app shell so the SPA
    // still boots (client-side routing/logic handles the rest).
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    throw err;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

// Allow the page to trigger an immediate activation of a waiting SW
// (used by sw-register.js when it detects an update).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
