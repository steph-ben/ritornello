# Refonte de l'interface (style Néon)

La maquette de référence est `docs/superpowers/specs/2026-11-13-maquette-neon.html`.
Ouvrez-la dans un navigateur : elle est cliquable et se règle sur le style
Néon. Les autres styles (Partition, Luthier, Signal) y restent pour mémoire,
mais ils n'ont pas été retenus. Pour tout ce que ce document ne précise pas,
c'est la maquette qui fait foi.

## Pourquoi

L'écran actuel empile tous les blocs dans l'ordre du code : réglages,
compteur, onde, marqueurs, menus de boucle, boutons, puis les listes. Le
bouton ▶ se trouve au milieu de la page et les listes tout en bas. Les
boutons ne sont pas alignés, et la liste des morceaux n'est pas claire.
Stéphane veut une app qu'on a envie d'ouvrir, avec un effet « wouah ».

Comment Stéphane s'en sert : le téléphone est posé sur le pupitre et le
violon est en main. Il relance la boucle souvent, d'un geste rapide, de loin.
Il trouve fluide l'organisation de l'extension Transpose (mode Boucle), qu'il
utilise à la souris sur ordinateur.

## Objectifs

- Deux écrans au lieu d'une seule page qui défile : **Listes** et
  **Lecteur**. On passe de l'un à l'autre par un glissement horizontal.
- Le lecteur reprend l'organisation de Transpose (tuiles en haut, onde,
  liste des marqueurs, commandes en bas), mais les gestes sont faits pour le
  doigt : rien de plus petit que 44 px à toucher.
- Le style Néon : fond nuit avec des halos de couleur, des cartes en verre
  dépoli, un dégradé magenta → orange et la police Space Grotesk.
- Reprendre le dernier morceau en un seul geste depuis l'écran des listes.

## Hors du périmètre

Les liens YouTube, la synchronisation par gist, un thème clair, le choix de
la palette par l'utilisateur, et tout nouveau réglage audio.

## Ce qui serait un échec

- L'app ne s'ouvre plus hors ligne, ou s'ouvre hors ligne sans sa police.
- Des boucles ou des marqueurs déjà enregistrés sont perdus.
- Un framework, un outil de build ou un nouveau fichier qui ne sert pas
  tout de suite.
- Il faut plus de deux gestes pour reprendre un morceau d'une liste.

## Façons de faire envisagées

1. **Refaire l'interface sur place (retenu).** On garde les mêmes fichiers.
   Les deux écrans vivent dans `index.html`, et un seul est visible à la
   fois. `app.js` et `lists.js` changent leur affichage, et la logique pure
   reste dans `track.js` et `library.js`.
2. Changer seulement le CSS : écarté. Les deux écrans, les cadrans et le
   choix de la boucle dans la liste demandent de changer le HTML et le JS.
3. Passer à un framework (Preact, Lit) : écarté. C'est un composant de plus
   à lire et à déployer, contre la règle « lisible sans IA ».

## Écran Listes

De haut en bas :

1. Le titre « Ritornello », écrit avec le dégradé.
2. La carte **Reprendre** : un disque ▶ en dégradé, puis le nom du dernier
   morceau ouvert. La toucher ouvre ce morceau dans le lecteur. Elle est
   cachée s'il n'y a pas de dernier morceau, ou s'il n'est plus dans la
   bibliothèque.
3. Les **listes**, sous forme d'onglets en pilule qui défilent à
   l'horizontale. L'onglet ＋ crée une liste (avec `prompt`, comme
   aujourd'hui). Toucher l'onglet déjà actif propose de le renommer ou de le
   supprimer. Décision de Claude : on garde `prompt` et `confirm` pour
   l'instant.
4. Les **morceaux** de la liste : une ligne par morceau, avec seulement le
   nom et un chevron ›. Il n'y a ni réglages ni nombre de marqueurs
   (demande de Stéphane). Le morceau ouvert est en couleur d'accent. Quand
   le fichier est à retrouver, la ligne affiche « à retrouver » en rouge, et
   la toucher ouvre le sélecteur de fichiers.
5. Un bouton **✎** au-dessus des lignes active le mode modification : chaque
   ligne montre alors un ✕ pour retirer le morceau de la liste. Décision de
   Claude, sur le modèle du ✎ des marqueurs.
6. Un bouton rond **＋** flottant en bas à droite ajoute un morceau.
7. Pendant un chargement, la ligne touchée affiche « Chargement… ». Les
   autres touchers sont ignorés, comme aujourd'hui.

## Écran Lecteur

De haut en bas :

1. **Barre** : « ‹ » revient aux listes et arrête la lecture. À côté, le nom
   du morceau.
2. **Trois tuiles** :
   - **Ton** : un cadran arrondi en demi-tons, de −12 à +12.
   - **Vitesse** : un cadran arrondi en %, de 25 à 200 par pas de 5. Ces
     pas sont ceux d'aujourd'hui.
   - **Temps** : le temps joué en grand (mm:ss plus les centièmes en petit),
     puis le début et la fin de la boucle, puis « Nᵉ passage ».
   Une valeur qui n'est pas neutre (ton différent de 0, vitesse différente
   de 100 %) s'affiche en couleur d'accent.
3. **Forme d'onde** : en haut, des pastilles numérotées pour les marqueurs ;
   la zone de boucle est teintée ; la partie déjà jouée est en dégradé avec
   un halo. Toucher l'onde déplace la lecture, comme aujourd'hui.
