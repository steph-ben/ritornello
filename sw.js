// Service worker : garde une copie des fichiers de l'app pour qu'elle
// s'ouvre sans réseau. Réseau d'abord : en ligne, on sert toujours la
// dernière version (et on met la copie à jour) ; hors ligne, la copie.
// La musique n'y passe jamais : elle vient des fichiers du téléphone.

const CACHE = 'ritornello';
const APP_FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'app.js', 'lists.js', 'library.js', 'storage.js', 'player.js', 'track.js', 'waveform.js',
  'vendor/signalsmith-stretch.mjs',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // Seulement nos propres fichiers (pas l'API GitHub, pas YouTube).
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkThenCache(request));
});

async function networkThenCache(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? Response.error();
  }
}
