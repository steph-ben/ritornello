import test from 'node:test';
import assert from 'node:assert/strict';
import { addMarker, removeMarker, renameMarker, markerNumber, loopBounds,
  positionAfterTick, stepSpeed, stepSemitones, formatTime, tapLoop } from '../track.js';

test('addMarker keeps markers sorted by time with stable ids', () => {
  let m = addMarker([], 30);
  m = addMarker(m, 10);
  assert.deepEqual(m, [
    { id: 2, time: 10, name: 'marker 2' },
    { id: 1, time: 30, name: 'marker 1' },
  ]);
  assert.equal(markerNumber(m, 1), 2);
});

test('addMarker does not modify its argument', () => {
  const m = addMarker([], 5);
  addMarker(m, 7);
  assert.equal(m.length, 1);
});

test('removeMarker and renameMarker', () => {
  const m = addMarker(addMarker([], 1), 2);
  assert.deepEqual(removeMarker(m, 1).map(x => x.id), [2]);
  assert.equal(renameMarker(m, 2, 'refrain')[1].name, 'refrain');
});

test('loopBounds orders the two markers', () => {
  const m = addMarker(addMarker([], 51), 11);   // id 1 à 51 s, id 2 à 11 s
  assert.deepEqual(loopBounds(m, { fromId: 1, toId: 2 }), { start: 11, end: 51 });
});

test('loopBounds returns null when a marker is missing', () => {
  const m = addMarker([], 11);
  assert.equal(loopBounds(m, { fromId: 1, toId: 99 }), null);
  assert.equal(loopBounds(m, null), null);
});

test('loopBounds returns null for an empty loop', () => {
  const m = addMarker(addMarker([], 11), 11);
  assert.equal(loopBounds(m, { fromId: 1, toId: 1 }), null);
  assert.equal(loopBounds(m, { fromId: 1, toId: 2 }), null);
});

test('positionAfterTick jumps back at or after the loop end', () => {
  const b = { start: 11, end: 51 };
  assert.equal(positionAfterTick(30, b), null);
  assert.equal(positionAfterTick(51, b), 11);
  assert.equal(positionAfterTick(80, b), 11);
  assert.equal(positionAfterTick(80, null), null);
});

test('stepSpeed moves by 5 between 25 and 200', () => {
  assert.equal(stepSpeed(100, -1), 95);
  assert.equal(stepSpeed(25, -1), 25);
  assert.equal(stepSpeed(200, 1), 200);
});

test('stepSemitones moves by 1 between -12 and 12', () => {
  assert.equal(stepSemitones(0, 1), 1);
  assert.equal(stepSemitones(-12, -1), -12);
  assert.equal(stepSemitones(12, 1), 12);
});

test('formatTime gives mm:ss', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(14.9), '00:14');
  assert.equal(formatTime(292), '04:52');
  assert.equal(formatTime(3725), '62:05');
});

// Cinq marqueurs, ids 1 à 5 dans l'ordre du temps.
const FIVE = [10, 20, 30, 40, 50].map((time, i) => ({ id: i + 1, time, name: `m${i + 1}` }));

test('tapLoop: first tap loops from the marker to the next one', () => {
  assert.deepEqual(tapLoop(FIVE, null, false, 2), { fromId: 2, toId: 3 });
});

test('tapLoop: tapping another marker extends the loop', () => {
  assert.deepEqual(tapLoop(FIVE, { fromId: 2, toId: 3 }, true, 4), { fromId: 2, toId: 5 });
});

test('tapLoop: tapping inside a wide loop goes back to one section', () => {
  assert.deepEqual(tapLoop(FIVE, { fromId: 2, toId: 5 }, true, 3), { fromId: 3, toId: 4 });
});

test('tapLoop: the last marker loops to the end of the track', () => {
  assert.deepEqual(tapLoop(FIVE, null, false, 5), { fromId: 5, toId: null });
});

test('tapLoop: when the loop is off, a tap starts a new single section', () => {
  assert.deepEqual(tapLoop(FIVE, { fromId: 1, toId: 3 }, false, 4), { fromId: 4, toId: 5 });
});

test('tapLoop: an old reversed loop is read in time order', () => {
  assert.deepEqual(tapLoop(FIVE, { fromId: 4, toId: 2 }, true, 5), { fromId: 2, toId: null });
});

test('loopBounds: toId null means the end of the track', () => {
  assert.deepEqual(loopBounds(FIVE, { fromId: 5, toId: null }, 200), { start: 50, end: 200 });
  assert.equal(loopBounds(FIVE, { fromId: 5, toId: null }, 0), null);
});
