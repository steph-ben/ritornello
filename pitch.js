// Calculs purs de l'accordeur (hauteur d'un son, corde la plus proche).
// Testés dans tests/pitch.test.js.

const NOTE_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];

// Numéro MIDI des cordes à vide (La 4 = 69), de la plus grave à la plus aiguë.
const OPEN_STRINGS = {
  violon: [55, 62, 69, 76],
  guitare: [40, 45, 50, 55, 59, 64],
};

const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1500;
const MIN_RMS = 0.01; // en dessous, c'est du silence
const MIN_CLARITY = 0.8; // en dessous, ce n'est pas une note nette (bruit)
const PEAK_TOLERANCE = 0.9; // on prend le premier pic proche du meilleur

export function centsBetween(frequency, target) {
  return 1200 * Math.log2(frequency / target);
}

function frequencyOfMidi(midi, a4) {
  return a4 * 2 ** ((midi - 69) / 12);
}

function describeMidi(midi) {
  return { name: NOTE_NAMES[midi % 12], octave: Math.floor(midi / 12) - 1 };
}

export function noteName(frequency, a4) {
  const exactMidi = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(exactMidi);
  return { ...describeMidi(midi), cents: (exactMidi - midi) * 100 };
}

export function stringsFor(instrument, a4) {
  return OPEN_STRINGS[instrument].map(midi => ({
    ...describeMidi(midi),
    frequency: frequencyOfMidi(midi, a4),
  }));
}

export function nearestString(frequency, strings) {
  let best = strings[0];
  for (const string of strings) {
    if (Math.abs(centsBetween(frequency, string.frequency)) < Math.abs(centsBetween(frequency, best.frequency))) {
      best = string;
    }
  }
  return best;
}

function rootMeanSquare(samples) {
  let sum = 0;
  for (const value of samples) sum += value * value;
  return Math.sqrt(sum / samples.length);
}

// Fonction de différence normalisée de McLeod : proche de 1 quand le son
// se répète à l'identique après `lag` échantillons.
function normalizedSquareDifference(samples, windowSize, maxLag) {
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let correlation = 0;
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      correlation += samples[i] * samples[i + lag];
      energy += samples[i] * samples[i] + samples[i + lag] * samples[i + lag];
    }
    nsdf[lag] = energy > 0 ? (2 * correlation) / energy : 0;
  }
  return nsdf;
}

// Pics de la fonction : le plus haut point de chaque zone positive.
function findPeaks(nsdf, minLag) {
  const peaks = [];
  let lag = 1;
  while (lag < nsdf.length && nsdf[lag] > 0) lag++; // saute la zone du lag 0
  while (lag < nsdf.length) {
    while (lag < nsdf.length && nsdf[lag] <= 0) lag++;
    let best = -1;
    while (lag < nsdf.length && nsdf[lag] > 0) {
      if (best < 0 || nsdf[lag] > nsdf[best]) best = lag;
      lag++;
    }
    if (best >= minLag) peaks.push(best);
  }
  return peaks;
}

// Affine la position du pic avec une parabole passant par ses deux voisins.
function refineLag(nsdf, lag) {
  if (lag <= 0 || lag >= nsdf.length - 1) return lag;
  const before = nsdf[lag - 1];
  const after = nsdf[lag + 1];
  const curvature = before - 2 * nsdf[lag] + after;
  return curvature === 0 ? lag : lag + (before - after) / (2 * curvature);
}

export function detectPitch(samples, sampleRate) {
  if (rootMeanSquare(samples) < MIN_RMS) return null;

  const windowSize = Math.floor(samples.length / 2);
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.min(windowSize - 1, Math.ceil(sampleRate / MIN_FREQUENCY));
  const nsdf = normalizedSquareDifference(samples, windowSize, maxLag);

  const peaks = findPeaks(nsdf, minLag);
  if (peaks.length === 0) return null;
  const highest = Math.max(...peaks.map(lag => nsdf[lag]));
  if (highest < MIN_CLARITY) return null;

  const chosen = peaks.find(lag => nsdf[lag] >= PEAK_TOLERANCE * highest);
  return sampleRate / refineLag(nsdf, chosen);
}
