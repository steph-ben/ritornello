# Synchronisation entre appareils (gist GitHub, facultative)

Ce document précise la section « Synchronisation entre appareils » de
`docs/superpowers/specs/2026-11-10-ritornello-design.md`.

## Pourquoi

Stéphane travaille ses morceaux sur le téléphone, sur Linux et sur macOS.
Il veut retrouver partout ses listes, ses marqueurs et ses réglages, sans
exporter ni importer à la main. La spec en fait « une clé du succès ».

Un autre utilisateur, qui ne veut pas de compte GitHub, doit pouvoir
utiliser l'app sans la synchro (demande de Stéphane).

## Objectifs

- Une synchro automatique entre appareils, par un gist secret sur le
  compte GitHub de l'utilisateur.
- **Facultative et coupée par défaut.** Sans jeton, l'app marche comme
  aujourd'hui, avec tout sur l'appareil. Aucun écran ne force à configurer
  la synchro.
- Configurer un appareil revient à coller un jeton, une seule fois.

## Hors du périmètre

Un serveur à nous, un compte autre que GitHub, une fusion fine des listes,
et la synchro des fichiers audio : la musique n'est jamais copiée.

## Ce qui serait un échec

- Perdre des marqueurs, quand on travaille hors ligne ou sur deux
  appareils.
- Une app qui ne s'ouvre plus, ou qui bloque, quand le réseau ou GitHub
  ne répond pas.
- Un jeton envoyé ailleurs qu'à `api.github.com`.

## Façons de faire envisagées

1. **Gist secret, via l'API GitHub appelée directement depuis la page
   (retenu).** L'API accepte les appels d'une page web (CORS). Le jeton est
   un jeton **classique** avec le seul droit `gist`. Le lien
   `https://github.com/settings/tokens/new?scopes=gist&description=Ritornello`
   ouvre la page de création avec la case déjà cochée. Révisé après essai :
   le jeton « fine-grained » cache la permission « Gists » dans les
   permissions du compte, et Stéphane ne l'a pas trouvée.
   Un bouton « Se connecter à GitHub » (OAuth) demanderait un serveur à
   nous : GitHub n'autorise pas une page web à échanger le code contre un
   jeton.
2. Gist public : écarté. Il faut quand même un jeton pour écrire, et les
   listes seraient visibles de tous. Stéphane l'avait proposé pour faire
   simple, mais ça ne simplifie rien. Si on change d'avis, c'est une ligne
   (`public: true` à la création).
3. Un service de stockage JSON anonyme (jsonblob.com, etc.) : écarté. Le
   2026-11-13, la création a été refusée (403), et ses données expirent.
4. Un fichier dans un dépôt GitHub (API contents) : écarté. Il faut plus de
   droits sur le jeton, pour aucun gain.

## Ce qui voyage, et ce qui reste sur l'appareil

Le gist contient un seul fichier, `ritornello.json` :
`{ version: 1, lists, listsModifiedAt, tracks }`.

- `tracks` : chaque morceau, avec ses marqueurs, sa boucle, sa vitesse, sa
  transposition et sa date `modifiedAt` (elle existe déjà).
- `lists` : toutes les listes. `listsModifiedAt` est un nouveau champ de la
  bibliothèque, mis à jour par toute modification des listes : créer,
  renommer, supprimer, ajouter un morceau ou en retirer un.
- Restent sur l'appareil : `currentListId`, `lastTrackId`, les références
  aux fichiers (déjà dans IndexedDB), et le jeton.

## La fusion

C'est une fonction pure de `library.js`, testée :
`mergeLibraries(local, remote) -> bibliothèque`.

- Morceaux : morceau par morceau, celui qui a le `modifiedAt` le plus
  récent gagne. Un morceau présent d'un seul côté est gardé.
