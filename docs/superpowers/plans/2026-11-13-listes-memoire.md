# Listes de morceaux et mémoire : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** plusieurs listes nommées de morceaux, et chaque morceau retrouve
ses marqueurs, sa boucle, sa vitesse et sa transposition, même après
fermeture de l'app.

**Architecture :** toutes les données (listes, morceaux, réglages) forment un
seul objet, la « bibliothèque », manipulé par des fonctions pures
(`library.js`, testées avec `node --test`). Cet objet sera plus tard le JSON
du gist de synchronisation. Il est gardé dans IndexedDB (`storage.js`), avec
à part les références aux fichiers (handles), qui ne valent que sur cet
appareil.

**Tech Stack :** JavaScript (modules ES), IndexedDB, File System Access API
(`queryPermission`, `requestPermission`), `node --test`.

**Spec :** `docs/superpowers/specs/2026-11-10-ritornello-design.md`

## Global Constraints

- Jamais de copie de la musique : on garde seulement le handle, le nom, la
  taille et les réglages.
- Un morceau est identifié par son nom et sa taille (même identifiant sur
  tous les appareils). Identifiant : `` `${name}|${size}` ``.
- Plus de deux gestes pour reprendre un morceau déjà dans une liste = échec.
  Toucher le morceau (1), accepter l'autorisation du navigateur si elle est
  demandée (2).
- Si le fichier n'est plus accessible, le morceau reste dans la liste avec
  un bouton « Retrouver le fichier » qui rouvre le sélecteur et garde les
  marqueurs, après avoir vérifié nom et taille.
- `showOpenFilePicker()` toujours sans filtre de type.
- Code lisible sans IA, peu de fichiers, identifiants en anglais, textes en
  français.

## Décisions prises dans ce plan

- Une liste par défaut, « Mes morceaux », créée au premier lancement.
- Nouvelle liste et renommage : `prompt()`. Suppression d'une liste :
  `confirm()`. Natif, simple, lisible.
- Supprimer une liste ne supprime pas les réglages des morceaux (ils
  resservent si le morceau est rajouté). On ne peut pas supprimer la
  dernière liste.
- Les réglages sont enregistrés à chaque changement (marqueur, boucle,
  vitesse, transposition), avec `modifiedAt` (ms) pour la future synchro.
- Au démarrage, aucun morceau n'est ouvert automatiquement : le navigateur
  exige un geste pour redonner l'accès au fichier.
- « Ouvrir un morceau » devient « Ajouter un morceau », dans la zone des
  listes, sous le lecteur (comme dans la spec).

## Review Focus

1. Recharger la page : listes, morceaux et marqueurs sont toujours là.
   Essai headless (tâche 3).
2. Fichier choisi via « Retrouver » mais différent (nom ou taille) : refusé
   avec un message, les marqueurs ne sont pas perdus. Test
   `matchesTrack rejects another file` (tâche 1) et essai headless (tâche 3).
3. Ajouter deux fois le même fichier à une liste : une seule entrée. Test
   `addTrackToList ignores duplicates` (tâche 1).
4. Supprimer la liste courante : une autre liste devient courante, rien ne
   plante. Test `deleteList picks another current list` (tâche 1).
5. IndexedDB indisponible (navigation privée, stockage bloqué) : l'app
   marche quand même pour la session, avec un message. Essai headless
   (tâche 3).

---

### Task 1: la bibliothèque (`library.js`)

**Files :**
- Create : `library.js`
- Test : `tests/library.test.js`

**Interfaces :**
- Produces (fonctions pures, ne modifient pas leurs arguments) :
  - `type Track = { id, name, size, markers: Marker[], loop: {fromId,toId}|null, loopActive: boolean, speed: number, semitones: number, modifiedAt: number }`
  - `type Library = { lists: [{ id: string, name: string, trackIds: string[] }], tracks: { [id]: Track }, currentListId: string }`
  - `createLibrary() -> Library`, avec une liste « Mes morceaux »
  - `trackId(name: string, size: number) -> string`
  - `addList(lib, name) -> Library`, la nouvelle liste devient courante
  - `renameList(lib, listId, name) -> Library`
  - `deleteList(lib, listId) -> Library`, sans effet sur la dernière liste
  - `selectList(lib, listId) -> Library`
  - `currentList(lib) -> List`
  - `addTrackToList(lib, listId, { name, size }, now: number) -> Library`
  - `removeTrackFromList(lib, listId, trackId) -> Library`
  - `updateTrack(lib, trackId, changes: Partial<Track>, now: number) -> Library`
  - `matchesTrack(track, file: { name, size }) -> boolean`

