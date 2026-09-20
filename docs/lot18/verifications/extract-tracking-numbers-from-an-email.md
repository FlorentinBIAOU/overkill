# extract-tracking-numbers-from-an-email — vérification du lot 18

Avis : `docs/lot17/avis/extract-tracking-numbers-from-an-email.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. « this family carries nothing to check » est faux pour UPS — levé

L'avis propose deux voies et en préfère une : « Mieux encore : le calcul tient
en huit lignes, je viens de le faire ; rien n'oblige à s'en priver. » C'est
celle-là qui est prise.

La dix-huitième position d'un numéro `1Z` est une clé sur les quinze
caractères qui la précèdent : lettres converties en chiffres, places impaires
comptées une fois et paires deux fois, complément à la dizaine supérieure.
Reproduit sur l'exemple canonique que l'avis cite :

```
1Z999AA10123456784   quinze = 999AA1012345678   somme 96   clé calculée 4   dernier 4
1Z999AA10123456785   clé calculée 4             dernier 5   -> checked: false, avec sa raison
```

Le commentaire dit ce que cette clé est et ce qu'elle n'est pas : **UPS ne la
publie pas**. Elle est écrite parce qu'elle est l'algorithme que l'exemple
canonique du transporteur satisfait, et parce qu'un numéro qui y échoue est
**rendu quand même**, avec `checked: false` et la raison. Rien n'est écarté sur
la foi d'une règle non publiée ; seul le mot « vérifié » est retenu.

Et la deuxième moitié de la demande est faite : une raison par famille. « Dix
chiffres » rend `shape only: ten digits carry no key to check` ; UPS rend
`the UPS check digit does not match the rest of the number`. Un test affirme
que les deux diffèrent. Le `verdict_rationale` est corrigé dans les deux
langues.

### 2. Le point de rupture citait un exemple absent du test — levé

Le message de test porte maintenant un numéro de téléphone, sous la forme
compacte qu'un courriel d'expédition emploie — `0123456789` en pied de
signature —, et le test l'asserte à côté du numéro de commande. Les deux
exemples que la fiche cite sont désormais démontrés.

Le numéro UPS du message était par ailleurs faux au regard de sa propre clé :
il devient `1Z9999W99999999997`, qui la satisfait, de sorte que le message
ordinaire de la fiche porte deux numéros vérifiés et deux numéros qui ne le
sont pas.

## Les remarques non bloquantes

### 1. Le téléphone à la française échappe à la famille — levée

Le point de rupture parle désormais du « téléphone compact », et un test
affirme que `01 23 45 67 89`, écrit par paires, n'est pas attrapé — ce qui est
la forme qu'un lecteur francophone écrit le plus souvent. L'affaiblissement de
l'argument est dit plutôt que passé sous silence.

### 2. Un `why` par famille — levée

Voir le point 1 : trois raisons distinctes là où il y en avait deux, et une
`docstring` qui dit pourquoi ce ne sont pas le même énoncé.

### 3. R11 — point de rupture de 103 mots et trois phrases

Réécrit : 52 mots en français, 54 en anglais, deux phrases. La fiche sort de la
dette R11.

## R14

`expected text, not <type>` n'était lue par aucun test. Elle est citée mot pour
mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs extract-tracking-numbers-from-an-email
  ok        extract-tracking-numbers-from-an-email 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture && npm run check:raisons && npm run check:chiffres
check-longueur-rupture : OK — 208 point(s) de rupture, 141 encore en dette, aucun nouveau dépassement
check-raisons : OK — 170 raison(s) …; 6 fiche(s) encore en dette
check-chiffres-tenus : OK — 72 nombre(s) publié(s), tous présents dans un test ; 4 fiche(s) encore en dette
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt-trois tests Python verts, vingt-deux tests JavaScript verts. Le corpus de
parité gagne l'exemple canonique d'UPS, sa variante fausse, et le téléphone
écrit par paires.
