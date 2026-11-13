// Lecture audio. C'est le seul fichier qui touche Web Audio et SoundTouchJS :
// pour changer de bibliothèque (Rubber Band par exemple), on ne change que lui.

import { PitchShifter } from './vendor/soundtouch.js';

const BUFFER_SIZE = 4096;

let audioContext = null;
let gainNode = null;
let shifter = null;   // le morceau en cours (un PitchShifter de SoundTouchJS)
let duration = 0;
let currentTime = 0;  // temps entendu quand la lecture est en pause
let playing = false;
// Pendant la lecture, le temps entendu se calcule depuis l'horloge audio :
// SoundTouchJS annonce sa position de lecture dans le fichier, qui est en
// avance de 0,1 à 0,4 s sur ce qu'on entend (il remplit ses tampons).
let anchorContextTime = 0;  // heure de l'horloge audio au dernier recalage
let anchorTrackTime = 0;    // temps du morceau au dernier recalage
let speed = 100;      // en %
let semitones = 0;
let endListener = () => {};

// À appeler pendant un geste de l'utilisateur (clic) : sinon le navigateur
// refuse de jouer du son.
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

// Décode le fichier et remplace le morceau en cours.
export async function loadAudio(arrayBuffer) {
  ensureAudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  pause();

  // SoundTouchJS ne sait pas vraiment retirer ses écouteurs (off() est
  // cassé) : on crée un nouveau PitchShifter et on ignore les événements
  // de l'ancien en comparant avec `shifter`.
  const newShifter = new PitchShifter(audioContext, audioBuffer, BUFFER_SIZE, () => {
    if (newShifter === shifter) handleEnd();
  });

  shifter = newShifter;
  duration = audioBuffer.duration;
  currentTime = 0;
  applySettings();
  return { duration, samples: audioBuffer.getChannelData(0) };
}

export function play() {
  if (!shifter || playing) return;
  ensureAudioContext();
  shifter.connect(gainNode);
  playing = true;
  setAnchor(currentTime);
}

export function pause() {
  if (!shifter || !playing) return;
  currentTime = heardTime();
  shifter.disconnect();
  playing = false;
}

export function isPlaying() {
  return playing;
}

export function seek(seconds) {
  if (!shifter) return;
  // Un peu avant la fin au maximum : au-delà, SoundTouchJS lit hors du fichier.
  const time = Math.min(Math.max(0, seconds), Math.max(0, duration - 0.05));
  // Attention : ce setter attend une fraction entre 0 et 1 (le getter
  // renvoie 0–100).
  shifter.percentagePlayed = time / duration;
  currentTime = time;
  setAnchor(time);
}

export function getCurrentTime() {
  return heardTime();
}

export function setSpeed(percent) {
  if (playing) setAnchor(heardTime());
  speed = percent;
  applySettings();
}

export function setSemitones(value) {
  semitones = value;
  applySettings();
}

export function onEnded(callback) {
  endListener = callback;
}

function setAnchor(trackTime) {
  anchorContextTime = audioContext.currentTime;
  anchorTrackTime = trackTime;
}

function heardTime() {
  if (!playing) return currentTime;
  const latency = audioContext.outputLatency || 0;
  const elapsed = Math.max(0, audioContext.currentTime - anchorContextTime - latency);
  return Math.min(duration, anchorTrackTime + elapsed * speed / 100);
}

function applySettings() {
  if (!shifter) return;
  shifter.tempo = speed / 100;
  shifter.pitchSemitones = semitones;
}

// SoundTouchJS appelle la fin à chaque bloc tant que le son est branché :
// on ne la traite qu'une fois.
function handleEnd() {
  if (!playing) return;
  pause();
  endListener();
}
