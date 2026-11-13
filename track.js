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
// `toId: null` veut dire « jusqu'à la fin du morceau » (`duration`).
export function loopBounds(markers, loop, duration = 0) {
  if (!loop) return null;
  const from = markers.find(m => m.id === loop.fromId);
  if (!from) return null;
  const toTime = loop.toId === null ? duration : markers.find(m => m.id === loop.toId)?.time;
  if (toTime === undefined || toTime === from.time) return null;
  if (loop.toId === null && toTime < from.time) return null; // durée pas encore connue
  return { start: Math.min(from.time, toTime), end: Math.max(from.time, toTime) };
}

// Nouvelle boucle quand on touche un marqueur. Une section va d'un
// marqueur au suivant (ou à la fin du morceau pour le dernier).
// - boucle coupée, ou on retouche la même section seule : cette section ;
// - on touche une section dans une boucle de plusieurs : cette section ;
// - sinon : la boucle s'étend jusqu'à la section touchée.
export function tapLoop(markers, loop, loopActive, tappedId) {
  const tapped = markers.findIndex(m => m.id === tappedId);
  const current = loopActive ? loopSections(markers, loop) : null;
  let first = tapped;
  let last = tapped;
  const insideWideLoop = current && current.first < current.last
    && tapped >= current.first && tapped <= current.last;
  if (current && !insideWideLoop) {
    first = Math.min(current.first, tapped);
    last = Math.max(current.last, tapped);
  }
  return { fromId: markers[first].id, toId: markers[last + 1]?.id ?? null };
}

// Première et dernière section (indices) couvertes par la boucle, ou null.
function loopSections(markers, loop) {
  if (!loop) return null;
  const from = markers.findIndex(m => m.id === loop.fromId);
  const to = loop.toId === null ? markers.length : markers.findIndex(m => m.id === loop.toId);
  if (from < 0 || to < 0 || from === to) return null;
  return { first: Math.min(from, to), last: Math.max(from, to) - 1 };
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
