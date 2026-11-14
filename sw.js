const CACHE = 'reserva-simples-v0.39.32-rc1';
const CORE_FILES = ['./index.html', './app.js', './engines.js', './manifest.webmanifest', './version.json'];
const OPTIONAL_FILES = ['./', './icon.svg', './icon-192.png', './icon-512.png'];
const FILES = [...CORE_FILES, ...OPTIONAL_FILES];
const assets = new Set(FILES.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE_FILES.map(path => new Request(new URL(path, self.registration.scope), {cache:'reload'})));
      await Promise.all(OPTIONAL_FILES.map(path => {
        const request = new Request(new URL(path, self.registration.scope), {cache:'reload'});
        return cache.add(request).catch(() => {});
      }));
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
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
    const clean = new URL(url.href); clean.search = '';
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.href) || await cache.match(clean.href)) || fetch(request)));
  }
});
self.addEventListener('notificationclick', event => {
  const date = event.notification.data?.date;
  event.notification.close();
  const target = new URL('./', self.registration.scope);
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(date || '')) target.searchParams.set('calendarDate', date);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if ('focus' in client) { await client.navigate(target.href); return client.focus(); }
    }
    return self.clients.openWindow(target.href);
  }));
});
