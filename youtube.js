// Lecture d'une vidéo YouTube avec le lecteur intégré (IFrame API).
// Même interface que player.js : app.js choisit l'un ou l'autre.
// Pas de transposition : le lecteur intégré ne donne pas accès au son.

const API_URL = 'https://www.youtube.com/iframe_api';
const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const WAIT_DURATION_MS = 3000;   // temps laissé au lecteur pour annoncer la durée
const AFTER_SEEK_MS = 300;       // juste après un saut, le lecteur lit encore l'ancienne position

let apiPromise = null;
let ytPlayer = null;
let duration = 0;
let playing = false;
let speed = 100;           // en %
let loop = null;           // { start, end } ; le saut est fait par app.js (onTick)
let endListener = () => {};
let lastSeek = { time: 0, at: 0 };

// Charge le script de YouTube une seule fois, à la première vidéo.
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement('script');
    script.src = API_URL;
    script.onerror = () => {
      apiPromise = null;   // hors ligne : on pourra réessayer plus tard
      reject(new Error('Script YouTube inaccessible'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

// Crée le lecteur dans `container` et attend que la durée soit connue.
export async function loadVideo(videoId, container) {
  await loadApi();
  pause();
  ytPlayer?.destroy();
  ytPlayer = null;
  await createPlayer(videoId, container);
  duration = await waitForDuration();
  lastSeek = { time: 0, at: 0 };
  ytPlayer.setPlaybackRate(speed / 100);
  return { duration, title: ytPlayer.getVideoData().title };
}

function createPlayer(videoId, container) {
  const target = document.createElement('div');
  container.replaceChildren(target);
  return new Promise((resolve, reject) => {
    ytPlayer = new YT.Player(target, {
      width: '100%', height: '100%', videoId,
      playerVars: { playsinline: 1 },
      events: {
        onReady: resolve,
        onStateChange: onStateChange,
        onError: event => reject(new Error(`Erreur YouTube ${event.data}`)),
      },
    });
  });
}

// La durée n'est connue qu'un instant après le chargement.
async function waitForDuration() {
  const giveUpAt = Date.now() + WAIT_DURATION_MS;
  while (ytPlayer.getDuration() === 0 && Date.now() < giveUpAt) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return ytPlayer.getDuration();
}

function onStateChange(event) {
  if (event.data === STATE_PLAYING) ytPlayer.setPlaybackRate(speed / 100);
  if (event.data === STATE_PAUSED) playing = false;
  if (event.data === STATE_ENDED) {
    playing = false;
    endListener();
  }
}

export function play() {
  if (!ytPlayer || playing || duration === 0) return;
  playing = true;
  ytPlayer.playVideo();
}

export function pause() {
  if (!ytPlayer || !playing) return;
  playing = false;
  ytPlayer.pauseVideo();
}

export function isPlaying() {
  return playing;
}

export function seek(seconds) {
  if (!ytPlayer) return;
  const time = Math.min(Math.max(0, seconds), duration);
  lastSeek = { time, at: Date.now() };
  ytPlayer.seekTo(time, true);
}

export function getCurrentTime() {
  if (!ytPlayer) return 0;
  if (Date.now() - lastSeek.at < AFTER_SEEK_MS) return lastSeek.time;
  return ytPlayer.getCurrentTime();
}

export function setSpeed(percent) {
  speed = percent;
  if (ytPlayer) ytPlayer.setPlaybackRate(percent / 100);
}

// La vitesse que le lecteur utilise vraiment : YouTube peut en refuser une.
export function actualSpeed() {
  return ytPlayer ? Math.round(ytPlayer.getPlaybackRate() * 100) : speed;
}

// Pas de transposition possible avec une vidéo.
export function setSemitones() {}

// On garde les bornes ; c'est le onTick d'app.js qui saute au début.
export function setLoop(bounds) {
  loop = bounds;
}

export function onEnded(callback) {
  endListener = callback;
}
