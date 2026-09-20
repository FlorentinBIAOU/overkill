# repair-text-with-broken-encoding — vérification du lot 18

Avis : `docs/lot17/avis/repair-text-with-broken-encoding.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. « The two agree on thirty-nine of forty-one strings » est faux — levé

Reproduit, à l'identique de l'avis. `ftfy` 6.3.1 pèse la chaîne entière avant
de réparer et renonce quand ce qui en sortirait est une suite courte ouvrant
sur une majuscule accentuée :

```
$ .venv-tools/bin/python …
'Île-de-France'    casse='ÃŽle-de-France'    py='ÃŽle-de-France'    changed=False
'Îles Canaries'    casse='ÃŽles Canaries'    py='ÃŽles Canaries'    changed=False
'Îlot'             casse='ÃŽlot'             py='ÃŽlot'             changed=False
'Œuvre'            casse='Å’uvre'            py='Å’uvre'            changed=False
'Région Île-de-France'  casse='RÃ©gion ÃŽle-de-France'  py='Région Île-de-France'  changed=True
```

L'extrait JavaScript répare les quatre. Le dernier cas est le témoin qui montre
que l'heuristique dépend du reste de la chaîne, pas du mot.

Le décompte est refait sur un corpus élargi, et les deux docstrings publient le
résultat réel : **trente-neuf accords sur quarante-sept**, et **huit écarts en
trois familles, dans les deux sens** :

| Famille | Sens | Nombre |
|---|---|---|
| `ftfy` renonce sur une chaîne courte à majuscule accentuée | JavaScript répare | 4 |
| `ftfy` lit un caractère de remplacement déjà présent comme un octet | JavaScript laisse tranquille | 1 |
| Règle « Ã » + espace ordinaire → « à » | `ftfy` répare, JavaScript non | 2 |
| Accidents empilés au-delà de `ROUNDS` | `ftfy` défait tout, JavaScript s'arrête | 1 |

La phrase « It repairs one more real case and rewrites one more correct
sentence, and the JavaScript side does neither », qui laissait croire que le
Python domine, est remplacée par les trois paragraphes qui disent les deux
sens. Le `verdict_rationale` de la fiche le dit aussi, en une phrase : sur ces
quatre chaînes, c'est l'extrait sans bibliothèque qui répare.

### 2. Le jeu de quarante et une chaînes était complaisant (T3) — levé

Le corpus passe de 41 à 47 entrées, et les six qui entrent sont exactement
celles que l'avis réclame, plus deux que le travail a fait apparaître. Elles ne
sont pas écrites à la main : une fonction `_casser` / `casser` **produit**
l'accident — encoder en UTF-8, relire en Windows-1252 relâché — à partir du mot
correct, dans les deux langages. Un mojibake écrit à la main est un mojibake
choisi ; celui-ci est celui que l'accident fabrique.

L'assertion de parité est réécrite à l'égalité stricte sur la liste des huit
écarts, dans l'ordre, et chacun des sens est vérifié séparément — ce qui la
rend sensible à une régression dans n'importe lequel des deux langages.

### 3. Le cas où `ftfy` détruit la donnée — levé, avec un écart sur l'exemple

**Écart assumé avec l'avis.** L'exemple de l'avis n'est pas reproductible tel
qu'il est écrit. Le mojibake de `Ïambe` par un décodeur Windows-1252 *relâché*
— celui de `ftfy`, celui des vrais fichiers — est `Ã` + U+008F + `ambe`, et
les deux extraits le réparent correctement :

```
'Ã\x8fambe'   py {'text': 'Ïambe', 'changed': True,  'lossy': False}
              js {"text": "Ïambe", "changed": true,  "lossy": false}
```

Ce qui est reproductible, et qui est bien le défaut que l'avis décrit, c'est le
mojibake produit par un décodeur **strict**, où l'octet 0x8F est jeté avant que
ce code voie la chaîne :

```
'Ã�ambe' py {'text': '�ambe', 'changed': True,  'lossy': True}
              js {"text": "Ã�ambe", "changed": false, "lossy": true}
```

`ftfy` lit le caractère de remplacement comme un octet, et **le « Ã » qui le
précède disparaît** : la perte n'est donc pas un `U+FFFD` écrit par la
réparation, mais un caractère survivant qu'elle supprime. L'extrait JavaScript
laisse la chaîne intacte. Les deux sont testés, dans les deux langages, avec le
témoin du même mot dont l'octet n'a pas été jeté.

La docstring du champ `lossy` est réécrite en conséquence, dans les deux
langages et en français : elle ne promet plus que la perte est toujours
antérieure à l'appel, et elle dit que `ftfy` peut supprimer le caractère devant
un remplacement — « a `lossy` text is one to import again, not one to repair ».

**Pourquoi le code n'a pas été changé.** Refuser d'écrire un `U+FFFD` que
l'entrée ne portait pas ne couvre pas ce cas, puisque l'entrée le portait.
Refuser toute réparation d'une chaîne qui porte un remplacement casserait le
comportement que la fiche vend et que le commentaire explique — réparer
segment par segment, donc réparer la moitié saine d'une chaîne à moitié perdue.
Et doubler l'extrait Python pour contourner `ftfy` sur ce cas est exactement ce
que l'interdit n° 6 refuse. La divergence est donc publiée, pas masquée, et
l'`escalate_when` de la fiche disait déjà la seule réponse : réimporter la
source.

## Les remarques non bloquantes

### 1. `ROUNDS = 4` sans équivalent déclaré côté Python — levée

Mesuré : `ftfy` défait n'importe quelle profondeur — sept accidents empilés
reviennent à `été`. L'extrait JavaScript en défait quatre et laisse le reste.
C'est écrit dans les deux docstrings, et testé des deux côtés : quatre tours
passent, le cinquième laisse `Ã©tÃ©`.

### 2. R11 — point de rupture de 76 mots

Réécrit : 48 mots en français, 49 en anglais, deux phrases. « Île-de-France »
sort de la liste du témoin — le mot correct y était juste, mais le citer là
alors que sa forme cassée est désormais le cœur d'une divergence prêtait à
confusion. La fiche sort de la dette R11.

## Le nombre publié, et les raisons rendues

- « une table de 256 octets » (`unavailable_reason` de N1) n'était tenue par
  aucun test. Elle l'est : les deux cent cinquante-six octets sont décodés en
  `sloppy-windows-1252`, la table est vérifiée injective, et le retour rend les
  mêmes octets — ce qui démontre en même temps « exactement inversible ».
- « text is expected, not … » n'était lue par aucun test : il vérifiait qu'une
  chaîne non vide sortait. Elle est citée mot pour mot dans les deux langages.

La fiche sort de `dette-chiffres.json`, `dette-raisons.json` et
`dette-rupture.json`.

## Preuve

```
$ node scripts/test-snippets.mjs repair-text-with-broken-encoding
  ok        repair-text-with-broken-encoding   1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:chiffres
check-chiffres-tenus : OK — 70 nombre(s) publié(s), tous présents dans un test ; 8 fiche(s) encore en dette
$ npm run check:raisons
check-raisons : OK — 163 raison(s) …; 20 fiche(s) encore en dette
$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 164 encore en dette, aucun nouveau dépassement
$ npm run check:content && npm run check:figures && npm run check:french
check-content : OK — 50 fiche(s) … ; check-figures : OK … ; check-french : OK (410 fichiers)
```

Vingt-deux tests Python verts, vingt tests JavaScript verts.
