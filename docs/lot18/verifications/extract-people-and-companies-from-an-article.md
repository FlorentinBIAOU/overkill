# extract-people-and-companies-from-an-article — vérification du lot 18

Avis : `docs/lot17/avis/extract-people-and-companies-from-an-article.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. Le mot d'ouverture d'une phrase entrait dans le nom — levé

Le test `opens` n'était appliqué que si la suite capitalisée faisait un seul
mot. Dès qu'elle en faisait deux, le mot d'ouverture était avalé, et l'entité
sortait avec `evidence: None` et `type: "unknown"` — indiscernable d'un nom
correct — pendant que `skipped_at_sentence_start` restait à zéro.

Correction : une liste `SENTENCE_OPENERS`, déclarée comme `HONORIFICS`,
`LEGAL_FORMS` et `PARTICLES` le sont déjà, des mots français et anglais qui
ouvrent une phrase et ne font jamais partie d'un nom. Quand une suite
capitalisée commence une phrase par l'un d'eux, le nom commence un mot plus
loin, et le mot mis de côté est **compté** dans `skipped_at_sentence_start`.

C'est la première des deux voies que l'avis propose. La seconde — un
`at_sentence_start: true` sur le nom — a été écartée : elle laisse le nom faux
dans la liste, et la fiche existe pour ne pas rendre une valeur devinée.

Les articles et les particules sont volontairement absents de la liste :
« Le Monde » ouvre une phrase par « Le », et l'en retirer perdrait le journal.
Le test l'affirme, et il affirme aussi que `le` et `la` n'y sont pas.

Le critère d'acceptation de l'avis, mesuré dans les deux langages :

```
« Après Renault, Stellantis a annoncé un accord. »       -> Renault, Stellantis   skipped 1
« Selon Le Monde, Renault et Stellantis ont signé… »     -> Le Monde, Renault…    skipped 1
« Depuis Lyon, Marie Martin dirige le groupe. »          -> Lyon, Marie Martin    skipped 1
« Chez Boulanger, les prix ont baissé. »                 -> Boulanger             skipped 1
« Malgré Airbus, le marché recule. »                     -> Airbus                skipped 1
```

Témoins dans le même test : « Jean Dupont, président de la société Acme, a
signé. » commence bien au premier mot et ne compte rien ; « Le Monde a publié
un article. » garde son article.

### 2. Le point de rupture de N0 n'était pas le premier à se produire — levé par la correction

L'avis le dit explicitement : « Une fois le point 1 corrigé, la phrase actuelle
peut rester. » Le point 1 est corrigé, donc la phrase reste — un nom rendu
`unknown` est une non-réponse assumée, et c'est bien la première chose qui
arrive au lecteur maintenant qu'un nom faux ne sort plus. Elle est seulement
raccourcie pour R11.

## Les remarques non bloquantes

### 1. Une référence de produit rendue comme un nom — levée

Un paragraphe dans les deux docstrings et en français : « A350 » dans « Airbus
a livré son premier A350 à Air France » est capitalisé, ne suit aucun mot
d'ouverture et ne porte aucun marqueur, donc il revient comme un nom
`unknown` ; c'est le niveau au-dessus. Un test l'affirme, à l'égalité stricte,
dans les deux langages.

### 2. La licence du modèle distinguée de celle de la bibliothèque

Rien à corriger : l'avis la cite en exemple. Elle a été reprise dans la charte
des extraits par ce lot, au chapitre des dépendances.

### 3. R11 — points de rupture de 66 et 99 mots, trois phrases chacun

Réécrits : 49 et 55 mots en français, 55 et 52 en anglais, deux phrases chacun.
La fiche sort de la dette R11.

## R14

`expected text, not <type>` n'était lue par aucun test. Elle est citée mot pour
mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-people-and-companies-from-an-article
  ok        extract-people-and-companies-from-an-article 2 py, 2 js
test-snippets : OK — 4 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 155 encore en dette, aucun nouveau dépassement
$ npm run check:raisons
check-raisons : OK — 167 raison(s) …; 14 fiche(s) encore en dette
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Les cinq phrases de l'avis, la phrase « Lors du salon… » et la phrase au A350
entrent dans `TOUS`, donc dans le test de parité entre les deux langages.
