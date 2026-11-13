# Refonte de l'interface (style Néon) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** deux écrans (Listes, Lecteur) au style Néon, avec des gestes
faits pour le doigt, sur le modèle de la maquette.

**Architecture :** on garde les mêmes fichiers. `index.html` contient les
deux écrans, et un seul est visible. La logique pure (boucle au toucher,
dernier morceau) va dans `track.js` et `library.js`, avec des tests.
`app.js` gère le lecteur et le passage d'un écran à l'autre, `lists.js`
gère l'écran Listes.

**Tech Stack :** HTML, CSS et JS modules sans build, `node --test`.

**Spec :** `docs/superpowers/specs/2026-11-13-refonte-interface-design.md`
(maquette : `docs/superpowers/specs/2026-11-13-maquette-neon.html`)

## Global Constraints

- Pas de framework, pas de build, pas de fichier qui ne sert pas tout de suite.
- Zones à toucher d'au moins 44 px ; lignes de marqueurs de 48 px.
- Couleurs Néon : fond `#07070c`, accent `#ff4fd8`, accent 2 `#ffb347`,
  texte `#f4f3ff`, cartes `rgba(255,255,255,.05)` avec flou.
- Police Space Grotesk copiée dans `vendor/fonts/` (licence OFL) et listée
  dans `APP_FILES` de `sw.js` ; jamais Google Fonts.
- Icônes en SVG au trait, aucun emoji pour les commandes.
- Les boucles déjà enregistrées (`{ fromId, toId }`) restent valables.

## Review Focus

1. Un morceau sans marqueur ou avec un seul : la liste est vide ou n'a
   qu'une ligne, et toucher la ligne boucle jusqu'à la fin. Testé dans la
   tâche 1.
2. Une ancienne boucle où `fromId` est après `toId` : elle reste lue dans
   le bon sens. Testé dans la tâche 1.
3. Le dernier morceau ouvert a été retiré de toutes les listes : la carte
   « Reprendre » est cachée. Testé dans la tâche 2.
4. Hors ligne : la police est servie depuis la copie. Testé par
   `tests/sw.test.js` (fichier listé et présent).
5. Le bouton retour d'Android sur le lecteur ramène aux listes sans
   quitter l'app. Vérifié à la main (tâche 4).

---

### Task 1 : boucle au toucher (`track.js`)

**Files :** Modify `track.js`, Test `tests/track.test.js`

**Interfaces :**
- Produit `loopBounds(markers, loop, duration)`. `toId: null` veut dire
  « fin du morceau », et `duration` sert seulement dans ce cas.
- Produit `tapLoop(markers, loop, loopActive, tappedId)`, qui renvoie la
  nouvelle boucle `{ fromId, toId }`. Une section va du marqueur i au
  marqueur suivant (`null` pour le dernier).

- [ ] Tests : 5 marqueurs (ids 1 à 5, dans l'ordre).
  `tapLoop(m, null, false, 2)` → `{fromId: 2, toId: 3}`.
  Boucle 2→3 active, toucher 4 → `{2, 5}`.
  Boucle 2→5 active, toucher 3 → `{3, 4}`.
  Toucher 5 → `{5, null}`.
  Boucle inactive, toucher 4 → `{4, 5}`.
  Boucle `{fromId: 4, toId: 2}` active, toucher 5 → `{2, null}`.
  `loopBounds(m, {fromId: 5, toId: null}, 200)` → `{start: t5, end: 200}`.
- [ ] Implémenter, puis lancer `node --test tests/` : tout PASS.
- [ ] Commit.

### Task 2 : dernier morceau ouvert (`library.js`)

**Files :** Modify `library.js`, Test `tests/library.test.js`

**Interfaces :** produit `setLastTrack(lib, id)` et `lastTrack(lib)`.
`lastTrack` renvoie le morceau ou `null` s'il n'est dans aucune liste.

- [ ] Tests : après `setLastTrack`, `lastTrack` renvoie le morceau. Après
  l'avoir retiré de la seule liste, `lastTrack` renvoie `null`. Sur une
  bibliothèque neuve, `lastTrack` renvoie `null`.
- [ ] Implémenter, lancer les tests, commit.

### Task 3 : police hors ligne

**Files :** Create `vendor/fonts/space-grotesk-latin-wght-normal.woff2`,
`vendor/fonts/space-grotesk-LICENSE` ; Modify `sw.js`

- [ ] Copier les fichiers depuis `@fontsource-variable/space-grotesk@5.2.10`,
  puis les ajouter à `APP_FILES`.
- [ ] `node --test tests/` : PASS. Commit.

### Task 4 : les deux écrans au style Néon

**Files :** Modify `index.html`, `style.css`, `app.js`, `lists.js`,
`waveform.js`, `manifest.webmanifest`

**Interfaces :** utilise `tapLoop`, `loopBounds(…, duration)`,
`setLastTrack` et `lastTrack`. `lists.js` exporte `showListsScreen()`
pour que `app.js` redessine les listes au retour.

- [ ] HTML : `#lists-screen` et `#player-screen`, chacun avec les blocs de
  la spec, et un bandeau `#message` commun aux deux écrans (on le ferme en
  le touchant).
- [ ] CSS Néon d'après la maquette, avec `@font-face` local.
- [ ] `app.js` : cadrans (moitié gauche −, droite +, glisser de 18 px par
  pas, double toucher pour remettre à zéro), liste des marqueurs, mode ✎,
  compteur de passages (un saut en arrière pendant la boucle compte un
  passage), commandes en SVG, écran Lecteur avec `history.pushState`, et
  `popstate` pour revenir aux listes.
- [ ] `lists.js` : carte Reprendre, onglets (l'onglet actif ouvre le menu
  Renommer / Supprimer), lignes avec « à retrouver », mode ✎ avec ✕,
  bouton ＋ flottant, « Chargement… » sur la ligne touchée.
- [ ] `waveform.js` : pastilles numérotées, partie jouée en dégradé.
  Toucher une pastille fait la même chose que `tapLoop`.
- [ ] `node --test tests/`, puis essai à la main sur le téléphone.
  Commit.
