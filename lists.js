// L'écran des listes de morceaux, et leur mémoire.
// Ouvrir un morceau passe par `openInPlayer`, fourni par app.js.

import { createLibrary, currentList, addList, renameList, deleteList, selectList,
  addTrackToList, removeTrackFromList, updateTrack, matchesTrack, findTrackId,
  setLastTrack, lastTrack, stampLists, parseYoutubeId, addYoutubeToList } from './library.js';
import { initSync, enableSync, disableSync, libraryChanged, isSyncOn } from './sync.js';
import * as storage from './storage.js';

const $ = id => document.getElementById(id);

let library = createLibrary();
let storageWorks = true;
let openTrackId = null;          // le morceau chargé dans le lecteur
let loadingTrackId = null;       // le morceau en train de se charger
let editingTracks = false;       // mode ✎ : retirer des morceaux
let listMenuOpen = false;        // menu Renommer / Supprimer de la liste active
const missingTrackIds = new Set(); // morceaux dont le fichier est à retrouver
let openInPlayer = async () => false;
let openVideoInPlayer = async () => false;
let showMessage = () => {};
let showPlayer = () => {};
let onLibraryReplaced = () => {};

// onOpen(file, track) charge le morceau dans le lecteur et renvoie true si
// ça a marché ; onOpenVideo(track) fait de même pour une vidéo YouTube.
// onMessage(text) affiche un message.
// onShowPlayer() revient au lecteur sans recharger le morceau.
// onTrackReplaced(track) : la synchro a apporté une autre version d'un morceau.
export async function initLists({ onOpen, onOpenVideo, onMessage, onShowPlayer, onTrackReplaced }) {
  openInPlayer = onOpen;
  openVideoInPlayer = onOpenVideo;
  showMessage = onMessage;
  showPlayer = onShowPlayer;
  onLibraryReplaced = onTrackReplaced;
  $('resume').addEventListener('click', onResume);
  $('edit-tracks').addEventListener('click', () => { editingTracks = !editingTracks; render(); });
  $('sync-button').addEventListener('click', toggleSyncPanel);
  $('sync-form').addEventListener('submit', onSyncSubmit);
  $('sync-off').addEventListener('click', disableSync);
  $('rename-list').addEventListener('click', onRenameList);
  $('delete-list').addEventListener('click', onDeleteList);
  $('add-track').addEventListener('click', toggleAddMenu);
  $('add-file').addEventListener('click', onAddTrack);
  $('add-youtube').addEventListener('click', onAddYoutube);
  try {
    library = (await storage.loadLibrary()) ?? library;
  } catch {
    storageWorks = false;
    showMessage("La mémoire du navigateur n'est pas disponible : rien ne sera gardé après fermeture.");
  }
  render();
  initSync({ getLibrary: () => library, setLibrary: onSyncedLibrary, onStatus: showSyncStatus });
}

// Appelé par app.js au retour sur l'écran des listes.
export function refreshLists() {
  render();
}

// Appelé par app.js à chaque changement de marqueur, boucle, vitesse…
export function saveTrackSettings(id, settings) {
  if (!library.tracks[id]) return;
  changeLibrary(updateTrack(library, id, settings, Date.now()), { quiet: true });
}

// --- Gestes de l'utilisateur ---

function toggleAddMenu() {
  $('add-menu').hidden = !$('add-menu').hidden;
}

// Ajoute une vidéo à la liste. Son titre est lu à la première ouverture.
function onAddYoutube() {
  $('add-menu').hidden = true;
  const text = prompt('Collez le lien YouTube');
  if (text === null) return;
  const videoId = parseYoutubeId(text);
  if (!videoId) {
    showMessage("Ce lien YouTube n'est pas reconnu.");
    return;
  }
  changeLibrary(addYoutubeToList(library, currentList(library).id, videoId, '', Date.now()));
}

async function onAddTrack() {
  $('add-menu').hidden = true;
  const picked = await pickFile();
  if (!picked) return;
  const { handle, file } = picked;
  const id = findTrackId(library, file);
  await loadOnce(id, async () => {
    changeLibrary(addTrackToList(library, currentList(library).id, file, Date.now()));
    await rememberHandle(id, handle);
    await open(id, await freshFile(handle, file));
  });
}

// Toucher un morceau : on rouvre son fichier sans repasser par le sélecteur.
async function onTrackClick(id) {
  if (library.tracks[id].source === 'youtube') return onVideoClick(id);
  if (missingTrackIds.has(id)) return onFindTrack(id);
  if (id === openTrackId) return showPlayer(); // déjà chargé
  await loadOnce(id, async () => {
    const file = await reopenFile(id);
    if (file) {
      await open(id, file);
    } else {
      missingTrackIds.add(id);
      showMessage(`Fichier inaccessible (introuvable, ou accès refusé) : ${library.tracks[id].name}. Touchez-le de nouveau pour le retrouver.`);
    }
  });
}

