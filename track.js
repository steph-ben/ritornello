// Logique d'un morceau : marqueurs, boucle, réglages, affichage du temps.
// Fonctions pures : elles ne touchent ni au navigateur ni à leurs arguments.

export const MIN_SPEED = 25;
export const MAX_SPEED = 200;
export const SPEED_STEP = 5;
export const MAX_SEMITONES = 12;

// Un marqueur : { id, time }. La liste est toujours triée par temps.
export function addMarker(markers, time) {
  const id = markers.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const marker = { id, time };
  return [...markers, marker].sort((a, b) => a.time - b.time);
}

export function removeMarker(markers, id) {
  return markers.filter(m => m.id !== id);
}

// Déplace un marqueur (jamais avant 0) ; la liste reste triée par temps.
export function moveMarker(markers, id, time) {
  return markers.map(m => (m.id === id ? { ...m, time: Math.max(0, time) } : m))
    .sort((a, b) => a.time - b.time);
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

// Nouvelle boucle quand on touche un marqueur : elle va entre les deux
// derniers marqueurs touchés (`previousId`, puis `tappedId`), dans l'ordre
// du temps. Un marqueur touché seul boucle jusqu'au suivant (ou jusqu'à la
// fin du morceau pour le dernier).
export function tapLoop(markers, previousId, tappedId) {
  const tapped = markers.findIndex(m => m.id === tappedId);
  const previous = markers.findIndex(m => m.id === previousId);
  if (previous < 0 || previous === tapped) {
    return { fromId: tappedId, toId: markers[tapped + 1]?.id ?? null };
  }
  const [first, last] = [previous, tapped].sort((a, b) => a - b);
  return { fromId: markers[first].id, toId: markers[last].id };
}

// Où sauter quand la lecture est à `time` : au début de la boucle si on a
// atteint sa fin, ou si on joue avant son début ; sinon null (pas de saut).
// Petite marge avant le début : juste après un saut, le temps lu peut être
// à peine en dessous.
const BEFORE_START_MARGIN = 0.05;

export function positionAfterTick(time, bounds) {
  if (!bounds) return null;
  if (time >= bounds.end || time < bounds.start - BEFORE_START_MARGIN) return bounds.start;
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
