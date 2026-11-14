// Le lecteur : relie l'écran à player.js (fichiers audio) ou youtube.js
// (vidéos), track.js (marqueurs, boucle) et waveform.js (barre de temps).
// Les listes sont dans lists.js.

import * as player from './player.js';
import * as youtube from './youtube.js';
import { addMarker, removeMarker, moveMarker, markerNumber, loopBounds, tapLoop,
  positionAfterTick, stepSpeed, stepSemitones, formatTime,
  MIN_SPEED, MAX_SPEED, MAX_SEMITONES } from './track.js';
import { computePeaks, drawTimeline, timeAtX, markerAtPoint } from './waveform.js';
import { initLists, saveTrackSettings, refreshLists } from './lists.js';
import { readFileBytes } from './readfile.js';

const REFRESH_MS = 50;   // mise à jour de l'écran pendant la lecture
const JUMP_SECONDS = 5;  // recul et avance
const PEAK_COUNT = 800;  // barres de la forme d'onde
const DRAG_STEP_PX = 18; // glisser sur un cadran : un pas tous les 18 px
const DOUBLE_TAP_MS = 300;
const SPEED_REPLY_MS = 300; // délai de réponse du lecteur YouTube après un changement de vitesse

const $ = id => document.getElementById(id);
const canvas = $('timeline');
const playButton = $('play-button');
const transportButtons = ['go-start', 'go-back', 'go-forward', 'add-marker'].map($);

// État du morceau ouvert
let engine = player;      // player.js pour un fichier, youtube.js pour une vidéo
let currentTrackId = null;
let duration = 0;
let peaks = null;
let markers = [];
let loop = null;          // { fromId, toId } ; toId null = fin du morceau
let loopActive = false;
let speed = 100;
let semitones = 0;
let refreshTimer = null;
let wakeLock = null;
let openMarkerId = null;  // marqueur dont le panneau ⋯ est ouvert
const NUDGE_SECONDS = 0.1;
let lastTappedId = null;  // dernier marqueur touché : la boucle va de lui au suivant touché
let passCount = 1;        // passages dans la boucle depuis son dernier changement
let lastTickTime = 0;

playButton.addEventListener('click', togglePlay);
$('go-start').addEventListener('click', () => seekTo(0));
$('go-back').addEventListener('click', () => seekTo(engine.getCurrentTime() - JUMP_SECONDS));
$('go-forward').addEventListener('click', () => seekTo(engine.getCurrentTime() + JUMP_SECONDS));
setupDial($('pitch-dial'), changeSemitones, () => changeSemitones(-semitones));
setupDial($('speed-dial'), changeSpeed, () => changeSpeed((100 - speed) / 5));
$('add-marker').addEventListener('click', onAddMarker);
$('loop-button').addEventListener('click', toggleLoop);
$('go-lists').addEventListener('click', () => {
  if (history.state?.player) history.back(); // passe par popstate
  else showListsScreen();
});
$('message').addEventListener('click', hideMessage);
canvas.addEventListener('pointerdown', event => {
  if (duration <= 0) return;
  const markerId = markerAtPoint(canvas, event.offsetX, event.offsetY, markers, duration);
  if (markerId !== null) onMarkerTap(markerId);
  else seekTo(timeAtX(canvas, event.offsetX, duration));
});
window.addEventListener('resize', renderTime);
window.addEventListener('popstate', () => { if (!history.state?.player) showListsScreen(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && engine.isPlaying()) keepScreenOn();
});
function onEnded() {
  stopPlayback();
  engine.seek(0);
  renderTime();
}
player.onEnded(onEnded);
youtube.onEnded(onEnded);

renderSettings();
renderMarkers();
renderTime();
// Après un rechargement, on repart de l'écran Listes.
if (history.state?.player) history.replaceState(null, '');
initLists({ onOpen: openFile, onOpenVideo: openVideo, onMessage: showMessage, onShowPlayer: showPlayerScreen, onTrackReplaced });

// --- Écrans ---

