// Relie l'écran au lecteur (player.js) et à la logique du morceau (track.js).

import * as player from './player.js';
import { formatTime } from './track.js';

const openButton = document.getElementById('open-button');
const playButton = document.getElementById('play-button');
const trackName = document.getElementById('track-name');
const message = document.getElementById('message');
const clock = document.getElementById('clock');

const REFRESH_MS = 50;  // fréquence de mise à jour de l'écran pendant la lecture

let duration = 0;
let currentTime = 0;
let refreshTimer = null;

openButton.addEventListener('click', openTrack);
playButton.addEventListener('click', togglePlay);
player.onEnded(() => { player.seek(0); stopRefresh(); render(); });

async function openTrack() {
  if (!window.showOpenFilePicker) {
    showMessage("Ce navigateur ne permet pas d'ouvrir les fichiers. Utilisez Chrome sur Android, ou Brave avec l'option file-system-access-api.");
    return;
  }
  let file;
  try {
    // Pas de filtre de type : sinon Proton Drive grise tous les fichiers.
    const [handle] = await window.showOpenFilePicker();
    file = await handle.getFile();
  } catch {
    return; // sélecteur fermé sans choisir
  }
  try {
    const track = await player.loadAudio(await file.arrayBuffer());
    stopRefresh();
    duration = track.duration;
    currentTime = 0;
    trackName.textContent = file.name;
    hideMessage();
  } catch {
    showMessage(`Impossible de lire ${file.name} : format non reconnu par ce navigateur.`);
  }
  render();
}

function togglePlay() {
  if (player.isPlaying()) {
    player.pause();
    stopRefresh();
  } else {
    player.play();
    refreshTimer = setInterval(render, REFRESH_MS);
  }
  render();
}

function stopRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function render() {
  currentTime = player.getCurrentTime();
  playButton.disabled = duration === 0;
  playButton.textContent = player.isPlaying() ? '⏸' : '▶';
  clock.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function hideMessage() {
  message.hidden = true;
}
