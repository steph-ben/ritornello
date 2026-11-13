// Synchronisation facultative entre appareils, par un gist secret GitHub.
// Sans jeton, ce module ne fait aucune requête : tout reste sur l'appareil.
//
// Une synchro : lire le gist, fusionner avec la bibliothèque locale
// (library.js), garder le résultat, puis l'écrire s'il diffère du gist.
// Elle a lieu à l'ouverture, au retour au premier plan, au retour du réseau,
// et 3 s après une modification.

import { mergeLibraries, toSyncFile, fromSyncFile } from './library.js';

const API = 'https://api.github.com';
const FILE_NAME = 'ritornello.json';
const WRITE_DELAY_MS = 3000;
const TOKEN_KEY = 'ritornello.syncToken';
const GIST_KEY = 'ritornello.gistId';

let getLibrary = () => null;
let setLibrary = () => {};
let onStatus = () => {};
let writeTimer = null;
let running = null;    // la synchro en cours (une seule à la fois)
let again = false;     // une autre synchro a été demandée pendant celle-ci
let lastSync = null;

// getLibrary() : la bibliothèque locale ; setLibrary(lib) : la remplace
// (sans relancer de synchro) ; onStatus({ state, message, lastSync }).
export function initSync(hooks) {
  ({ getLibrary, setLibrary, onStatus } = hooks);
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  syncNow();
}

export function isSyncOn() {
  return Boolean(load(TOKEN_KEY));
}

export function enableSync(token) {
  save(TOKEN_KEY, token);
  forget(GIST_KEY);
  return syncNow();
}

// Oublie le jeton sur cet appareil. Le gist et les données ne bougent pas.
export function disableSync() {
  forget(TOKEN_KEY);
  forget(GIST_KEY);
  clearTimeout(writeTimer);
  report('off');
}

// Appelé à chaque modification de la bibliothèque.
export function libraryChanged() {
  if (!isSyncOn()) return;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(syncNow, WRITE_DELAY_MS);
}

export function syncNow() {
  if (!isSyncOn()) {
    report('off');
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = runSync().finally(() => {
    running = null;
    if (again) {
      again = false;
      syncNow();
    }
  });
  return running;
}

async function runSync() {
  report('busy');
  try {
    const gistId = load(GIST_KEY) ?? await findOrCreateGist();
    const text = await readGist(gistId);
    const remote = fromSyncFile(text);   // null : gist vide ou abîmé, le local gagne
    const merged = remote ? mergeLibraries(getLibrary(), remote) : getLibrary();
    setLibrary(merged);
    const content = toSyncFile(merged);
    if (content !== text) await writeGist(gistId, content);
    lastSync = new Date();
    report('ok');
  } catch (error) {
    reportError(error);
  }
}

function reportError(error) {
  if (error.status === 401) {
    forget(TOKEN_KEY);
    report('error', 'Jeton refusé par GitHub. La synchro est coupée.');
  } else if (error.status === 404) {
    forget(GIST_KEY); // gist supprimé : il sera retrouvé ou recréé
    report('error', 'Gist introuvable. Il sera recréé à la prochaine synchro.');
  } else if (error.status) {
    report('error', `GitHub a répondu ${error.status}.`);
  } else {
    report('offline', 'Pas de réseau : les modifications partiront plus tard.');
  }
}

function report(state, message = '') {
  onStatus({ state, message, lastSync });
}

// --- GitHub ---

// Cherche parmi les gists de l'utilisateur celui qui contient
// ritornello.json ; sinon le crée, secret, avec la bibliothèque locale.
async function findOrCreateGist() {
  for (let page = 1; ; page++) {
    const gists = await api(`/gists?per_page=100&page=${page}`);
    const found = gists.find(gist => gist.files?.[FILE_NAME]);
    if (found) return remember(found.id);
    if (gists.length < 100) break;
  }
  const created = await api('/gists', 'POST', {
    description: 'Ritornello : listes, marqueurs et réglages',
    public: false,
    files: { [FILE_NAME]: { content: toSyncFile(getLibrary()) } },
  });
  return remember(created.id);
}

async function readGist(gistId) {
  const gist = await api(`/gists/${gistId}`);
  return gist.files?.[FILE_NAME]?.content ?? '';
}

function writeGist(gistId, content) {
  return api(`/gists/${gistId}`, 'PATCH', { files: { [FILE_NAME]: { content } } });
}

// Une erreur HTTP porte `status` ; une erreur réseau n'en a pas.
async function api(path, method = 'GET', body) {
  const response = await fetch(API + path, {
    method,
    cache: 'no-store', // sinon le navigateur peut resservir un gist périmé
    headers: {
      Authorization: `Bearer ${load(TOKEN_KEY)}`,
      Accept: 'application/vnd.github+json',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw Object.assign(new Error(`GitHub ${response.status}`), { status: response.status });
  return response.json();
}

function remember(gistId) {
  save(GIST_KEY, gistId);
  return gistId;
}

// --- Mémoire de l'appareil (jeton, identifiant du gist) ---

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : la synchro ne survivra pas à la fermeture
  }
}

function forget(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // rien à faire
  }
}