// Une vidéo n'a ni fichier ni « à retrouver » : le lecteur la charge par son id.
async function onVideoClick(id) {
  if (id === openTrackId) return showPlayer();
  await loadOnce(id, async () => {
    if (await openVideoInPlayer(library.tracks[id])) markOpened(id);
  });
}

async function onFindTrack(id) {
  const picked = await pickFile();
  if (!picked) return;
  const track = library.tracks[id];
  if (!matchesTrack(track, picked.file) && !confirmOtherFile(track, picked.file)) return;
  await loadOnce(id, async () => {
    await rememberHandle(id, picked.handle);
    await open(id, await freshFile(picked.handle, picked.file));
  });
}

// Le nom ou la taille diffère (un drive peut renommer ou réencoder le
// fichier). On montre les deux, et l'utilisateur décide.
function confirmOtherFile(track, file) {
  return confirm(
    `Ce fichier ne ressemble pas à celui attendu.\n\n` +
    `Attendu : ${track.name} (${formatSize(track.size)})\n` +
    `Choisi : ${file.name} (${formatSize(file.size)})\n\n` +
    `L'utiliser quand même pour ce morceau ?`
  );
}

function onRemoveTrack(id) {
  changeLibrary(removeTrackFromList(library, currentList(library).id, id));
}

function onResume() {
  const track = lastTrack(library);
  if (track) onTrackClick(track.id);
}

// Toucher un onglet : choisir la liste ; retoucher l'onglet actif : menu.
function onTabClick(listId) {
  if (listId === currentList(library).id) {
    listMenuOpen = !listMenuOpen;
    render();
  } else {
    listMenuOpen = false;
    changeLibrary(selectList(library, listId));
  }
}

function onNewList() {
  const name = prompt('Nom de la nouvelle liste :')?.trim();
  if (name) changeLibrary(addList(library, name));
}

function onRenameList() {
  const list = currentList(library);
  const name = prompt('Nouveau nom de la liste :', list.name)?.trim();
  listMenuOpen = false;
  if (name) changeLibrary(renameList(library, list.id, name));
  else render();
}

function onDeleteList() {
  const list = currentList(library);
  if (library.lists.length <= 1) {
    showMessage('Impossible de supprimer la dernière liste.');
    return;
  }
  listMenuOpen = false;
  render();
  if (confirm(`Supprimer la liste « ${list.name} » ? Les morceaux ne sont pas effacés du téléphone.`)) {
    changeLibrary(deleteList(library, list.id));
  }
}

// --- Fichiers ---

// Un seul chargement à la fois : sur téléphone, lire et décoder un fichier
// prend quelques secondes, et un deuxième toucher mélangerait deux morceaux.
async function loadOnce(id, work) {
  if (loadingTrackId) return;
  loadingTrackId = id;
  render();
  try {
    await work();
  } finally {
    loadingTrackId = null;
    render();
  }
}

async function open(id, file) {
  const opened = await openInPlayer(file, library.tracks[id]);
  if (opened) markOpened(id);
}

function markOpened(id) {
  openTrackId = id;
  missingTrackIds.delete(id);
  changeLibrary(setLastTrack(library, id), { quiet: true });
  render();
}

// Renvoie le fichier du morceau, ou null s'il n'est plus accessible
// (autre appareil, fichier déplacé, autorisation refusée).
async function reopenFile(id) {
  try {
    const handle = await storage.loadHandle(id);
    if (!handle) return null;
    if ((await handle.queryPermission({ mode: 'read' })) !== 'granted'
      && (await handle.requestPermission({ mode: 'read' })) !== 'granted') return null;
    const file = await handle.getFile();
    return matchesTrack(library.tracks[id], file) ? file : null;
  } catch {
    return null;
  }
}

// Redemande le fichier juste avant de le lire : sur Android, un fichier
// obtenu avant l'enregistrement du handle peut devenir illisible.
async function freshFile(handle, file) {
  try {
    return await handle.getFile();
  } catch {
    return file;
  }
}

// Ouvre le sélecteur du système. Renvoie { handle, file } ou null.
async function pickFile() {
  if (!window.showOpenFilePicker) {
    showMessage("Ce navigateur ne permet pas d'ouvrir les fichiers. Utilisez Chrome sur Android, ou Brave avec l'option file-system-access-api.");
    return null;
  }
  let handle;
  try {
    // Pas de filtre de type : sinon Proton Drive grise tous les fichiers.
    [handle] = await window.showOpenFilePicker();
  } catch {
    return null; // sélecteur fermé sans choisir
  }
  try {
    return { handle, file: await handle.getFile() };
  } catch {
    showMessage(`Impossible d'ouvrir ${handle.name} : le fichier n'est pas accessible.`);
    return null;
  }
}

