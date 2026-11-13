// Relie l'écran au lecteur (player.js), à la logique du morceau (track.js)
// et au dessin de la barre de temps (waveform.js).

import * as player from './player.js';
import { addMarker, removeMarker, renameMarker, markerNumber, loopBounds,
  positionAfterTick, stepSpeed, stepSemitones, formatTime } from './track.js';
import { computePeaks, drawTimeline, timeAtX } from './waveform.js';

const REFRESH_MS = 50;   // mise à jour de l'écran pendant la lecture
const JUMP_SECONDS = 5;  // recul et avance
const PEAK_COUNT = 800;  // barres de la forme d'onde

const $ = id => document.getElementById(id);
const canvas = $('timeline');
const playButton = $('play-button');
const transportButtons = ['go-start', 'go-back', 'go-forward', 'add-marker'].map($);

// État du morceau ouvert
let duration = 0;
let peaks = null;
let markers = [];
let loop = null;          // { fromId, toId } : les deux marqueurs choisis
let loopActive = false;
let speed = 100;
let semitones = 0;
let refreshTimer = null;
let wakeLock = null;

$('open-button').addEventListener('click', openTrack);
playButton.addEventListener('click', togglePlay);
$('go-start').addEventListener('click', () => seekTo(0));
$('go-back').addEventListener('click', () => seekTo(player.getCurrentTime() - JUMP_SECONDS));
$('go-forward').addEventListener('click', () => seekTo(player.getCurrentTime() + JUMP_SECONDS));
$('pitch-down').addEventListener('click', () => changeSemitones(-1));
$('pitch-up').addEventListener('click', () => changeSemitones(1));
$('speed-down').addEventListener('click', () => changeSpeed(-1));
$('speed-up').addEventListener('click', () => changeSpeed(1));
$('add-marker').addEventListener('click', onAddMarker);
$('loop-from').addEventListener('change', onLoopSelect);
$('loop-to').addEventListener('change', onLoopSelect);
$('loop-button').addEventListener('click', toggleLoop);
canvas.addEventListener('pointerdown', event => {
  if (duration > 0) seekTo(timeAtX(canvas, event.offsetX, duration));
});
window.addEventListener('resize', renderTime);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && player.isPlaying()) keepScreenOn();
});
// SoundTouchJS s'arrête environ 0,35 s avant la vraie fin : une boucle dont
// le dernier marqueur est tout au bout n'atteindrait jamais sa fin.
player.onEnded(() => {
  const bounds = loopActive ? loopBounds(markers, loop) : null;
  if (bounds) {
    player.seek(bounds.start);
    player.play();
    return;
  }
  stopPlayback();
  player.seek(0);
  renderTime();
});

renderSettings();
renderMarkers();
renderTime();

// --- Morceau ---

async function openTrack() {
  if (!window.showOpenFilePicker) {
    showMessage("Ce navigateur ne permet pas d'ouvrir les fichiers. Utilisez Chrome sur Android, ou Brave avec l'option file-system-access-api.");
    return;
  }
  let handle;
  try {
    // Pas de filtre de type : sinon Proton Drive grise tous les fichiers.
    [handle] = await window.showOpenFilePicker();
  } catch {
    return; // sélecteur fermé sans choisir
  }
  let file;
  try {
    file = await handle.getFile();
  } catch {
    showMessage(`Impossible d'ouvrir ${handle.name} : le fichier n'est pas accessible.`);
    return;
  }
  try {
    const track = await player.loadAudio(await file.arrayBuffer());
    stopPlayback();
    duration = track.duration;
    peaks = computePeaks(track.samples, PEAK_COUNT);
    markers = [];
    loop = null;
    loopActive = false;
    $('track-name').textContent = file.name;
    hideMessage();
  } catch {
    showMessage(`Impossible de lire ${file.name} : format non reconnu, ou fichier trop long pour la mémoire.`);
  }
  renderMarkers();
  renderTime();
}

// --- Lecture ---

function togglePlay() {
  if (player.isPlaying()) {
    stopPlayback();
  } else {
    player.play();
    refreshTimer = setInterval(onTick, REFRESH_MS);
    keepScreenOn();
  }
  renderTime();
}

function stopPlayback() {
  player.pause();
  clearInterval(refreshTimer);
  refreshTimer = null;
  releaseScreen();
}

function seekTo(seconds) {
  player.seek(seconds);
  renderTime();
}

// Appelé toutes les 50 ms pendant la lecture.
function onTick() {
  if (loopActive) {
    const jump = positionAfterTick(player.getCurrentTime(), loopBounds(markers, loop));
    if (jump !== null) player.seek(jump);
  }
  renderTime();
}

