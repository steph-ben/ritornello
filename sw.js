// Service worker : garde une copie des fichiers de l'app pour qu'elle
// s'ouvre vite, même sans réseau ou avec un réseau très faible.
//
// - On sert toujours la copie : rapide, et tous les fichiers viennent de la
//   même version.
// - À chaque ouverture, la nouvelle version est téléchargée en arrière-plan,
//   en entier, dans une nouvelle copie. Elle ne remplace l'ancienne que si
//   tous les fichiers sont arrivés. Une mise à jour se voit donc à
//   l'ouverture suivante.
// - La musique n'y passe jamais : elle vient des fichiers du téléphone.

const CACHE_PREFIX = 'ritornello-';
const APP_FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'app.js', 'lists.js', 'library.js', 'storage.js', 'player.js', 'track.js', 'waveform.js', 'readfile.js', 'sync.js', 'tuner.js', 'pitch.js', 'key.js', 'keyfinder.js', 'tuner.css', 'key.css',
  'vendor/signalsmith-stretch.mjs', 'vendor/fonts/space-grotesk-latin-wght-normal.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(downloadApp());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // Seulement nos propres fichiers (pas l'API GitHub, pas YouTube).
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.waitUntil(downloadApp()); // pour la prochaine ouverture
  event.respondWith(fromCopyElseNetwork(request));
});

async function fromCopyElseNetwork(request) {
  const copy = await latestCopy();
  const response = copy && await copy.match(request, { ignoreSearch: true });
  return response ?? fetch(request);
}

// Télécharge tous les fichiers dans une nouvelle copie. `addAll` n'écrit
// rien si un seul fichier échoue : une copie est complète ou vide.
async function downloadApp() {
  const name = CACHE_PREFIX + Date.now();
  const copy = await caches.open(name);
  try {
    // no-cache : demander au serveur, pas au cache HTTP du navigateur.
    await copy.addAll(APP_FILES.map(file => new Request(file, { cache: 'no-cache' })));
  } catch {
    await caches.delete(name); // réseau trop faible : on garde l'ancienne copie
    return;
  }
  for (const old of await copyNames()) {
    if (old !== name) await caches.delete(old);
  }
}

// La copie complète la plus récente, ou null.
async function latestCopy() {
  for (const name of (await copyNames()).reverse()) {
    const copy = await caches.open(name);
    if (await copy.match('./')) return copy;
  }
  return null;
}

async function copyNames() {
  return (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX)).sort();
}
