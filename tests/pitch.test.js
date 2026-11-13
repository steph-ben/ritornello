import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, stringsFor, nearestString, centsBetween, noteName } from '../pitch.js';

const SAMPLE_RATE = 44100;

// Son de 4096 échantillons : un sinus, avec des harmoniques si on en donne.
function tone(frequency, harmonics = [1]) {
  const samples = new Float32Array(4096);
  for (let i = 0; i < samples.length; i++) {
    harmonics.forEach((weight, index) => {
      samples[i] += 0.3 * weight * Math.sin(2 * Math.PI * frequency * (index + 1) * i / SAMPLE_RATE);
    });
  }
  return samples;
}

function assertDetected(samples, expected) {
  const found = detectPitch(samples, SAMPLE_RATE);
  assert.ok(found !== null, `rien détecté pour ${expected} Hz`);
  assert.ok(Math.abs(centsBetween(found, expected)) < 3, `${found} Hz au lieu de ${expected} Hz`);
}

for (const frequency of [82.41, 196, 440, 659.25, 1400]) {
  test(`detectPitch finds a sine at ${frequency} Hz`, () => assertDetected(tone(frequency), frequency));
}

test('detectPitch finds the fundamental of a sound with harmonics', () => {
  for (const frequency of [82.41, 196, 440, 659.25]) {
    assertDetected(tone(frequency, [1, 0.6, 0.4, 0.2]), frequency);
  }
});

test('detectPitch finds the fundamental when it is weaker than the second harmonic', () => {
  assertDetected(tone(196, [0.5, 1, 0.3]), 196);
});

test('detectPitch returns null for silence', () => {
  assert.equal(detectPitch(new Float32Array(4096), SAMPLE_RATE), null);
});

test('detectPitch returns null for a very quiet sound', () => {
  const quiet = tone(440).map(value => value * 0.01);
  assert.equal(detectPitch(quiet, SAMPLE_RATE), null);
});

test('detectPitch returns null for noise', () => {
  let seed = 1;
  const noise = new Float32Array(4096).map(() => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647 - 0.5) * 0.6;
  });
  assert.equal(detectPitch(noise, SAMPLE_RATE), null);
});

test('stringsFor gives the violin strings at A 440', () => {
  const strings = stringsFor('violon', 440);
  assert.deepEqual(strings.map(s => `${s.name} ${s.octave}`), ['Sol 3', 'Ré 4', 'La 4', 'Mi 5']);
  assert.ok(Math.abs(strings[2].frequency - 440) < 0.001);
  assert.ok(Math.abs(strings[0].frequency - 196) < 0.01);
});

test('stringsFor gives the guitar strings', () => {
  const strings = stringsFor('guitare', 440);
  assert.deepEqual(strings.map(s => `${s.name} ${s.octave}`),
    ['Mi 2', 'La 2', 'Ré 3', 'Sol 3', 'Si 3', 'Mi 4']);
  assert.ok(Math.abs(strings[0].frequency - 82.41) < 0.01);
});

test('stringsFor follows the reference A', () => {
  const la = stringsFor('violon', 442).find(s => s.name === 'La');
  assert.ok(Math.abs(la.frequency - 442) < 0.001);
});

test('nearestString picks the string nearest in cents', () => {
  const violin = stringsFor('violon', 440);
  assert.equal(nearestString(438, violin).name, 'La');
  assert.equal(nearestString(200, violin).name, 'Sol');
  assert.equal(nearestString(600, violin).name, 'Mi');
});

test('centsBetween measures a semitone as 100 cents', () => {
  assert.ok(Math.abs(centsBetween(440 * 2 ** (1 / 12), 440) - 100) < 1e-6);
  assert.equal(centsBetween(440, 440), 0);
});

test('noteName names A 440 as La 4 with 0 cents', () => {
  const note = noteName(440, 440);
  assert.equal(note.name, 'La');
  assert.equal(note.octave, 4);
  assert.ok(Math.abs(note.cents) < 1e-6);
});

test('noteName writes sharps with ♯ and gives the gap in cents', () => {
  const note = noteName(466.16 * 1.01, 440);
  assert.equal(note.name, 'La♯');
  assert.equal(note.octave, 4);
  assert.ok(note.cents > 15 && note.cents < 20);
});

test('noteName gives the right octave for low and high notes', () => {
  assert.equal(noteName(82.41, 440).octave, 2);
  assert.equal(noteName(261.63, 440).name, 'Do');
  assert.equal(noteName(261.63, 440).octave, 4);
});