function showPlayerScreen() {
  if (!history.state?.player) history.pushState({ player: true }, '');
  $('lists-screen').hidden = true;
  $('player-screen').hidden = false;
  renderTime(); // le canvas n'a sa taille qu'une fois visible
}

// Retour aux listes (bouton ‹ ou retour d'Android) : la lecture s'arrête.
function showListsScreen() {
  stopPlayback();
  renderTime();
  $('player-screen').hidden = true;
  $('lists-screen').hidden = false;
  refreshLists();
}

// --- Morceau ---

// Charge le fichier dans le lecteur avec les réglages mémorisés du morceau.
// Renvoie true si ça a marché (appelé par lists.js).
async function openFile(file, track) {
  try {
    const audio = await player.loadAudio(await readFileBytes(file));
    stopPlayback();
    youtube.pause();
    engine = player;
    showVideo(false);
    duration = audio.duration;
    peaks = computePeaks(audio.samples, PEAK_COUNT);
  } catch (error) {
    // Le détail de l'erreur dit quelle étape a échoué (lecture du fichier,
    // démarrage du moteur audio ou décodage).
    console.error(error);
    showMessage(`Impossible de lire ${file.name} : format non reconnu, ou fichier trop long pour la mémoire. (${error?.name}: ${error?.message})`);
    return false;
  }
  currentTrackId = track.id;
  startTrack(track, file.name);
  announce('ritornello:track-opened', { track, samples: audio.samples, sampleRate: audio.sampleRate });
  return true;
}

// Charge la vidéo YouTube du morceau. Renvoie true si ça a marché
// (appelé par lists.js).
async function openVideo(track) {
  if (!navigator.onLine) {
    showMessage('Pas de réseau : une vidéo YouTube a besoin d\'internet.');
    return false;
  }
  try {
    stopPlayback();
    showVideo(true);
    showPlayerScreen();   // le lecteur YouTube doit être visible pour se charger
    const video = await youtube.loadVideo(track.videoId, $('video'));
    engine = youtube;
    duration = video.duration;
    peaks = null;
    if (track.name === track.videoId && video.title) saveTrackSettings(track.id, { name: video.title });
    startTrack(track, video.title || track.name);
  } catch (error) {
    console.error(error);
    showVideo(engine === youtube);
    showListsScreen();
    showMessage(`Impossible de lire la vidéo YouTube. (${error?.message})`);
    return false;
  }
  announce('ritornello:track-opened', { track, samples: null, sampleRate: 0 });
  return true;
}

// Reprend les réglages mémorisés du morceau et affiche le lecteur.
function startTrack(track, name) {
  currentTrackId = track.id;
  ({ markers, loop, loopActive, speed, semitones } = track);
  engine.setSpeed(speed);
  engine.setSemitones(semitones);
  applyLoop();
  $('track-name').textContent = name;
  openMarkerId = null;
  lastTappedId = null;
  passCount = 1;
  hideMessage();
  showPlayerScreen();
  renderSettings();
  setTimeout(renderSettings, SPEED_REPLY_MS);
  renderMarkers();
  renderTime();
}

// Une vidéo remplace la forme d'onde ; la barre de temps devient fine.
function showVideo(visible) {
  $('video').hidden = !visible;
  $('player-screen').classList.toggle('video-mode', visible);
}

// La synchro a apporté une autre version du morceau ouvert (modifié sur un
// autre appareil) : on reprend ses réglages, sans recharger le son.
function onTrackReplaced(track) {
  if (track.id !== currentTrackId) return;
  ({ markers, loop, loopActive, speed, semitones } = track);
  engine.setSpeed(speed);
  engine.setSemitones(semitones);
  applyLoop();
  openMarkerId = null;
  lastTappedId = null;
  if (engine === player) announce('ritornello:semitones', { trackId: track.id, semitones, key: track.key });
  renderSettings();
  renderMarkers();
  renderTime();
}

// Garde les réglages du morceau ouvert (listes, mémoire).
function rememberSettings() {
  if (currentTrackId) saveTrackSettings(currentTrackId, { markers, loop, loopActive, speed, semitones });
}

// --- Lecture ---

