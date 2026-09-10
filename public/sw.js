// Minimal service worker: makes the PWA installable and lets the app shell
// re-launch offline after a first visit. Quran text/audio caching is already
// handled by the app's own data layer (AsyncStorage — see src/data/quranApi.ts),
// so this SW only caches the static build output (JS bundle, manifest,
// icons), never API/content requests.
const CACHE_NAME = 'ayahone-shell-v5';
const APP_SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only ever handle same-origin GETs — never intercept POSTs (e.g.
  // /api/gemini) or cross-origin requests (the Quran text API, Gemini,
  // recitation audio hosts).
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build output (/_expo/...) never changes content under the same
  // URL, so cache-first is safe and fast.
  if (url.pathname.startsWith('/_expo/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (the HTML shell, manifest, icons): network-first so a
  // new deploy is picked up immediately, falling back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