- [ ] **Step 1 : écrire les tests** (`createLibrary`, `addList` rend la
  liste courante, `renameList`, `deleteList picks another current list`,
  `deleteList keeps the last list`, `addTrackToList creates the track with
  default settings` (speed 100, semitones 0, markers [], loop null,
  loopActive false), `addTrackToList ignores duplicates`,
  `addTrackToList keeps existing settings`, `removeTrackFromList keeps the
  track settings`, `updateTrack sets modifiedAt`, `matchesTrack rejects
  another file`, et aucun argument modifié).
- [ ] **Step 2 : `node --test`, puis vérifier l'échec** (module absent).
- [ ] **Step 3 : écrire `library.js`.** Les identifiants de liste viennent
  de `crypto.randomUUID()`, disponible dans Node 22 et les navigateurs.
- [ ] **Step 4 : `node --test`, puis vérifier que tout passe.**
- [ ] **Step 5 : commit.**

### Task 2: la mémoire (`storage.js`)

**Files :**
- Create : `storage.js`

**Interfaces :**
- Produces :
  - `loadLibrary() -> Promise<Library | null>`
  - `saveLibrary(lib) -> Promise<void>`
  - `saveHandle(trackId, handle) -> Promise<void>`
  - `loadHandle(trackId) -> Promise<FileSystemFileHandle | null>`
- Une base IndexedDB `ritornello`, version 1, avec deux magasins :
  `library` (une seule clé, `"main"`) et `handles` (clé = identifiant du
  morceau).

- [ ] **Step 1 : écrire `storage.js`** (environ 40 lignes, une fonction
  `openDatabase()` qui garde la connexion).
- [ ] **Step 2 : essai headless** : sauver puis relire une bibliothèque, et
  un handle remplacé par un objet simple (les handles se clonent comme des
  objets).
- [ ] **Step 3 : commit.**

### Task 3: l'écran des listes (`index.html`, `style.css`, `app.js`)

**Interfaces :**
- Consumes : tâches 1 et 2, et `player.js` (inchangé).

Comportement :
- Au démarrage : `loadLibrary()`, ou `createLibrary()` si rien. Si
  IndexedDB échoue : message « La mémoire du navigateur n'est pas
  disponible : rien ne sera gardé après fermeture. », et l'app continue.
- Zone des listes, sous le lecteur : un `<select>` des listes, les boutons
  « Nouvelle liste », « Renommer », « Supprimer la liste », la liste des
  morceaux (nom, bouton ✕ pour retirer), puis « Ajouter un morceau ».
- Ajouter : sélecteur, puis `addTrackToList` et `saveHandle`, et le morceau
  s'ouvre dans le lecteur.
- Toucher un morceau : `loadHandle`. Si l'autorisation n'est pas
  `granted`, `requestPermission({ mode: 'read' })`. Puis `getFile()`, et
  `matchesTrack`. Si tout va bien, on charge l'audio et on applique les
  réglages du morceau (marqueurs, boucle, vitesse, transposition). Sinon,
  le morceau affiche « Retrouver le fichier ».
- « Retrouver le fichier » : sélecteur. Si `matchesTrack`, `saveHandle` puis
  ouverture. Sinon, message « Ce n'est pas le même fichier : <nom>
  (<taille>) attendu. » et rien ne change.
- Chaque changement de marqueur, boucle, vitesse ou transposition :
  `updateTrack` puis `saveLibrary`.
- Le morceau ouvert est mis en évidence dans la liste.

- [ ] **Step 1 : écrire l'écran et le comportement.**
- [ ] **Step 2 : `node --test`, tout passe.**
- [ ] **Step 3 : essais headless** (sélecteur simulé) : ajouter deux
  morceaux, poser des marqueurs, recharger la page, retoucher le morceau :
  les marqueurs et la vitesse reviennent. « Retrouver » avec un autre
  fichier est refusé. Créer, renommer et supprimer une liste. IndexedDB
  bloqué : message, et l'app marche.
- [ ] **Step 4 : commit.**
