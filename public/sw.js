const version = '__CACHE_VERSION__';
const cacheName = 'tsugi-preview-' + version;
const assets = /* PRECACHE */ [];
const catalog = /* CATALOG */ {};
const allowed = new Set(assets.map(path => new URL(path, self.location).href));
const optional = new Map(Object.entries(catalog).map(([path,hash]) => [new URL(path,self.location).href,hash]));
const materialCache = 'tsugi-materials-v1';

async function loadMaterial(request,hash) {
  const key = new URL(request.url);
  key.searchParams.set('sha',hash);
  const cache=await caches.open(materialCache);
  const saved=await cache.match(key);
  if(saved)return saved;
  const response=await fetch(request);
  if(response.ok&&!response.redirected&&response.headers.get('Content-Type')?.includes('image/webp')){
    try {
      await cache.put(key,response.clone());
      const keys=await cache.keys();
      await Promise.all(keys.slice(0,Math.max(0,keys.length-48)).map(old=>cache.delete(old)));
    } catch {} // A full storage quota never prevents online rendering.
  }
  return response;
}

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
  } else if (optional.has(request.url)) {
    event.respondWith(loadMaterial(request,optional.get(request.url)));
  }
});
