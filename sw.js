/**
 * SwingAI v2 Service Worker
 * 오프라인 지원 (기본 셸 캐싱)
 */

const CACHE_NAME = 'swingai-v2-cache-v13';
const PRECACHE_URLS = [
  './',
  './index.html',
  './js/app.js',
  './js/pose-engine.js',
  './js/swing-analyzer.js',
  './js/feedback.js',
  './js/gemini-vision.js',
  './js/swing-learning.js',
  './js/tf-model.js',
  './manifest.json',
];

// Install: precache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls (Groq, MediaPipe CDN) — network only
  if (url.hostname !== location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  // JS/HTML files — network first, fallback to cache (ensures fresh code)
  const isAppFile = url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isAppFile) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Other assets (images, manifests) — cache first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
