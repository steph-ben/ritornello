// Mémoire du navigateur (IndexedDB) : la bibliothèque, et les références aux
// fichiers (handles), qui ne valent que sur cet appareil.

const DATABASE = 'ritornello';
const LIBRARY = 'library';   // une seule entrée, clé "main"
const HANDLES = 'handles';   // clé = identifiant du morceau

let databasePromise = null;

export async function loadLibrary() {
  return (await read(LIBRARY, 'main')) ?? null;
}

export function saveLibrary(lib) {
  return write(LIBRARY, 'main', lib);
}

export async function loadHandle(trackId) {
  return (await read(HANDLES, trackId)) ?? null;
}

export function saveHandle(trackId, handle) {
  return write(HANDLES, trackId, handle);
}

function openDatabase() {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(LIBRARY);
      request.result.createObjectStore(HANDLES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function read(store, key) {
  const db = await openDatabase();
  return asPromise(db.transaction(store).objectStore(store).get(key));
}

async function write(store, key, value) {
  const db = await openDatabase();
  const transaction = db.transaction(store, 'readwrite');
  transaction.objectStore(store).put(value, key);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
