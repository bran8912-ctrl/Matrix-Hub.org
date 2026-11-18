/* Matrix Hub service worker — Arcade Season 2 PWA.
 *
 * Strategy (per the Season 2 brief):
 *   - HTML / navigations: network-first, falling back to cache, so the
 *     site is never stale when online but still opens offline.
 *   - Static assets (JS/CSS/images/fonts/audio, incl. the whole
 *     /games/ arcade): cache-first, populated on first fetch, so games
 *     load instantly and play offline after one visit.
 *   - Everything else (cross-origin, non-GET, analytics, Supabase/API):
 *     not intercepted.
 *
 * Bump CACHE_VERSION whenever the precache list or strategy changes.
 */
const CACHE_VERSION = 'mh-pwa-v1';

const PRECACHE = [
  '/',
  '/games/',
  '/manifest.webmanifest',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/icon-maskable-512.png',
  '/pwa/apple-touch-icon.png',
  '/games/matrix-best.js',
  '/games/matrix-competitive.css',
  '/games/engine/matrix-engine.js',
  '/games/cyber-snake/',
  '/games/cyber-snake/script.js',
  '/games/cyber-snake/style.css',
  '/games/bullet-dodge/',
  '/games/bullet-dodge/script.js',
  '/games/bullet-dodge/style.css',
  '/games/code-breaker/',
  '/games/code-breaker/script.js',
  '/games/code-breaker/style.css',
  '/games/hacking-simulator/',
  '/games/hacking-simulator/script.js',
  '/games/hacking-simulator/style.css',
  '/games/neos-training/',
  '/games/neos-training/script.js',
  '/games/neos-training/style.css',
  '/games/memory-game/',
  '/games/memory-game/script.js',
  '/games/memory-game/style.css',
  '/games/matrix-rain/',
  '/games/matrix-rain/script.js',
  '/games/matrix-rain/style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|mp3|wav|ogg|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // analytics, fonts, APIs: untouched
  if (url.pathname.startsWith('/api/')) return;

  // HTML: network-first, cache fallback (then the cached home page).
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match('/');
        })
    );
    return;
  }

  // Static assets: cache-first, network fills the cache.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
