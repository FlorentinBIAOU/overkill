# extract-a-table-from-a-web-page — vérification du lot 18

Avis : `docs/lot17/avis/extract-a-table-from-a-web-page.md` (REFUSÉE).

Le refus porte sur le rapport à la norme, que la fiche invoque comme autorité.

## Les motifs de refus, un par un

### 1. « Une portée est plafonnée à mille » est faux pour `rowspan` — levé

Le standard fixe deux nombres différents : `colspan` « less than or equal to
1000 », `rowspan` « less than or equal to 65534 », et l'algorithme de formation
de la grille répète les deux. Le code appliquait mille aux deux.

`MAX_COLSPAN` et `MAX_ROWSPAN` sont désormais deux constantes, commentées avec
la phrase de la norme. Mesuré dans les deux langages : un `rowspan="2000"`,
parfaitement légal, rend deux mille lignes et n'est plus ramené ; un
`rowspan="70000"` est ramené à 65 534 et le rapport le dit. Le
`verdict_rationale` publie les deux plafonds.

### 2. `rowspan="0"` était lu comme 1, en décalant les colonnes — levé

La norme : « the value zero means that the cell is to span all the remaining
rows in the row group ». Le tableau de l'avis, avant et après :

| | avant | après |
|---|---|---|
| ligne 1 | `Groupe` \| `a` | `Groupe` \| `a` |
| ligne 2 | `b` \| `` | `Groupe`* \| `b` |
| ligne 3 | `c` \| `` | `Groupe`* \| `c` |

C'est le critère d'acceptation de l'avis, et c'est exactement le décalage
silencieux que le point de rupture disait vouloir éviter.

Les groupes de lignes ne sont pas suivis, donc « le groupe » est lu comme « le
tableau » — la même chose sur un tableau à un seul `tbody`, qui est le cas
ordinaire. Le commentaire le dit plutôt que de le laisser deviner.

### 3. Une cellule après `</tr>` était ajoutée à la ligne précédente — levé

Dans le mode « in table body », un `<td>` hors d'un `<tr>` ouvre un `<tr>`.
L'extrait l'ajoutait à la dernière ligne, ce qui faisait passer **toutes** les
lignes du tableau à une colonne de plus. Les deux langages le faisaient, donc
la parité tenait et c'est de la norme que les deux s'écartaient.

Le cas où la cellule orpheline **suit** une ligne entre dans les deux jeux de
tests, avec le cas isolé qui tombait juste par accident comme témoin.

```
<table><tr><td>a</td><td>b</td><td>c</td></tr><td>orpheline</td></table>
  avant : 1 ligne de 4 colonnes, toutes les autres complétées
  après : ["a","b","c"] puis ["orpheline","",""]   padded 2
```

## Les remarques non bloquantes

### 1. Le plafond de portée n'était dit nulle part — levée

Le rapport porte `capped` : combien de portées ont été ramenées à leur
maximum. C'est la ligne de conduite de la fiche 17, appliquée ici.

### 2. `columns` ne disait pas d'où venait la largeur — levée

Le rapport porte `padded` : combien de cellules le remplissage rectangulaire a
ajoutées. Sur le tableau irrégulier du point 3, c'est deux, et c'est la seule
trace de l'irrégularité.

### 3. R11 — point de rupture de 100 mots et trois phrases

Réécrit : 53 mots en français, 54 en anglais, deux phrases. La troisième
phrase, qui expliquait l'alternative écartée, était déjà dans la docstring. La
fiche sort de la dette R11.

## R14

`expected text, not <type>` n'était lue par aucun test. Elle est citée mot pour
mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-a-table-from-a-web-page
  ok        extract-a-table-from-a-web-page    1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture && npm run check:raisons
check-longueur-rupture : OK — 208 point(s) de rupture, 143 encore en dette, aucun nouveau dépassement
check-raisons : OK — 170 raison(s) …; 7 fiche(s) encore en dette
$ npm run check:chiffres && npm run check:content && npm run check:figures && npm run check:french
check-chiffres-tenus : OK … ; check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt tests Python verts, dix-neuf tests JavaScript verts. Les trois cas du
standard entrent dans le corpus de parité.
