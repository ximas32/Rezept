/* Service Worker – App-Shell Cache.
   WICHTIG: Bei jedem Deploy CACHE_VERSION hochzählen, damit alle Geräte
   die neue Version bekommen. */
const CACHE_VERSION = 'v4';
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
      // Einzeln cachen: eine fehlende Datei soll nicht die ganze Installation
      // kippen. "reload" umgeht den Browser-Cache, damit hier nicht gleich
      // wieder eine veraltete Fassung eingelagert wird.
      .then((cache) => Promise.allSettled(SHELL.map((url) =>
        fetch(new Request(url, { cache: 'reload' }))
          .then((res) => (res.ok ? cache.put(url, res) : null))
      )))
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

/**
 * @param {Request} req
 * @param {boolean} revalidieren  true = am Browser-Cache vorbei beim Server
 *   nachfragen. GitHub Pages liefert "Cache-Control: max-age=600", sonst
 *   haelt der Browser App-Code bis zu zehn Minuten fest – auch wenn der
 *   Service Worker laengst das Netz fragen wollte. Unveraendertes
 *   beantwortet der Server mit 304, kostet also fast nichts.
 */
function holenUndCachen(req, revalidieren = false) {
  const anfrage = revalidieren
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : req;
  return fetch(anfrage).then((res) => {
    if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
    }
    return res;
  });
}

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

  // Fremde Hosts (z. B. das Firebase-SDK vom CDN) normal durchreichen.
  if (url.origin !== self.location.origin) return;

  // Bilder, Icons, Schriften aendern sich praktisch nie -> Cache zuerst.
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(req).then((c) => c || holenUndCachen(req)));
    return;
  }

  // Seiten, JavaScript, CSS: IMMER zuerst das Netz fragen, Cache nur als
  // Rueckfall. Sonst laeuft auf den Geraeten noch tagelang alter Code,
  // obwohl laengst eine neue Version veroeffentlicht ist.
  event.respondWith(
    holenUndCachen(req, true).catch(() => caches.match(req).then((cached) => {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
