// Forme d'onde et barre de temps, dessinées dans un seul <canvas>.

import { markerNumber } from './track.js';

const BAR_HEIGHT = 24;          // bande du haut : marqueurs et zone de boucle
const MAX_READS_PER_PEAK = 2000; // au-delà, on saute des échantillons

// Découpe les échantillons en `count` tranches et garde, pour chacune,
// la plus grande valeur absolue (entre 0 et 1).
export function computePeaks(samples, count) {
  const peaks = new Float32Array(count);
  const sliceSize = samples.length / count;
  const stride = Math.max(1, Math.floor(sliceSize / MAX_READS_PER_PEAK));
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * sliceSize);
    const end = Math.floor((i + 1) * sliceSize);
    let max = 0;
    for (let j = start; j < end; j += stride) {
      const value = Math.abs(samples[j]);
      if (value > max) max = value;
    }
    peaks[i] = max;
  }
  return peaks;
}

// Position touchée (en px CSS depuis le bord gauche) -> secondes.
export function timeAtX(canvas, x, duration) {
  const ratio = x / canvas.clientWidth;
  return Math.min(duration, Math.max(0, ratio * duration));
}

export function drawTimeline(canvas, { peaks, duration, currentTime, markers, bounds }) {
  const ctx = prepareCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const colors = readColors(canvas);
  const xOf = time => (duration > 0 ? (time / duration) * width : 0);

  ctx.fillStyle = colors.bar;
  ctx.fillRect(0, 0, width, BAR_HEIGHT);

  if (bounds) {
    ctx.fillStyle = colors.loop;
    ctx.fillRect(xOf(bounds.start), 0, xOf(bounds.end) - xOf(bounds.start), height);
  }

  drawWave(ctx, peaks, width, height, xOf(currentTime), colors);
  drawMarkers(ctx, markers, xOf, height, colors);

  ctx.fillStyle = colors.playhead;
  ctx.fillRect(xOf(currentTime) - 1, 0, 2, height);
}

function drawWave(ctx, peaks, width, height, playedX, colors) {
  if (!peaks) return;
  const middle = BAR_HEIGHT + (height - BAR_HEIGHT) / 2;
  const halfHeight = (height - BAR_HEIGHT) / 2;
  const barWidth = width / peaks.length;
  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth;
    const h = Math.max(1, peaks[i] * halfHeight);
    ctx.fillStyle = x < playedX ? colors.wavePlayed : colors.wave;
    ctx.fillRect(x, middle - h, Math.max(1, barWidth - 0.5), 2 * h);
  }
}

function drawMarkers(ctx, markers, xOf, height, colors) {
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const marker of markers) {
    const x = xOf(marker.time);
    ctx.fillStyle = colors.marker;
    ctx.fillRect(x, 0, 1, height);
    ctx.fillText(String(markerNumber(markers, marker.id)), x + 3, BAR_HEIGHT / 2);
  }
}

// Ajuste la taille réelle du canvas à l'écran (net sur téléphone).
function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function readColors(canvas) {
  const style = getComputedStyle(canvas);
  const get = name => style.getPropertyValue(name).trim();
  return {
    bar: get('--timeline-bar'),
    loop: get('--timeline-loop'),
    wave: get('--wave'),
    wavePlayed: get('--wave-played'),
    marker: get('--marker'),
    playhead: get('--playhead'),
  };
}
