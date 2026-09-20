# validate-an-email-address-without-sending-a-message — vérification du lot 18

Avis : `docs/lot17/avis/validate-an-email-address-without-sending-a-message.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. L'algorithme du standard appliqué à moitié — levé

Le texte complet, pour `input type=email` : « Strip newlines from the value,
**then** strip leading and trailing ASCII whitespace from the value. » Les deux
moitiés sont maintenant appliquées, dans cet ordre, dans les deux langages, et
le commentaire cite l'algorithme en entier — la fiche tire toute son autorité
de ce texte.

Les deux conséquences, mesurées avant et après :

| Entrée | avant | après | ce que fait le navigateur |
|---|---|---|---|
| `jean@ex\nemple.fr` | `valid: false` | `valid: true`, `jean@exemple.fr` | retire le saut, valide |
| `jean@exemple.fr\x0b` | `valid: true` | `valid: false` | refuse |

La tabulation verticale n'est pas un *ASCII whitespace* au sens du standard :
`ASCII_WHITESPACE` est la constante des cinq caractères, et le commentaire dit
que `str.strip()` sans argument — ou `String.prototype.trim` — retirerait le
`\v` de trop.

Le critère d'acceptation de l'avis est tenu : les deux cas sont assertés dans
chaque langage, et les quatre variantes — saut au milieu, `\r\n` en tête,
tabulation verticale en queue et en tête — entrent dans le test de parité.

**Une remarque non bloquante traitée avec ce point** (remarque 1) : rien ne
tenait la transcription de l'expression régulière. La source du standard est
désormais recopiée dans les deux tests et comparée à `WHATWG.pattern` /
`WHATWG.source`. Le jour où quelqu'un « améliore » l'expression, le test tombe.

### 2. L'essai affirmait une résolution DNS qu'il ne fait pas — levé

Le libellé `routable` de l'essai disait « il se résout sur l'internet public »
à côté du `why` qui dit « la syntaxe ne consulte rien », sur le cas
`jean.dupont@gmial.com` que l'essai propose lui-même. Il dit maintenant, dans
les deux langues : « Le domaine porte un point : rien ici ne dit qu'il existe,
seulement qu'il n'est pas un nom d'hôte local. » C'est le registre du
commentaire du code, qui était juste.

La docstring de l'essai dit pourquoi le libellé est écrit ainsi, pour que
personne ne le « simplifie » en sens inverse.

## Les remarques non bloquantes

### 2. `routable` est vrai pour `jean@1.2.3.4` — levée

Le commentaire du rapport le dit maintenant en toutes lettres, et un test le
porte dans chaque langage, avec le cas vedette de la fiche : une faute de
frappe sur le domaine est routable elle aussi, puisque rien ne résout rien.

### 3. R11

Le point de rupture fait 57 mots et deux phrases — c'est le plus court du lot
et l'avis le cite en modèle. Rien à changer ; `check-longueur-rupture` le
confirme.

## R14

`an address is text, not <type>` n'était lue par aucun test. Elle est citée mot
pour mot dans les deux langages, et la fiche sort de `dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs validate-an-email-address-without-sending-a-message
  ok        validate-an-email-address-without-sending-a-message 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run test:tryout
# pass 50 / # fail 0

$ npm run check:raisons && npm run check:rupture && npm run check:figures && npm run check:french
check-raisons : OK — 170 raison(s) …; 10 fiche(s) encore en dette
check-longueur-rupture : OK — 208 point(s) de rupture, 149 encore en dette, aucun nouveau dépassement
check-figures : OK … ; check-french : OK (410 fichiers)
```

Dix-neuf tests Python verts, vingt tests JavaScript verts.
