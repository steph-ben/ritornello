// Les listes de morceaux, sous le lecteur, et leur mémoire.
// Ouvrir un morceau passe par `openInPlayer`, fourni par app.js.

import { createLibrary, currentList, addList, renameList, deleteList, selectList,
  addTrackToList, removeTrackFromList, updateTrack, matchesTrack, trackId } from './library.js';
import * as storage from './storage.js';

const $ = id => document.getElementById(id);

let library = createLibrary();
let storageWorks = true;
let openTrackId = null;          // le morceau chargé dans le lecteur
let loading = false;             // un morceau est en train de se charger
const missingTrackIds = new Set(); // morceaux dont le fichier est à retrouver
let openInPlayer = async () => false;
let showMessage = () => {};

// onOpen(file, track) charge le morceau dans le lecteur et renvoie true si
// ça a marché. onMessage(text) affiche un message.
export async function initLists({ onOpen, onMessage }) {
  openInPlayer = onOpen;
  showMessage = onMessage;
  $('list-select').addEventListener('change', event => changeLibrary(selectList(library, event.target.value)));
  $('new-list').addEventListener('click', onNewList);
  $('rename-list').addEventListener('click', onRenameList);
  $('delete-list').addEventListener('click', onDeleteList);
  $('add-track').addEventListener('click', onAddTrack);
  try {
    library = (await storage.loadLibrary()) ?? library;
  } catch {
    storageWorks = false;
    showMessage("La mémoire du navigateur n'est pas disponible : rien ne sera gardé après fermeture.");
  }
  render();
}

// Appelé par app.js à chaque changement de marqueur, boucle, vitesse…
export function saveTrackSettings(id, settings) {
  if (!library.tracks[id]) return;
  changeLibrary(updateTrack(library, id, settings, Date.now()), { quiet: true });
}

// --- Gestes de l'utilisateur ---

async function onAddTrack() {
  const picked = await pickFile();
  if (!picked) return;
  const { handle, file } = picked;
  const id = trackId(file.name, file.size);
  await loadOnce(async () => {
    changeLibrary(addTrackToList(library, currentList(library).id, file, Date.now()));
    await rememberHandle(id, handle);
    await open(id, await freshFile(handle, file));
  });
}

// Toucher un morceau : on rouvre son fichier sans repasser par le sélecteur.
async function onTrackClick(id) {
  await loadOnce(async () => {
    const file = await reopenFile(id);
    if (file) {
      await open(id, file);
    } else {
      missingTrackIds.add(id);
      showMessage(`Fichier inaccessible (introuvable, ou accès refusé) : ${library.tracks[id].name}. Touchez « Retrouver le fichier ».`);
    }
  });
}

async function onFindTrack(id) {
  const picked = await pickFile();
  if (!picked) return;
  const track = library.tracks[id];
  if (!matchesTrack(track, picked.file)) {
    showMessage(`Ce n'est pas le même fichier : ${track.name} (${formatSize(track.size)}) attendu.`);
    return;
  }
  await loadOnce(async () => {
    await rememberHandle(id, picked.handle);
    await open(id, await freshFile(picked.handle, picked.file));
  });
}

function onRemoveTrack(id) {
  changeLibrary(removeTrackFromList(library, currentList(library).id, id));
}

function onNewList() {
  const name = prompt('Nom de la nouvelle liste :')?.trim();
  if (name) changeLibrary(addList(library, name));
}

function onRenameList() {
  const list = currentList(library);
  const name = prompt('Nouveau nom de la liste :', list.name)?.trim();
  if (name) changeLibrary(renameList(library, list.id, name));
}

function onDeleteList() {
  const list = currentList(library);
  if (library.lists.length <= 1) {
    showMessage('Impossible de supprimer la dernière liste.');
    return;
  }
  if (confirm(`Supprimer la liste « ${list.name} » ? Les morceaux ne sont pas effacés du téléphone.`)) {
    changeLibrary(deleteList(library, list.id));
  }
}

// --- Fichiers ---

// Un seul chargement à la fois : sur téléphone, lire et décoder un fichier
// prend quelques secondes, et un deuxième toucher mélangerait deux morceaux.
async function loadOnce(work) {
  if (loading) return;
  loading = true;
  $('list-status').hidden = false;
  try {
    await work();
  } finally {
    loading = false;
    $('list-status').hidden = true;
    render();
  }
}

async function open(id, file) {
  const opened = await openInPlayer(file, library.tracks[id]);
  if (!opened) return;
  openTrackId = id;
  missingTrackIds.delete(id);
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

// Remplace la bibliothèque, l'enregistre, et redessine (sauf `quiet`).
function changeLibrary(newLibrary, { quiet = false } = {}) {
  library = newLibrary;
  if (storageWorks) storage.saveLibrary(library).catch(storageFailed);
  if (!quiet) render();
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
  $('list-select').replaceChildren(...library.lists.map(l => {
    const option = document.createElement('option');
    option.value = l.id;
    option.textContent = l.name;
    option.selected = l.id === list.id;
    return option;
  }));
  $('delete-list').disabled = library.lists.length <= 1;
  $('track-list').replaceChildren(...list.trackIds.map(id => trackItem(library.tracks[id])));
}

function trackItem(track) {
  const item = document.createElement('li');
  item.classList.toggle('current', track.id === openTrackId);

  const name = document.createElement('button');
  name.className = 'track-open';
  name.textContent = track.name;
  name.addEventListener('click', () => onTrackClick(track.id));
  item.append(name);

  if (missingTrackIds.has(track.id)) {
    const find = document.createElement('button');
    find.textContent = 'Retrouver le fichier';
    find.addEventListener('click', () => onFindTrack(track.id));
    item.append(find);
  }

  const remove = document.createElement('button');
  remove.textContent = '✕';
  remove.setAttribute('aria-label', 'Retirer de la liste');
  remove.addEventListener('click', () => onRemoveTrack(track.id));
  item.append(remove);
  return item;
}

// 3 400 000 -> "3,4 Mo"
function formatSize(bytes) {
  return `${(bytes / 1e6).toFixed(1).replace('.', ',')} Mo`;
}