function togglePlay() {
  if (engine.isPlaying()) {
    stopPlayback();
  } else {
    engine.play();
    clearInterval(refreshTimer);   // la vidéo a pu être mise en pause depuis YouTube
    refreshTimer = setInterval(onTick, REFRESH_MS);
    keepScreenOn();
  }
  renderTime();
}

function stopPlayback() {
  engine.pause();
  clearInterval(refreshTimer);
  refreshTimer = null;
  releaseScreen();
}

function seekTo(seconds) {
  engine.seek(seconds);
  lastTickTime = engine.getCurrentTime();
  renderTime();
}

// Appelé toutes les 50 ms pendant la lecture. Le moteur boucle tout seul ;
// ce test sert quand on déplace la lecture après la fin de la boucle.
// Un saut en arrière pendant la boucle, c'est un nouveau passage.
function onTick() {
  const now = engine.getCurrentTime();
  if (loopActive) {
    const jump = positionAfterTick(now, currentBounds());
    if (jump !== null) engine.seek(jump);
    // Un passage : on a atteint la fin, ou le moteur est revenu au début tout seul.
    const reachedEnd = jump !== null && now >= currentBounds().end;
    if (reachedEnd || (jump === null && now < lastTickTime - 0.3)) countPass();
  }
  lastTickTime = engine.getCurrentTime();
  renderTime();
}

function countPass() {
  passCount += 1;
  const pass = $('counter-pass');
  pass.classList.remove('pulse');
  void pass.offsetWidth; // relance l'animation
  pass.classList.add('pulse');
}

function changeSpeed(direction) {
  speed = stepSpeed(speed, direction);
  engine.setSpeed(speed);
  renderSettings();
  setTimeout(renderSettings, SPEED_REPLY_MS);   // YouTube répond avec un léger retard
  rememberSettings();
}

function changeSemitones(direction) {
  if (engine === youtube) return;   // pas de transposition pour une vidéo
  semitones = stepSemitones(semitones, direction);
  engine.setSemitones(semitones);
  announce('ritornello:semitones', { trackId: currentTrackId, semitones });
  renderSettings();
  rememberSettings();
}

// --- Marqueurs et boucle ---

