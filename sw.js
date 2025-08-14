const CACHE_NAME = 'todo-pwa-v2';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.webmanifest',
  'sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      // For navigation requests, serve cached index.html as fallback
      if (request.mode === 'navigate') {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('index.html');
        try {
          const response = await fetch(request);
          // Update cache with fresh index if navigating to root-like paths
          if (new URL(request.url).pathname === '/' || new URL(request.url).pathname.endsWith('index.html')) {
            cache.put('index.html', response.clone()).catch(() => {});
          }
          return response;
        } catch (e) {
          if (cachedIndex) return cachedIndex;
          // As a last resort, try any cache match
          const any = await caches.match(request);
          if (any) return any;
          return new Response('You are offline and no cached content is available.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      }

      // For other GET requests: cache-first, then network
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        return response;
      } catch (e) {
        // If network fails, try index fallback for same-origin HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('index.html');
          if (cachedIndex) return cachedIndex;
        }
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});


