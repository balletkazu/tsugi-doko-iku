const cacheName = 'tsugi-preview-__CACHE_VERSION__';
const assets = /* PRECACHE */ [];
const allowed = new Set(assets.map(path => new URL(path, self.location).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName)
    .then(cache => cache.addAll(assets))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('tsugi-preview-') && key !== cacheName)
    .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const home = new URL('./', self.location).href;
  if (request.mode === 'navigate' && (request.url === home || request.url === `${home}index.html`)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match('./index.html')) ?? fetch(request)));
  } else if (allowed.has(request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request)) ?? fetch(request)));
  }
});