// --- Mémoire ---

// Remplace la bibliothèque, l'enregistre, prévient la synchro, et
// redessine (sauf `quiet`).
function changeLibrary(newLibrary, { quiet = false } = {}) {
  library = stampLists(library, newLibrary, Date.now());
  if (storageWorks) storage.saveLibrary(library).catch(storageFailed);
  libraryChanged();
  if (!quiet) render();
}

// La synchro a fusionné la bibliothèque : on la garde sans relancer
// d'envoi, et le lecteur reprend le morceau ouvert s'il a changé.
function onSyncedLibrary(merged) {
  const before = library.tracks[openTrackId];
  library = merged;
  if (storageWorks) storage.saveLibrary(library).catch(storageFailed);
  render();
  const after = library.tracks[openTrackId];
  if (after && after !== before) onLibraryReplaced(after);
}

// --- Synchronisation (panneau du nuage) ---

function toggleSyncPanel() {
  const panel = $('sync-panel');
  panel.hidden = !panel.hidden;
  $('sync-button').setAttribute('aria-expanded', String(!panel.hidden));
}

async function onSyncSubmit(event) {
  event.preventDefault();
  const token = $('sync-token').value.trim();
  if (!token) return;
  $('sync-token').value = '';
  await enableSync(token);
}

const SYNC_TEXT = {
  off: 'Synchro coupée : tout reste sur cet appareil.',
  busy: 'Synchronisation…',
};

function showSyncStatus({ state, message, lastSync }) {
  $('sync-button').dataset.state = state;
  const time = lastSync?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const text = state === 'ok' ? `À jour. Dernière synchro : ${time}.` : message || SYNC_TEXT[state] || '';
  $('sync-status').textContent = text;
  $('sync-off').hidden = !isSyncOn();
  $('sync-token').placeholder = isSyncOn() ? 'Jeton enregistré (en coller un autre pour le changer)' : 'Jeton GitHub';
}

async function rememberHandle(id, handle) {
  if (!storageWorks) return;
  await storage.saveHandle(id, handle).catch(storageFailed);
}

function storageFailed() {
  storageWorks = false;
  showMessage("La mémoire du navigateur n'est pas disponible : rien ne sera gardé après fermeture.");
}

// --- Affichage ---

function render() {
  const list = currentList(library);

  const resume = lastTrack(library);
  $('resume').hidden = !resume;
  if (resume) $('resume-name').textContent = resume.name;

  const tabs = library.lists.map(l => tab(l.name, l.id === list.id, () => onTabClick(l.id)));
  const newTab = tab('＋', false, onNewList);
  newTab.setAttribute('aria-label', 'Nouvelle liste');
  $('list-tabs').replaceChildren(...tabs, newTab);
  $('list-menu').hidden = !listMenuOpen;
  $('delete-list').disabled = library.lists.length <= 1;

  const count = list.trackIds.length;
  $('list-count').textContent = count === 1 ? '1 morceau' : `${count} morceaux`;
  $('edit-tracks').hidden = count === 0;
  if (count === 0) editingTracks = false;
  $('edit-tracks').setAttribute('aria-pressed', String(editingTracks));

  const rows = list.trackIds.map(id => trackItem(library.tracks[id]));
  if (count === 0) rows.push(emptyHint());
  $('track-list').replaceChildren(...rows);
}

function tab(text, selected, onClick) {
  const button = document.createElement('button');
  button.className = 'tab';
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-selected', String(selected));
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function trackItem(track) {
  const item = document.createElement('li');
  const missing = missingTrackIds.has(track.id);
  item.classList.toggle('current', track.id === openTrackId);
  item.classList.toggle('missing', missing);

  const open = document.createElement('button');
  open.className = 'track-open';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = track.name;
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = 'YouTube';
  tag.hidden = track.source !== 'youtube';
  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.textContent = track.id === loadingTrackId ? 'Chargement…' : missing ? 'à retrouver' : '›';
  open.append(name, tag, hint);
  open.addEventListener('click', () => onTrackClick(track.id));
  item.append(open);

  if (editingTracks) {
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Retirer ${track.name} de la liste`);
    remove.addEventListener('click', () => onRemoveTrack(track.id));
    item.append(remove);
  }
  return item;
}

function emptyHint() {
  const item = document.createElement('li');
  item.className = 'empty';
  item.textContent = 'Aucun morceau dans cette liste. Touchez ＋ pour en choisir un sur le téléphone (Proton Drive, Téléchargements…).';
  return item;
}

// 3 400 000 -> "3,4 Mo"
function formatSize(bytes) {
  return `${(bytes / 1e6).toFixed(1).replace('.', ',')} Mo`;
}
