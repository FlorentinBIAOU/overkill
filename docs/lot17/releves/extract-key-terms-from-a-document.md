# extract-key-terms-from-a-document — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « moulin à café » revient en « moulin » d’un côté et « café » de l’autre » | démontrée | test_point_de_rupture_un_terme_construit_sur_une_preposition_est_coupe_en_deux |
| 2 | N0 breaking_point | « le témoin : « droit français » revient d’un seul tenant » | démontrée | test_point_de_rupture_temoin_un_terme_sans_preposition_revient_entier |
| 3 | N0 docstring | « la liste de mots vides […] appartient à l’appelant » — une liste vide est refusée | démontrée | test_la_liste_de_mots_vides_est_exigee |
| 4 | N0 docstring, R6 | la liste anglaise appliquée au texte français ne coupe presque rien | démontrée | test_sans_les_mots_vides_de_la_bonne_langue_le_decoupage_ne_veut_rien_dire |
| 5 | N0 — limites dites | singulier et pluriel sont deux termes ; un nombre seul n’est pas un terme | démontrées | test_le_singulier_et_le_pluriel_sont_deux_termes, test_un_nombre_seul_nest_pas_un_terme |
| 6 | N1 breaking_point | « « conditions générales de vente » tombe à zéro […] « rétractation » tombe à zéro aussi » | démontrée | test_point_de_rupture_le_sujet_de_la_collection_disparait_de_tous_ses_documents |
| 7 | N1 breaking_point | « le témoin : le niveau N0 fait bien remonter ce terme » | démontrée | test_point_de_rupture_temoin_le_niveau_n0_le_fait_remonter |
| 8 | verdict_rationale | « lu seul, il rend « conditions générales » […] lu dans son dossier, il rend « moulin » et « café » » | démontrée | test_verdict_le_corpus_fait_remonter_ce_qui_distingue_le_document |
| 9 | verdict_rationale | chaque document de la collection a son propre sujet en tête | démontrée | test_verdict_chaque_document_de_la_collection_a_son_propre_sujet |
| 10 | N1 docstring | « le logarithme n’est pas planché à un » — zéro ici, un chez scikit-learn | démontrée | test_le_logarithme_nest_pas_plancher_a_un_contrairement_a_scikit_learn |
| 11 | N1 — corpus exigé | moins de deux documents, ce n’est pas une collection | démontrée | test_un_corpus_de_moins_de_deux_documents_est_refuse |
| 12 | Les deux niveaux | le classement ne dépend pas de l’ordre des égalités | démontrée | test_le_classement_ne_depend_pas_de_lordre_des_egalites (n0 et n1) |
| 13 | Les deux langages | rapport identique, scores compris, sur treize cas en N0 et six en N1 | démontrée | test_python_et_javascript_rendent_le_meme_rapport (n0 et n1) |
| 14 | N0 latency `~10 ms`, N1 `~100 ms` | classes de latence | mesurées | voir ci-dessous |
| 15 | N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Sur la machine de travail, pour un document de 3 040 caractères : **0,59 ms en
Python et 0,22 ms en JavaScript** au niveau N0. Pour une collection de vingt
documents de cette taille : **18,5 ms et 6,8 ms** au niveau N1, soit environ
0,9 ms par document. Les classes affichées sont `~10 ms` pour un document et
`~100 ms` pour une collection, qui est l’ordre de grandeur d’un dossier de
cent documents. Les tests ne gardent que des bornes d’effondrement.

## Le chiffre qui porte le verdict

Aucun : ce n’est pas une question de coût, les deux niveaux étant gratuits et
locaux. Le verdict tient à ce que les deux niveaux rendent sur le même
document, et le test le montre en une ligne — « conditions générales » d’un
côté, « moulin » et « café » de l’autre.

## Ce que la recherche a établi

