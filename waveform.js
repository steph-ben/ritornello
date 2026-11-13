// Forme d'onde et barre de temps, dessinées dans un seul <canvas>.

import { markerNumber } from './track.js';

const BAR_HEIGHT = 26;          // bande du haut : pastilles des marqueurs
const PIN_RADIUS = 9;
const PIN_TOUCH = 22;           // distance (px) à laquelle un toucher prend la pastille
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

// Marqueur dont la pastille est sous le doigt (bande du haut), ou null.
export function markerAtPoint(canvas, x, y, markers, duration) {
  if (y > BAR_HEIGHT + 6 || duration <= 0) return null;
  let best = null;
  for (const marker of markers) {
    const distance = Math.abs((marker.time / duration) * canvas.clientWidth - x);
    if (distance <= PIN_TOUCH && (!best || distance < best.distance)) best = { id: marker.id, distance };
  }
  return best?.id ?? null;
}

export function drawTimeline(canvas, { peaks, duration, currentTime, markers, bounds }) {
  const ctx = prepareCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const colors = readColors(canvas);
  const xOf = time => (duration > 0 ? (time / duration) * width : 0);

  if (bounds) {
    ctx.fillStyle = colors.loop;
    ctx.fillRect(xOf(bounds.start), BAR_HEIGHT, xOf(bounds.end) - xOf(bounds.start), height - BAR_HEIGHT);
  }

  drawWave(ctx, peaks, width, height, xOf(currentTime), colors);
  drawMarkers(ctx, markers, xOf, height, colors);

  ctx.fillStyle = colors.playhead;
  ctx.fillRect(xOf(currentTime) - 1, BAR_HEIGHT, 2, height - BAR_HEIGHT);
}

function drawWave(ctx, peaks, width, height, playedX, colors) {
  if (!peaks) return;
  const middle = BAR_HEIGHT + (height - BAR_HEIGHT) / 2;
  const halfHeight = (height - BAR_HEIGHT) / 2;
  const barWidth = width / peaks.length;
  // Partie déjà jouée : dégradé magenta -> orange, avec un halo.
  const played = ctx.createLinearGradient(0, 0, width, 0);
  played.addColorStop(0, colors.wavePlayed);
  played.addColorStop(1, colors.wavePlayed2);
  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth;
    const h = Math.max(1, peaks[i] * halfHeight);
    ctx.fillStyle = x < playedX ? played : colors.wave;
    ctx.fillRect(x, middle - h, Math.max(1, barWidth - 0.5), 2 * h);
  }
}

function drawMarkers(ctx, markers, xOf, height, colors) {
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const middle = BAR_HEIGHT / 2;
  for (const marker of markers) {
    const x = xOf(marker.time);
    ctx.fillStyle = colors.marker;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x - 0.5, middle + PIN_RADIUS, 1, height);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, middle, PIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = colors.markerDisc;
    ctx.fill();
    ctx.strokeStyle = colors.marker;
    ctx.stroke();
    ctx.fillStyle = colors.marker;
    ctx.fillText(String(markerNumber(markers, marker.id)), x, middle + 0.5);
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
    loop: get('--timeline-loop'),
    wave: get('--wave'),
    wavePlayed: get('--wave-played'),
    wavePlayed2: get('--wave-played-2'),
    markerDisc: get('--marker-disc'),
    marker: get('--marker'),
    playhead: get('--playhead'),
  };
}
