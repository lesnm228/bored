const CACHE_NAME = 'kc-builder-board-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-maskable.svg'];
const SENSITIVE_PATHS = /\/(api|auth|github|terminal|agent)(\/|$)/i;

function isCacheableStaticRequest(request) {
  const url = new URL(request.url);
  return request.method === 'GET'
    && url.origin === self.location.origin
    && !request.headers.has('authorization')
    && !SENSITIVE_PATHS.test(url.pathname)
    && !url.search;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
  )));
});

self.addEventListener('fetch', (event) => {
  if (!isCacheableStaticRequest(event.request)) return;

  const request = event.request;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })),
  );
});