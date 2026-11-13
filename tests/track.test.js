import test from 'node:test';
import assert from 'node:assert/strict';
import { addMarker, removeMarker, markerNumber, loopBounds,
  positionAfterTick, stepSpeed, stepSemitones, formatTime, tapLoop, moveMarker } from '../track.js';

test('addMarker keeps markers sorted by time with stable ids', () => {
  let m = addMarker([], 30);
  m = addMarker(m, 10);
  assert.deepEqual(m, [
    { id: 2, time: 10 },
    { id: 1, time: 30 },
  ]);
  assert.equal(markerNumber(m, 1), 2);
});

test('addMarker does not modify its argument', () => {
  const m = addMarker([], 5);
  addMarker(m, 7);
  assert.equal(m.length, 1);
});

test('removeMarker', () => {
  const m = addMarker(addMarker([], 1), 2);
  assert.deepEqual(removeMarker(m, 1).map(x => x.id), [2]);
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

test('tapLoop: a marker touched alone loops to the next one', () => {
  assert.deepEqual(tapLoop(FIVE, null, 2), { fromId: 2, toId: 3 });
});

test('tapLoop: two markers touched one after the other loop between them', () => {
  assert.deepEqual(tapLoop(FIVE, 1, 2), { fromId: 1, toId: 2 });
  assert.deepEqual(tapLoop(FIVE, 2, 4), { fromId: 2, toId: 4 });
});

test('tapLoop: the order of the two touches does not matter', () => {
  assert.deepEqual(tapLoop(FIVE, 4, 2), { fromId: 2, toId: 4 });
});

test('tapLoop: the last marker touched alone loops to the end of the track', () => {
  assert.deepEqual(tapLoop(FIVE, null, 5), { fromId: 5, toId: null });
});

test('tapLoop: touching the same marker twice, or a deleted previous one, starts again', () => {
  assert.deepEqual(tapLoop(FIVE, 3, 3), { fromId: 3, toId: 4 });
  assert.deepEqual(tapLoop(FIVE, 99, 3), { fromId: 3, toId: 4 });
});

test('loopBounds: toId null means the end of the track', () => {
  assert.deepEqual(loopBounds(FIVE, { fromId: 5, toId: null }, 200), { start: 50, end: 200 });
  assert.equal(loopBounds(FIVE, { fromId: 5, toId: null }, 0), null);
});

test('positionAfterTick jumps to the loop start when playing before it', () => {
  const b = { start: 11, end: 51 };
  assert.equal(positionAfterTick(3, b), 11);
  assert.equal(positionAfterTick(10.98, b), null); // juste après un saut : on laisse jouer
});

test('moveMarker changes the time, keeps the order and never goes below 0', () => {
  let m = moveMarker(FIVE, 2, 45);
  assert.deepEqual(m.map(x => x.id), [1, 3, 4, 2, 5]);
  assert.equal(m.find(x => x.id === 2).time, 45);
  m = moveMarker(FIVE, 1, -3);
  assert.equal(m[0].time, 0);
  assert.equal(FIVE[1].time, 20); // argument inchangé
});
