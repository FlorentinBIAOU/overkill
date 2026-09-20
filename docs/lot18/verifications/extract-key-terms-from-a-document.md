# extract-key-terms-from-a-document — vérification du lot 18

Avis : `docs/lot17/avis/extract-key-terms-from-a-document.md` (REFUSÉE).

Le refus ne porte pas sur le verdict N1, que l'avis tient pour justifié, mais
sur ce que le niveau recommandé rend hors du jeu de quatre contrats de la
fiche.

## Les motifs de refus, un par un

### 1. Le classement était un ordre alphabétique déguisé — levé

Le score est `count × moyenne(idf)`, et `idf = log(N/1)` pour tout terme
présent dans un seul document : sur un document court, chaque expression
apparaît une fois et nulle part ailleurs, donc toutes valent `log(N)`. Le tri
final était `(-score, -count, key)` : à égalité, c'est la chaîne qui
départageait, c'est-à-dire l'alphabet.

Correction : le tri devient `(-score, -count, -nombre de mots, rang de première
apparition, key)`. La chaîne ne sert plus qu'à ce que les deux langages
répondent dans le même ordre. Pour que ce soit possible, une entrée de N0
porte désormais `first`, le rang de la première apparition de l'expression dans
le document.

Reproduit sur le corpus de comptes rendus de conseil municipal de l'avis, à
`top=3` :

| | avant (alphabet) | après |
|---|---|---|
| document 0 | `approuvé`, `budget`, `Frères-Lumière` | `nouvelle médiathèque`, `travaux commenceront`, `approuvé` |

Le sujet du document arrive premier au lieu d'arriver septième. Sur le corpus
de la fiche, les quatre premiers passent de `café`, `batterie`,
`cartouche laser`, `casque audio` à `moulins`, `vélos électriques`,
`imprimantes laser`, `casques audio` — l'expression de deux mots d'abord.

La fiche le dit maintenant, plutôt que de laisser croire à un classement : le
`verdict_rationale` nomme les trois termes à égalité, le point de rupture de N1
est réécrit autour de l'égalité, et la docstring française explique la règle de
départage et pourquoi elle existe.

### 2. R4 — le verdict ne reposait que sur le meilleur cas possible — levé

Un second corpus entre dans les deux jeux de tests : quatre comptes rendus de
conseil municipal, courts, où les égalités dominent, et qui n'ont pas été
taillés pour la démonstration. Ce qu'il montre est publié dans le test, des
deux côtés :

- ce que N1 gagne : « conseil municipal » ouvre les quatre comptes rendus, donc
  il n'est le sujet d'aucun. N0 le garde dans les trois premiers termes des
  **quatre** documents ; N1 le fait disparaître partout ;
- ce que N1 ne gagne pas : les trois termes retenus du premier document sont à
  égalité de score, et huit autres partagent ce score derrière eux. C'est la
  règle de départage qui les ordonne, pas la mesure, et le test l'affirme.

## Les remarques non bloquantes

### 1. `top` coupait dans une zone d'égalité sans le dire — levée

Le rapport porte `tied_at_cut` : le nombre de termes restés dehors qui
partagent le score du dernier retenu. Huit sur le premier compte rendu à
`top=3`, zéro quand rien n'est coupé. Testé dans les deux langages.

### 2. Le seuil de deux documents — levée par la docstring

La docstring française dit maintenant ce que valent deux documents : `log(2/1)`
vaut 0,69 et `log(2/2)` vaut zéro, donc le classement est binaire. Le plancher
reste à deux parce qu'en dessous il n'y a rien à comparer, pas parce que deux
suffisent — et c'est écrit ainsi.

### 3. R11 — points de rupture de 103 et 101 mots

Réécrits : 56 et 58 mots en français, 56 et 60 en anglais, deux phrases chacun.
La troisième phrase du N0, qui expliquait la réponse de `yake`, appartient à la
docstring et y est déjà. La fiche sort de la dette R11.

## R14

`expected text, not …` et `expected a list, not …` étaient assertées par des
préfixes. Les deux sont citées mot pour mot dans les deux langages, aux deux
niveaux, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-key-terms-from-a-document
  ok        extract-key-terms-from-a-document  2 py, 2 js
test-snippets : OK — 4 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture && npm run check:raisons
check-longueur-rupture : OK — 208 point(s) de rupture, 145 encore en dette, aucun nouveau dépassement
check-raisons : OK — 170 raison(s) …; 8 fiche(s) encore en dette
$ npm run check:chiffres && npm run check:content && npm run check:figures && npm run check:french
check-chiffres-tenus : OK … ; check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt tests Python et dix-neuf tests JavaScript verts pour N1.
