# know-whether-a-pdf-needs-ocr — vérification du lot 18

Avis : `docs/lot17/avis/know-whether-a-pdf-needs-ocr.md` (REFUSÉE).

Le refus porte entièrement sur le niveau N1. Le niveau N0 n'a pas été touché,
hors les deux assertions de chiffres du point 4 ci-dessous.

## Les motifs de refus, un par un

### 1. Le témoin du point de rupture de N1 était une page d'entraînement — levé

Le seuil est `min(scores du lot) − MARGIN`, donc toute page du lot passe son
propre seuil par construction, et le test l'affirmait lui-même une ligne plus
bas. Le témoin était `CORPUS[0]`.

Quatre pages de prose administrative française sont ajoutées **hors** du lot,
dans `RETENUES` : un avenant, un article du code civil, un accusé de réception,
un en-tête de facture. Le témoin du point de rupture est désormais la lettre
commerciale, à −2,83, et le test dit pourquoi le témoin doit être hors du lot.

La validation croisée que l'avis a faite à la main est devenue un test dans les
deux langages : retirer une page du lot, ajuster sur les cinq autres, noter la
sixième. Les six passent.

### 2. `MARGIN = 0.3` refusait des pages françaises ordinaires — levé

Le commentaire ne mesurait que le lot d'entraînement. Mesuré sur les quatre
pages retenues, avec le corpus accentué du point 3 :

| Page retenue | Score |
|---|---|
| avenant | −2,42 |
| article du code civil | −2,63 |
| accusé de réception | **−2,83** |
| en-tête de facture | −2,65 |

La pire page d'entraînement note −2,48 : la plus éloignée des quatre est donc
0,35 en dessous, et trois dixièmes la refusaient. `MARGIN` passe à 0,5, ce qui
la laisse passer et refuse toujours une page anglaise (−3,25, soit 0,65 sous le
lot) et un tableau de montants (−4,10, soit 1,66 dessous).

Et la seconde moitié de ce que R7 demande est écrite : la marge est un **réglage
par défaut**, mesuré sur six pages d'entraînement et quatre retenues, ce qui est
peu. Le commentaire du code et la docstring française disent, en toutes lettres,
de garder quelques pages lisibles hors de `fit`, de les noter et de déplacer ce
nombre jusqu'à ce qu'elles passent toutes.

### 3. Le corpus ne contenait pas un seul accent — levé

Les six pages de `CORPUS` sont réécrites en français accentué, dans les deux
langages, avec les mêmes textes. `ALPHABET` déclare `àâäçéèêëîïôöùûüÿœæ` : sans
un `é` dans le lot, ces lettres ne recevaient que le lissage add-one et le
modèle pénalisait le français écrit correctement. Un test compte les accents du
lot, dans chaque langage.

Les cinq scores publiés changent tous, et sont republiés : seuil −2,98, tableau
de montants −4,10, page cassée −4,14, page anglaise −3,25, témoin hors lot
−2,83. La parité est exacte entre les deux langages, à la quatrième décimale.

## Les remarques non bloquantes

### 1. `fit([])` approuvait tout — levée

`fit` refuse un lot vide, dans les deux langages, avec la raison écrite : un
modèle ajusté sur rien déclarerait tout lisible, et c'est l'erreur coûteuse de
cette fiche. Le test affirme le refus au lieu d'observer l'approbation.

### 2. Le coût du faux refus sur les annexes financières — levée

Une phrase dans le `verdict_rationale`, dans les deux langues, et les annexes
financières entrent dans l'`escalate_when` de N1.

### 3. R11

Les deux points de rupture faisaient 64 et 58 mots, deux phrases chacun. Le N1
est réécrit avec le nouveau témoin — 52 et 50 mots — et le N0 est inchangé à 60
et 52. `check-longueur-rupture` les accepte tous les quatre.

## Les chiffres publiés

`183` et `224`, les deux décomptes de caractères du point de rupture de N0,
n'étaient tenus qu'à moitié : le test affirmait `abs(224 − 183) < 60`, une borne
qui aurait passé sur n'importe quel écart. Les deux sont maintenant assertés à
l'unité, dans les deux langages, et la fiche sort de `dette-chiffres.json`.

## Preuve

```
$ node scripts/test-snippets.mjs know-whether-a-pdf-needs-ocr
  ok        know-whether-a-pdf-needs-ocr       2 py, 2 js
test-snippets : OK — 4 extrait(s) exécuté(s), aucun échec

$ npm run check:chiffres
check-chiffres-tenus : OK — 72 nombre(s) publié(s), tous présents dans un test ; 6 fiche(s) encore en dette
$ npm run check:rupture && npm run check:content && npm run check:figures && npm run check:french
check-longueur-rupture : OK … ; check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Dix-sept tests Python et dix-sept tests JavaScript verts pour N1.
