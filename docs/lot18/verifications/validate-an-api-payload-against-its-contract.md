# validate-an-api-payload-against-its-contract — vérification du lot 18

Avis : `docs/lot17/avis/validate-an-api-payload-against-its-contract.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. La clé du cache sérialisait le document à chaque requête — levé

Reproduit avant correction, sur un document de 127 Ko — quatre cents chemins,
deux méthodes chacun, un schéma de quarante-deux propriétés :

```
avant   document 127 ko : 0,763 ms par appel   (document 6 ko : 0,054 ms)  → rapport 14,0
après   document 127 ko : 0,013 ms par appel   (document 6 ko : 0,013 ms)  → rapport 1,03
```

Le cache est désormais indexé par l'**identité** du document, jamais par son
contenu : `id(document)` en Python, avec l'entrée qui garde une référence au
document — c'est ce qui empêche son identifiant d'être réutilisé —, et une
`WeakMap` en JavaScript, qui ne retient rien et n'a donc rien à évincer. Le
plafond porte désormais sur les opérations compilées par document.

Le critère d'acceptation de l'avis — « le temps par appel cessera de dépendre
de la taille du document » — est un test, dans les deux langages : un document
de plus de cent kilooctets et le même réduit à deux chemins, avec un rapport
borné large, parce qu'une borne de temps attrape un effondrement et ne mesure
rien.

### 2. La classe de latence était fausse sur un document ordinaire — levée par le point 1

`latency: "<1 ms"` redevient vraie et large : 0,013 ms par requête sur un
document de 127 Ko, contre 0,763 ms avant. Le champ est inchangé, et c'est le
code qui l'a rejointe.

### 3. « divise le temps par neuf cents » mesurait le mauvais écart — levé

Le facteur comparait « compiler à chaque appel » à « garder le compilé », sur
un document minuscule, et il était publié dans le corps de la fiche là où la
charte interdit les chiffres de performance. Il disparaît du
`verdict_rationale`, remplacé par ce qui compte : le document compilé est gardé
**sous l'identité du document, jamais sous son contenu**, sans quoi fabriquer
la clé coûte plus que la validation qu'elle épargne.

**Reste ouvert, et c'est écrit dans le rapport de lot** : `check-figures` ne
reconnaît toujours pas un facteur (`×N`, « N fois plus ») comme un chiffre de
performance, ce que propose le § 3.5 de la synthèse. Deux figurent encore dans
la fiche 8, qui a été acceptée et qui est hors du périmètre de ce lot.

## Les remarques non bloquantes

### 1. `_match_path` départageait deux gabarits par ordre alphabétique — levée

La règle est écrite et ne tient plus à l'ordre de `{` dans la table ASCII : le
gabarit qui porte le moins de variables l'emporte, puis celui dont le premier
segment concret vient le plus tôt. Quatre cas sont testés dans chaque langage,
dont l'ordre de déclaration inversé — que le tri des chaînes ne garantissait
que par accident.

### 2. `error_count` comptait après dédoublonnage — levée

Les deux docstrings le disent : `error_count` compte ce que la fonction a
gardé, pas ce que le validateur a levé, parce que les deux bibliothèques ne
signalent pas `additionalProperties` de la même façon. Un test le montre : deux
propriétés en trop au même endroit rendent une erreur et `error_count: 1`.

### 3. R11

Le point de rupture fait 57 et 54 mots, deux phrases. Il est déjà dans la
limite.

## Ce que le témoin du point de rupture citait

La fiche écrit « le même montant écrit « 1 000,00 » est refusé », et le test
envoyait `"1000"`. La charte demande l'exemple de la fiche mot pour mot : le
test envoie désormais `"1 000,00"`, ce qu'écrit un partenaire francophone, avec
le témoin du même montant en nombre qui passe. La fiche sort de
`dette-chiffres.json`.

## R14

`this document is not usable` et `no body is declared` n'étaient lues par aucun
test. Les quatre raisons de la fiche sont citées mot pour mot dans les deux
langages, avec la note qui dit pourquoi deux formes d'inutilisable partagent
une raison : le code ne les distingue pas. La fiche sort de
`dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs validate-an-api-payload-against-its-contract
  ok        validate-an-api-payload-against-its-contract 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:chiffres && npm run check:raisons
check-chiffres-tenus : OK — 72 nombre(s) publié(s), tous présents dans un test ; 5 fiche(s) encore en dette
check-raisons : OK — 170 raison(s) …; 9 fiche(s) encore en dette
$ npm run check:rupture && npm run check:content && npm run check:figures && npm run check:french
check-longueur-rupture : OK … ; check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt-trois tests Python verts, vingt et un tests JavaScript verts.
