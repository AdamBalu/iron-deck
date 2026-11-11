// Offline support. Online: always fetch the newest files. Offline or slow: serve the last saved copy.
const CACHE = 'iron-deck-v15';
const SOUNDS = [
  'slide1', 'slide2', 'slide3', 'slide4', 'place1', 'place2', 'fan', 'shuffle', 'pack', 'takeout',
  'slice1', 'slice2', 'chop', 'punch1', 'punch2', 'plate', 'clang1', 'clang2', 'body',
  'bell', 'bell2', 'ding', 'coins', 'coins2', 'draw', 'cloth', 'anvil1', 'anvil2', 'tick', 'tap',
];
const SHELL = [
  './', 'index.html', 'css/styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/data.js', 'js/art.js', 'js/art-bosses.js', 'js/picto.js',
  'js/sound.js', 'js/sync.js', 'js/cloud.js', 'js/config.js', 'js/arena.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  ...SOUNDS.map(name => `sounds/${name}.ogg`),
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
  // Fonts and the sign-in library never change once published: saved copy first.
  const fixed = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
    (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (url.origin !== location.origin && !fixed) return;

  if (fixed) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
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
