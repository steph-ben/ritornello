// Lecture audio. C'est le seul fichier qui touche Web Audio et la bibliothèque
// de ralenti/transposition (Signalsmith Stretch) : pour en changer, on ne
// change que lui.

import SignalsmithStretch from './vendor/signalsmith-stretch.mjs';

const UPDATE_SECONDS = 0.05;  // fréquence à laquelle le moteur donne sa position

let audioContext = null;
let stretch = null;   // le moteur Signalsmith (un nœud Web Audio)
let duration = 0;
let currentTime = 0;  // position quand la lecture est en pause
let playing = false;
let speed = 100;      // en %
let semitones = 0;
let loop = null;      // { start, end } en secondes, ou null
let endListener = () => {};

// À appeler pendant un geste de l'utilisateur (clic) : sinon le navigateur
// refuse de jouer du son.
async function ensureEngine() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
  if (!stretch) {
    stretch = await SignalsmithStretch(audioContext);
    stretch.connect(audioContext.destination);
    stretch.setUpdateInterval(UPDATE_SECONDS, checkEnd);
  }
}

// Décode le fichier et remplace le morceau en cours.
export async function loadAudio(arrayBuffer) {
  await ensureEngine();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  pause();
  const channels = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c));
  await stretch.dropBuffers();
  await stretch.addBuffers(channels);
  duration = audioBuffer.duration;
  currentTime = 0;
  loop = null;
  return { duration, samples: channels[0], sampleRate: audioBuffer.sampleRate };
}

export function play() {
  if (!stretch || playing || duration === 0) return;
  audioContext.resume();
  playing = true;
  schedule({ active: true, input: currentTime });
}

export function pause() {
  if (!stretch || !playing) return;
  currentTime = stretch.inputTime;
  playing = false;
  schedule({ active: false });
}

export function isPlaying() {
  return playing;
}

export function seek(seconds) {
  if (!stretch) return;
  currentTime = Math.min(Math.max(0, seconds), duration);
  stretch.inputTime = currentTime;  // affichage juste avant le prochain retour du moteur
  if (playing) schedule({ input: currentTime });
}

export function getCurrentTime() {
  if (!stretch || !playing) return currentTime;
  return Math.min(stretch.inputTime, duration);
}

export function setSpeed(percent) {
  speed = percent;
  if (stretch) schedule({});
}

export function setSemitones(value) {
  semitones = value;
  if (stretch) schedule({});
}

// Le moteur boucle tout seul entre start et end ; null coupe la boucle.
export function setLoop(bounds) {
  loop = bounds;
  if (stretch) schedule({});
}

export function onEnded(callback) {
  endListener = callback;
}

// Envoie au moteur les réglages courants, plus ce qui change (`changes`).
function schedule(changes) {
  stretch.schedule({
    rate: speed / 100,
    semitones,
    loopStart: loop ? loop.start : 0,
    loopEnd: loop ? loop.end : 0,
    ...changes,
  });
}

// Appelé par le moteur à chaque nouvelle position : à la fin du morceau,
// on s'arrête (une boucle active ne l'atteint jamais).
function checkEnd(inputTime) {
  if (!playing || inputTime < duration) return;
  pause();
  currentTime = duration;
  endListener();
}
