import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromaProfile, findKey, transposeKey, keyName } from '../keyfinder.js';

const SAMPLE_RATE = 44100;
const DO = 0, RE = 2, MI = 4, FA_DIESE = 6, SOL = 7, LA = 9, SI = 11;

// Fréquence d'une note : pitchClass 0-11 (0 = Do), dans l'octave 4.
function frequency(pitchClass) {
  return 440 * 2 ** ((pitchClass - 9) / 12);
}

// Somme de sinus : chaque note a un poids, la tonique et la quinte pèsent plus.
function synthesize(notes, seconds) {
  const samples = new Float32Array(SAMPLE_RATE * seconds);
  for (const [pitchClass, weight] of notes) {
    const step = 2 * Math.PI * frequency(pitchClass) / SAMPLE_RATE;
    for (let i = 0; i < samples.length; i++) samples[i] += weight * Math.sin(step * i);
  }
  return samples;
}

// Gamme de Ré majeur (Ré Mi Fa♯ Sol La Si Do♯), tonique et quinte renforcées.
const reMajeur = [[2, 3], [4, 1], [6, 2], [7, 1], [9, 2.5], [11, 1], [1, 0.7]];
// Gamme de La mineur naturel (La Si Do Ré Mi Fa Sol), tonique et quinte renforcées.
const laMineur = [[9, 3], [11, 1], [0, 2], [2, 1], [4, 2.5], [5, 1], [7, 0.7]];

test('Ré majeur synthétique est reconnu', () => {
  const chroma = chromaProfile(synthesize(reMajeur, 4), SAMPLE_RATE);
  assert.deepEqual(findKey(chroma), { tonic: RE, mode: 'majeur' });
});

test('La mineur synthétique est reconnu', () => {
  const chroma = chromaProfile(synthesize(laMineur, 4), SAMPLE_RATE);
  assert.deepEqual(findKey(chroma), { tonic: LA, mode: 'mineur' });
});

test('transposeKey monte et descend modulo 12', () => {
  assert.equal(transposeKey({ tonic: RE, mode: 'majeur' }, 2).tonic, MI);
  assert.equal(transposeKey({ tonic: DO, mode: 'mineur' }, -1).tonic, SI);
  assert.equal(transposeKey({ tonic: SI, mode: 'mineur' }, 1).mode, 'mineur');
});

test('keyName écrit les altérations comme d\'habitude', () => {
  assert.equal(keyName({ tonic: 10, mode: 'majeur' }), 'Si♭ majeur');
  assert.equal(keyName({ tonic: FA_DIESE, mode: 'mineur' }), 'Fa♯ mineur');
  assert.equal(keyName({ tonic: DO, mode: 'majeur' }), 'Do majeur');
  assert.equal(keyName({ tonic: 3, mode: 'majeur' }), 'Mi♭ majeur');
  assert.equal(keyName({ tonic: 1, mode: 'mineur' }), 'Do♯ mineur');
  assert.equal(keyName({ tonic: SOL, mode: 'mineur' }), 'Sol mineur');
});

test('un morceau de 3 minutes est analysé en moins de 2 s', () => {
  const samples = synthesize(reMajeur, 180);
  const start = performance.now();
  const key = findKey(chromaProfile(samples, SAMPLE_RATE));
  const elapsed = performance.now() - start;
  console.log(`analyse de 3 minutes : ${Math.round(elapsed)} ms`);
  assert.deepEqual(key, { tonic: RE, mode: 'majeur' });
  assert.ok(elapsed < 2000, `trop lent : ${elapsed} ms`);
});
