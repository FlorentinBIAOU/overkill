# extract-tables-from-a-pdf — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le tableau tracé rend trois lignes […] quand la lecture sans filets en rend quatre » | démontrée | test_point_de_rupture_la_lecture_devinee_coupe_une_cellule_repliee (les deux lectures sur le même document) |
| 2 | N0 breaking_point | « le témoin : `strategy` dit laquelle des deux lectures a répondu » | démontrée | test_point_de_rupture_temoin_le_rapport_dit_laquelle_des_deux_lectures_a_repondu |
| 3 | N0 docstring, verdict_rationale | « celui de `pdfplumber` coupe une cellule […] et rend « Prix H » pour « Prix HT » » | démontrée | test_un_mot_nest_jamais_coupe (la stratégie texte de pdfplumber est appelée à côté de l’extrait) |
| 4 | N0 commentaire | « « Moulin à café » is one cell » | démontrée | test_les_mots_dune_meme_cellule_sont_rassembles |
| 5 | N0 — production | une page de prose ne rend pas un tableau inventé | démontrée | test_une_page_sans_tableau_ne_rend_pas_un_tableau_invente |
| 6 | N0 docstring | « `pages` is the list of page numbers to look at » | démontrée | test_chaque_page_est_lue_et_lappelant_peut_en_choisir |
| 7 | N0 — seuils | les trois tolérances et leur effet de part et d’autre | démontrée | test_production_valeurs_aux_limites |
| 8 | Les deux langages | identiques sans filets ; différents avec, et la fiche dit pourquoi | démontrée | test_sans_filets_les_deux_langages_rendent_la_meme_grille_avec_filets_non |
| 9 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, vérifié à la source pour camelot | — |

## La mesure de latence

Deux cents lectures du tableau tracé, après une passe de chauffe : **4,72 ms en
Python, 0,87 ms en JavaScript**. La classe affichée est `~10 ms`. Le test ne
garde qu’une borne d’effondrement : cent lectures en moins de soixante
secondes.

## Le langage sans outil de référence, et ce qui a été fait

Aucun paquet npm ne lit les filets d’un PDF pour en tirer une grille — le
registre a été consulté, et les résultats voisins rendent le texte avec ses
coordonnées, ce qui est le point de départ, pas la réponse. L’extrait
JavaScript ne fait donc que la lecture devinée, et `strategy` vaut toujours
« text » de ce côté.

La conséquence est mesurée : sur le tableau tracé à cellule repliée, l’extrait
Python rend trois lignes, le JavaScript quatre. Le test l’affirme des deux
côtés plutôt que de le taire, et la docstring de chaque fichier le dit. Sur un
tableau sans filets — le cas ordinaire d’une facture reçue par courriel — les
deux rendent exactement la même grille, parce que le regroupement est le même
code dans les deux langages.

## Ce que le repli écrit ici fait de mieux que celui de la bibliothèque

`pdfplumber` propose lui aussi une stratégie « texte ». Elle découpe la page en
bandes et coupe ce qui dépasse : sur le tableau sans filets de cette fiche,
elle rend « Prix H » pour « Prix HT », et intercale des lignes vides. Le
regroupement écrit ici n’affecte jamais qu’un mot entier à une colonne. Le test
appelle les deux et épingle l’écart.

## Les documents d’exemple

Six PDF fabriqués sans bibliothèque d’écriture, avec filets tracés au trait
pour les uns et rien pour les autres, en encodage WinAnsi pour que le français
accentué se relise à l’identique des deux côtés.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure. Le fait que le
mode « lattice » de camelot emploie OpenCV est vérifié à la source, pas exécuté.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Un fichier qui n’est pas un PDF, une page d’image et dix mille mots posés
sur une page rendent chacun une réponse nommée.
