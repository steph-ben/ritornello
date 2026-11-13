// Logique d'un morceau : marqueurs, boucle, réglages, affichage du temps.
// Fonctions pures : elles ne touchent ni au navigateur ni à leurs arguments.

export const MIN_SPEED = 25;
export const MAX_SPEED = 200;
export const SPEED_STEP = 5;
export const MAX_SEMITONES = 12;

// Un marqueur : { id, time, name }. La liste est toujours triée par temps.
export function addMarker(markers, time) {
  const id = markers.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const marker = { id, time, name: `marker ${id}` };
  return [...markers, marker].sort((a, b) => a.time - b.time);
}

export function removeMarker(markers, id) {
  return markers.filter(m => m.id !== id);
}

export function renameMarker(markers, id, name) {
  return markers.map(m => (m.id === id ? { ...m, name } : m));
}

// Numéro affiché : position dans l'ordre du temps, à partir de 1.
export function markerNumber(markers, id) {
  return markers.findIndex(m => m.id === id) + 1;
}

// Début et fin de la boucle, ou null si elle est impossible
// (marqueur absent, ou deux marqueurs au même instant).
export function loopBounds(markers, loop) {
  if (!loop) return null;
  const from = markers.find(m => m.id === loop.fromId);
  const to = markers.find(m => m.id === loop.toId);
  if (!from || !to || from.time === to.time) return null;
  return { start: Math.min(from.time, to.time), end: Math.max(from.time, to.time) };
}

// Où sauter quand la lecture arrive à `time` : au début de la boucle si on a
// atteint ou dépassé sa fin, sinon null (pas de saut).
export function positionAfterTick(time, bounds) {
  if (bounds && time >= bounds.end) return bounds.start;
  return null;
}

export function stepSpeed(percent, direction) {
  return clamp(percent + direction * SPEED_STEP, MIN_SPEED, MAX_SPEED);
}

export function stepSemitones(semitones, direction) {
  return clamp(semitones + direction, -MAX_SEMITONES, MAX_SEMITONES);
}

// 292 -> "04:52"
export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const secs = String(whole % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
