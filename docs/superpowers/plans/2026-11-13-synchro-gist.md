# Synchronisation par gist : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** synchroniser la bibliothèque entre appareils par un gist secret.
La synchro est facultative et coupée par défaut.

**Architecture :** la fusion et le format du fichier sont des fonctions
pures de `library.js`. Un nouveau module, `sync.js`, parle à l'API GitHub
et décide quand lire et quand écrire. `lists.js` le branche sur
`changeLibrary` et affiche le nuage. `app.js` reprend les réglages du
morceau ouvert quand il change ailleurs.

**Tech Stack :** `fetch` vers `https://api.github.com`, `localStorage`,
`node --test`.

**Spec :** `docs/superpowers/specs/2026-11-13-synchro-gist-design.md`

## Global Constraints

- Sans jeton, aucune requête réseau : l'app marche comme aujourd'hui.
- Requêtes seulement vers `https://api.github.com`, avec l'en-tête
  `Authorization: Bearer <jeton>`.
- Fichier du gist : `ritornello.json`, contenu
  `{ version: 1, lists, listsModifiedAt, tracks }`, gist secret.
- Écriture 3 s après la dernière modification ; elle relit, fusionne,
  puis écrit.
- `currentListId`, `lastTrackId`, le jeton et l'identifiant du gist ne
  voyagent jamais.

## Review Focus

1. Une bibliothèque ancienne, sans `listsModifiedAt` : elle compte comme 0
   et ne fait pas planter la fusion. Testé dans la tâche 1.
2. La liste affichée a été supprimée ailleurs : on affiche la première.
   Testé dans la tâche 1.
3. Un gist vide ou abîmé (JSON illisible) : la copie locale gagne et elle
   est renvoyée. Testé dans la tâche 1 (`fromSyncFile` renvoie null).
4. Pas de réseau à l'ouverture : l'app s'ouvre, le nuage montre « hors
   ligne ». Vérifié à la main (tâche 3).
5. Un jeton refusé (401) : le message s'affiche dans le panneau et la
   synchro reste coupée. Vérifié à la main (tâche 3).

---

### Task 1 : fusion et format (`library.js`)

**Files :** Modify `library.js`, Test `tests/library.test.js`

**Interfaces (produit) :**
- `stampLists(before, after, now)` renvoie `after`, avec
  `listsModifiedAt: now` si `after.lists !== before.lists`.
- `toSyncFile(lib)` renvoie la chaîne JSON du fichier.
- `fromSyncFile(text)` renvoie `{ lists, listsModifiedAt, tracks }`, ou
  `null` si le texte est illisible ou n'a pas `version: 1`.
- `mergeLibraries(local, remote)` : `remote` vient de `fromSyncFile`.

- [ ] Tests :
  - un morceau plus récent à distance remplace le local, et inversement ;
  - un morceau présent d'un seul côté est gardé ;
  - les listes à distance gagnent si leur `listsModifiedAt` est plus
    grand, sinon les locales restent ;
  - un `listsModifiedAt` absent compte comme 0 ;
  - `currentListId` et `lastTrackId` restent les locaux ; une liste
    affichée qui a disparu donne la première ;
  - `fromSyncFile('{')` et `fromSyncFile('{"version":2}')` valent `null` ;
  - `toSyncFile` ne contient ni `currentListId` ni `lastTrackId` ;
  - `stampLists` date seulement quand les listes ont changé.
- [ ] Implémenter, lancer `node --test tests/*.test.js` : tout PASS. Commit.

### Task 2 : le module `sync.js`

**Files :** Create `sync.js` ; Modify `sw.js` (`APP_FILES`)

**Interfaces (produit) :**
- `initSync({ getLibrary, setLibrary, onStatus })`. `setLibrary(lib)`
  remplace la bibliothèque sans relancer d'envoi. `onStatus(status)`
  reçoit `{ state: 'off' | 'ok' | 'busy' | 'offline' | 'error', message, lastSync }`.
- `enableSync(token)` renvoie une promesse : vérifie le jeton, trouve ou
  crée le gist, puis fait une première synchro.
- `disableSync()` oublie le jeton et l'identifiant du gist.
- `libraryChanged()` programme un envoi dans 3 s.
- Clés `localStorage` : `ritornello.syncToken`, `ritornello.gistId`,
  `ritornello.syncPending`.

- [ ] Écrire `sync.js` : `syncNow()` lit le gist, fusionne
  (`mergeLibraries`), appelle `setLibrary`, puis écrit si le résultat
  diffère du contenu lu. Une seule synchro à la fois, et une autre suit si
  besoin. Il écoute `online` et `visibilitychange`. Un 401 donne
  `state: 'error'`, et le message « Jeton refusé par GitHub ».
- [ ] Ajouter `sync.js` à `APP_FILES`, lancer les tests (le test de `sw.js`
  le vérifie). Commit.

### Task 3 : le nuage, le panneau et le branchement

**Files :** Modify `index.html`, `style.css`, `lists.js`, `app.js`

- [ ] `index.html` : un bouton `#sync-button` (icône de nuage) à côté du
  titre, et un panneau `#sync-panel` caché, avec `#sync-token`
  (type password), `#sync-save`, un lien vers
  `https://github.com/settings/personal-access-tokens/new`, `#sync-status`
  et `#sync-off`.
- [ ] `lists.js` : `changeLibrary` appelle `stampLists`, puis
  `libraryChanged()`. `initSync` reçoit `getLibrary` et `setLibrary` (qui
  enregistre, redessine et prévient `app.js`).
- [ ] `app.js` : `onLibraryReplaced(track)` reprend marqueurs, boucle,
  vitesse et transposition du morceau ouvert s'ils diffèrent.
- [ ] Essai à la main : sans jeton, aucune requête ; avec un faux jeton,
  « Jeton refusé » ; hors ligne, le nuage montre « hors ligne ». Commit.
