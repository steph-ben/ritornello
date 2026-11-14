# YouTube et Deezer dans Ritornello : ce qui est possible

Recherche du 2026-11-14. Question de Stéphane : « réfléchir à ajouter YouTube
et Deezer ». Contrainte : une page statique sur GitHub Pages, sans serveur à
nous, sans copier la musique.

En bref : YouTube est faisable sans transposition, comme la spec l'avait déjà
prévu. Deezer n'est pas faisable de façon utile. Pour transposer un morceau,
il faut un fichier local, et ça ne changera pas.

## YouTube

Le seul moyen autorisé de jouer une vidéo YouTube dans une page est le lecteur
intégré (une iframe), piloté par l'API IFrame Player. Ritornello peut lui dire
de jouer, mettre en pause, aller à un instant, lire l'instant courant et
changer la vitesse.

Vitesse. `setPlaybackRate()` ne fait qu'une « suggestion » : YouTube choisit
parmi les vitesses que donne `getAvailablePlaybackRates()`, et l'événement
`onPlaybackRateChange` dit la vitesse réellement appliquée. [Certain]
(https://developers.google.com/youtube/iframe_api_reference) La doc cite
0,25, 0,5, 1, 1,5 et 2 comme exemples. En pratique la liste est 0,25 à 2 par
pas de 0,25. [Likely] Le site youtube.com propose maintenant des vitesses par
pas de 0,05, mais je ne sais pas si le lecteur intégré les accepte.
[Guessing] À vérifier en cinq minutes sur le téléphone en affichant
`getAvailablePlaybackRates()`. Si la liste reste par pas de 0,25, les paliers
de 5 % de Ritornello doivent s'arrondir à 75 %, 50 %, etc.

Hauteur. Ralentir sur YouTube garde la hauteur du son, c'est le comportement
normal du lecteur HTML5. [Likely] Mais transposer est impossible. L'API n'a
aucune fonction sur le son à part le volume et la sourdine. [Certain] (même
source) La page Ritornello ne peut pas lire le son de l'iframe : elle vient
d'un autre domaine (youtube.com), et le navigateur interdit à une page de
toucher au contenu d'une iframe d'un autre domaine. Web Audio ne peut donc pas
recevoir ce son. [Certain]
(https://developer.mozilla.org/fr/docs/Web/Security/Same-origin_policy) Même
si c'était possible techniquement, les règles YouTube l'interdisent : on ne
doit pas « séparer, isoler ou modifier la partie audio ou vidéo » d'un
contenu YouTube (III.I.7), ni modifier le lecteur (III.I.6). [Certain]
(https://developers.google.com/youtube/terms/developer-policies)

Boucle et précision. `seekTo(secondes, true)` saute à l'instant voulu.
[Certain] (https://developers.google.com/youtube/iframe_api_reference)
`getCurrentTime()` n'a pas de précision documentée, et Ritornello doit
l'interroger régulièrement pour voir que la fin de la boucle est atteinte. On
peut espérer une précision d'environ un dixième de seconde, avec parfois une
petite coupure le temps que YouTube recharge le début de la boucle. [Likely]
C'est assez pour travailler un passage, pas pour un enchaînement parfait.

Android Chrome. Le lancement automatique avec le son peut être bloqué par le
navigateur sans geste de l'utilisateur ; l'événement `onAutoplayBlocked` le
signale. [Certain] (même source) Le premier lancement doit donc venir d'un
toucher. Les règles interdisent aussi de lancer une vidéo tant que plus de la
moitié du lecteur n'est pas visible. [Certain]
(https://developers.google.com/youtube/terms/required-minimum-functionality)
La lecture en arrière-plan (lecteur caché, autre onglet) est interdite
(III.I.9). [Certain] (https://developers.google.com/youtube/terms/developer-policies)
Écran verrouillé, YouTube met la vidéo en pause hors abonnement Premium.
[Likely] Ce n'est pas gênant : Ritornello garde déjà l'écran allumé (Wake
Lock) pendant la lecture.

Autres règles qui touchent l'interface. Le lecteur doit faire au moins
200 × 200 pixels, et rien ne doit être posé par-dessus. [Certain]
(https://developers.google.com/youtube/terms/required-minimum-functionality)
Il faut donc une place pour la vidéo dans l'écran de lecture, sans cacher la
vidéo derrière la forme d'onde. Télécharger, mettre en cache ou rendre
disponible hors ligne un contenu YouTube est interdit (III.E.1). [Certain]
(https://developers.google.com/youtube/terms/developer-policies)

Ce qui marche avec YouTube : les marqueurs (on les pose sur
`getCurrentTime()`), la boucle A–B (par `seekTo`), le compteur de passages
(il compte les retours au début de la boucle, peu importe le lecteur), la
vitesse aux paliers YouTube, la synchronisation (le morceau est identifié par
l'identifiant de la vidéo au lieu de `nom|taille`, rien à retrouver sur un
autre appareil). Ce qui ne marche pas : la transposition, la forme d'onde
(il faut le son pour la calculer ; on garde une simple barre de temps avec les
marqueurs), et le hors ligne (il faut le réseau, et le cache est interdit).

## Deezer

Le lecteur à intégrer (widget). Deezer propose une iframe à coller dans une
page, pour un titre, un album ou une playlist. La page ne décrit aucune API
JavaScript pour piloter ce widget : pas de saut à un instant, pas de vitesse.
[Certain] (https://widget.deezer.com/) Il joue les titres en entier seulement
pour un abonné connecté, sinon des extraits de 30 secondes. [Certain]
(https://developers.deezer.com/guidelines) La connexion passe par un cookie
deezer.com dans une iframe, donc un cookie tiers, que DuckDuckGo bloque
probablement. [Guessing]

Le SDK JavaScript (`DZ.init`, `DZ.player.playTracks`). Il demande un
identifiant d'application enregistré pour le domaine de la page. [Likely]
(https://gist.github.com/dirkk0/de02cd05a819f417e14272371750715c) Or Deezer a
arrêté de créer de nouveaux accès à son API en octobre 2025, à cause d'abus,
sans date de reprise. [Certain] (message d'un responsable Deezer :
https://en.deezercommunity.com/features-feedback-44/api-auth-impossible-80857)
Le SDK n'est donc pas utilisable pour une nouvelle app en 2026. [Likely] Même
s'il l'était, il n'offre pas de changement de vitesse ni de hauteur, et son
saut se fait en pourcentage du titre. [Likely]

L'API publique. Elle donne les informations (titres, pochettes) et une
adresse d'extrait de 30 secondes, jamais le titre entier : « pas de streaming
audio sauf les extraits de 30 s ». [Certain]
(https://developers.deezer.com/guidelines) Trente secondes ne suffisent pas
pour travailler un morceau. Garder du son en local est « strictement
interdit ». [Certain] (même source) Contourner les protections pour
télécharger l'est aussi (section V). [Certain]
(https://developers.deezer.com/termsofuse)

Ce qui marche avec Deezer : rien des fonctions de Ritornello. Ni marqueurs,
ni boucle, ni vitesse, ni hauteur, ni forme d'onde, ni compteur, ni hors
ligne. Au mieux, une liste peut garder un lien qui ouvre le titre dans
l'application Deezer.

## Les approches, de la meilleure à la pire

1. Lecteur YouTube intégré, comme prévu dans la spec. Pas de nouveau
   composant : un deuxième lecteur qui répond aux mêmes appels que le lecteur
   actuel (jouer, pause, aller à, temps courant, vitesse), et les listes
   gardent un lien YouTube à côté des fichiers. Coût : un fichier de plus,
   l'affichage de la vidéo, les paliers de vitesse arrondis, la transposition
   et la forme d'onde masquées. C'est ma recommandation.
2. Un simple lien Deezer dans une liste, qui ouvre l'application Deezer. Peu
   de code, mais peu d'intérêt : Ritornello ne fait rien de plus qu'un
   favori. À ne faire que si Stéphane le demande vraiment.
3. Pour transposer un morceau qu'on a sur Deezer ou YouTube : acheter le
   fichier (par exemple en MP3 sur Qobuz ou Bandcamp) et l'ouvrir comme
   fichier local. Toutes les fonctions marchent. Ce n'est pas du code, c'est
   la vraie réponse au besoin de transposition. Sur ordinateur, l'extension
   Transpose reste l'autre solution, comme dit dans la spec.
4. Écarté : le SDK Deezer (nouveaux accès fermés, aucun réglage de vitesse ou
   de hauteur), et les extraits de 30 secondes (trop courts).
5. Écarté : capturer le son de l'onglet (`getDisplayMedia`) pour le
   transposer. Ça n'existe pas sur Chrome Android [Likely], et c'est
   « modifier la partie audio », interdit par YouTube. [Certain]
6. Écarté : télécharger ou extraire le son (yt-dlp, outils qui « rippent »
   Deezer). Interdit par les deux services, et contraire à la règle
   « jamais de copie de la musique ».

Recommandation : faire seulement YouTube, avec le lecteur intégré, sans
transposition. Avant de coder, vérifier sur le téléphone deux points en une
petite page de test : la liste réelle des vitesses, et la précision du
retour au début de la boucle. Ne rien faire pour Deezer, sauf un lien si
Stéphane le veut.

