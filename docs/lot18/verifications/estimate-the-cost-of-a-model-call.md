# estimate-the-cost-of-a-model-call — vérification du lot 18

Avis : `docs/lot17/avis/estimate-the-cost-of-a-model-call.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Le coût par appel était arrondi avant d'être multiplié — levé

`_amount` arrondissait à `scale` décimales, et `total = per_item * items`
multipliait l'erreur avec le coût. À deux décimales — ce que demande
l'appelant qui veut des euros et des centimes — cent mille appels à 36
revenaient à `0.00`, avec `reason: null`.

Correction : l'arithmétique est menée à `scale + WORKING_DECIMALS` décimales,
le total y est calculé, et seuls les deux montants rendus sont ramenés à
`scale` par un arrondi unique. Neuf décimales de plus qu'il n'en faut : la
valeur exacte d'un appel à un prix par million porte au plus six décimales de
plus que le prix, donc les montants internes sont exacts.

Le critère d'acceptation de l'avis, mesuré dans les deux langages — les trois
lignes rendent 36 dans leur précision respective :

| `decimals` | `per_item` | `total` |
|---|---|---|
| 6 | `0.000360` | `36.000000` |
| 4 | `0.0004` | `36.0000` |
| 2 | `0.00` | `36.00` |

### 2. Le seuil de bascule disparaissait dans le même cas — levé

Le calcul du seuil utilise désormais le coût par appel non arrondi. À deux
décimales, `fixed_alternative="40"` rend `break_even_items: 111112` — l'avis
annonçait « environ 111 000 » — au lieu de `null`.

Reste la question que l'avis pose : ce que `break_even_items: null` veut dire.
Le code distingue deux situations, donc il en donne deux, ce que R14 demande :

- aucune alternative déclarée : `break_even_items` est `None`, `reason` reste
  `None` — il n'y avait pas de question ;
- l'appel ne coûte rien à ces prix : `reason` vaut « the call costs nothing at
  these prices: no number of calls reaches the alternative's cost ».

Les deux sont assertés dans les deux langages, et la docstring dit ce que
`reason` couvre désormais : ce qui manque, et pourquoi.

## Les remarques non bloquantes

### 1. Le commentaire anglais de `break_even` décrivait un dépassement — levée

Il dit maintenant ce que le calcul fait : « A ceiling: the first call whose
bill reaches the fixed cost. » Le test porte le cas du commentaire — cent d'un
côté, dix par appel, dix appels — à côté des deux cas déjà présents.

### 2. `source: "mixed"` quand l'un des comptes est zéro — levée

Un compte déclaré à zéro ne pèse plus dans le verdict. Une entrée estimée à
1 200 jetons et une sortie déclarée à zéro rendent `source: "estimated"` ; dès
que la sortie compte pour quelque chose, le rapport redevient `mixed` ; et deux
comptes à zéro rendent `counted`. Les trois sont testés.

### 3. R11 — point de rupture de 108 mots

Réécrit : 60 mots en français, 55 en anglais, deux phrases. La fiche sort de la
dette R11.

## R14

Sept raisons sur cette fiche étaient assertées par un préfixe de douze
caractères — `startswith("the in price")` — donc le texte rendu au-delà n'était
lu par personne. Les sept sont citées mot pour mot, dans les deux langages, les
deux directions (`in` et `out`) comprises. La fiche sort de
`dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs estimate-the-cost-of-a-model-call
  ok        estimate-the-cost-of-a-model-call  1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 151 encore en dette, aucun nouveau dépassement
$ npm run check:raisons
check-raisons : OK — 170 raison(s) …; 12 fiche(s) encore en dette
$ npm run check:chiffres && npm run check:content && npm run check:figures && npm run check:french
check-chiffres-tenus : OK — 71 nombre(s) publié(s) … ; check-content : OK … ;
check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt-cinq tests Python verts, vingt-deux tests JavaScript verts. Le corpus de
parité gagne cinq cas, dont les trois précisions de la campagne de cent mille
appels.
