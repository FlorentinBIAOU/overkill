# rank-products-by-relevance — vérification du lot 16

Avis d'origine : `docs/lot15/avis/rank-products-by-relevance.md` (REFUSÉE).

## Motif 1 — N1 apprenait sur des produits jamais vus

**Le refus.** `pairs` appariait chaque produit cliqué à **chaque** produit non
cliqué de la page, y compris ceux affichés sous le clic. C'est le biais de
position, et l'article de Joachims que la fiche cite en `further_reading` en
tire la stratégie inverse, « Click > Skip Above ».

**Ce qui a été fait.** Ce que l'avis demande en premier.

- `impressions` est désormais **une page dans l'ordre d'affichage**, ce que la
  docstring dit en toutes lettres, et `pairs` n'apparie un clic qu'aux produits
  montrés **au-dessus** de lui. Deux clics sur une même page ne s'apparient pas
  entre eux.
- La docstring cite la stratégie, l'article et la raison : « the model would
  learn to reproduce N0, which is the opposite of why one climbs here ».
- Un journal où l'on clique toujours en première position ne forme aucune paire,
  et `learn_weights` le dit (« no click with an ignored product above it in the
  log: nothing to learn from ») au lieu d'inventer des poids.

**La preuve.** Les jeux de test écrivent le produit cliqué en premier par
commodité de lecture ; le constructeur `page` les remet dans l'ordre d'affichage
— ignorés au-dessus, clic en dessous — et le dit. Tous les poids appris, la
comparaison Python/JavaScript à deux décimales comprise, sont inchangés : les
paires sont les mêmes, l'ordre les rend légitimes. Le `breaking_point` de N1
gagne le nouveau cas, avec sa sortie observable.

## Motif 2 — une marge négative faisait tomber la page

**Le refus.** `signals` levait pour une marge hors de [0, 1], et `rank` ne
rattrapait rien : un déstockage à marge -0,05 faisait tomber toute la page de
catégorie.

**Ce qui a été fait.** La première option de l'avis, bornée et signalée.

- `on_scale` / `onScale` ramène une valeur sur l'échelle et dit si elle a dû
  bouger. Tout ce qui n'est pas un nombre fini vaut zéro — `None`, `"0.5"`,
  `NaN`, `Infinity` — dans les deux langages.
- `rank` rend un champ `out_of_scale` / `outOfScale` par produit : le défaut est
  visible dans la sortie au lieu d'être silencieux.
- Un champ **absent** du produit lève toujours, dans les deux langages : c'est un
  défaut de schéma, pas une valeur sale.
- Les pondérations, elles, viennent du code : elles sont refusées si l'une
  manque, ou si elle n'est pas un nombre fini nul ou positif.

**La preuve.** Tests, deux langages :
`une marge ou une popularité hors de l'échelle est ramenée et signalée`,
`un seul produit mal renseigné ne fait pas tomber la page` (trois produits, trois
lignes rendues, le fautif nommé, les deux autres avec une liste vide),
`un poids qui n'est pas un nombre fini est refusé`,
`production : un champ manquant lève, un champ sali est signalé`.

## Motif 3 — quatre marquages vivants

| Marquage | Défaut | Correction |
|---|---|---|
| `n0` py/js `DÉFAUT` poids NaN ou infini | le score sortait de l'échelle sans erreur | `math.isfinite` / `Number.isFinite` sur les pondérations, avec le type vérifié |
| `n0.test.js` `DÉFAUT` marge nulle ou en chaîne | passait le contrôle d'échelle en JavaScript | `onScale` vérifie le type ; la valeur est ramenée à zéro et signalée, identiquement des deux côtés |
| `n0.test.js` `DÉFAUT` poids incomplets | score nul partout, sans erreur | la présence des quatre pondérations est contrôlée |
| `n1.test.js` `DÉFAUT` signal nul ou en chaîne | passait le contrôle | `inScale` vérifie le type ; Python fait de même et rend la même `ValueError` que JavaScript une `RangeError`, sur le même message |

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/rank-products-by-relevance/
(aucune sortie)
$ node scripts/test-snippets.mjs rank-products-by-relevance
  ok        rank-products-by-relevance         2 py, 2 js
```

## Remarques non bloquantes de l'avis

- **`text_match` est une part, pas un score de pertinence.** Dit dans la
  docstring des deux langages, avec ce qu'il faut faire quand on a déjà un
  moteur (BM25 dans PostgreSQL, Elasticsearch, Meilisearch) : y mettre son score
  normalisé, la valeur du niveau étant l'arbitrage des quatre poids.
- **Le règlement P2B.** La source pointe désormais EUR-Lex et non
  `legislation.gov.uk`. L'article de Joachims entre aussi en `sources`, puisque
  N1 en tire sa règle d'appariement.
- **Le nom de la pratique dans `escalate_when` de N1.** Ajouté : exploration,
  entrelacement, une part du trafic servie dans un ordre perturbé.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts, aucun marquage.
