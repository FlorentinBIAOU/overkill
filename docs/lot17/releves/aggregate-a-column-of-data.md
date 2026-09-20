# aggregate-a-column-of-data — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « trois des sept lignes de la colonne ne sont pas des nombres, et la moyenne rendue est celle des quatre autres » | démontrée | test_point_de_rupture_la_moyenne_est_celle_de_ce_qui_a_ete_lu |
| 2 | N0 breaking_point | « le témoin : chaque ligne écartée revient avec son numéro et sa raison » | démontrée | test_point_de_rupture_temoin_chaque_ligne_ecartee_revient_avec_sa_raison |
| 3 | verdict_rationale | « l’addition en flottants rend 244.98000000000002 quand la facture imprime 244,98 » | **mesurée, dans les deux langages** | test_verdict_la_somme_flottante_nest_pas_la_somme_de_la_facture |
| 4 | verdict_rationale | « la somme compensée de Kahan ou le `fsum` de Python rend exactement la même valeur fausse » | **mesurée** | test_verdict_la_somme_compensee_ny_change_rien |
| 5 | N0 docstring | « la somme est une addition d’entiers — exacte, quelle que soit la longueur » | démontrée | test_la_somme_est_exacte_quelle_que_soit_la_longueur_de_la_colonne |
| 6 | N0 docstring | les valeurs sont alignées sur le plus grand nombre de décimales | démontrée | test_les_valeurs_sont_alignees_sur_le_plus_grand_nombre_de_decimales |
| 7 | N0 docstring | la moyenne, deux décimales au-delà, arrondie en s’éloignant de zéro | démontrée sur quatre cas | test_la_moyenne_est_rendue_deux_decimales_au_dela_des_donnees |
| 8 | N0 — signe décimal | déclaré, et l’autre refusé plutôt que mal lu | démontrée | test_le_signe_decimal_est_declare_et_lautre_est_refuse |
| 9 | verdict_rationale | « une colonne sans aucun nombre ne rend pas zéro mais rien » | démontrée | test_une_colonne_sans_aucun_nombre_ne_rend_pas_zero |
| 10 | Les deux langages | rapport identique sur seize colonnes | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 11 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Sur la machine de travail, pour une colonne de mille lignes : **1,26 ms en
Python et 0,31 ms en JavaScript**. La classe affichée est `~10 ms`, qui est
celle d'un fichier de dix mille lignes. Les tests ne gardent que des bornes
d'effondrement : cent mille lignes de dix-neuf chiffres en moins de soixante
secondes.

## Le chiffre qui porte le verdict

Trois mesures, toutes reproductibles :

| Colonne | Somme exacte | Somme flottante | Somme compensée (Kahan) |
|---|---|---|---|
| six montants de facture | `244.98` | `244.98000000000002` | `244.98000000000002` |
| deux cents centimes | `2.00` | `2.0000000000000013` | — |
| cent fois 0,07 | `7.00` | `7.000000000000009` | `7.000000000000001` |

La deuxième ligne du tableau est celle de l'essai de la fiche ; la troisième
montre que la compensation **améliore** l'accumulation sans jamais atteindre la
bonne valeur. Les deux langages donnent les mêmes chiffres, à une exception
près : le `sum()` de CPython rend `7.000000000000001` là où une boucle
explicite rend `7.000000000000009`, parce que sa version rapide n'additionne
pas dans le même ordre interne.

Une mesure plus large, faite pendant la recherche et **hors suite de tests** :
sur quatre mille colonnes de trois à quarante montants tirés au hasard entre
0,01 et 99,99, la somme flottante diffère de la somme exacte **277 fois**, soit
environ sept pour cent. Aucune de ces différences ne déplace les centimes après
arrondi à deux décimales : l'écart est dans les derniers bits. C'est pourquoi
la fiche n'annonce pas que « le total est faux de quelques centimes » — ce
serait exagéré — mais qu'il n'est pas égal au total, ce qui suffit à faire
échouer une comparaison et à se voir dès qu'on écrit le nombre.

## Décidé seul

- **Les entiers plutôt que `Decimal`.** Python a un type décimal ; JavaScript
  n'en a pas, et la proposition TC39 n'est pas adoptée. Emprunter `Decimal`
  d'un côté et improviser de l'autre aurait fait deux extraits aux arrondis
  différents. L'addition d'entiers mis à l'échelle est exacte des deux côtés,
  et le résultat est rendu sous forme de chaîne de chiffres — comme la fiche
  sur les montants d'un texte les rend.
- **Le signe décimal est déclaré, avec un défaut.** La différence avec la fiche
  sur les montants est expliquée dans la docstring : là-bas, un défaut fait
  lire « 1,859 » de deux façons à mille près ; ici, une valeur écrite avec
  l'autre signe n'est pas mal lue, elle est refusée et comptée. Un défaut qui
  ne peut pas se tromper en silence est un défaut acceptable.
- **La moyenne est le seul résultat arrondi, et la règle est annoncée** : deux
  décimales au-delà des données, en s'éloignant de zéro. La somme exacte et le
  compte reviennent à côté pour qu'un appelant arrondisse autrement.
- **Une colonne sans aucun nombre rend `null`, pas zéro.** Zéro est une somme ;
  l'absence de données n'en est pas une.
- **Un booléen n'est pas un nombre.** En Python, `True` est un entier valant 1 ;
  nulle part ailleurs. Il est refusé des deux côtés, et le commentaire le dit.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure : une somme a une
valeur exacte, et il n'y a rien à apprendre ni à approcher.

## Infirmé, et ce que le code fait réellement

Un point corrigé par la comparaison entre les langages : `list("texte")` réussit
en Python et lit la colonne lettre par lettre, là où `Array.isArray` refuse.
Les deux extraits exigent désormais une liste, avec le même message.

Une affirmation abandonnée en cours de route : la première intention de la
fiche était d'annoncer que la somme flottante d'une colonne d'argent « perd des
centimes ». La mesure l'a démentie — sur quatre mille colonnes, aucun centime
déplacé après arrondi. La fiche annonce donc ce que la mesure montre, et rien
de plus.

## Défauts de production

Le reste : une entrée qui n'est pas une liste rend un rapport avec sa raison,
une ligne de total au milieu du fichier est écartée et nommée, un séparateur de
milliers n'est pas lu ici — la fiche voisine s'en charge —, une écriture
scientifique comme « 1e3 » est refusée plutôt que devinée, et les zéros de tête
sont acceptés.
