# find-duplicate-records — vérification du lot 16

Avis d'origine : `docs/lot15/avis/find-duplicate-records.md` (REFUSÉE).

## Motif 1 — l'enregistrement comparé en bloc

**Le refus.** `record_text` concaténait l'enregistrement dans l'ordre des clés
du dictionnaire, et `similarity` comparait ce bloc. Deux conséquences sur le cas
même de la fiche :

```python
find_duplicates([a, b])  # []  b n'a ni courriel ni téléphone
find_duplicates([a, c])  # []  mêmes données, colonnes dans un autre ordre
```

**Ce qui a été fait.** La comparaison se fait champ par champ, sur les champs
que les deux fiches remplissent, et seulement ceux-là (`compare_records` /
`compareRecords`).

- Un champ que l'une des deux seulement porte est ignoré, pas compté comme une
  différence — c'est le point du modèle Fellegi-Sunter que l'avis cite.
- `record_text` trie les colonnes par nom : deux exports des mêmes données
  donnent le même texte quel que soit l'ordre des colonnes. La même correction
  a été portée dans `record_text` de N1 et de N2, où l'ordre changeait les
  n-grammes aux frontières.
- Un champ identifiant — courriel, téléphone, code postal, SIRET — est comparé
  par égalité et non par distance d'édition (`IDENTIFYING`) : deux adresses
  différentes au même domaine partagent l'essentiel de leurs caractères.
- Chaque champ est pesé (`WEIGHTS`) : s'accorder sur une ville ne dit presque
  rien, s'accorder sur une adresse électronique dit presque tout. Sans cette
  pondération, deux personnes d'un même foyer — même nom de famille, même
  adresse, même ville, même pays — passaient au-dessus du seuil.

**La preuve.** Tests écrits dans les deux langages :

- `un champ absent d'un côté n'est pas une différence` — les deux cas de l'avis
  rendent `(0, 1, 1.0)`, et le témoin (deux personnes différentes au même code
  postal) rend `[]` ;
- `l'ordre des colonnes ne change rien` — `record_text` identique, paire rendue ;
- `un champ partagé par tous ne porte pas une paire à lui seul` — la moyenne non
  pondérée passe le seuil, la moyenne pondérée non, avec pour témoin la même
  personne saisie deux fois ;
- `un courriel différent pèse autant qu'un nom identique`.

## Motif 2 — « ce que ce niveau coûte n'est pas la comparaison »

**Le refus.** La docstring de N2 affirmait que le coût est le déploiement, alors
que la comparaison est une double boucle sur toutes les paires : 16,6 s pour
mille fiches en dimension 384, hors encodage. Le test « mille fiches dans une
borne large » tournait en dimension 32, donc ne mesurait pas ce que la fiche
décrit.

**Ce qui a été fait.** Les deux branches que l'avis propose, ensemble :

- la phrase est remplacée par ce qui est vrai — deux prix, le déploiement fixe
  et la comparaison quadratique, avec ce qu'il faut faire au-delà de quelques
  dizaines de milliers de fiches (bloquer avec la clé de N0, ou un index
  approché), et le fait que cet extrait ne fait ni l'un ni l'autre ;
- les produits scalaires passent par un produit matriciel `numpy` en Python et
  par un tableau plat `Float64Array` en JavaScript. La comparaison reste
  quadratique — la docstring le dit —, elle n'est plus à la vitesse d'une
  boucle d'interprète ;
- le test passe en dimension 384, celle du modèle nommé, avec une borne de 10 s
  (marge de dix sur la mesure).

## Motif 3 — la réponse à une clé qui rate n'est pas N1

**Le refus.** `escalate_when` et le verdict envoyaient à N1, quadratique, ce que
la page Splink citée en `further_reading` règle par une seconde règle de
blocage.

**Ce qui a été fait.** `find_duplicates` prend une liste de clés
(`DEFAULT_KEYS = (blocking_key, field_key("email"), field_key("phone"))`), les
paires sont réunies et dédoublonnées, et chaque paire n'est comparée qu'une
fois. Le verdict et `escalate_when` disent désormais que la première réponse est
une clé de plus, et que N1 ne vient que lorsqu'il ne reste aucun champ sur
lequel en écrire une.

Le `breaking_point` de N0 est réécrit sur ce qui reste vrai : une paire
qu'**aucune** clé ne rapproche n'est jamais comparée, quel que soit le seuil —
avec son témoin, le même couple portant le même courriel, comparé et rendu à
0,863.

Test : `une seconde clé rattrape ce que la première a manqué` (deux langages) —
`keys=(blocking_key,)` rend `[]`, `keys=(field_key("email"),)` rend la paire,
l'union aussi.

## Motif 4 — marquages actifs

`n0.test.py` / `n0.test.js`, `INFIRMÉ` « ce niveau ne compare jamais toutes les
paires » : périmé, la docstring dit désormais « all of them when every record
lands in the same group ». Le test est réécrit en démonstration de cette
phrase — 300 fiches dans un seul groupe rendent exactement les 44 850 paires —
avec pour témoin vingt codes postaux qui ramènent le compte sous le dixième.

Trois noms de test portaient encore un préfixe `defaut` sans marquage et sans
défaut (`n1.test.py`, `n2.test.py`, un commentaire de `n1.test.js`) : renommés
sur ce qu'ils démontrent.

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/find-duplicate-records/
(aucune sortie)
```

## Remarques non bloquantes de l'avis

- **Latence de N1 qui change avec la taille.** Dite en toutes lettres dans la
  docstring de N1 et sa traduction : le coût croît avec le carré du fichier, la
  classe affichée est mesurée sur le fichier nominal des tests.
- **`blocking_key` prend le dernier mot comme nom de famille.** Gardé : le
  `breaking_point` le dit et le test le démontre. Une clé sur les initiales
  triées changerait le point de rupture sans le supprimer.
- **`breaking_point` de N2 fabriqué par un double.** Gardé tel quel, l'aveu y
  est déjà ; télécharger le modèle n'est pas à la portée de la suite.

## État

**Levée.** `node scripts/test-snippets.mjs find-duplicate-records` vert,
`check-content`, `check-figures`, `check-french` verts, aucun marquage.
