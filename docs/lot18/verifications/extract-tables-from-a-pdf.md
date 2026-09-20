# extract-tables-from-a-pdf — vérification du lot 18

Avis : `docs/lot17/avis/extract-tables-from-a-pdf.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. R1 — l'en-tête de la page devenait des lignes du tableau — levé

La facture que l'avis décrit est fabriquée et entre dans les deux jeux de
tests, avec les mêmes octets des deux côtés : un bloc adresse de trois lignes,
un numéro de facture, un tableau à quatre colonnes sans un seul filet, un pied
de page. Avant correction, `read_tables` rendait bien huit lignes dont cinq
d'habillage, chacune avec trois cellules vides.

Correction, dans les deux langages : une lecture devinée ne garde que les
lignes à au moins deux cellules remplies (`MIN_FILLED_CELLS`), et **nomme** les
autres dans `dropped_lines`.

**Écart avec l'avis, et pourquoi.** L'avis propose de « compter » les lignes
écartées. Elles sont listées avec leur texte plutôt que comptées : la première
version, qui comptait, faisait disparaître la seconde moitié d'une désignation
repliée — elle n'a qu'une cellule remplie — et une règle écrite pour empêcher
une donnée fausse en faisait perdre une vraie. `dropped_lines` porte donc le
texte, rien de ce qui a été lu sur la page n'est perdu, et c'est la règle
inventée par la fiche 21 — « ce qui n'est pas lu est nommé » — appliquée ici.

Après correction, dans les deux langages, à l'identique :

```
page 1  strategy text
   ['Reference', 'Designation', 'Quantite', 'Prix HT']
   ['MC-4501', 'Moulin a cafe', '2', '19,90']
   ['MC-9000', 'Bouilloire', '1', '34,00']
dropped_lines  ['SARL Le Moulin', '12 rue des Freres-Lumiere',
                '92100 Boulogne-Billancourt',
                'Facture n FA-2026-0412 du 12 janvier 2026', 'Page 1 sur 1']
```

Le point de rupture nomme ce comportement, avec cet exemple. La cellule repliée
reste démontrée — c'est maintenant la divergence entre les deux langages, et
elle a son test dans chacun.

Effet de bord attendu, et voulu : `PROSE`, une page de prose sans le moindre
tableau, ne rend plus rien du tout. Le test
`test_une_page_sans_tableau_ne_rend_pas_un_tableau_invente` dit enfin ce que
son nom annonce — il constatait le contraire et s'en accommodait.

### 2. Le nom du niveau promettait aux deux langages ce qu'un seul sait faire — levé

`name` devient « Les filets en Python quand la page en a, la position des mots
dans les deux langages ». La docstring Python porte la même restriction en
toutes lettres, à côté de la description de `strategy`.

## Les remarques non bloquantes

### 1. Les colonnes sont déduites de toute la page — levée

C'est la mécanique qui produisait le défaut, et elle est maintenant écrite dans
les deux docstrings, en français comme en anglais : « le devinement porte sur
toute la page, pas sur le tableau », suivie de la conséquence et du filtre
qu'elle justifie.

### 2. `if ruled: … continue`

**Non traitée, et assumée.** Un encadré décoratif autour d'un titre produit un
tableau d'une cellule en `strategy: lines`, et le vrai tableau sans filets de
la même page n'est alors jamais lu. Corriger demanderait de décider quand une
lecture tracée est « assez bonne » pour dispenser de l'autre, c'est-à-dire un
second seuil sur une page dont on ne sait rien — exactement le genre de verdict
que cette fiche existe pour refuser. Le cas reste ouvert et il est dans
`RAPPORT-LOT18.md`.

### 3. R11 — point de rupture de 73 mots

Réécrit : 58 mots dans les deux langues, deux phrases. La fiche sort de la
dette R11.

## Preuve

```
$ node scripts/test-snippets.mjs extract-tables-from-a-pdf
  ok        extract-tables-from-a-pdf          1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 161 encore en dette, aucun nouveau dépassement
$ npm run check:content && npm run check:figures && npm run check:raisons && npm run check:french
check-content : OK … ; check-figures : OK … ; check-raisons : OK … ; check-french : OK (410 fichiers)
```

Dix-sept tests Python verts, seize tests JavaScript verts. Le test de parité
compare désormais le rapport entier de la facture — lignes rendues et lignes
écartées — entre les deux langages.
