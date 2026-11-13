import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary, trackId, addList, renameList, deleteList, selectList,
  currentList, addTrackToList, removeTrackFromList, updateTrack,
  matchesTrack } from '../library.js';

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

test('functions do not modify their arguments', () => {
  const lib = createLibrary();
  const copy = structuredClone(lib);
  addList(lib, 'Piano');
  addTrackToList(lib, lib.currentListId, BOURREE, 1);
  renameList(lib, lib.currentListId, 'X');
  assert.deepEqual(lib, copy);
});
