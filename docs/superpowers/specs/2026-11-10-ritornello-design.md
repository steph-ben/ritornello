# Ritornello : description

## Pourquoi

Stéphane joue du violon (avec un cours chaque semaine) et du piano. Le temps
pour jouer est très limité, donc l'outil ne doit jamais être un frein.

Le déclencheur : un matin, au lit, sur le téléphone, impossible d'écouter
simplement les morceaux du cours du soir. Il n'y avait pas d'appli évidente,
et lire les fichiers stockés dans Proton Drive était pénible.

Sur ordinateur, l'extension Chrome « Transpose » fait exactement ce qu'il
faut (mode Boucle), mais elle ne marche ni sur le téléphone ni sur des
fichiers Proton Drive.

Ritornello est une petite application web installable (PWA) qui reprend le
comportement du mode Boucle de Transpose pour des fichiers audio, sur Android,
Linux et macOS.

## Usages

1. Écouter les morceaux du cours en entier, pour les avoir en tête.
2. Boucler un passage difficile, éventuellement ralenti ou transposé.

Le succès : au lit, sur le téléphone, ouvrir un morceau de la liste et
boucler un passage prend moins de 30 secondes, sans réfléchir.

## Ce que fait Ritornello

Un seul écran : le lecteur en haut, les listes de morceaux en dessous.

Le lecteur, sur le modèle du mode Boucle de Transpose :

- transposition en demi-tons (− 0 +) et vitesse en % (− 100 % +),
  indépendantes l'une de l'autre ;
- un compteur de temps qui affiche aussi la boucle en cours
  (ex. `00:11 ⇄ 00:51`) ;
- une barre de temps avec les marqueurs numérotés, et la zone de boucle
  surlignée ;
- une forme d'onde avec la tête de lecture ; toucher la forme d'onde ou la
  barre déplace la lecture ;
- un bouton « + Marker » qui pose un marqueur numéroté à l'instant joué ;
- la liste des marqueurs : numéro, temps, nom modifiable (« marker 1 » par
  défaut), suppression ;
- la boucle se fait toujours entre deux marqueurs, choisis dans la liste
  (ex. 1 et 3) ;
  un bouton de boucle l'active ou la coupe ; un badge en bas (`1–3`) montre
  la boucle en cours ;
- en bas : début, recul, lecture/pause, avance, et le temps `00:14 / 04:52`.

Les listes de morceaux :

- plusieurs listes nommées (ex. « Violon - cours », « Piano »), avec un
  sélecteur au-dessus ;
- « Ajouter un morceau » ouvre le sélecteur de fichiers du système ; sur
  Android, Proton Drive y apparaît comme source ;
- « Ajouter un lien YouTube » ajoute une vidéo à la liste. Elle est lue
  avec le lecteur YouTube intégré : marqueurs, boucle et vitesse
  fonctionnent, la transposition est désactivée (le lecteur intégré ne donne
  pas accès au son). La vitesse suit les paliers proposés par YouTube ;
- toucher un morceau le charge dans le lecteur, avec ses marqueurs, sa
  dernière boucle, sa transposition et sa vitesse ;
- on peut retirer un morceau d'une liste, et créer, renommer ou supprimer une
  liste.

## Contraintes

- **Jamais de copie de la musique.** Ritornello garde seulement la référence
  du fichier, les listes et les réglages par morceau.
- Le fichier est rouvert avec l'API File System Access : `showOpenFilePicker()`,
  handle stocké dans IndexedDB, `requestPermission()` à la réouverture.
  Vérifié le 2026-11-10 sur le téléphone de Stéphane avec un `.mp3` venant de
  Proton Drive (`spike/index.html`).
