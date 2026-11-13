// Accordeur violon et guitare : écoute le micro et montre l'écart à la corde
// la plus proche. Écran #tuner-screen, ouvert par #tuner-button.
import { detectPitch, stringsFor, nearestString, centsBetween, noteName } from './pitch.js';

const A4_KEY = 'ritornello.tunerA4';
const INSTRUMENT_KEY = 'ritornello.tunerInstrument';
const A4_MIN = 415;
const A4_MAX = 446;
const A4_DEFAULT = 440;
const IN_TUNE_CENTS = 5;
const GAUGE_CENTS = 50;
const SMOOTHING = 0.35; // part de la nouvelle mesure dans la valeur affichée
const NEW_NOTE_CENTS = 80; // au-delà, on change de note : pas de lissage
const CONFIRM_MS = 120; // une note doit tenir ce temps avant d'être affichée
const CONFIRM_CENTS = 50; // écart toléré entre deux mesures de la même note
const WAITING_MS = 1000; // sans note pendant ce temps, l'affichage pâlit

const screen = document.getElementById('tuner-screen');
const listsScreen = document.getElementById('lists-screen');

let instrument = readInstrument();
let a4 = readA4();
let strings = stringsFor(instrument, a4);
let smoothedFrequency = null; // dernière hauteur retenue (gardée pendant les silences)
let microphone = null; // { stream, context, frameId } tant que l'on écoute
let isOpen = false;

const elements = buildScreen();

// Après un rechargement, on repart de l'écran Listes (comme le lecteur).
if (history.state?.tuner) history.replaceState(null, '');

document.getElementById('tuner-button').addEventListener('click', openTuner);
window.addEventListener('popstate', onPopState);
document.addEventListener('visibilitychange', onVisibilityChange);

// --- Mémoire du réglage ---

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : le réglage ne sera pas retenu
  }
}

function readA4() {
  const value = Number(readStored(A4_KEY));
  return Number.isInteger(value) && value >= A4_MIN && value <= A4_MAX ? value : A4_DEFAULT;
}

function readInstrument() {
  return readStored(INSTRUMENT_KEY) === 'guitare' ? 'guitare' : 'violon';
}

