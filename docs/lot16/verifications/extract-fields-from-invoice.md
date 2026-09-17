# extract-fields-from-invoice — vérification du lot 16

Avis d'origine : `docs/lot15/avis/extract-fields-from-invoice.md` (REFUSÉE,
`status: draft`). La fiche est réécrite autour de la réforme de la facturation
électronique, décision du commanditaire.

## Motif 1 — la fiche ignorait que la facture arrive structurée

**Le refus.** Nous sommes après le 1er septembre 2026 : le premier geste d'un
traitement de factures n'est plus une expression régulière sur le texte d'un
PDF, c'est de lire le XML quand il est là. La fiche reléguait Factur-X en
lecture complémentaire, « quand il n'y a plus rien à extraire ».

**Ce qui a été fait.** La lecture de la donnée structurée entre dans le niveau
N0, dans le `scenario` et dans le verdict, et la réglementation est vérifiée à
la source.

- **`n0.py` et `n0.js` ont deux portes et une règle** : `read_invoice` lit le
  fichier structuré quand on lui en donne un, le texte de la page sinon, et
  **dit par quelle porte la réponse est passée** (`source: "structured"` ou
  `"text"`). « A number read from XML and a number read from a line of text are
  not worth the same, and the caller has to be able to tell them apart. »
- **Les deux syntaxes du socle sont lues**, UBL et CII — donc Factur-X, qui
  porte le CII dans le PDF. Les champs sont repérés par le couple (parent,
  enfant) des noms locaux, ce qui évite une page de déclarations d'espaces de
  noms et écarte les `ID` de lignes de produit.
- **Le contrôle arithmétique que l'avis réclamait est là, et c'est une règle de
  la norme** : BR-CO-15, total TTC = total HT + TVA, rendue dans
  `totals_agree`. Trois états, pas deux : vrai, faux, et `None` quand la facture
  ne porte pas les trois montants. La docstring dit aussi sa limite, lue dans
  l'annexe des règles de gestion : « en profil extended, la règle BR-CO-15 ne
  s'applique pas », donc un `totals_agree` faux « is a reason to look, not a
  reason to reject ».
- **Sortir le XML du PDF n'est pas dans l'extrait**, et la docstring le dit :
  c'est une pièce jointe que n'importe quelle bibliothèque PDF liste.
- **Le `scenario`, le `name` de N0, son `breaking_point`, son `escalate_when` et
  le verdict sont réécrits** sur ce partage : la moitié structurée se lit, le
  résidu — fournisseurs hors de France, tickets, arriéré, factures d'avant la
  réforme — s'extrait, et c'est lui qui casse.
- **Une dépendance entre dans le dépôt pour JavaScript** : `fast-xml-parser`
  5.2.5 (MIT), Node n'ayant pas d'analyseur XML dans sa bibliothèque standard là
  où Python en a un. Elle était déjà dans l'arbre, tirée par `@astrojs/rss`.

**Les sources, vérifiées à la source et citées dans la fiche** :

- foire aux questions « Je découvre la facturation électronique » d'impots.gouv.fr,
  version du 01/09/2026, question 5.1, mot pour mot : « Depuis le 1er septembre
  2026, toutes les entreprises, quelles que soient leur taille et leur forme
  juridique, ont l'obligation de recevoir des factures sous format électronique,
  par l'intermédiaire d'une plateforme agréée » ; les grandes entreprises et les
  ETI doivent aussi les émettre ; les petites, moyennes et micro-entreprises
  « au plus tard le 1er septembre 2027 » ;
- dossier de spécifications externes v3.2 (30/04/2026), section 2 : « le respect
  du socle minimum de formats reposant sur des standards sémantiques et
  syntaxiques respectant la norme européenne EN16931 pour faciliter les
  échanges : UBL, CII et Factur-X » ;
- annexe 1 du même dossier, pour les chemins CII de BT-1, BT-2, BT-109 et
  BT-110, repris tels quels en commentaire de l'extrait ;
- annexe 7 « Règles de gestion » v1.9, règle BR-CO-15, en français : « Montant
  total de la facture TVA comprise (BT-112) = Montant total de la facture hors
  TVA (BT-109) + Montant total de TVA de la facture (BT-110). »

**La preuve.** Sept tests par langage sur la porte structurée : les deux
syntaxes rendent le même objet, les deux écritures de date rendent la même
forme, BR-CO-15 vraie, fausse à un centime près, indécidable sans les trois
montants, un document qui n'est ni CII ni UBL refusé, une facture sans numéro
refusée, les préfixes d'espaces de noms indifférents, et un `ID` de ligne de
produit qui ne prend pas la place du numéro de facture.

