# check-bank-details-before-a-transfer — vérification du lot 18

Avis : `docs/lot17/avis/check-bank-details-before-a-transfer.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1, 2 et 3. Trois chiffres publiés que le dépôt ne produit pas — levés

Les trois mesures ont été rejouées, avec les générateurs des tests et leur
graine, dans les deux langages :

| Mesure | Python (graine 3) | JavaScript (graine 3) |
|---|---|---|
| fautes d'un chiffre, cent IBAN | 20 700 essais, 0 passe | 20 700 essais, 0 passe |
| transpositions voisines, cent IBAN | 1 973 essais, 0 passe | 2 000 essais, 0 passe |
| lettres sosies, cinq cents IBAN | 6 882 essais, **31** par la clé ISO seule, **0,45 %** | 6 892 essais, **32**, **0,46 %** |

Aucune des deux ne donne 0,6 %, ni 6 887, et « cinq cents IBAN » ne vaut que
pour la troisième. Les docstrings des deux langages publient désormais
l'effectif de chaque mesure séparément, avec le décompte de l'autre langage
nommé comme tel. Le `verdict_rationale` publie « 31 des 6 882 […] — 0,45 % ».
`check-chiffres-tenus` vérifie maintenant que chacun de ces nombres se trouve
dans un test de la fiche.

### 4. Tests écrits pour passer, pas pour démontrer — levé

Les deux générateurs sont à graine fixe, donc rien n'autorisait une fourchette.
Les bornes `ensemble > 6_000` et `0.002 < x < 0.02` — qui laissaient passer
n'importe quel taux dans une décade — sont remplacées par des égalités :

```python
assert essais == 20_700          # 100 IBAN × 23 positions × 9 autres chiffres
assert essais == 1_973
assert ensemble == 6_882
assert seule_iso == 31
assert round(100 * seule_iso / ensemble, 2) == 0.45
```

et leurs jumelles en JavaScript, à 20 700, 2 000, 6 892, 32 et 0,46.

### 5. Le test de la clé RIB ne testait pas ce qu'il annonçait — levé

La « fausse clé RIB » était fabriquée en changeant les deux derniers chiffres
de l'IBAN, ce qui casse d'abord la clé ISO, et l'assertion s'en accommodait par
un `or`. Elle est remplacée par le numéro que l'avis donne,
`FR0630006000011234567890188`, qui passe la clé ISO et échoue à la seule clé
RIB, sans `or` :

```
{"valid": false, "country": "FR", "national_key": false,
 "reason": "the RIB key inside the account number does not match"}
```

Le test Python vérifie en plus que `stdnum.iban.is_valid` l'accepte, et le test
JavaScript qu'`ibantools` le refuse : les deux moitiés de la phrase de la
docstring sont ainsi démontrées là où elles sont écrites.

## Les remarques non bloquantes

### 1. Monaco portait la même clé, et la fiche le savait à moitié — levée

`RIB_COUNTRIES = ("FR", "MC")`. Vérifié sur les deux numéros de l'avis :
`MC5811222000010123456789030` et `MC1112739000700011111000H79` rendent tous
deux `national_key: true`. Le commentaire dit pourquoi — la partie nationale
monégasque fait vingt-trois caractères et satisfait le même modulo 97 — et un
test le porte dans chaque langage, avec le témoin d'un pays sans clé connue.

La raison rendue perd son adjectif : « the RIB key inside the account number
does not match », puisqu'elle vaut désormais pour deux pays.

### 2. Le choix de ne pas appeler la clé nationale des bibliothèques était sous-documenté — levée

Les deux docstrings nomment les deux comportements constatés, plutôt qu'une
généralité : `python-stdnum` n'a pas de module français et accepte
`FR0630006000011234567890188` ; `ibantools` le refuse. Deux bibliothèques qui
répondent différemment sur le même numéro sont deux extraits qui répondraient
différemment sur la même page — c'est la raison directe d'écrire la clé
soi-même, et elle est maintenant écrite.

### 3. R11 — point de rupture de 70 mots

Réécrit : 56 mots en français, 59 en anglais, deux phrases. La fiche sort de la
dette R11.

## R14

`an IBAN is text, not <type>` n'était lue par aucun test. Elle est citée mot
pour mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs check-bank-details-before-a-transfer
  ok        check-bank-details-before-a-transfer 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:chiffres
check-chiffres-tenus : OK — 72 nombre(s) publié(s), tous présents dans un test ; 7 fiche(s) encore en dette
$ npm run check:raisons && npm run check:rupture
check-raisons : OK — 170 raison(s) …; 11 fiche(s) encore en dette
check-longueur-rupture : OK — 208 point(s) de rupture, 149 encore en dette, aucun nouveau dépassement
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt tests Python verts, vingt tests JavaScript verts.
