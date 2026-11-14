# Vidéos YouTube dans les listes

Ce document précise la ligne « Ajouter un lien YouTube » de
`docs/superpowers/specs/2026-11-10-ritornello-design.md`. La recherche est
dans `2026-11-14-youtube-deezer-recherche.md`.

## Pourquoi

Stéphane travaille aussi des morceaux qu'il n'a que sur YouTube. Il veut
les mettre dans ses listes et retrouver le même lecteur : marqueurs, boucle,
vitesse et compteur de passages.

## Ce qui a été décidé avec Stéphane

- **Ajout** : le bouton ＋ propose « Fichier audio » ou « Lien YouTube ». Pour
  un lien YouTube, on colle le lien copié. Il n'y a pas de partage depuis
  l'app YouTube.
- **Lecteur** : la vidéo prend la place de la forme d'onde. Juste dessous,
  une fine barre de temps porte les pastilles des marqueurs et la zone de
  boucle. On la touche comme l'onde. La vidéo reste visible, d'au moins
  200 × 200 px, et rien ne passe par-dessus : c'est une règle de YouTube.
- **Ton** : le cadran est désactivé, grisé avec « — », car le lecteur
  intégré ne donne pas accès au son.
- Stéphane accepte les deux défauts mesurés le 2026-11-14 sur la page de
  test : environ 140 ms de silence à chaque reprise de la boucle, et des
  publicités avant certaines vidéos.

## Décisions de Claude

- **Vitesse** : on garde les pas de 5 %. Sur ordinateur, YouTube a accepté
  0,85 alors qu'il ne le propose pas dans sa liste. Si le lecteur renvoie une
  autre vitesse que celle demandée, le cadran affiche celle du lecteur.
- **Identifiant** : `youtube:<id de la vidéo>`. Un morceau YouTube a
  `source: 'youtube'` et `videoId`, et il n'est jamais « à retrouver ». Son
  nom est le titre de la vidéo, lu dans le lecteur une fois chargé, ou l'id
  en attendant.
- **Moteur** : un nouveau module `youtube.js` offre les mêmes fonctions que
  `player.js` (play, pause, seek, getCurrentTime, isPlaying, setSpeed,
  setLoop, onEnded), et `app.js` choisit le moteur selon le morceau. La
  boucle est faite par le `onTick` d'`app.js`, qui fait déjà le saut au
  début.
- **Hors ligne** : une vidéo ne se lit pas, et l'app affiche un message
  clair dans le bandeau.
- **Synchro** : les morceaux YouTube voyagent comme les autres, car ils sont
  déjà dans `tracks`.
- **Tonalité** : elle n'est pas calculée pour une vidéo (pas d'accès au
  son), donc `#track-key` reste vide.

## Hors du périmètre

Deezer, la transposition des vidéos, la lecture en arrière-plan et le
partage depuis l'app YouTube.

## Ce qui serait un échec

- Un fichier audio qui se lit moins bien qu'avant.
- Une vidéo YouTube qui demande « à retrouver ».
- La perte des marqueurs d'une vidéo après la synchro.
