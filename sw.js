/* Service worker: permite usar la app sin internet una vez abierta (requiere https). */
const CACHE = 'rrss-otuzco-v4';
const FILES = ['./', './index.html', './styles.css', './app.js', './data-inicial.js', './config.js', './vendor/piexif.js', './manifest.webmanifest', './icon.svg',
  './vendor/leaflet.js', './vendor/leaflet.css', './vendor/xlsx.full.min.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return; // teselas del mapa: siempre de la red
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    const cp = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return resp;
  })));
});
