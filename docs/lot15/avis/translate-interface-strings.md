# translate-interface-strings — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs translate-interface-strings` : **rouge** sur la
machine de travail. Le test en échec est `n0.test.js`, « une recherche prend
de l'ordre de dix millisecondes dans une mémoire réelle » (55 ms mesurés contre
une borne de 32 ms).

### Raisons du refus

1. **[pertinence technique]** N0, `lookup`. La correspondance exacte est
   cherchée **dans la boucle** qui calcule le score approché : pour trouver
   qu'une chaîne est inchangée, l'extrait compare d'abord par `SequenceMatcher`
   toutes les entrées de la mémoire qui la précèdent. Mesuré sur une mémoire de
   1 000 libellés : exacte en première position 0,03 ms, exacte en dernière
   position **106 ms** ; 200 chaînes inchangées, **1,8 s**. Or l'argument de la
   fiche est précisément que « l'essentiel d'un fichier d'interface ne bouge
   pas d'une version à l'autre » : l'extrait paie le coût maximal sur le cas
   majoritaire. Sur un catalogue de quelques milliers de chaînes, une passe de
   publication se compte en dizaines de minutes pour ne rien traduire.

   Ce qu'il faut faire : construire une fois un dictionnaire `exact_key →
   (source, cible)` et le consulter **avant** toute notation approchée ; ne
   noter que les chaînes absentes. `latency` redescend alors pour le cas
   exact, et la fiche doit dire la classe du cas approché séparément
   (décision 13 : la classe se mesure sur l'entrée nominale, et la fiche dit
   quand elle change). Test, deux langages : une chaîne exacte en dernière
   position d'une mémoire de mille entrées ne déclenche aucun calcul de score
   (compteur, ou double de `SequenceMatcher`), et le résultat est identique.

2. **[preuves]** Le test chronométré de `n0.test.js` (et son jumeau Python,
   marqué) viole la charte des tests : une borne de temps « attrape un
   effondrement, elle ne mesure pas », et doit être « dix fois plus large que
   ce que vous observez ». Ici 32 ms pour 21 ms observés : la suite devient
   rouge dès que la machine est chargée. Ce qu'il faut faire : borne large
   d'effondrement, et la classe de latence justifiée par la mesure écrite
   dans le relevé, pas par une assertion serrée.

3. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs, et adaptateur
   N3 non testé.
   - `n0` (py, js), `INFIRMÉ` : « a variable moves […] last year's translation
     is still nearly right ». **Périmé** : la phrase n'est plus dans l'extrait.
   - `n0.test.py`, `INFIRMÉ` : `latency « ~10 ms »`. **Périmé** : la fiche
     déclare désormais `~100 ms` (et le point 1 la fera changer encore).
   - `n2.test.js`, `INFIRMÉ` : le `why` de l'essai parle d'une variable
     traduite. **Périmé** : l'essai a été corrigé.
   - `n3` (py, js), `DÉFAUT` : « le client par défaut a la forme du vrai
     kit ». **Périmé** et décoratif ; **aucun test ne fait tourner
     `ProviderClient`**.

   Ce qu'il faut faire : réécrire sur les phrases actuelles, sans marquage ;
   tester l'adaptateur sur `_harness/fake_sdk.py` / `fake-sdk.mjs`.

### Remarques non bloquantes

- Le `breaking_point` de N2 fait près de cent vingt mots et mélange deux
  sujets (la variable masquée, le message ICU). Le second est le plus utile —
  observé sur le vrai modèle, et il casse pour de bon — ; il mérite d'être en
  tête, et court.
- `sources: []` alors que le rédacteur a lancé le vrai modèle (versions de
  `transformers` et Transformers.js notées dans les corrections) et lu sa
  fiche (licence Apache 2.0). Ces références doivent passer dans la fiche.
- N2 n'a pas de contexte d'interface : « Save » bouton contre verbe. La fiche
  le dit dans l'`escalate_when`, c'est exactement le bon événement observable.
- Le marqueur `[N]` choisi parce que ses caractères sont dans le vocabulaire
  du modèle, avec « Check again if you change model » : une vraie leçon de
  terrain.

### Ce qui est solide

- Le `scenario` tient les deux vrais arguments : on ne recommande pas deux
  fois une traduction, et la variable traduite est un défaut que personne dans
  l'équipe ne voit.
- Le verdict N2 est défendable et bien argumenté : un modèle de traduction par
  paire, local, sous licence Apache 2.0, qui ne voit jamais la variable.
- Le contrôle de variables à la sortie, y compris sur une correspondance
  exacte, et la reconnaissance des formes i18next, ICU, Android et iOS, sont
  ce qu'un extrait de production doit porter.
