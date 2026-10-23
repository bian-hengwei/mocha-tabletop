const CACHE = '__MOCHA_CACHE__';
const PRECACHE = ['__MOCHA_PRECACHE__'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(async cache => {
    const ready = (await Promise.all(PRECACHE.map(url => cache.match(url)))).every(Boolean);
    event.ports[0].postMessage({ready, cache:CACHE});
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mocha-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {const copy = response.clone(); caches.open(CACHE).then(cache => cache.put('/', copy));}
      return response;
    }).catch(() => caches.match('/')));
  } else {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (response.ok) {const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));}
      return response;
    })));
  }
});
