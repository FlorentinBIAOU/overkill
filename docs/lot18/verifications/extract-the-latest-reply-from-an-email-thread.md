# extract-the-latest-reply-from-an-email-thread — vérification du lot 18

Avis : `docs/lot17/avis/extract-the-latest-reply-from-an-email-thread.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. La ligne d'attribution comptait comme du texte écrit sous la citation — levé

`_first_marker` rendait l'index de la ligne
« Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit : » et
`_unquoted_under(lines[cut:])` la comptait ensuite, parce qu'elle ne porte pas
de préfixe `>`. Elle fait soixante-neuf caractères : toute réponse plus courte
qu'elle levait le signal.

Correction : `_first_marker` / `firstMarker` rend un troisième nombre, la
hauteur de l'habillage du marqueur — zéro pour un préfixe `>`, que le filtre
écarte déjà, et un à trois lignes pour une attribution, selon ce qui a été
apparié. Le décompte commence donc après l'attribution.

Le critère d'acceptation de l'avis, mesuré dans les deux langages :

```
"Oui."                                        -> reason null
"Oui, c'est signé."                           -> reason null
"Bonjour Marie,\nOui, le contrat est signé…"  -> reason null
```

Et le témoin de l'autre côté, dans le même test : une ligne non préfixée
ajoutée sous la citation, plus longue que la réponse, lève bien le signal.

### 2. Le fixture passait à trente-cinq caractères près — levé

`test_valeurs_aux_limites_du_signal_de_texte_sous_la_citation` interroge le
seuil : une réponse d'un caractère, une de la longueur de l'attribution moins
un, une de sa longueur exacte, une d'un caractère de plus, et la raison
attendue pour chacune. `len(ATTRIBUTION) == 69` est asserté, pour que la
constante qui a fait le défaut soit celle du test.

Les quatre fils ainsi fabriqués entrent aussi dans `TOUS`, donc dans le test de
parité.

## Les remarques non bloquantes

### 1. « Le client a écrit : » coupait le message à zéro — levée

Une attribution doit désormais porter une date ou une adresse dans sa fenêtre,
ce que tout client de messagerie écrit — `ATTRIBUTION_DATES = /\d|@/`. Le
message de l'avis revient entier, avec `quoted_from_line: None`, et le témoin
du même test vérifie que la tournure avec une date coupe toujours.

### 2. `quoted_from_line` sans mode d'emploi — levée

Une phrase dans les deux docstrings : le numéro compte les lignes d'un message
découpé sur CR, LF et CRLF, et sur ceux-là seulement — pas comme
`str.splitlines()` ni comme un `split` sur les blancs —, et un appelant qui
s'en sert découpe pareil, avec l'expression régulière nommée plus bas.

### 3. R11 — point de rupture de 84 mots et trois phrases

Réécrit : 52 mots dans les deux langues, deux phrases. C'était le plus long des
seize premières fiches. La fiche sort de la dette R11.

## R14

`expected text, not <type>` n'était lue par aucun test : il vérifiait un
préfixe de quatorze caractères. Elle est citée mot pour mot dans les deux
langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-the-latest-reply-from-an-email-thread
  ok        extract-the-latest-reply-from-an-email-thread 2 py, 2 js
test-snippets : OK — 4 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 158 encore en dette, aucun nouveau dépassement
$ npm run check:raisons
check-raisons : OK — 167 raison(s) …; 15 fiche(s) encore en dette
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt tests Python verts, dix-neuf tests JavaScript verts.
