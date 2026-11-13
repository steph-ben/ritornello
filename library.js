// La bibliothèque : listes de morceaux et réglages de chaque morceau.
// Un seul objet, simple à enregistrer (et plus tard à synchroniser).
// Fonctions pures : elles renvoient une nouvelle bibliothèque.

// Un morceau est reconnu par son nom et sa taille, sur tous les appareils.
export function trackId(name, size) {
  return `${name}|${size}`;
}

// L'identifiant d'un morceau déjà connu sous un nom écrit autrement
// (voir matchesTrack), sinon celui d'un nouveau morceau.
export function findTrackId(lib, file) {
  const known = Object.values(lib.tracks).find(track => matchesTrack(track, file));
  return known ? known.id : trackId(file.name, file.size);
}

export function createLibrary() {
  const list = newList('Mes morceaux');
  return { lists: [list], tracks: {}, currentListId: list.id };
}

export function currentList(lib) {
  return lib.lists.find(list => list.id === lib.currentListId) ?? lib.lists[0];
}

export function addList(lib, name) {
  const list = newList(name);
  return { ...lib, lists: [...lib.lists, list], currentListId: list.id };
}

export function renameList(lib, listId, name) {
  return changeList(lib, listId, list => ({ ...list, name }));
}

// La dernière liste ne peut pas être supprimée. Les réglages des morceaux
// sont gardés : ils resservent si le morceau est rajouté.
export function deleteList(lib, listId) {
  if (lib.lists.length <= 1) return lib;
  const lists = lib.lists.filter(list => list.id !== listId);
  const currentListId = lib.currentListId === listId ? lists[0].id : lib.currentListId;
  return { ...lib, lists, currentListId };
}

export function selectList(lib, listId) {
  return { ...lib, currentListId: listId };
}

export function addTrackToList(lib, listId, file, now) {
  const id = findTrackId(lib, file);
  const tracks = lib.tracks[id] ? lib.tracks : { ...lib.tracks, [id]: newTrack(id, file, now) };
  const withTrack = { ...lib, tracks };
  return changeList(withTrack, listId, list =>
    list.trackIds.includes(id) ? list : { ...list, trackIds: [...list.trackIds, id] });
}

export function removeTrackFromList(lib, listId, id) {
  return changeList(lib, listId, list => ({ ...list, trackIds: list.trackIds.filter(t => t !== id) }));
}

// `changes` : les réglages qui ont changé (markers, loop, speed…).
export function updateTrack(lib, id, changes, now) {
  const track = { ...lib.tracks[id], ...changes, modifiedAt: now };
  return { ...lib, tracks: { ...lib.tracks, [id]: track } };
}

// Le dernier morceau ouvert, pour « Reprendre ».
export function setLastTrack(lib, id) {
  return { ...lib, lastTrackId: id };
}

// Le dernier morceau ouvert, ou null s'il n'est plus dans aucune liste.
export function lastTrack(lib) {
  const inAList = lib.lists.some(list => list.trackIds.includes(lib.lastTrackId));
  return inAList ? lib.tracks[lib.lastTrackId] : null;
}

// --- Synchronisation entre appareils ---

const SYNC_VERSION = 1;

// Date les listes quand une modification les a changées (créer, renommer,
// supprimer, ajouter ou retirer un morceau). Sert à la fusion.
// La date avance toujours : si les listes reçues d'un autre appareil sont
// datées plus tard que notre horloge, la modification passe quand même après.
export function stampLists(before, after, now) {
  if (after.lists === before.lists) return after;
  const listsModifiedAt = Math.max(now, (before.listsModifiedAt ?? 0) + 1);
  return { ...after, listsModifiedAt };
}

// Le contenu du fichier partagé. La liste affichée et le dernier morceau
// ouvert restent sur l'appareil.
export function toSyncFile(lib) {
  const { lists, listsModifiedAt = 0, tracks } = lib;
  return JSON.stringify({ version: SYNC_VERSION, lists, listsModifiedAt, tracks });
}

// Le contenu partagé, ou null si le fichier est illisible ou d'une autre version.
export function fromSyncFile(text) {
  try {
    const data = JSON.parse(text);
    if (data?.version !== SYNC_VERSION || !Array.isArray(data.lists) || data.lists.length === 0) return null;
    return { lists: data.lists, listsModifiedAt: data.listsModifiedAt ?? 0, tracks: data.tracks ?? {} };
  } catch {
    return null;
  }
}

// Fusion : chaque morceau, le plus récent gagne ; les listes, le bloc le
// plus récent gagne en entier. La liste affichée et le dernier morceau
// restent ceux de l'appareil.
export function mergeLibraries(local, remote) {
  const tracks = { ...local.tracks };
  for (const [id, track] of Object.entries(remote.tracks)) {
    if (!tracks[id] || track.modifiedAt > tracks[id].modifiedAt) tracks[id] = track;
  }
  const remoteListsWin = remote.listsModifiedAt > (local.listsModifiedAt ?? 0);
  const lists = remoteListsWin ? remote.lists : local.lists;
  const listsModifiedAt = remoteListsWin ? remote.listsModifiedAt : (local.listsModifiedAt ?? 0);
  const currentListId = lists.some(list => list.id === local.currentListId) ? local.currentListId : lists[0].id;
  return { ...local, lists, listsModifiedAt, tracks, currentListId };
}

// Vrai si le fichier choisi est bien celui du morceau.
export function matchesTrack(track, file) {
  return sameName(track.name, file.name) && track.size === file.size;
}

// Les systèmes n'écrivent pas les accents de la même façon (é en un ou
// deux caractères), et certains téléchargements gardent « utf-8'' » devant
// le nom.
function sameName(a, b) {
  const clean = name => name.replace(/^utf-8''/i, '').normalize('NFC');
  return clean(a) === clean(b);
}

function newList(name) {
  return { id: crypto.randomUUID(), name, trackIds: [] };
}

function newTrack(id, file, now) {
  return {
    id, name: file.name, size: file.size,
    markers: [], loop: null, loopActive: false, speed: 100, semitones: 0,
    modifiedAt: now,
  };
}

function changeList(lib, listId, change) {
  return { ...lib, lists: lib.lists.map(list => (list.id === listId ? change(list) : list)) };
}
