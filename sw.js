/* Service Worker – App-Shell Cache.
   WICHTIG: Bei jedem Deploy CACHE_VERSION hochzählen, damit alle Geräte
   die neue Version bekommen. */
const CACHE_VERSION = 'v2';
const CACHE_NAME = `rezeptbuch-${CACHE_VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/firebase.js',
  './js/auth.js',
  './js/store.js',
  './js/schema.js',
  './js/util.js',
  './js/image.js',
  './js/nutrition.js',
  './js/prompt.js',
  './js/pending.js',
  './js/theme.js',
  './js/views/list.js',
  './js/views/detail.js',
  './js/views/edit.js',
  './js/views/import.js',
  './js/views/shopping.js',
  './js/views/settings.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Einzeln cachen: eine fehlende Datei soll nicht die ganze Installation kippen.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase/Google-Requests nie cachen – Firestore hat eigenen Offline-Cache.
  if (url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebaseapp.com') ||
      url.hostname.endsWith('firebase.com')) {
    return;
  }

  // Navigation: erst Netz, bei Offline die gecachte index.html.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Übrige Assets: Cache zuerst, im Hintergrund aktualisieren.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
