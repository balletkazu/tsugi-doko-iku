const version = '__CACHE_VERSION__';
const cacheName = 'tsugi-preview-' + version;
const assets = /* PRECACHE */ [];
const allowed = new Set(assets.map(path => new URL(path, self.location).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName)
    .then(cache => cache.addAll(assets.map(path => new Request(new URL(path, self.location), {
      cache: 'reload', redirect: 'error'
    }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('message', event => {
  if (event.data === 'app-version') event.source?.postMessage({appVersion: version});
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
  const url = new URL(request.url);
  const home = new URL('./', self.location);
  const indexPath = new URL('index.html', home).pathname;
  if (request.mode === 'navigate' && url.origin === home.origin && (url.pathname === home.pathname || url.pathname === indexPath)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match('./index.html')) ?? fetch(request)));
  } else if (allowed.has(request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request)) ?? fetch(request)));
  }
});