- Le sélecteur ne doit **pas** filtrer par type « audio/* » : Proton Drive
  grise alors tous les fichiers.
- Formats : au minimum `.mp3` et `.aac`. Le test avec `<audio>` a échoué
  sur un `.aac` ; le décodage via Web Audio (`decodeAudioData`) est à
  vérifier sur Android.
- Sans pub, sans serveur à nous. Seul compte nécessaire : GitHub (pour la
  synchronisation, voir plus bas). Page statique hébergée sur GitHub
  Pages (`https://steph-ben.github.io/ritornello/`), dépôt
  `git@github.com:steph-ben/ritornello.git`.
- Pas de lecture en arrière-plan : Ritornello garde l'écran allumé pendant la
  lecture (Wake Lock). Décision de Stéphane : « écran allumé, ça suffit ».
- Installable sur Android depuis Chrome (manifeste + service worker), pour
  avoir une icône et une fenêtre plein écran. Marche hors ligne.
- Le code doit rester lisible par un humain sans IA : peu de fichiers, pas
  de framework si possible, noms explicites.

## Hors du périmètre (pour l'instant)

- La transposition des vidéos YouTube, et Deezer (sur ordinateur,
  l'extension Transpose reste l'outil).
- Les onglets Lecture, Mix et Clips de Transpose, et ses outils Range,
  ciseaux et grille.
- Un vrai fichier `.apk` (Capacitor) : seulement plus tard, si l'app
  installée via Chrome gêne vraiment.

## Ce qui serait un échec

- Plus de deux gestes pour reprendre le travail sur un morceau déjà dans une
  liste.
- Des pubs, un nouveau compte à créer, ou la musique copiée hors de Proton
  Drive.
- Devoir exporter ou importer à la main pour retrouver ses marqueurs sur un
  autre appareil.
- Un son de mauvaise qualité en transposition ou en vitesse réduite, au point
  de gêner le travail de la justesse au violon.

## Synchronisation entre appareils

Les listes, marqueurs et réglages sont partagés automatiquement entre le
téléphone, Linux et macOS, sans export/import à la main. C'est une clé du
succès (décision de Stéphane).

- La référence au fichier (handle) ne vaut que sur l'appareil où il a été
  choisi. Un morceau est donc identifié entre appareils par son nom et sa
  taille. La première fois qu'il est ouvert sur un autre appareil, « Retrouver
  le fichier » rouvre le sélecteur ; Ritornello vérifie nom et taille et
  garde les marqueurs.
- Les vidéos YouTube sont identifiées par leur lien, donc rien à retrouver.
- Stockage : un gist secret sur le compte GitHub `steph-ben`, contenant un
  seul fichier JSON (listes, morceaux, marqueurs, réglages). Décision de
  Stéphane.
- Accès : un jeton GitHub (fine-grained, droit « Gists » seulement) collé une
  fois par appareil dans les réglages de Ritornello, gardé localement.
- Ritornello lit le gist au démarrage et l'écrit après chaque modification
  (avec un court délai pour grouper les changements). Une copie locale permet
  de travailler hors ligne ; elle est envoyée au retour du réseau.
- Conflits : pas de fusion fine. Fusion par morceau, la modification la plus
  récente gagne (chaque morceau porte une date de modification).

## Navigateurs

- Android : Stéphane navigue avec DuckDuckGo. Le test `spike/index.html` y
  fonctionne (`.mp3` depuis Proton Drive, réouverture sans re-choisir). Mais
  le bouton « tout effacer » de DuckDuckGo efface les références aux
  fichiers, et DuckDuckGo ne crée qu'un raccourci, pas une app plein écran.
  Décision de Stéphane : Ritornello est installé une fois depuis **Chrome**
  (app plein écran, à l'abri du bouton feu), la navigation reste sur
  DuckDuckGo. Le test `spike/index.html` est à refaire dans Chrome.
- Laptops (Linux, macOS) : Brave. Brave désactive par défaut l'API File
  System Access ; il faut l'activer une fois par laptop
  (`brave://flags/#file-system-access-api`), à vérifier avec
  `spike/index.html`.
- Safari et Firefox n'ont pas `showOpenFilePicker`.

## Choix validés par Stéphane

- Pas de bouton A-B séparé : la boucle passe par les marqueurs.
- Si un fichier n'est plus accessible (déplacé, renommé, permission refusée),
  le morceau reste dans la liste avec un bouton « Retrouver le fichier » qui
  rouvre le sélecteur et garde les marqueurs.
- Thème sombre par défaut, avec un style propre à Ritornello.

## Laissé à la personne qui code

- La bibliothèque de transposition/vitesse dans le navigateur (SoundTouchJS,
  Rubber Band en WASM, ou autre), choisie sur la qualité du son au violon
  et la simplicité.
- Le découpage du code, tant qu'il reste petit et lisible.
- Les raccourcis clavier sur ordinateur.
