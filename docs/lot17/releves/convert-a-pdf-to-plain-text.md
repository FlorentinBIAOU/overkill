# convert-a-pdf-to-plain-text — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « quatre généra- » et « tions de clients » […] restent deux morceaux » | démontrée | test_point_de_rupture_une_cesure_reste_une_cesure |
| 2 | N0 breaking_point | « « Boulogne- » et « Billancourt » sont coupés de la même façon sur la même page » | démontrée | test_point_de_rupture_une_cesure_reste_une_cesure (le témoin est dans le même document) |
| 3 | N0 breaking_point | « le témoin : tout le reste de la page ressort au caractère près » | démontrée | test_point_de_rupture_temoin_le_reste_du_texte_est_rendu_tel_quel |
| 4 | N0 docstring, verdict_rationale | « la lecture naïve donne « La boulangerie Martin fête Clémentine Martin a repris » » | démontrée | test_une_page_a_deux_colonnes_est_lue_colonne_par_colonne (la lecture brute de pypdf est appelée à côté de l’extrait) |
| 5 | N0 docstring | « `columns` […] tells a caller that the page was not a simple column of prose » | démontrée | test_le_nombre_de_colonnes_est_rendu |
| 6 | N0 docstring | « a run of points no word overlaps, wider than a gutter, separates two columns » | démontrée | test_les_bandes_sont_trouvees_par_les_gouttieres (de part et d’autre du seuil) |
| 7 | N0 escalate_when | « zéro colonne et un texte vide » sur un scan | démontrée | test_le_nombre_de_colonnes_est_rendu |
| 8 | Les deux langages | même texte, même nombre de colonnes, même raison | démontrée | test_python_et_javascript_rendent_le_meme_texte (cinq documents) |
| 9 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Deux cents lectures de la page à deux colonnes, après une passe de chauffe :
**4,61 ms en Python, 0,89 ms en JavaScript**. La classe affichée est `~10 ms`.
Le test ne garde qu’une borne d’effondrement : cent lectures en moins de
soixante secondes.

## Ce que la fiche ajoute à la bibliothèque

La lecture brute de `pypdf` sur la page à deux colonnes entrelace les deux :
« La boulangerie Martin fête Clémentine Martin a repris ». Le test l’appelle à
côté de l’extrait pour l’épingler. La recherche de gouttières — une bande de
vingt-cinq points où aucun mot ne se trouve — remet les colonnes dans l’ordre,
et le même code tourne dans les deux langages.

## Ce que la fiche refuse de faire

Recoller les césures. Le document d’exemple porte les deux cas sur la même
page : « généra- / tions », qu’il faudrait recoller, et « Boulogne- /
Billancourt », qu’il ne faudrait surtout pas. Aucune règle locale ne les
distingue, et l’extrait rend donc le texte imprimé plutôt qu’un texte deviné.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Un fichier qui n’est pas un PDF, une page d’image et dix mille mots posés
sur une page rendent chacun une réponse nommée.
