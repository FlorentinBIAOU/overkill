# fuzzy-match-company-names — vérification du lot 16

Avis d'origine : `docs/lot15/avis/fuzzy-match-company-names.md` (REFUSÉE).

## Motif 1 — le point de rupture citait le sigle, l'ordinaire cassait avant

**Le refus.** Sur des noms français, Jaro-Winkler récompense le début commun,
c'est-à-dire le métier. Deux pharmacies d'une même ville obtenaient 0,963, au-dessus
de la vraie paire Dubois à 0,957, et « Ets Martin » — l'abréviation la plus
courante des raisons sociales françaises — tombait à 0,682. La fiche ne disait
rien de tout cela.

**Ce qui a été fait.** Les quatre points de l'avis.

1. **Le cas passe en tête du `breaking_point` de N0**, avec les deux pharmacies,
   la comparaison à la vraie paire, et le témoin (0,897 pour deux boulangeries de
   noms différents). Le sigle reste, en second.
2. **La docstring est corrigée** : le préfixe commun favorise les noms qui
   partagent leur métier, « which is a problem here, not a feature ».
3. **Les abréviations usuelles sont développées** avant toute comparaison
   (`ABBREVIATIONS` : `ets`/`etab`/`etabs` → `etablissements`, `ste`/`stes` →
   `societe`, `cie` → `compagnie`), et « & » devient « et ».
4. **Le verdict dit qu'un score au-dessus du seuil est une paire à relire,
   jamais une fusion**, avec l'exemple des deux pharmacies.

**La preuve.** Cinq lignes du tableau de l'avis, dans les deux langages :

| Paire | Même société ? | Avant | Après |
|---|---|---|---|
| Pharmacie de la Gare / Pharmacie de la Mairie | non | 0,963 | 0,963, et la fiche le dit en premier |
| Transports Martin / Transports Martineau | non | 0,970 | 0,970, même famille de cas |
| Boulangerie Martin / Boulangerie Dupont | non | 0,897 | 0,897 (témoin) |
| Dubois & Fils SARL / Dubois et Fils | oui | 0,957 | **1,0** |
| Ets Martin / Établissements Martin | oui | 0,682 | **1,0** |

Test `les abréviations du registre sont développées`, avec le 0,682 gardé en
témoin de ce que le développement achète.

## Motif 2 — l'identifiant et le répertoire Sirene absents

**Ce qui a été fait.**

- Le `scenario` s'ouvre désormais sur la vraie première question : « y a-t-il un
  SIREN, un SIRET ou un numéro de TVA dans les deux fichiers ? S'il y en a un, il
  n'y a rien à rapprocher ; s'il n'y en a que d'un côté, on résout l'autre contre
  le répertoire Sirene. »
- Le verdict le redit, et ajoute que la paire sigle contre raison sociale ne se
  gagne pas par un niveau de plus mais par une table de sigles.
- `escalate_when` de N1 pointe cette table avant tout niveau supérieur.
- `sources` cite ce qui a été lu : la description officielle du fichier
  StockUniteLegale (Insee, 29 janvier 2026), où la variable `sigleUniteLegale`
  porte le sigle de l'unité légale à côté de sa dénomination, et la Licence
  Ouverte 2.0 du jeu de données.

## Motif 3 — N2 disponible sans preuve

**Ce qui a été fait.** L'option (b) de l'avis : **N2 passe en
`available: false`**. Sa raison dit que sa seule raison d'être serait le sigle,
que rien n'établit qu'un encodeur généraliste le rapproche de sa raison sociale,
que le mesurer demanderait de télécharger le modèle — ce que la vérification de
ce site ne fait pas —, et qu'une table de sigles règle le cas de façon
déterministe.

Conséquences portées jusqu'au bout : les quatre fichiers `n2.*` sont supprimés,
la traduction `n2` de `doc.fr.yaml` aussi, la ligne N2 de
`docs/sprints/MATRICE-EXTRAITS.md` devient une raison d'absence, et
`content/snippets/manifest.json` est régénéré (73 niveaux disponibles au lieu de
74). `escalate_when` de N1 ne promet plus rien qui ne soit démontré.

## Motif 4 — deux marquages vivants

| Marquage | Défaut | Correction |
|---|---|---|
| `n0` py/js `DÉFAUT` marques de catégorie M | « कमल उद्योग » et « कोमल उद्योग » à 1,0 | Seuls les diacritiques latins (U+0300–U+036F) sont retirés, et les marques restent dans les jetons : un signe voyelle devanagari n'est plus perdu. Les deux noms tombent à 0,973, les deux thaïs à 0,88 |
| `n0` py/js `DÉFAUT` forme juridique retirée n'importe où | « Sa Nostra » / « Nostra » et « NV Energy » / « Energy Ltd » à 1,0 | La forme n'est retirée qu'en fin de nom, et en tête pour une liste explicite qui exclut `sa` et `nv` — l'article catalan et corse, et le `NV` de « NV Energy ». Les deux paires tombent à 0,833 |

Les deux tests sont réécrits en démonstration, chacun avec son témoin
(« Société Générale » contre « Societe Generale » à 1,0 ; « SARL Dupont » contre
« Dupont SAS » à 1,0).

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/fuzzy-match-company-names/
(aucune sortie)
$ node scripts/test-snippets.mjs fuzzy-match-company-names
  ok        fuzzy-match-company-names          2 py, 2 js
```

## Remarques non bloquantes de l'avis

- **`LEGAL_FORMS` incomplète.** `scop`, `selarl` et `gie` ajoutés. `sel` et
  `association` écartés : « sel » est un mot français courant et « association »
  figure dans des dénominations, la même raison que celle qui écarte déjà
  « spa ». `ets` et `cie` sont traités comme des abréviations à développer, pas
  comme des formes à retirer.
- **`escalate_when` de N0 mêlait deux événements.** Gardé tel quel : les deux
  sont observables et mènent au même niveau ; c'est le seul point de l'avis sur
  lequel rien n'a été changé.

## État

**Levée.** `test-snippets` vert sur la fiche et sur le manifeste,
`check-content`, `check-figures`, `check-french` verts (`sirene` ajouté au
lexique), aucun marquage.
