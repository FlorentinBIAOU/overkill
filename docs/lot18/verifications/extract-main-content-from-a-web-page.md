# extract-main-content-from-a-web-page — vérification du lot 18

Avis : `docs/lot17/avis/extract-main-content-from-a-web-page.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Deux situations, une seule raison — levé

Le code n'avait qu'une branche sous le plancher, et elle annonçait à toute page
courte qu'elle était « probablement construite par son JavaScript ». Reproduit
sur la brève de presse de l'avis, avant correction :

```
{'title': 'Grève à la SNCF',
 'text': 'Grève à la SNCF\nLe trafic sera perturbé jeudi…',
 'characters': 125,
 'reason': 'almost nothing was extracted: this page may be built by its own JavaScript'}
```

Deux branches, deux raisons, exactement comme l'avis les prescrit :

| Situation | Raison rendue |
|---|---|
| `text` vide | `nothing was extracted: this page may be built by its own JavaScript` |
| `0 < len(text) < min_characters` | `this page is short: N characters` |

Après correction, la même brève :

```
py  {'title': 'Grève à la SNCF', …, 'characters': 125, 'reason': 'this page is short: 125 characters'}
js  {"title":"Grève à la SNCF", …, "characters":109, "reason":"this page is short: 109 characters"}
```

L'écart de seize caractères entre les deux langages est celui que la docstring
annonce depuis le lot 17 — `Readability` met le titre dans `title`, `trafilatura`
le garde dans le corps — et le test de chaque langage l'affirme à sa valeur.

La seconde raison ne porte aucun diagnostic : elle dit une longueur, et le
commentaire de `MIN_CHARACTERS` dit maintenant ce que le seuil est — une ligne
d'information rendue à l'appelant — et ce qu'il n'est pas : un verdict sur la
technologie de la page. La phrase « An article in the press, a documentation
page or a blog post is an order of magnitude above », que rien ne soutenait
(remarque 2), a disparu avec lui.

**Écart de forme avec R14.** La raison du cas vide garde « may be built by its
own JavaScript », qui est une cause supposée — ce que R14, écrite par ce même
lot, décourage. Elle est conservée parce que l'avis la prescrit mot pour mot,
parce que le verbe reste au conditionnel, et parce qu'elle ne s'applique plus
qu'au cas où **rien** n'est sorti, où l'inférence est solide et où
l'`escalate_when` de la fiche en dépend.

### 2. Le test des valeurs aux limites ne pouvait pas échouer — levé

`assert … is None or … < MIN_CHARACTERS` est remplacé, dans les deux langages,
par quatre assertions séparées : un caractère sous le plancher avec le rapport
complet à l'égalité stricte, exactement au plancher, un caractère au-dessus, et
le cas vide avec sa propre raison.

```
py  199 → 'this page is short: 199 characters' ; 200 → None ; 201 → None ; 0 → 'nothing was extracted…'
js  199 → 'this page is short: 199 characters' ; 200 → null ; 201 → null ; 0 → 'nothing was extracted…'
```

## Les remarques non bloquantes

### 1. `_link_share` pouvait dépasser 1 — levée

Les deux côtés sont rognés, et le résultat est borné à un. Un test nouveau
porte le cas qui le produisait — un lien imbriqué dans un autre, ce qu'un
analyseur permissif fabrique sur du HTML mal formé — avec le témoin d'un
article ordinaire qui reste sous le seuil.

### 2. `MIN_CHARACTERS = 200` n'était pas justifié — levée par la reformulation

Le seuil ne décide plus rien de grave une fois le point 1 corrigé, et son
commentaire ne prétend plus à une mesure qu'il n'a pas. Aucune mesure nouvelle
n'a été fabriquée pour la circonstance.

### 3. R11

Le point de rupture fait 59 mots et deux phrases : il était déjà dans la
limite, et `check-longueur-rupture` le confirme — la fiche n'était pas dans la
dette.

## R14

`expected HTML, not <type>` n'était lue par aucun test. Elle est citée mot pour
mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-main-content-from-a-web-page
  ok        extract-main-content-from-a-web-page 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:raisons
check-raisons : OK — 165 raison(s) …; 18 fiche(s) encore en dette
$ npm run check:content && npm run check:rupture && npm run check:figures && npm run check:french
check-content : OK … ; check-longueur-rupture : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Dix-huit tests Python verts, dix-sept tests JavaScript verts.