function onAddMarker() {
  markers = addMarker(markers, engine.getCurrentTime());
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


// Toucher un marqueur (ligne ou pastille) : boucle sa section, ou l'étend.
function onMarkerTap(id) {
  loop = tapLoop(markers, lastTappedId, id);
  lastTappedId = id;
  loopActive = currentBounds() !== null;
  passCount = 1;
  applyLoop();
  if (loopActive) seekTo(currentBounds().start);
  rememberSettings();
  renderMarkers();
  renderTime();
}

function toggleMarkerPanel(id) {
  openMarkerId = openMarkerId === id ? null : id;
  renderMarkers();
}

// Déplace un marqueur (à l'instant joué, ou de ±0,1 s).
function onMoveMarker(id, time) {
  markers = moveMarker(markers, id, Math.min(time, duration));
  updateLoopAfterMarkerChange();
  applyLoop();
  rememberSettings();
  renderMarkers();
  renderTime();
}

// Activer la boucle replace la lecture dedans si elle était ailleurs.
function toggleLoop() {
  loopActive = !loopActive && currentBounds() !== null;
  lastTappedId = null; // le prochain marqueur touché repart de zéro
  passCount = 1;
  applyLoop();
  if (loopActive && positionAfterTick(engine.getCurrentTime(), currentBounds()) !== null) {
    seekTo(currentBounds().start);
  }
  rememberSettings();
  renderMarkers();
  renderTime();
}

// Si un marqueur de la boucle a disparu, la boucle se coupe. Ensuite, on
// propose par défaut la première section.
function updateLoopAfterMarkerChange() {
  if (currentBounds() === null) {
    loopActive = false;
    loop = markers.length ? tapLoop(markers, null, markers[0].id) : null;
  }
}

function currentBounds() {
  return loopBounds(markers, loop, duration);
}

// Transmet la boucle au moteur audio, qui boucle tout seul.
function applyLoop() {
  engine.setLoop(loopActive ? currentBounds() : null);
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
  const currentTime = engine.getCurrentTime();
  const bounds = loopActive ? currentBounds() : null;
  $('counter-time').innerHTML = `${formatTime(currentTime)}<small>${hundredths(currentTime)}</small>`;
  $('counter-loop').textContent = bounds ? `${formatTime(bounds.start)} · ${formatTime(bounds.end)}` : '';
  $('counter-pass').textContent = bounds ? (passCount === 1 ? '1er passage' : `${passCount}e passage`) : '';
  $('clock').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  const here = document.querySelector('.marker-panel .here');
  if (here) here.textContent = `Placer à ${formatTime(currentTime)}`;

  renderPlayButton(engine.isPlaying());
  playButton.disabled = duration === 0;
  transportButtons.forEach(button => { button.disabled = duration === 0; });

  if (!$('player-screen').hidden) drawTimeline(canvas, { peaks, duration, currentTime, markers, bounds });
}

// On ne remplace l'icône que si l'état change : renderTime tourne toutes les
// 50 ms, et une icône remplacée entre l'appui et le relâchement du doigt
// annule le clic (le bouton pause ne marchait qu'une fois sur deux).
function renderPlayButton(playing) {
  const label = playing ? 'Pause' : 'Lecture';
  if (playButton.getAttribute('aria-label') === label) return;
  playButton.innerHTML = `<svg class="ico"><use href="#i-${playing ? 'pause' : 'play'}"/></svg>`;
  playButton.setAttribute('aria-label', label);
}

function renderSettings() {
  const isVideo = engine === youtube;
  $('pitch-dial').classList.toggle('disabled', isVideo);
  $('pitch-value').textContent = isVideo ? '—' : semitones > 0 ? `+${semitones}` : semitones < 0 ? `−${-semitones}` : '0';
  $('pitch-value').classList.toggle('changed', !isVideo && semitones !== 0);
  drawArc($('pitch-dial'), (semitones + MAX_SEMITONES) / (2 * MAX_SEMITONES));
  // Pour une vidéo, on montre la vitesse que le lecteur utilise vraiment.
  const shownSpeed = isVideo ? youtube.actualSpeed() : speed;
  $('speed-value').textContent = `${shownSpeed} %`;
  $('speed-value').classList.toggle('changed', shownSpeed !== 100);
  drawArc($('speed-dial'), (shownSpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED));
}

// Ce qui change seulement quand on touche aux marqueurs ou à la boucle.
function renderMarkers() {
  const bounds = loopActive ? currentBounds() : null;
  $('marker-list').replaceChildren(...markers.map(marker => markerItem(marker, bounds)));

  const loopButton = $('loop-button');
  loopButton.disabled = currentBounds() === null;
  loopButton.setAttribute('aria-pressed', String(loopActive));
}

function markerItem(marker, bounds) {
  const item = document.createElement('li');
  item.classList.toggle('in-loop', bounds !== null && marker.time >= bounds.start && marker.time <= bounds.end);

  const number = element('span', 'number', markerNumber(markers, marker.id));
  const time = element('span', 'time', formatTime(marker.time));
  time.append(element('small', '', hundredths(marker.time)));

  const row = element('button', 'marker-row');
  row.append(number, time);
  row.addEventListener('click', () => onMarkerTap(marker.id));

  const more = element('button', 'more', '⋯');
  more.setAttribute('aria-label', `Modifier le marqueur ${markerNumber(markers, marker.id)}`);
  more.setAttribute('aria-expanded', String(openMarkerId === marker.id));
  more.addEventListener('click', () => toggleMarkerPanel(marker.id));

  item.append(row, more);
  if (openMarkerId === marker.id) item.append(markerPanel(marker));
  return item;
}

// Panneau ⋯ : déplacement, suppression.
function markerPanel(marker) {
  const panel = element('div', 'marker-panel');

  const earlier = element('button', 'nudge', '−0,1 s');
  earlier.addEventListener('click', () => onMoveMarker(marker.id, marker.time - NUDGE_SECONDS));
  const here = element('button', 'here', `Placer à ${formatTime(engine.getCurrentTime())}`);
  here.addEventListener('click', () => onMoveMarker(marker.id, engine.getCurrentTime()));
  const later = element('button', 'nudge', '+0,1 s');
  later.addEventListener('click', () => onMoveMarker(marker.id, marker.time + NUDGE_SECONDS));

  const remove = element('button', 'remove', 'Supprimer');
  remove.addEventListener('click', () => { openMarkerId = null; onDeleteMarker(marker.id); });

  const moves = element('div', 'marker-moves');
  moves.append(earlier, here, later);
  panel.append(moves, remove);
  return panel;
}

function element(tag, className, text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

// 42.37 -> ".37"
function hundredths(seconds) {
  // + 1e-6 : 10.1 s vaut 10.0999… en binaire, on veut « .10 ».
  return `.${String(Math.floor(seconds * 100 + 1e-6) % 100).padStart(2, '0')}`;
}

// --- Cadrans (ton, vitesse) ---

// Toucher la moitié gauche : −1 ; la droite : +1 ; glisser vers le haut ou
// le bas : un pas tous les 18 px ; double toucher : valeur par défaut.
// Les deux moitiés sont des boutons, pour le clavier et les lecteurs d'écran.
function setupDial(dial, onStep, onReset) {
  let startY = null;
  let dragged = false;
  let lastTap = 0;
  dial.addEventListener('pointerdown', event => {
    startY = event.clientY;
    dragged = false;
    dial.setPointerCapture(event.pointerId);
  });
  dial.addEventListener('pointermove', event => {
    if (startY === null) return;
    const steps = Math.trunc((startY - event.clientY) / DRAG_STEP_PX);
    if (steps === 0) return;
    dragged = true;
    startY -= steps * DRAG_STEP_PX;
    onStep(steps);
  });
  dial.addEventListener('pointerup', event => {
    if (startY === null || dragged) { startY = null; return; }
    startY = null;
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      lastTap = 0;
      onReset();
      return;
    }
    lastTap = now;
    const box = dial.getBoundingClientRect();
    onStep(event.clientX < box.left + box.width / 2 ? -1 : 1);
  });
  dial.addEventListener('pointercancel', () => { startY = null; });
  // Clavier seulement (detail 0) : le toucher passe par pointerup.
  dial.querySelectorAll('.dial-step').forEach(button => button.addEventListener('click', event => {
    if (event.detail === 0) onStep(Number(button.dataset.step));
  }));
}

// Arc de 270° avec la partie remplie jusqu'à `fraction` (0 à 1).
function drawArc(dial, fraction) {
  const cx = 38, cy = 38, r = 30, start = Math.PI * 0.8, end = Math.PI * 2.2;
  const point = angle => `${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`;
  const arc = (from, to, color) => `<path d="M${point(from)} A${r} ${r} 0 ${to - from > Math.PI ? 1 : 0} 1 ${point(to)}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const value = start + (end - start) * fraction;
  const [dx, dy] = point(value).split(' ');
  dial.querySelector('.arc').innerHTML = arc(start, end, 'rgba(255,255,255,.12)')
    + arc(start, Math.max(start + 0.01, value), 'var(--accent)')
    + `<circle cx="${dx}" cy="${dy}" r="5" fill="var(--accent)"/>`;
}

// --- Modules à part (key.js, tuner.js) ---
// Ils écoutent ces événements sur `document`, et app.js ne les importe pas :
// - ritornello:track-opened { track, samples, sampleRate } : un morceau est ouvert ;
// - ritornello:semitones { trackId, semitones, key? } : la transposition a changé.
// key.js renvoie ritornello:key-found { trackId, key }, que l'on enregistre
// avec les réglages du morceau (donc synchronisé).
function announce(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

document.addEventListener('ritornello:key-found', event => {
  saveTrackSettings(event.detail.trackId, { key: event.detail.key });
});

function showMessage(text) {
  $('message').textContent = text;
  $('message').hidden = false;
}

function hideMessage() {
  $('message').hidden = true;
}

// Copie hors ligne de l'app (sw.js). Sans service worker, l'app marche quand même.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
