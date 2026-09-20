# convert-a-pdf-to-plain-text — vérification du lot 18

Avis : `docs/lot17/avis/convert-a-pdf-to-plain-text.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Une page de tableau ressortait transposée, en silence — levé

La facture à quatre colonnes de l'avis est fabriquée et entre dans les deux
jeux de tests, avec les mêmes octets des deux côtés. Avant correction, les
trois bandes trouvées étaient lues de haut en bas : toutes les références, puis
toutes les désignations, puis tous les prix.

Correction : au-delà de deux bandes, la page n'est pas réordonnée. Elle est lue
dans l'ordre du dessin, et `reason` le dit sur la page concernée :
`this page looks like a table: read in page order`. `columns` continue de
rendre le nombre de bandes **trouvées** — ce qui a été vu, pas ce qui a été
fait — pour que l'appelant ait les deux informations.

Après correction, dans les deux langages, à l'identique :

```
columns 3   reason "this page looks like a table: read in page order"
SARL Le Moulin | 12 rue des Freres-Lumiere | 92100 Boulogne-Billancourt
| Facture n FA-2026-0412 du 12 janvier 2026
| Reference Designation Quantite Prix HT
| MC-4501 Moulin a cafe 2 19,90
| MC-9000 Bouilloire 1 34,00 | Page 1 sur 1
```

Le lien entre `MC-4501` et `19,90` tient : ils sont sur la même ligne, et le
test l'affirme ainsi.

**Écart avec l'avis, et pourquoi.** L'avis proposait deux signaux : plus de
deux bandes, **ou** des bandes faites de lignes courtes. Le second a été écrit,
mesuré, et retiré : il n'est pas portable. Le nombre de mots d'une ligne dépend
de la façon dont l'extracteur découpe les suites de caractères, et `pdfplumber`
et `pdf.js` ne les découpent pas pareil — le test de parité a immédiatement
divergé sur la page à deux colonnes de prose, que le JavaScript classait comme
tableau et le Python comme texte.

```
ÉCART DEUX_PAGES
  py  columns 2  reason null   « La boulangerie Martin fête\nses cent ans… »
  js  columns 2  reason "this page looks like a table…"
```

Le compte de bandes, lui, vient de la géométrie et ne dépend d'aucun découpage :
il est identique des deux côtés sur les cinq documents du test. Il est donc le
seul signal retenu.

La conséquence est qu'un tableau à **exactement deux colonnes** — un libellé à
gauche, un montant à droite — reste lu comme deux colonnes, et reste transposé.
Ce n'est pas tu : c'est la **première phrase** du point de rupture, comme R2
l'exige, la facture à quatre colonnes servant de témoin. Les deux docstrings le
disent aussi, avec la raison de la limite.

### 2. La docstring attribuait le travail à des bibliothèques non appelées — levé

Les deux docstrings, en anglais et en français, disent désormais ce qui est
vrai : `pypdf`, `pdftotext` et `pdf.js` rendent les caractères ; l'extrait
Python n'appelle aucun des trois et passe par `pdfplumber`, parce qu'il lui
faut la position de chaque mot. Un lecteur qui installe `pypdf` et copie
l'extrait ne peut plus tomber sur un `ModuleNotFoundError`.

## Les remarques non bloquantes

### 1. `MIN_GUTTER` sans contre-mesure — levée

`read_text(..., min_gutter=...)` et `readText(..., { minGutter })`, comme la
fiche voisine expose `min_characters`. Testé des deux côtés : une gouttière
étroite ne sépare rien par défaut et sépare avec un réglage plus petit, et une
gouttière très large ramène la page à deux colonnes à une seule.

### 2. Les lignes coupées ne sont pas comptées — levée

`hyphenated_lines` compte, par page, les lignes qui finissent sur un tiret.
Testé à sa valeur exacte — deux sur la page de césures — avec le témoin d'une
page qui n'en a aucune.

### 3. R11 — point de rupture de 69 mots

Réécrit : 47 mots en français, 48 en anglais, deux phrases.

## Preuve

```
$ node scripts/test-snippets.mjs convert-a-pdf-to-plain-text
  ok        convert-a-pdf-to-plain-text        1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:raisons
check-raisons : OK — 167 raison(s) …; 16 fiche(s) encore en dette
$ npm run check:rupture && npm run check:content && npm run check:figures && npm run check:french
check-longueur-rupture : OK … ; check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt tests Python verts, dix-neuf tests JavaScript verts. Le test de parité
compare le rapport entier — texte, nombre de bandes, raison et compte de
césures — sur six documents dont la facture.
