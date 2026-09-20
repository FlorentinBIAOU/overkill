# extract-product-data-from-a-shop-page — vérification du lot 18

Avis : `docs/lot17/avis/extract-product-data-from-a-shop-page.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Le niveau N3 réintroduisait l'effondrement que le N0 évite — levé

Reproduit avant correction, sur la page hostile qui sert d'argument au N0 —
vingt mille `<script>` jamais refermés :

```
$ .venv-tools/bin/python …  to_text(hostile)
py script 71.94 s
```

Deux corrections, dans les deux langages :

- `TAGS` perd son alternance et son quantificateur non gourmand. Le motif est
  réduit à `<[^>]+>`, qui ne peut pas revenir en arrière. Les blocs `script` et
  `style` sont retirés par un balayage linéaire — `_without_scripts` /
  `withoutScripts` —, le même que `_blocks` au niveau N0 et pour la même
  raison, écrite dans le commentaire.
- Un plafond de balisage, `MAX_HTML`, est appliqué **avant** tout le reste. La
  charte des tests demande qu'une entrée trop grande soit refusée avant
  l'appel ; `slice(0, MAX_CHARACTERS)` était appliqué après le nettoyage, donc
  il ne protégeait rien, puisque le nettoyage est la partie qui coûte.

Après :

```
py  script 0.0010 s   style 0.0002 s
js  script 0.0013 s   style 0.0004 s
```

Le critère d'acceptation de l'avis — « la page hostile passera sous la seconde
des deux côtés, et le test d'entrée très grande doit la contenir » — est tenu :
`test_production_entree_tres_grande_la_page_hostile_du_niveau_N0` et son jumeau
JavaScript portent la page hostile, sa variante `<style>`, et le témoin d'une
grande page ordinaire qui reste lisible ; un second test vérifie que le plafond
de balisage s'applique bien avant le nettoyage.

### 2. `price` était un flottant — levé

`price` est désormais la chaîne de chiffres que la boutique a écrite, et
l'appelant en fait ce que son type monétaire demande. C'est la décision du site
que les fiches 17 et 24 tiennent, remontée dans `CHARTE-EXTRAITS.md` par ce lot.

### 3. `price_text` perdait les centimes — levé

Le défaut était en amont de la mise en forme : `json.loads` / `JSON.parse`
transformaient `"price": 24.90` en flottant, et `str(24.9)` ne peut plus rendre
les centimes. Les deux analyseurs savent rendre les chiffres lus :

- Python : `json.loads(block, parse_float=str, parse_int=str)` ;
- JavaScript : le troisième argument du *reviver*, `context.source`, qui porte
  le texte source du nombre (Node 22).

Aucun nombre du document ne devient donc un flottant. Mesuré, parité comprise :

```
py  {"price": "24.90", "price_text": "24.90", … }
js  {"price": "24.90", "price_text": "24.90", … }
```

## Les remarques non bloquantes

### 1. Le premier `offers` gagnait en silence — levée

Le rapport porte `offers`, le nombre d'offres publiées pour ce produit. Seule
la première est lue, et l'appelant le sait. C'est le traitement que la fiche
réservait déjà aux produits multiples, appliqué au cas identique des offres
multiples, et c'est dit dans la docstring des deux langages.

### 2. `gtin` écrasait trois clés en une — levée

Le rapport porte `gtin_key` : laquelle des cinq clés — `gtin`, `gtin14`,
`gtin13`, `gtin12`, `gtin8` — a répondu. C'est la règle inventée par la fiche
21, « ce qui n'est pas lu est nommé », appliquée à ce qui est lu. Testé sur
trois clés et sur l'absence de clé.

### 3. R11 — points de rupture de 65 et 67 mots

Réécrits : 53 et 48 mots, deux phrases chacun. La fiche sort de la dette R11.

## R14

`expected HTML, not <type>` n'était lue par aucun test : il vérifiait que la
raison était une chaîne. Elle est citée mot pour mot dans les deux langages, et
la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-product-data-from-a-shop-page
  ok        extract-product-data-from-a-shop-page 2 py, 2 js
test-snippets : OK — 4 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 163 encore en dette, aucun nouveau dépassement
$ npm run check:raisons
check-raisons : OK — 163 raison(s) …; 19 fiche(s) encore en dette
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK — 50 fiche(s) … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Le jeu de tests du N0 passe de dix-sept à vingt et un cas en Python et de seize
à vingt en JavaScript ; celui du N3 gagne deux cas dans chaque langage.