// --- Construction de l'écran ---

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createButton(className, text, label, onClick) {
  const button = create('button', className, text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

function buildHeader() {
  const header = create('header', 'bar');
  const back = createButton('icon-button accent', '', 'Retour aux listes', () => history.back());
  back.innerHTML = '<svg class="ico"><use href="#i-back"/></svg>';
  const title = create('h1', 'tuner-title', 'Accordeur');
  const switcher = create('div', 'tuner-switch');
  const buttons = {
    violon: createButton('', 'Violon', 'Violon', () => chooseInstrument('violon')),
    guitare: createButton('', 'Guitare', 'Guitare', () => chooseInstrument('guitare')),
  };
  switcher.append(buttons.violon, buttons.guitare);
  header.append(back, title, switcher);
  return { header, instrumentButtons: buttons };
}

function buildReference() {
  const row = create('div', 'tuner-reference');
  const value = create('span', 'tuner-reference-value');
  const less = createButton('tuner-step', '−', 'Baisser le La', () => changeA4(-1));
  const more = createButton('tuner-step', '+', 'Monter le La', () => changeA4(1));
  row.append(less, value, more);
  return { row, value, less, more };
}

function buildScreen() {
  const { header, instrumentButtons } = buildHeader();
  const note = create('div', 'tuner-note', '–');
  const gauge = create('div', 'tuner-gauge');
  const needle = create('div', 'tuner-needle');
  gauge.append(create('div', 'tuner-zone'), needle);
  const cents = create('div', 'tuner-cents');
  const middle = create('div', 'tuner-middle');
  middle.append(note, gauge, cents);
  const stringsRow = create('div', 'tuner-strings');
  const reference = buildReference();
  const error = create('p', 'tuner-error');
  error.hidden = true;
  screen.append(header, middle, stringsRow, reference.row, error);
  return { instrumentButtons, note, needle, cents, stringsRow, reference, error, gauge };
}

// --- Affichage ---

function renderInstrument() {
  for (const [name, button] of Object.entries(elements.instrumentButtons)) {
    button.setAttribute('aria-pressed', String(name === instrument));
  }
}

function renderStrings() {
  elements.stringsRow.replaceChildren(...strings.map(string => {
    const item = create('div', 'tuner-string');
    item.append(create('span', 'tuner-string-name', string.name), create('span', 'tuner-string-octave', String(string.octave)));
    return item;
  }));
}

function renderReference() {
  elements.reference.value.textContent = `La = ${a4} Hz`;
  elements.reference.less.disabled = a4 <= A4_MIN;
  elements.reference.more.disabled = a4 >= A4_MAX;
}

function formatCents(cents) {
  const rounded = Math.round(cents);
  return `${rounded > 0 ? '+' : ''}${rounded} cents`;
}

function renderNoHearing() {
  elements.note.textContent = '–';
  elements.cents.textContent = '';
  elements.needle.style.left = '50%';
  elements.gauge.classList.remove('in-tune');
  for (const item of elements.stringsRow.children) item.classList.remove('heard');
}

function renderHeard(frequency) {
  const string = nearestString(frequency, strings);
  const gap = centsBetween(frequency, string.frequency);
  const note = noteName(frequency, a4);
  const needlePosition = 50 + 50 * Math.max(-1, Math.min(1, gap / GAUGE_CENTS));

  elements.note.textContent = `${note.name} ${note.octave}`;
  elements.cents.textContent = formatCents(gap);
  elements.needle.style.left = `${needlePosition}%`;
  elements.gauge.classList.toggle('in-tune', Math.abs(gap) < IN_TUNE_CENTS);
  strings.forEach((candidate, index) => {
    elements.stringsRow.children[index].classList.toggle('heard', candidate === string);
  });
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

// --- Réglages ---

function refreshStrings() {
  strings = stringsFor(instrument, a4);
  renderStrings();
  renderNoHearing();
  smoothedFrequency = null;
}

function chooseInstrument(name) {
  instrument = name;
  writeStored(INSTRUMENT_KEY, name);
  renderInstrument();
  refreshStrings();
}

function changeA4(step) {
  a4 = Math.max(A4_MIN, Math.min(A4_MAX, a4 + step));
  writeStored(A4_KEY, String(a4));
  renderReference();
  refreshStrings();
}

// --- Micro ---

// Lisse la hauteur : moyenne mobile, sauf si l'on change de note.
function smooth(frequency) {
  const isNewNote = smoothedFrequency === null
    || Math.abs(centsBetween(frequency, smoothedFrequency)) > NEW_NOTE_CENTS;
  smoothedFrequency = isNewNote
    ? frequency
    : smoothedFrequency * (frequency / smoothedFrequency) ** SMOOTHING;
  return smoothedFrequency;
}

// Une note n'est affichée que si elle tient CONFIRM_MS : un bruit d'archet ou
// une autre corde qui résonne un instant ne s'affiche pas.
// Sans note depuis WAITING_MS, l'affichage pâlit : on voit que l'accordeur attend.
function listen(analyser, sampleRate) {
  const samples = new Float32Array(analyser.fftSize);
  let candidate = null; // dernière hauteur entendue, pas encore forcément affichée
  let candidateSince = 0;
  let lastShownAt = -Infinity; // rien d'affiché : pâle dès l'ouverture
  function onFrame(now = performance.now()) {
    analyser.getFloatTimeDomainData(samples);
    const frequency = detectPitch(samples, sampleRate);
    const isSameNote = frequency !== null && candidate !== null
      && Math.abs(centsBetween(frequency, candidate)) < CONFIRM_CENTS;
    if (!isSameNote) candidateSince = now;
    candidate = frequency;
    if (frequency !== null && now - candidateSince >= CONFIRM_MS) {
      renderHeard(smooth(frequency));
      lastShownAt = now;
    }
    screen.classList.toggle('tuner-waiting', now - lastShownAt > WAITING_MS);
    microphone.frameId = requestAnimationFrame(onFrame);
  }
  onFrame();
}

async function startMicrophone() {
  if (microphone) return;
  showError('');
  const context = new AudioContext(); // créé dans le geste de l'utilisateur
  microphone = { stream: null, context, frameId: 0 };
  const current = microphone;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (microphone !== current) { // fermé pendant la demande d'autorisation
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    current.stream = stream;
    await context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    context.createMediaStreamSource(stream).connect(analyser);
    listen(analyser, context.sampleRate);
  } catch (error) {
    if (microphone === current) {
      stopMicrophone();
      showError(`Micro inaccessible (${error.name}). Autorisez le micro pour ce site dans les réglages du navigateur, puis rouvrez l'accordeur.`);
    }
  }
}

function stopMicrophone() {
  if (!microphone) return;
  cancelAnimationFrame(microphone.frameId);
  microphone.stream?.getTracks().forEach(track => track.stop());
  microphone.context.close().catch(() => {});
  microphone = null;
}

// --- Navigation ---

function showTuner() {
  isOpen = true;
  listsScreen.hidden = true;
  screen.hidden = false;
  renderInstrument();
  renderReference();
  refreshStrings();
  startMicrophone();
}

function hideTuner() {
  isOpen = false;
  stopMicrophone();
  screen.hidden = true;
}

function openTuner() {
  if (!history.state?.tuner) history.pushState({ tuner: true }, '');
  showTuner();
}

function onPopState() {
  if (history.state?.tuner) {
    if (!isOpen) showTuner(); // retour avant (l'écran Listes vient de s'afficher)
  } else if (isOpen) {
    hideTuner();
  }
}

// Le micro se coupe quand la page est cachée et reprend au retour.
function onVisibilityChange() {
  if (!isOpen) return;
  if (document.visibilityState === 'hidden') stopMicrophone();
  else startMicrophone();
}
