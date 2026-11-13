import test from 'node:test';
import assert from 'node:assert/strict';
import { computePeaks } from '../waveform.js';

test('computePeaks takes the max absolute value per slice', () => {
  const s = new Float32Array([0.1, -0.8, 0.3, 0.2, -0.1, 0.05]);
  assert.deepEqual(Array.from(computePeaks(s, 2)).map(v => +v.toFixed(2)), [0.8, 0.2]);
});

test('computePeaks handles fewer samples than peaks', () => {
  assert.equal(computePeaks(new Float32Array([0.5]), 4).length, 4);
});

test('computePeaks handles one hour of audio quickly', () => {
  const s = new Float32Array(44100 * 3600);
  const t0 = performance.now();
  computePeaks(s, 2000);
  assert.ok(performance.now() - t0 < 1000);
});
