// Tonalité du morceau ouvert, comme CarlTune : analyse le son, puis l'affiche
// dans #track-key, décalée de la transposition. Voir les événements
// ritornello:* en bas de app.js.
import { chromaOfFrames, frameCount, normalize, findKey, transposeKey, keyName } from './keyfinder.js';

const FRAMES_PER_CHUNK = 8;   // après chaque morceau d'analyse, on rend la main à l'interface

const keyLabel = document.getElementById('track-key');

let trackId = null;
let originalKey = null;   // tonalité du fichier, null tant qu'elle est inconnue
let semitones = 0;

document.addEventListener('ritornello:track-opened', event => {
  const { track, samples, sampleRate } = event.detail;
  trackId = track.id;
  originalKey = track.key || null;
  semitones = track.semitones || 0;
  if (!samples) {   // une vidéo YouTube : pas d'accès au son
    keyLabel.textContent = '';
    return;
  }
  render();
  if (!originalKey) analyze(track.id, samples, sampleRate);
});

document.addEventListener('ritornello:semitones', event => {
  if (event.detail.trackId !== trackId) return;
  semitones = event.detail.semitones;
  if (event.detail.key) originalKey = event.detail.key;   // calculée sur un autre appareil
  render();
});

// Analyse par petits morceaux. Si un autre morceau s'ouvre entre-temps, on abandonne.
async function analyze(analyzedTrackId, samples, sampleRate) {
  const total = frameCount(samples, sampleRate);
  const chroma = new Array(12).fill(0);
  for (let from = 0; from < total; from += FRAMES_PER_CHUNK) {
    const to = Math.min(from + FRAMES_PER_CHUNK, total);
    chromaOfFrames(samples, sampleRate, from, to).forEach((value, note) => { chroma[note] += value; });
    await new Promise(resolve => setTimeout(resolve));
    if (trackId !== analyzedTrackId) return;
  }
  if (originalKey) return;   // arrivée entre-temps par la synchro
  originalKey = findKey(normalize(chroma));
  render();
  document.dispatchEvent(new CustomEvent('ritornello:key-found', { detail: { trackId: analyzedTrackId, key: originalKey } }));
}

function render() {
  keyLabel.textContent = '';
  if (!originalKey) {
    keyLabel.textContent = 'Tonalité…';
    return;
  }
  keyLabel.textContent = keyName(transposeKey(originalKey, semitones));
  if (semitones !== 0) keyLabel.append(originSpan());
}

function originSpan() {
  const origin = document.createElement('span');
  origin.className = 'track-key-origin';
  origin.textContent = ` · origine ${keyName(originalKey)}`;
  return origin;
}
