const VERSION = '1.0.0-beta.36';
const CACHE = 'reserva-simples-v' + VERSION + '-pwa';
const INTEGRITY_MANIFEST = './integrity-manifest.json';
const CHECKED_FILES = ['./index.html', './app.js', './diagnostics.js', './accounts.js', './engines.js', './manifest.webmanifest', './version.json', './sw.js'];
const CORE_FILES = [...CHECKED_FILES, INTEGRITY_MANIFEST];
const OPTIONAL_FILES = ['./', './icon.svg', './icon-192.png', './icon-512.png'];
const FILES = [...CORE_FILES, ...OPTIONAL_FILES];
const scoped = path => new URL(path, self.registration.scope);
const assets = new Set(FILES.map(path => scoped(path).href));

async function verifyRelease(cache) {
  const manifestResponse = await cache.match(scoped(INTEGRITY_MANIFEST));
  const manifest = manifestResponse && await manifestResponse.json();
  if (manifest?.format !== 1 || manifest.version !== VERSION || !manifest.assets) {
    throw new Error('Manifesto de integridade incompatível');
  }
  for (const path of CHECKED_FILES) {
    const expected = manifest.assets[path];
    const response = await cache.match(scoped(path));
    if (!response?.ok || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Arquivo essencial ausente');
    const bytes = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    const observed = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    if (expected !== observed) throw new Error('Os arquivos publicados não pertencem à mesma versão');
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE_FILES.map(path => new Request(scoped(path), {cache:'reload'})));
      await verifyRelease(cache);
      await Promise.all(OPTIONAL_FILES.map(path => {
        const request = new Request(scoped(path), {cache:'reload'});
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

  if (request.cache === 'no-store') return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(scoped('./index.html'))).then(shell => shell || fetch(request)).catch(() => fetch(request)));
  } else if (assets.has(url.href)) {
    const clean = new URL(url.href); clean.search = '';
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.href) || await cache.match(clean.href)) || fetch(request)));
  }
});
self.addEventListener('notificationclick', event => {
  const {date,module} = event.notification.data || {};
  event.notification.close();
  const target = scoped('./');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    target.searchParams.set(module === 'budget' ? 'budgetDate' : 'calendarDate', date);
  }
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
