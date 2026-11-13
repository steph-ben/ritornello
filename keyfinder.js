// Calculs purs de la tonalité (profil des notes, tonalité la plus proche).
// Testés dans tests/keyfinder.test.js.

const TARGET_RATE = 11025;   // on sous-échantillonne vers cette fréquence
const FRAME_SIZE = 8192;     // taille de la FFT, en échantillons sous-échantillonnés
const MAX_SECONDS = 90;      // durée analysée au plus, répartie sur tout le morceau
const MIN_FREQUENCY = 55;
const MAX_FREQUENCY = 2000;

// Profils de Krumhansl-Schmuckler : poids de chaque note par rapport à la tonique.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Noms fixes : Si♭ majeur et non La♯ majeur, Fa♯ mineur, etc.
const MAJOR_NAMES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const MINOR_NAMES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'];

// --- Profil des notes ---

// Nombre de trames analysées : tout le morceau s'il est court, sinon MAX_SECONDS
// de trames réparties sur la durée.
export function frameCount(samples, sampleRate) {
  const factor = downsampleFactor(sampleRate);
  const frameLength = FRAME_SIZE * factor;
  const available = Math.floor(samples.length / frameLength);
  const wanted = Math.ceil(MAX_SECONDS * sampleRate / frameLength);
  return Math.min(available, wanted);
}

// Énergie par note (Do = 0) des trames from (incluse) à to (exclue), non normalisée.
// On peut l'appeler par morceaux et additionner les résultats.
export function chromaOfFrames(samples, sampleRate, from, to) {
  const total = frameCount(samples, sampleRate);
  const factor = downsampleFactor(sampleRate);
  const rate = sampleRate / factor;
  const pitchClassOfBin = pitchClassesOfBins(rate);
  const chroma = new Array(12).fill(0);
  for (let frame = from; frame < to; frame++) {
    const start = frameStart(frame, total, samples.length, FRAME_SIZE * factor);
    const magnitudes = spectrum(downsampledFrame(samples, start, factor));
    magnitudes.forEach((magnitude, bin) => {
      if (pitchClassOfBin[bin] >= 0) chroma[pitchClassOfBin[bin]] += magnitude;
    });
  }
  return chroma;
}

// Profil des notes d'un morceau entier, normalisé (somme = 1).
export function chromaProfile(samples, sampleRate) {
  const chroma = chromaOfFrames(samples, sampleRate, 0, frameCount(samples, sampleRate));
  return normalize(chroma);
}

export function normalize(chroma) {
  const sum = chroma.reduce((a, b) => a + b, 0);
  return sum > 0 ? chroma.map(value => value / sum) : chroma;
}

function downsampleFactor(sampleRate) {
  return Math.max(1, Math.round(sampleRate / TARGET_RATE));
}

// Les trames sont réparties régulièrement du début à la fin du morceau.
function frameStart(frame, total, length, frameLength) {
  if (total <= 1) return 0;
  return Math.floor(frame * (length - frameLength) / (total - 1));
}

// Une trame sous-échantillonnée (moyenne de `factor` échantillons) avec fenêtre de Hann.
function downsampledFrame(samples, start, factor) {
  const frame = new Float64Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i++) {
    let sum = 0;
    for (let k = 0; k < factor; k++) sum += samples[start + i * factor + k];
    const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FRAME_SIZE - 1));
    frame[i] = sum / factor * hann;
  }
  return frame;
}

// Pour chaque case de la FFT : la note la plus proche (La4 = 440 Hz), ou -1 hors plage.
function pitchClassesOfBins(rate) {
  const result = new Int8Array(FRAME_SIZE / 2).fill(-1);
  for (let bin = 1; bin < result.length; bin++) {
    const frequency = bin * rate / FRAME_SIZE;
    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue;
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));
    result[bin] = ((midiNote % 12) + 12) % 12;
  }
  return result;
}

// Amplitude de chaque case de la FFT (la moitié utile).
function spectrum(frame) {
  const real = Float64Array.from(frame);
  const imaginary = new Float64Array(frame.length);
  fft(real, imaginary);
  return Array.from({ length: frame.length / 2 }, (_, i) => Math.hypot(real[i], imaginary[i]));
}

// FFT radix-2 sur place. La taille doit être une puissance de 2.
function fft(real, imaginary) {
  const size = real.length;
  reverseBitOrder(real, imaginary);
  for (let half = 1; half < size; half *= 2) {
    const angle = -Math.PI / half;
    for (let start = 0; start < size; start += 2 * half) {
      for (let k = 0; k < half; k++) {
        const cos = Math.cos(angle * k);
        const sin = Math.sin(angle * k);
        const a = start + k;
        const b = a + half;
        const re = real[b] * cos - imaginary[b] * sin;
        const im = real[b] * sin + imaginary[b] * cos;
        real[b] = real[a] - re;
        imaginary[b] = imaginary[a] - im;
        real[a] += re;
        imaginary[a] += im;
      }
    }
  }
}

function reverseBitOrder(real, imaginary) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
}

// --- Tonalité ---

// Les 24 tonalités possibles sont comparées au profil des notes : on garde
// celle dont la forme ressemble le plus (corrélation).
export function findKey(chroma) {
  let best = { tonic: 0, mode: 'majeur' };
  let bestScore = -Infinity;
  for (const [mode, profile] of [['majeur', MAJOR_PROFILE], ['mineur', MINOR_PROFILE]]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const score = correlation(chroma, rotate(profile, tonic));
      if (score > bestScore) {
        bestScore = score;
        best = { tonic, mode };
      }
    }
  }
  return best;
}

// Le profil, décalé pour que sa tonique soit sur la note `tonic`.
function rotate(profile, tonic) {
  return profile.map((_, note) => profile[(note - tonic + 12) % 12]);
}

function correlation(a, b) {
  const meanA = a.reduce((x, y) => x + y, 0) / a.length;
  const meanB = b.reduce((x, y) => x + y, 0) / b.length;
  let covariance = 0, varianceA = 0, varianceB = 0;
  for (let i = 0; i < a.length; i++) {
    covariance += (a[i] - meanA) * (b[i] - meanB);
    varianceA += (a[i] - meanA) ** 2;
    varianceB += (b[i] - meanB) ** 2;
  }
  const denominator = Math.sqrt(varianceA * varianceB);
  return denominator > 0 ? covariance / denominator : 0;
}

export function transposeKey(key, semitones) {
  return { tonic: (((key.tonic + semitones) % 12) + 12) % 12, mode: key.mode };
}

export function keyName(key) {
  const names = key.mode === 'majeur' ? MAJOR_NAMES : MINOR_NAMES;
  return `${names[key.tonic]} ${key.mode}`;
}
