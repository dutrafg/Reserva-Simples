const CACHE = 'reserva-simples-v0.39.18-rc1';
const FILES = ['./', './index.html', './app.js', './engines.js', './manifest.webmanifest', './version.json', './icon.svg', './icon-192.png', './icon-512.png'];
const assets = new Set(FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, self.registration.scope), {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const older = keys.filter(key => key.startsWith('reserva-simples-') && key !== CACHE);
    await Promise.all(older.slice(0,-1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match('./index.html')).then(shell => shell || fetch(request)).catch(() => fetch(request)));
  } else if (assets.has(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
self.addEventListener('notificationclick', event => {
  const date = event.notification.data?.date;
  event.notification.close();
  const target = new URL('./', self.registration.scope);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) target.searchParams.set('calendarDate', date);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if ('focus' in client) { await client.navigate(target.href); return client.focus(); }
    }
    return self.clients.openWindow(target.href);
  }));
});
