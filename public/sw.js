const CACHE = '__MOCHA_CACHE__';
const CACHE_PREFIX = 'mocha-';
// Do not call skipWaiting(). Existing pages keep the previous build and cache
// until all controlled clients close, so late-loaded chunks cannot disappear.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  // Navigation always reaches the network. Only ordinary static subresources
  // are eligible for the visited-asset cache.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(event.request);
    if (hit) return hit;
    const response = await fetch(event.request);
    const type = response.headers.get('content-type') || '';
    if (response.ok && !type.toLowerCase().includes('text/html')) {
      try { await cache.put(event.request, response.clone()); } catch {}
    }
    return response;
  }));
});
