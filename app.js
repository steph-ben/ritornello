// Le lecteur : relie l'écran à player.js (son), track.js (marqueurs,
// boucle) et waveform.js (barre de temps). Les listes sont dans lists.js.

import * as player from './player.js';
import { addMarker, removeMarker, renameMarker, markerNumber, loopBounds,
  positionAfterTick, stepSpeed, stepSemitones, formatTime } from './track.js';
import { computePeaks, drawTimeline, timeAtX } from './waveform.js';
import { initLists, saveTrackSettings } from './lists.js';

const REFRESH_MS = 50;   // mise à jour de l'écran pendant la lecture
const JUMP_SECONDS = 5;  // recul et avance
const PEAK_COUNT = 800;  // barres de la forme d'onde

const $ = id => document.getElementById(id);
const canvas = $('timeline');
const playButton = $('play-button');
const transportButtons = ['go-start', 'go-back', 'go-forward', 'add-marker'].map($);

// État du morceau ouvert
let currentTrackId = null;
let duration = 0;
let peaks = null;
let markers = [];
let loop = null;          // { fromId, toId } : les deux marqueurs choisis
let loopActive = false;
let speed = 100;
let semitones = 0;
let refreshTimer = null;
let wakeLock = null;

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
player.onEnded(() => {
  stopPlayback();
  player.seek(0);
  renderTime();
});

renderSettings();
renderMarkers();
renderTime();
initLists({ onOpen: openFile, onMessage: showMessage });

// --- Morceau ---

// Charge le fichier dans le lecteur avec les réglages mémorisés du morceau.
// Renvoie true si ça a marché (appelé par lists.js).
async function openFile(file, track) {
  try {
    const audio = await player.loadAudio(await file.arrayBuffer());
    stopPlayback();
    duration = audio.duration;
    peaks = computePeaks(audio.samples, PEAK_COUNT);
  } catch {
    showMessage(`Impossible de lire ${file.name} : format non reconnu, ou fichier trop long pour la mémoire.`);
    return false;
  }
  currentTrackId = track.id;
  ({ markers, loop, loopActive, speed, semitones } = track);
  player.setSpeed(speed);
  player.setSemitones(semitones);
  applyLoop();
  $('track-name').textContent = file.name;
  hideMessage();
  renderSettings();
  renderMarkers();
  renderTime();
  return true;
}

// Garde les réglages du morceau ouvert (listes, mémoire).
function rememberSettings() {
  if (currentTrackId) saveTrackSettings(currentTrackId, { markers, loop, loopActive, speed, semitones });
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

// Appelé toutes les 50 ms pendant la lecture. Le moteur boucle tout seul ;
// ce test sert quand on déplace la lecture après la fin de la boucle.
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
  rememberSettings();
}

function changeSemitones(direction) {
  semitones = stepSemitones(semitones, direction);
  player.setSemitones(semitones);
  renderSettings();
  rememberSettings();
}

// --- Marqueurs et boucle ---

function onAddMarker() {
  markers = addMarker(markers, player.getCurrentTime());
  updateLoopAfterMarkerChange();
  applyLoop();
  rememberSettings();
  renderMarkers();
  renderTime();
}

function onDeleteMarker(id) {
  markers = removeMarker(markers, id);
  updateLoopAfterMarkerChange();
  applyLoop();
  rememberSettings();
  renderMarkers();
  renderTime();
}

function onRenameMarker(id, name) {
  markers = renameMarker(markers, id, name);
  rememberSettings();
  renderMarkers();
}

function onLoopSelect() {
  loop = { fromId: Number($('loop-from').value), toId: Number($('loop-to').value) };
  if (!loopBounds(markers, loop)) loopActive = false;
  applyLoop();
  rememberSettings();
  renderMarkers();
  renderTime();
}

function toggleLoop() {
  loopActive = !loopActive && loopBounds(markers, loop) !== null;
  applyLoop();
  rememberSettings();
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

// Transmet la boucle au moteur audio, qui boucle tout seul.
function applyLoop() {
  player.setLoop(loopActive ? loopBounds(markers, loop) : null);
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

// Copie hors ligne de l'app (sw.js). Sans service worker, l'app marche quand même.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