4. **Outils** : « ＋ Marqueur » pose un marqueur à l'instant joué.
5. **Liste des marqueurs** : une ligne de 48 px par marqueur, avec le numéro
   dans un rond, le temps (avec les centièmes), le nom et un bouton ⋯.
   Le ⋯ ouvre sous la ligne un panneau : nom modifiable, « −0,1 s »,
   « Placer à mm:ss » (l'instant joué), « +0,1 s » et « Supprimer ».
   Révisé après essai sur le téléphone : le ✎ n'était pas trouvé, et on ne
   pouvait pas déplacer un marqueur. Cette liste défile si elle est longue.
6. **Commandes**, toujours visibles en bas : début, −5 s, lecture/pause
   (un grand disque en dégradé), +5 s, boucle. Le bouton de boucle n'a que
   son icône, sans numéros (demande de Stéphane). Il est en couleur quand la
   boucle est active. Sous les commandes, le temps `00:42 / 02:52`.
7. Les messages d'erreur (fichier illisible, etc.) s'affichent dans un
   bandeau en haut du lecteur.

Toutes les icônes sont des SVG au trait, écrits dans le HTML. On n'utilise
pas d'emoji ni de caractères ⏪ ⏩, que Stéphane trouve laids.

## Les gestes

**Choisir la boucle en touchant les marqueurs.** Toucher la ligne du
marqueur n boucle de n jusqu'au marqueur suivant. Toucher ensuite une autre
ligne étend la boucle jusqu'à elle, ce qui revient à « boucle de 1 à 3 »
dans Transpose. Toucher une ligne qui est déjà dans une boucle de plusieurs
sections ramène la boucle à cette seule section. Toucher une ligne active la
boucle et place la lecture au début de la boucle. Une bande colorée à gauche
montre les lignes qui sont dans la boucle. La même logique s'applique quand
on touche une pastille de l'onde. Décision de Claude : cette règle est
écrite comme une fonction pure dans `track.js` et testée.

**Activer la boucle replace la lecture dedans.** Si la lecture est avant
ou après la boucle quand on l'active, elle saute au début de la boucle.
Pendant la lecture, une position avant le début de la boucle y ramène aussi
(révisé après essai sur le téléphone).

**La boucle jusqu'à la fin du morceau.** Le dernier marqueur n'a pas de
suivant, donc toucher sa ligne boucle jusqu'à la fin du morceau. La boucle
reste `{ fromId, toId }`, et `toId: null` veut dire « fin du morceau ».
`loopBounds` reçoit alors la durée du morceau. Les boucles déjà
enregistrées restent valables.

**Les cadrans.** Toucher la moitié gauche retire un pas, toucher la moitié
droite ajoute un pas. Glisser vers le haut ou vers le bas change la valeur
d'un pas tous les 18 px environ. Un double toucher remet à 0 ou à 100 %.
Deux petits − et + dans les coins du cadran montrent qu'on peut toucher.

**Le compteur de passages.** Il compte les reprises de la boucle depuis le
dernier changement de boucle ou de morceau. Il grossit un instant à chaque
reprise, pour qu'on voie de loin que la boucle est repartie. Il n'est pas
enregistré.

**Ce qui ne change pas, ou presque.** Ce sont des décisions de Claude.
- L'app s'ouvre sur l'écran Listes.
- Le bouton retour d'Android ramène du lecteur aux listes, grâce à
  `history.pushState`.
- Toucher un marqueur pendant la lecture ne l'arrête pas : la lecture
  reprend au début de la nouvelle boucle.
- Toucher « Reprendre » quand le fichier est à retrouver fait comme toucher
  la ligne : le sélecteur de fichiers s'ouvre.
- L'écran reste allumé pendant la lecture (Wake Lock). Ajouter ou supprimer
  un marqueur garde la boucle, comme aujourd'hui.

## Le style Néon

Les couleurs sont des variables CSS sur `:root`, avec les valeurs de la
maquette (bloc `[data-style="neon"]`) : fond `#07070c`, halos magenta
(`#ff4fd8`) et orange (`#ffb347`), cartes `rgba(255,255,255,.05)` avec
`backdrop-filter: blur`, et texte `#f4f3ff`. `waveform.js` lit déjà ses
couleurs dans les variables CSS. Il lui faut une couleur de plus, pour le
dégradé.

La police est Space Grotesk (licence OFL). Elle est **copiée dans le
dépôt**, dans `vendor/fonts/` avec sa licence, déclarée en `@font-face` et
ajoutée à `APP_FILES` dans `sw.js`. Google Fonts n'est pas utilisé, car
sans réseau l'app retomberait sur la police du système.

La couleur de thème (`theme-color`, manifeste) passe à `#07070c`.

## Ce qui change dans le modèle

- `library.js` : un champ `lastTrackId`, mis à jour à chaque ouverture d'un
  morceau. Il sert à la carte « Reprendre ».
- `track.js` : `loopBounds` accepte `toId: null` (fin du morceau). Une
  nouvelle fonction pure calcule la boucle après le toucher d'un marqueur.
- Les menus `loop-from` et `loop-to` disparaissent.

## Laissé au choix de celui qui construit

- Le découpage exact du HTML et des fonctions de rendu.
- La façon d'animer le passage d'un écran à l'autre (transition CSS, comme
  dans la maquette).
- Comment rendre les cadrans accessibles (par exemple deux boutons
  invisibles, − et +, sous le cadran).
- L'ordre des étapes, du moment que l'app reste utilisable après chacune.
