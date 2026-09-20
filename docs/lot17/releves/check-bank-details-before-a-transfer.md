# check-bank-details-before-a-transfer — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « FR76 … 189 et FR76 … 028 passent toutes les deux, même banque, même guichet » | démontrée | test_point_de_rupture_deux_comptes_du_meme_etablissement_passent_tous_les_deux |
| 2 | N0 breaking_point | « aucune des vingt mille fautes d’un seul chiffre ne passe » (témoin) | démontrée | test_point_de_rupture_temoin_aucune_faute_dun_chiffre_ne_passe |
| 3 | N0 docstring | « two thousand adjacent transpositions … gets through » | démontrée | test_aucune_transposition_de_deux_caracteres_voisins_ne_passe |
| 4 | N0 docstring, verdict_rationale | « The ISO key alone lets 0.6 % of the last kind pass […] the RIB key is what closes that » | démontrée | test_la_cle_rib_ferme_ce_que_la_cle_iso_laisse_passer (T4 : les deux contrôles sur 6 887 mêmes entrées) |
| 5 | N0 commentaire | « A and J are 1, B, K and S are 2, and so on to I, R and Z at 9 » | démontrée | test_la_cle_rib_est_celle_de_la_norme_bancaire_francaise |
| 6 | N0 docstring | « or null when this snippet has none for that country » | démontrée | test_la_cle_nationale_nest_pas_calculee_hors_de_france |
| 7 | N0 docstring | « `country` comes back whether the number is valid or not » | démontrée | test_le_pays_est_rendu_meme_quand_le_numero_est_refuse |
| 8 | N0 docstring | « the country changing between the quote and the payment details » | démontrée | test_le_pays_attendu_refuse_le_detournement_vers_un_autre_pays |
| 9 | N0 docstring | « Nothing raises » | démontrée | test_aucune_entree_ne_leve |
| 10 | Les deux langages | la fiche montre deux extraits, elle affirme la même chose des deux | démontrée | test_python_et_javascript_rendent_le_meme_rapport (232 entrées, dont 200 IBAN fabriqués) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N0 escalate_when, N3 | « la vérification du bénéficiaire … depuis le 9 octobre 2025 » | non testable : fait réglementaire, vérifié au règlement (UE) 2024/886, article 5 quater | — |
| 13 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Cinquante mille contrôles de « FR76 3000 6000 0112 3456 7890 189 » sur la
machine de travail : **0,0232 ms par contrôle en Python, 0,0075 ms en
JavaScript**. La classe affichée est `<1 ms`, avec plus d’un ordre de grandeur
de marge. Le test ne garde qu’une borne d’effondrement — dix mille contrôles en
moins de dix secondes, soit une marge de quatre cents sur la mesure (T7).

## Décision d’écriture : la clé nationale est dans l’extrait, pas dans la bibliothèque

Les deux bibliothèques ne couvrent pas les mêmes clés nationales :
`ibantools` vérifie la clé RIB française et pas la clé belge, `python-stdnum`
fait l’inverse. Deux extraits montrés côte à côte qui ne répondent pas la même
chose sur le même IBAN n’était pas acceptable. L’extrait demande donc à la
bibliothèque ISO 13616 et le format du registre — identiques des deux côtés —
et calcule lui-même la clé RIB, en huit lignes, dans les deux langages. Le test
de parité passe 232 entrées aux deux.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure. La date du
9 octobre 2025 est un fait réglementaire, vérifié à la source.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait ne lève sur aucune entrée.