- Listes : le bloc qui a le `listsModifiedAt` le plus récent gagne en
  entier (décision de Stéphane). Ce qui peut arriver : une modification de
  liste faite hors ligne sur un appareil est perdue si l'autre appareil a
  touché aux listes après.
- `currentListId` et `lastTrackId` viennent toujours de l'appareil local.
  Si la liste affichée a disparu, on affiche la première.
- Une bibliothèque ancienne, sans `listsModifiedAt`, compte comme 0.

## Quand l'app synchronise

- **Lecture** à l'ouverture, puis chaque fois que l'app revient au premier
  plan (`visibilitychange`). L'app fusionne avec sa copie locale, enregistre
  le résultat et redessine. Si le résultat diffère du gist, elle l'envoie.
- **Écriture** 3 s après la dernière modification, pour grouper les
  changements. Elle relit toujours le gist juste avant, puis fusionne, puis
  écrit. Ainsi elle n'écrase pas ce qu'un autre appareil vient d'envoyer.
- **Hors ligne ou en erreur** : la copie locale fait foi, et un drapeau
  « envoi en attente » est gardé. L'envoi repart à l'événement `online`, au
  retour au premier plan, ou à l'ouverture suivante.
- Une synchro à la fois : si une modification arrive pendant un envoi, un
  nouvel envoi suit.

## Trouver ou créer le gist

Au premier usage d'un jeton, l'app cherche parmi les gists de l'utilisateur
(`GET /gists`) celui qui contient `ritornello.json`. Si elle n'en trouve
pas, elle le crée en secret, avec la bibliothèque locale. L'identifiant du
gist est gardé sur l'appareil, à côté du jeton.

## L'écran

Une icône de nuage à côté du titre « Ritornello », sur l'écran Listes :

- Synchro coupée : le nuage est gris et barré.
- À jour : le nuage est en couleur. Envoi en cours : il pulse.
- Hors ligne ou en erreur : il est gris avec un point orange.

Toucher le nuage ouvre un panneau sous le titre :

```
┌─ Synchronisation ─────────────────────┐
│ Jeton GitHub  [••••••••••••]  [OK]    │
│ → Créer un jeton (droit « Gists »)    │
│ Dernière synchro : 10:42              │
│ [Couper la synchro]                   │
└───────────────────────────────────────┘
```

- Le lien ouvre la page GitHub de création d'un jeton classique, avec le droit `gist` déjà coché.
- Un jeton refusé (401) affiche « Jeton refusé par GitHub » dans le panneau.
  La synchro reste coupée.
- « Couper la synchro » oublie le jeton et l'identifiant du gist sur cet
  appareil. Le gist et les données locales ne sont pas touchés.

## Contraintes

- Le jeton et l'identifiant du gist sont gardés dans `localStorage` sur
  l'appareil. Ils ne voyagent jamais dans le gist.
- Les requêtes ne vont qu'à `https://api.github.com`. Le service worker ne
  les touche déjà pas, car ce n'est pas notre origine.
- Les erreurs réseau ne bloquent jamais l'app : la synchro est en
  arrière-plan.

## Cas particuliers (décisions de Claude)

- **Le morceau ouvert dans le lecteur change sur un autre appareil.** Après
  une lecture du gist, si sa version fusionnée diffère de celle du lecteur,
  le lecteur reprend ses marqueurs, sa boucle, sa vitesse et sa
  transposition, sans recharger l'audio.
- **Les horloges des appareils** peuvent différer de quelques secondes. On
  l'accepte : la règle « le plus récent gagne » se trompe seulement si on
  modifie le même morceau sur deux appareils à quelques secondes d'écart.
- **Plus de 100 gists** : la recherche lit `GET /gists?per_page=100`, page
  par page, jusqu'à trouver `ritornello.json`.

## Laissé au choix de celui qui construit

- Le découpage interne de `sync.js` et la forme exacte des appels `fetch`.
- La forme du dessin du nuage, à condition de respecter le style Néon.
