# check-a-password-against-a-policy — vérification du lot 18

Avis : `docs/lot17/avis/check-a-password-against-a-policy.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. `data_egress: none` était faux — levé

Le niveau N0 émet une requête HTTPS vers `api.pwnedpasswords.com` à chaque
inscription acceptable. Le champ passe à `third-party`, qui est la valeur que
le schéma propose et ce que le `regulatory` de la fiche décrivait déjà
correctement. Le champ est affiché comme badge et sert de filtre au catalogue :
un lecteur qui filtrait sur « aucune sortie de données » trouvait cette fiche.

C'est le contrôle `check-egress`, écrit en tête de ce lot, qui le tenait :
cette fiche était sa seule ligne de dette, et `scripts/dette-egress.json` est
désormais vide.

### 2. Rien ne disait ni ne testait ce qui se passe quand le service ne répond pas — levé

Le `fetch` par défaut faisait un `urlopen` sans reprise, et `check_password` ne
l'entourait d'aucun `try` : une panne de Have I Been Pwned remontait en
exception dans le chemin d'inscription, après cinq secondes d'attente, pour
chaque nouvel utilisateur.

Correction, dans les deux langages : l'échec est attrapé, `breaches` revient à
`None`, et `blocklist-unavailable` entre dans `reasons`. Ce n'est pas une
raison de refus — une constante `BLOCKING` nomme celles qui le sont —, donc
`acceptable` dit ce que le reste du contrôle dit, et l'appelant décide. Le
commentaire l'explique : refuser toutes les inscriptions parce qu'un tiers est
en panne est une panne qu'on n'a pas choisie, et accepter en silence est le
seul contrôle que la norme met en `SHALL`, sauté sans un mot.

Le critère d'acceptation de l'avis, mesuré dans les deux langages :

```
check_password("Clementine-2019-Martin", fetch=<qui lève>)
  {"acceptable": true, "reasons": ["blocklist-unavailable"], "breaches": null, "length": 22}
```

Et le témoin : un refus qui ne vient pas de la liste reste un refus, panne ou
pas — « court » rend `too-short` dans les deux cas.

## Les remarques non bloquantes

### 1. `MAXIMUM = 64` appliqué comme un plafond — levée

La source dit « SHOULD permit a maximum password length of **at least** 64
characters » : soixante-quatre est un plancher sur le plafond. Le défaut passe
à 256, avec le commentaire qui dit pourquoi — une phrase de passe de
soixante-dix caractères, ce que produit un gestionnaire réglé sur six mots,
était refusée par une règle de forme, dans une fiche dont la thèse est que les
règles de forme mènent aux mauvais mots de passe. Deux phrases de passe
longues, dont celle de soixante-quatorze caractères, sont testées dans chaque
langage, avec le témoin du plafond qui existe toujours.

### 2. `context` ne teste que l'égalité — levée

L'`escalate_when` le dit dans les deux langues, avec l'exemple de l'avis, et un
test le porte dans chaque langage : « Boulangerie-Martin » est refusé,
« Boulangerie-Martin-2026 » passe.

### 3. R11

Le point de rupture fait 59 mots et deux phrases : il était déjà dans la
limite.

## Un chiffre de plus

« 0,38 », dans l'`unavailable_reason` de N2, était un score illustratif que
rien ne produit ni ne peut produire. Il est remplacé par « un nombre entre zéro
et un », ce qui dit la même chose et ne prétend pas à une mesure. La fiche sort
de `dette-chiffres.json`.

## Preuve

```
$ node scripts/test-snippets.mjs check-a-password-against-a-policy
  ok        check-a-password-against-a-policy  1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:egress
check-egress : OK — 67 niveau(x) déclarent « data_egress: none » ; 0 fiche(s) encore en dette
$ npm run check:chiffres && npm run check:rupture && npm run check:content && npm run check:figures
check-chiffres-tenus : OK — 71 nombre(s) publié(s), tous présents dans un test ; 4 fiche(s) encore en dette
check-longueur-rupture : OK … ; check-content : OK … ; check-figures : OK …
```

Vingt-quatre tests Python verts, vingt-trois tests JavaScript verts.
