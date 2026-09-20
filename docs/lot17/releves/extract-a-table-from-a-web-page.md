# extract-a-table-from-a-web-page — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « Total » écrit sur trois colonnes revient trois fois » | démontrée | test_point_de_rupture_une_cellule_fusionnee_est_repetee_et_le_dit |
| 2 | N0 breaking_point | « le témoin : une ligne sans fusion ne lève aucun drapeau » | démontrée | test_point_de_rupture_temoin_sans_le_drapeau_la_grille_serait_indistinguable |
| 3 | N0 docstring | la grille rendue est celle que le lecteur voit, fusions comprises | démontrée ligne à ligne | test_la_grille_rendue_est_celle_que_le_lecteur_voit |
| 4 | N0 docstring | une fusion en hauteur descend dans la ligne suivante | démontrée | test_une_fusion_en_hauteur_descend_dans_la_ligne_suivante |
| 5 | N0 docstring | « un tableau dans une cellule est un tableau à part » ; son texte ne coule pas | démontrée | test_un_tableau_dans_une_cellule_est_un_tableau_a_part |
| 6 | verdict_rationale | « une portée est plafonnée à mille, qui est le maximum que la norme autorise » | démontrée | test_une_portee_absurde_est_plafonnee_pas_crue |
| 7 | N0 — légende et sections | la légende revient, `thead`/`tbody` ne coupent pas les lignes | démontrées | test_la_legende_est_rendue_avec_la_grille, test_les_sections_de_tableau_ne_coupent_pas_les_lignes |
| 8 | Les deux langages | rapport identique sur treize pages | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 9 | N0 latency `~10 ms` | classe de latence | mesurée | bornes : mille lectures en moins de vingt secondes, vingt mille lignes en moins de soixante |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## Le chiffre qui porte le verdict

Aucun chiffre de coût : les deux analyseurs employés étaient déjà là.
`html.parser` est dans la bibliothèque standard de Python, et `linkedom` était
déjà une dépendance du site, pour la fiche sur le contenu principal d'une page.
Le verdict tient au fait que la norme HTML décrit l'algorithme lui-même.

## Décidé seul

- **Une fusion est déployée en répétant la valeur, pas en laissant un trou.**
  Les deux choix perdent quelque chose. La répétition fait apparaître trois
  fois une valeur écrite une fois ; le trou décale toutes les colonnes après
  la fusion. Le premier est signalé par un drapeau, le second ne l'est par
  rien : c'est ce qui a tranché.
- **Les tableaux sont rendus dans l'ordre où la page les ouvre.** La première
  version les rendait dans l'ordre où ils se ferment, ce qui plaçait un
  tableau imbriqué avant celui qui le porte — surprenant pour un lecteur, et
  déroutant dans l'essai.
- **Le texte d'un tableau imbriqué ne coule pas dans la cellule qui le
  porte.** C'est ce que rendrait `textContent` en JavaScript, et c'est le
  piège classique de l'aspiration de tableaux : la cellule extérieure hérite
  de tout le contenu du tableau intérieur. Les deux extraits l'excluent, et
  signalent le porteur.
- **Le plafond de portée n'est pas un chiffre choisi ici.** La norme HTML
  écrit « greater than zero and less than or equal to 1000 » ; l'extrait
  applique cette borne, et la source la cite.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure : la norme nomme
les éléments et décrit l'algorithme. Ce que la fiche ne promet pas est dit dans
l'`escalate_when` : une « table » faite de `div` mis en colonnes par la feuille
de style n'est pas un tableau, et rien ici ne la lira.

## Infirmé, et ce que le code fait réellement

Deux points corrigés par la comparaison entre les langages, et non par le
raisonnement :

- une cellule écrite sans ligne — `<table><td>x</td></table>` — est placée
  dans une ligne implicite par un navigateur et par l'analyseur Python, mais
  pas par `linkedom` ; l'extrait JavaScript a été aligné sur le navigateur ;
- l'ordre des tableaux, décrit ci-dessus.

## Défauts de production

Le reste : une entrée qui n'est pas du texte rend un rapport avec sa raison, un
tableau jamais fermé est rendu quand même, une ligne plus courte que les autres
est complétée par des cellules vides, une portée absurde est plafonnée, et un
tableau vide au milieu d'une page n'empêche pas de lire les suivants.