| Outil | Version | Licence | Publié | Retenu |
|---|---|---|---|---|
| `yake` (PyPI) | 0.7.3 | LGPLv3 | 9 février 2026 | nommé, essayé pendant la recherche, pas retenu comme dépendance |
| `rake-nltk` (PyPI) | 1.0.6 | MIT | 15 septembre 2021 | nommé : c’est la mise en œuvre de référence de la méthode du niveau N0 |
| `keybert` (PyPI) | 0.9.0 | MIT | 7 février 2025 | ferme le niveau N2 : il demande un encodeur par langue |
| `keyword-extractor` (npm) | 0.3.0 | **aucune déclarée** | 13 août 2026 | nommé, pas employé : un paquet sans licence déclarée est un paquet qu’on ne peut pas intégrer |
| `retext-keywords` (npm) | 8.0.2 | MIT | 23 octobre 2024 | écarté : il dépend de `stemmer`, l’algorithme de Porter, écrit pour l’anglais |
| `rake-js` (npm) | 0.1.1 | LGPL-3.0 | 15 juillet 2017 | écarté : neuf ans sans publication |
| `natural` (npm) | 8.1.1 | MIT | 27 février 2026 | non retenu : son `TfIdf` pèse des mots, pas des expressions candidates |

`yake` a été installé et exécuté pendant la recherche, **hors suite de tests**,
sur le document français de la fiche. Il rend « immatriculée au registre »,
« registre du commerce », « société Lumière », « café Lumière », « moulins à
café » et « vend des moulins » : la règle qui laisse un mot vide à l’intérieur
d’un candidat sans l’accepter au bord rend bien les termes prépositionnels, et
fait entrer avec eux des candidats qui commencent par un verbe. C’est cette
mesure qui est résumée dans le point de rupture du niveau N0. Il n’a pas été
ajouté aux dépendances : six dépendances transitives pour une comparaison qui
ne décide pas du verdict.

## Décidé seul

- **Le logarithme n’est pas lissé.** `scikit-learn` plancherait un terme
  présent partout à 1 ; ici il vaut 0. L’alternative écartée : garder la forme
  lissée par cohérence avec la fiche sur les articles voisins. Elle est juste
  là-bas, où les poids alimentent un cosinus et où un terme commun doit encore
  compter ; elle est fausse ici, où la liste est lue par un humain.
- **Le niveau N1 partage les candidats du niveau N0.** L’alternative écartée :
  classer des mots isolés, comme le fait un TF-IDF ordinaire. Les deux niveaux
  seraient alors incomparables, et le lecteur ne verrait pas ce que le corpus
  change — qui est tout le sujet de la fiche.
- **La liste de mots vides est exigée, et n’est pas livrée.** C’est la position
  déjà prise par la fiche sur les articles voisins, et elle vaut ici doublement :
  cette liste ne sert pas qu’à filtrer, elle découpe.
- **Le score est arrondi par `floor(x * 10000 + 0.5) / 10000` dans les deux
  langages.** L’arrondi de Python et celui de JavaScript ne traitent pas les
  moitiés de la même façon, et un classement ne doit pas dépendre du langage
  qui a tourné.

## Non testable, et pourquoi

Les niveaux N2 et N3 sont fermés par un argument de structure : ils lisent un
document à la fois, ce qui est exactement ce que le verdict reproche au niveau
N0. Aucun modèle n’est installé pour le démontrer.

## Infirmé, et ce que le code fait réellement

Un point corrigé en cours de route, et il était grave : la première version
découpait le texte sur la ponctuation avant de chercher les mots vides, mais ne
gardait pas trace de ce qui avait été coupé — si bien que « moulin. café »
donnait le candidat « moulin café », deux mots de deux phrases différentes. La
version publiée parcourt les mots et vérifie que rien d’autre qu’une espace ne
les sépare. Le test de parité et le test d’égalité de classement ont l’un et
l’autre attrapé la conséquence avant qu’elle n’entre dans la fiche.

## Défauts de production

Deux divergences entre les langages levées dans l’extrait :

- la normalisation Unicode est faite une fois sur tout le texte, avant le
  découpage : en forme décomposée, l’accent est un caractère à part et
  « société » était coupé en deux ;
- les classes d’espaces et de lettres sont écrites en toutes lettres plutôt que
  prises dans `\w` et `\s`, qui ne couvrent pas les mêmes caractères d’un
  langage à l’autre.

Le reste : une entrée qui n’est pas du texte rend un rapport avec sa raison, un
document vide rend une liste vide, un document qui n’est pas du texte au milieu
d’une collection ne fait pas tomber les autres, et l’apostrophe coupe —
« main-d’oeuvre » donne « main-d » et « oeuvre », ce que le code dit à
l’endroit où il le fait.
