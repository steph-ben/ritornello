import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary, trackId, findTrackId, addList, renameList, deleteList, selectList,
  currentList, addTrackToList, removeTrackFromList, updateTrack,
  matchesTrack, setLastTrack, lastTrack, mergeLibraries, toSyncFile, fromSyncFile,
  stampLists } from '../library.js';

const BOURREE = { name: 'Bourrée.mp3', size: 1234 };

test('createLibrary has one current list named Mes morceaux', () => {
  const lib = createLibrary();
  assert.equal(lib.lists.length, 1);
  assert.equal(currentList(lib).name, 'Mes morceaux');
  assert.deepEqual(lib.tracks, {});
});

test('trackId combines name and size', () => {
  assert.equal(trackId('Bourrée.mp3', 1234), 'Bourrée.mp3|1234');
});

test('addList makes the new list current', () => {
  const lib = addList(createLibrary(), 'Piano');
  assert.equal(lib.lists.length, 2);
  assert.equal(currentList(lib).name, 'Piano');
});

test('renameList and selectList', () => {
  let lib = addList(createLibrary(), 'Piano');
  const first = lib.lists[0].id;
  lib = renameList(lib, first, 'Violon - cours');
  lib = selectList(lib, first);
  assert.equal(currentList(lib).name, 'Violon - cours');
});

test('deleteList picks another current list', () => {
  const lib = addList(createLibrary(), 'Piano');
  const after = deleteList(lib, lib.currentListId);
  assert.equal(after.lists.length, 1);
  assert.equal(currentList(after).name, 'Mes morceaux');
});

test('deleteList keeps the last list', () => {
  const lib = createLibrary();
  assert.equal(deleteList(lib, lib.currentListId).lists.length, 1);
});

test('addTrackToList creates the track with default settings', () => {
  const lib = createLibrary();
  const after = addTrackToList(lib, lib.currentListId, BOURREE, 42);
  const id = trackId(BOURREE.name, BOURREE.size);
  assert.deepEqual(currentList(after).trackIds, [id]);
  assert.deepEqual(after.tracks[id], {
    id, name: 'Bourrée.mp3', size: 1234, markers: [], loop: null,
    loopActive: false, speed: 100, semitones: 0, modifiedAt: 42,
  });
});

test('addTrackToList ignores duplicates', () => {
  let lib = createLibrary();
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 1);
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 2);
  assert.equal(currentList(lib).trackIds.length, 1);
});

test('addTrackToList keeps existing settings', () => {
  let lib = createLibrary();
  const id = trackId(BOURREE.name, BOURREE.size);
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 1);
  lib = updateTrack(lib, id, { speed: 75 }, 2);
  lib = addList(lib, 'Piano');
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 3);
  assert.equal(lib.tracks[id].speed, 75);
});

test('removeTrackFromList keeps the track settings', () => {
  let lib = createLibrary();
  const id = trackId(BOURREE.name, BOURREE.size);
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 1);
  lib = removeTrackFromList(lib, lib.currentListId, id);
  assert.deepEqual(currentList(lib).trackIds, []);
  assert.ok(lib.tracks[id]);
});

test('updateTrack sets modifiedAt', () => {
  let lib = createLibrary();
  const id = trackId(BOURREE.name, BOURREE.size);
  lib = addTrackToList(lib, lib.currentListId, BOURREE, 1);
  lib = updateTrack(lib, id, { semitones: 2 }, 99);
  assert.equal(lib.tracks[id].semitones, 2);
  assert.equal(lib.tracks[id].modifiedAt, 99);
});

test('matchesTrack rejects another file', () => {
  const track = { name: 'Bourrée.mp3', size: 1234 };
  assert.equal(matchesTrack(track, { name: 'Bourrée.mp3', size: 1234 }), true);
  assert.equal(matchesTrack(track, { name: 'Bourrée.mp3', size: 999 }), false);
  assert.equal(matchesTrack(track, { name: 'Gavotte.mp3', size: 1234 }), false);
});

test('matchesTrack ignores how accents are encoded and a utf-8 prefix', () => {
  const decomposed = { name: 'Bourre\u0301e.mp3', size: 1234 };
  assert.equal(matchesTrack(decomposed, { name: 'Bourr\u00e9e.mp3', size: 1234 }), true);
  const prefixed = { name: "utf-8''Branle Th\u00e8me.mp3", size: 1234 };
  assert.equal(matchesTrack(prefixed, { name: 'Branle Th\u00e8me.mp3', size: 1234 }), true);
});

test('addTrackToList reuses a track whose name is encoded differently', () => {
  const empty = createLibrary();
  const listId = empty.currentListId;
  const lib = addTrackToList(empty, listId, { name: 'Bourre\u0301e.mp3', size: 1234 }, 1);
  const again = addTrackToList(lib, listId, { name: 'Bourr\u00e9e.mp3', size: 1234 }, 2);
  assert.equal(Object.keys(again.tracks).length, 1);
  assert.equal(findTrackId(again, { name: "utf-8''Bourr\u00e9e.mp3", size: 1234 }), 'Bourre\u0301e.mp3|1234');
  assert.equal(findTrackId(again, { name: 'Gavotte.mp3', size: 1234 }), 'Gavotte.mp3|1234');
});

