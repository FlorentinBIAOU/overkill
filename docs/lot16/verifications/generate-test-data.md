# generate-test-data — vérification du lot 16

Avis d'origine : `docs/lot15/avis/generate-test-data.md` (REFUSÉE).

## Motif unique — FNV-1a sans finalisation, colonnes anticorrélées

**Le refus.** `draw` rendait `FNV-1a(seed ␟ field ␟ row) % n`. Le dernier octet
haché est le dernier chiffre du numéro de ligne, et le préfixe est constant sur
toute une colonne : le bit de poids faible du résultat ne dépendait que de la
parité de la ligne. Conséquences mesurées par le relecteur : alternance stricte
d'une colonne à deux valeurs, période 4 sur quatre valeurs, et deux colonnes
« tirées indépendamment » parfaitement anticorrélées — `('x','x')` et
`('y','y')` n'existaient jamais.

**Ce qui a été fait.** Le haché passe par une finalisation avant tout modulo :
le `fmix32` de MurmurHash3, trois décalages et deux multiplications sur 32 bits,
écrit à l'identique dans les deux langages (`Math.imul` en JavaScript).
Appliquée dans N0 et dans N1, avec la raison en toutes lettres dans la
docstring de `finalise`.

Au passage, le motif non bloquant 3 de l'avis : N1 échappe désormais le
séparateur dans la graine et le nom de champ, comme N0 (`_part` / `part`).

**La preuve.** Le tableau de contingence a ses quatre cases, en Python comme en
JavaScript :

```
Counter({('y','x'): 2537, ('x','y'): 2503, ('y','y'): 2493, ('x','x'): 2467})
{ xy: 2503, xx: 2467, yx: 2537, yy: 2493 }
```

Tests ajoutés, règle T6, dans les deux langages et aux deux niveaux :

- `deux colonnes tirées séparément sont indépendantes` (N0 et N1) — les quatre
  combinaisons existent, chacune entre 20 % et 30 % sur dix mille lignes ;
- `une colonne à deux valeurs n'a pas de période deux` (N0) — entre 30 et 70
  changements sur cent lignes, et une colonne d'entiers sur quatre valeurs n'a
  pas de période 4.

**Les attendus figés recalculés.** `GOLDEN` de N0 et de N1, dans les deux
langages (le même littéral des deux côtés, ce que le test croisé vérifie), et
les proportions du `breaking_point` de N1, qui sont désormais celles d'un
tirage indépendant :

| Mesure | Avant (biaisé) | Après | Attendu si indépendant |
|---|---|---|---|
| lignes ville/code postal impossibles sur 2 000 | 908 (45,4 %) | 858 (42,9 %) | 44,2 % |
| Nantes avec un code postal parisien | 100 (5,0 %) | 95 (4,75 %) | 5,2 % |

Les deux tests comparent désormais la mesure à l'attendu du tirage indépendant,
et non plus seulement à un nombre figé. Le texte du `breaking_point` — « près
d'une ligne sur deux », « une sur vingt » — reste exact.

```
$ node scripts/test-snippets.mjs generate-test-data
  ok        generate-test-data                 3 py, 3 js
```

## Remarques non bloquantes de l'avis

- **`escalate_when` de N0 envoyait à N1.** Corrigé : il dit maintenant que la
  réponse à une forme jamais produite n'est pas N1, qui ne tire que des valeurs
  d'une table fournie, mais la génération par propriétés — Hypothesis est déjà
  en `further_reading`.
- **Pourquoi pas Faker.** Une phrase dans la docstring de N0 et sa traduction :
  la documentation de Faker prévient elle-même que les valeurs d'une graine
  peuvent changer d'une version à l'autre.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts. Cette fiche ne portait aucun marquage et n'a pas de
niveau N3 à adaptateur non testé (son N3 est testé).