function changeSpeed(direction) {
  speed = stepSpeed(speed, direction);
  player.setSpeed(speed);
  renderSettings();
}

function changeSemitones(direction) {
  semitones = stepSemitones(semitones, direction);
  player.setSemitones(semitones);
  renderSettings();
}

// --- Marqueurs et boucle ---

function onAddMarker() {
  markers = addMarker(markers, player.getCurrentTime());
  updateLoopAfterMarkerChange();
  renderMarkers();
  renderTime();
}

function onDeleteMarker(id) {
  markers = removeMarker(markers, id);
  updateLoopAfterMarkerChange();
  renderMarkers();
  renderTime();
}

function onRenameMarker(id, name) {
  markers = renameMarker(markers, id, name);
  renderMarkers();
}

function onLoopSelect() {
  loop = { fromId: Number($('loop-from').value), toId: Number($('loop-to').value) };
  if (!loopBounds(markers, loop)) loopActive = false;
  renderMarkers();
  renderTime();
}

function toggleLoop() {
  loopActive = !loopActive && loopBounds(markers, loop) !== null;
  renderMarkers();
  renderTime();
}

// Si un marqueur de la boucle a disparu, la boucle se coupe. Ensuite, on
// propose par défaut les deux premiers marqueurs.
function updateLoopAfterMarkerChange() {
  const loopStillValid = loopBounds(markers, loop) !== null;
  if (!loopStillValid) {
    loopActive = false;
    loop = markers.length >= 2 ? { fromId: markers[0].id, toId: markers[1].id } : null;
  }
}

// --- Écran allumé pendant la lecture ---

async function keepScreenOn() {
  if (!navigator.wakeLock || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null; // refusé (batterie faible, page cachée) : on continue sans
  }
}

function releaseScreen() {
  if (wakeLock) wakeLock.release();
  wakeLock = null;
}

// --- Affichage ---

// Ce qui bouge pendant la lecture : compteurs, canvas, bouton lecture.
function renderTime() {
  const currentTime = player.getCurrentTime();
  const bounds = loopActive ? loopBounds(markers, loop) : null;
  $('counter-time').textContent = formatTime(currentTime);
  $('counter-loop').hidden = !bounds;
  if (bounds) $('counter-loop').textContent = `${formatTime(bounds.start)} ⇄ ${formatTime(bounds.end)}`;
  $('clock').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

  const playing = player.isPlaying();
  playButton.textContent = playing ? '⏸' : '▶';
  playButton.setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
  playButton.disabled = duration === 0;
  transportButtons.forEach(button => { button.disabled = duration === 0; });

  drawTimeline(canvas, { peaks, duration, currentTime, markers, bounds });
}

function renderSettings() {
  $('pitch-value').textContent = semitones > 0 ? `+${semitones}` : String(semitones);
  $('speed-value').textContent = `${speed} %`;
}

// Ce qui change seulement quand on touche aux marqueurs ou à la boucle.
function renderMarkers() {
  const list = $('marker-list');
  list.replaceChildren(...markers.map(markerItem));

  fillLoopSelect($('loop-from'), loop?.fromId);
  fillLoopSelect($('loop-to'), loop?.toId);

  const loopButton = $('loop-button');
  loopButton.disabled = loopBounds(markers, loop) === null;
  loopButton.setAttribute('aria-pressed', String(loopActive));

  const badge = $('loop-badge');
  badge.hidden = !loopActive;
  if (loopActive) {
    const [first, second] = [markerNumber(markers, loop.fromId), markerNumber(markers, loop.toId)].sort((a, b) => a - b);
    badge.textContent = `${first}–${second}`;
  }
}

function markerItem(marker) {
  const item = document.createElement('li');

  const number = document.createElement('span');
  number.className = 'number';
  number.textContent = markerNumber(markers, marker.id);

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = formatTime(marker.time);

  const name = document.createElement('input');
  name.value = marker.name;
  name.setAttribute('aria-label', 'Nom du marqueur');
  name.addEventListener('change', () => onRenameMarker(marker.id, name.value));

  const remove = document.createElement('button');
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Supprimer le marqueur');
  remove.addEventListener('click', () => onDeleteMarker(marker.id));

  item.append(number, time, name, remove);
  return item;
}

function fillLoopSelect(select, selectedId) {
  const options = markers.map(marker => {
    const option = document.createElement('option');
    option.value = marker.id;
    option.textContent = `${markerNumber(markers, marker.id)} · ${marker.name}`;
    option.selected = marker.id === selectedId;
    return option;
  });
  select.replaceChildren(...options);
  select.disabled = markers.length < 2;
}

function showMessage(text) {
  $('message').textContent = text;
  $('message').hidden = false;
}

function hideMessage() {
  $('message').hidden = true;
}
