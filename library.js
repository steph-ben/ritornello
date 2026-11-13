// La bibliothèque : listes de morceaux et réglages de chaque morceau.
// Un seul objet, simple à enregistrer (et plus tard à synchroniser).
// Fonctions pures : elles renvoient une nouvelle bibliothèque.

// Un morceau est reconnu par son nom et sa taille, sur tous les appareils.
export function trackId(name, size) {
  return `${name}|${size}`;
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
  const id = trackId(file.name, file.size);
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

// Vrai si le fichier choisi est bien celui du morceau.
export function matchesTrack(track, file) {
  return track.name === file.name && track.size === file.size;
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
