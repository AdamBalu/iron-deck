// Offline support. Online: always fetch the newest files. Offline or slow: serve the last saved copy.
const CACHE = 'iron-deck-v7';
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/data.js', 'js/art.js', 'js/art-bosses.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) {
    // Fonts never change: saved copy first.
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      c.put(req, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    if (!saved) return fresh;
    // Give the network 2.5 seconds, then fall back to the saved copy.
    const timeout = new Promise(resolve => setTimeout(() => resolve(saved), 2500));
    return Promise.race([fresh.catch(() => saved), timeout]);
  })());
});