## Motif 2 — le niveau recommandé ne tournait pas

**Le refus.** N2 appelait `pipeline("token-classification")` avec des mots et
des boîtes, forme que ce pipeline n'accepte pas ; les boîtes étaient fabriquées
(`x1` toujours à 1000) ; le point de contrôle nommé était un encodeur de base
sans étiquettes de facture, sous licence non commerciale ; `cost` et `latency`
n'avaient pas de source.

**Ce qui a été fait.** L'option (b) de l'avis : **le verdict passe à N0**, élargi
à la donnée structurée, et **N2 est fermé** avec une raison qui tient.

- Les quatre fichiers de N2 sont supprimés, la ligne du niveau devient
  `available: false`, et l'`unavailable_reason` dit les trois raisons : le point
  de contrôle de référence est un encodeur non affiné, sa licence est
  CC BY-NC-SA donc hors usage commercial, et rien n'en lit l'équivalent en
  JavaScript. « Un extrait qui ne tourne pas n'a pas sa place sur cette
  échelle. »
- La ligne de `docs/sprints/MATRICE-EXTRAITS.md` est corrigée, le manifeste
  régénéré (73 niveaux disponibles), et la fiche passe de `draft` à `published`
  puisque le niveau recommandé tourne pour de bon, avec `verification: executed`.
- Le verdict explique ce que chaque niveau devient dans le monde de la réforme,
  et pourquoi le résidu se réduit.

## Motif 3 — le point de rupture de N2 décrivait un comportement jamais observé

Sans objet : le niveau est fermé et son point de rupture a disparu avec lui.

## Motif 4 — cinq marquages

- **N0 `INFIRMÉ`** (« trois chiffres exacts par groupe empêchent d'avaler une
  quantité et un prix unitaire ») : le commentaire du code disait déjà la vérité
  depuis le tour précédent. Le test devient
  `trois chiffres par groupe séparent une quantité d'un prix, mais pas toujours`,
  qui montre les deux cas — « 2 38,50 » séparé, « 2 380,50 » avalé.
- **N1 `INFIRMÉ`** (annoter corrigerait la lecture) : périmé, le point de rupture
  dit désormais le contraire. Devenu
  `point de rupture : annoter la facture ne corrige pas la lecture`, qui vérifie
  qu'après réentraînement l'indemnité de 40,00 est toujours retenue, avec le
  témoin d'une facture sans indemnité.
- **N2 `INFIRMÉ` et `DÉFAUT`** : disparus avec le niveau.
- **N3 `DÉFAUT`** : remplacé par trois tests d'adaptateur par langage contre
  `_harness/fake_sdk.py` et `fake-sdk.mjs` (règle T2) — la requête
  (`chat.completions`, modèle, température, l'image en URL de données dans le
  message), un `content` nul qui lève après trois appels, une panne retentée.
  Les doubles locaux `RealShapedClient` n'ont plus d'emploi et sont supprimés.
- **Les noms `test_defaut_…` et `test_infirme_…` restants** sont réécrits sur ce
  qu'ils démontrent, dans les deux langages.

## Remarques non bloquantes de l'avis

- **Aucune vérification arithmétique à aucun niveau.** C'est la plus utile des
  trois remarques, et elle est traitée deux fois : en N0 sur le fichier
  structuré, et **en N3 sur ce que le modèle écrit** — l'invite demande
  désormais les trois montants, et `totals_agree` recalcule BR-CO-15 dessus. Le
  test montre ce qu'elle attrape (la TVA lue sur la ligne au-dessus) et ce
  qu'elle n'attrape pas (trois montants inventés qui tombent juste).
- **Le point de rupture de N0 (« Sous-total » contient « total »)** est gardé tel
  quel, comme l'avis le demandait.
- **L'indemnité forfaitaire écrite en phrase plutôt qu'en montant seul.**
  Divergence assumée : vérifier « sur deux ou trois gabarits réels » demande des
  factures réelles que ce lot n'a pas. La fiche ne dit pas que la mention est
  toujours seule sur sa ligne ; le test montre ce que le classifieur fait quand
  elle l'est, et le `breaking_point` décrit ce cas-là.

## État

**Levée, et la fiche est publiée.** `node scripts/test-snippets.mjs
extract-fields-from-invoice` vert (6 extraits, 3 py, 3 js) ; `check-content`
(25 fiches publiées, plus aucun brouillon), `check-figures`, `check-french`
verts (`factur` ajouté au lexique) ; `npm run check:fast` vert.