test('functions do not modify their arguments', () => {
  const lib = createLibrary();
  const copy = structuredClone(lib);
  addList(lib, 'Piano');
  addTrackToList(lib, lib.currentListId, BOURREE, 1);
  renameList(lib, lib.currentListId, 'X');
  assert.deepEqual(lib, copy);
});

test('lastTrack returns the last opened track, or null', () => {
  let lib = createLibrary();
  assert.equal(lastTrack(lib), null);
  lib = addTrackToList(lib, currentList(lib).id, BOURREE, 1);
  const id = trackId(BOURREE.name, BOURREE.size);
  lib = setLastTrack(lib, id);
  assert.equal(lastTrack(lib).name, 'Bourrée.mp3');
  lib = removeTrackFromList(lib, currentList(lib).id, id);
  assert.equal(lastTrack(lib), null);
});

// --- Synchronisation ---

const GAVOTTE = { name: 'Gavotte.mp3', size: 99 };

function libWith(file, now) {
  const lib = createLibrary();
  return addTrackToList(lib, currentList(lib).id, file, now);
}

test('mergeLibraries keeps the most recent version of each track', () => {
  const id = trackId(BOURREE.name, BOURREE.size);
  const local = updateTrack(libWith(BOURREE, 1), id, { speed: 70 }, 10);
  const remote = fromSyncFile(toSyncFile(updateTrack(local, id, { speed: 50 }, 20)));
  assert.equal(mergeLibraries(local, remote).tracks[id].speed, 50);
  const older = fromSyncFile(toSyncFile(updateTrack(local, id, { speed: 50 }, 5)));
  assert.equal(mergeLibraries(local, older).tracks[id].speed, 70);
});

test('mergeLibraries keeps tracks present on one side only', () => {
  const local = libWith(BOURREE, 1);
  const remote = fromSyncFile(toSyncFile(libWith(GAVOTTE, 1)));
  const merged = mergeLibraries(local, remote);
  assert.ok(merged.tracks[trackId(BOURREE.name, BOURREE.size)]);
  assert.ok(merged.tracks[trackId(GAVOTTE.name, GAVOTTE.size)]);
});

test('mergeLibraries takes the most recent block of lists', () => {
  const local = { ...libWith(BOURREE, 1), listsModifiedAt: 10 };
  const newer = { ...addList(local, 'Piano'), listsModifiedAt: 20 };
  assert.equal(mergeLibraries(local, fromSyncFile(toSyncFile(newer))).lists.length, 2);
  const older = { ...addList(local, 'Piano'), listsModifiedAt: 5 };
  assert.equal(mergeLibraries(local, fromSyncFile(toSyncFile(older))).lists.length, 1);
});

test('mergeLibraries treats a missing listsModifiedAt as 0', () => {
  const local = libWith(BOURREE, 1); // ancienne bibliothèque, sans date
  const remote = fromSyncFile(toSyncFile({ ...addList(local, 'Piano'), listsModifiedAt: 1 }));
  assert.equal(mergeLibraries(local, remote).lists.length, 2);
});

test('mergeLibraries keeps the local current list and last track', () => {
  let local = addList(libWith(BOURREE, 1), 'Piano');  // Piano affichée
  local = setLastTrack({ ...local, listsModifiedAt: 1 }, trackId(BOURREE.name, BOURREE.size));
  const remote = fromSyncFile(toSyncFile({ ...deleteList(local, local.currentListId), listsModifiedAt: 9 }));
  const merged = mergeLibraries(local, remote);
  assert.equal(merged.lastTrackId, local.lastTrackId);
  assert.equal(merged.currentListId, merged.lists[0].id); // Piano a disparu
});

test('fromSyncFile rejects unreadable or unknown files', () => {
  assert.equal(fromSyncFile('{'), null);
  assert.equal(fromSyncFile('{"version":2}'), null);
});

test('toSyncFile leaves out what belongs to the device', () => {
  const text = toSyncFile(setLastTrack(libWith(BOURREE, 1), 'x'));
  assert.ok(!text.includes('currentListId'));
  assert.ok(!text.includes('lastTrackId'));
});

test('stampLists dates the library only when lists changed', () => {
  const before = libWith(BOURREE, 1);
  assert.equal(stampLists(before, addList(before, 'Piano'), 42).listsModifiedAt, 42);
  const same = updateTrack(before, trackId(BOURREE.name, BOURREE.size), { speed: 60 }, 3);
  assert.equal(stampLists(before, same, 42).listsModifiedAt, undefined);
});

// L'horloge de l'autre appareil avance : ses listes arrivent datées de 2000
// alors qu'il est 1000 ici. Un morceau ajouté ensuite dans la deuxième liste
// ne doit pas disparaître à la synchro suivante.
test('stampLists dates after the lists received from a clock ahead', () => {
  const fromOtherDevice = { ...addList(libWith(BOURREE, 1), 'Piano'), listsModifiedAt: 2000 };
  const local = selectList(fromOtherDevice, fromOtherDevice.lists[1].id);
  const withGavotte = stampLists(local, addTrackToList(local, local.currentListId, GAVOTTE, 1000), 1000);
  const merged = mergeLibraries(withGavotte, fromSyncFile(toSyncFile(fromOtherDevice)));
  assert.deepEqual(currentList(merged).trackIds, [trackId(GAVOTTE.name, GAVOTTE.size)]);
});
