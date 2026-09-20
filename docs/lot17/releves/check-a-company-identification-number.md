# check-a-company-identification-number — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « 000000000 passe » | démontrée | test_point_de_rupture_un_numero_bien_forme_peut_ne_designer_personne |
| 2 | N0 breaking_point | « 382 209 401 saisi « 382 290 401 » passe aussi […] l’inversion « 09 » → « 90 » » | démontrée | test_point_de_rupture_linversion_09_90_passe_la_cle |
| 3 | N0 breaking_point | « aucune faute d’un seul chiffre ne passe » (témoin) | démontrée | test_point_de_rupture_temoin_une_faute_dun_seul_chiffre_est_toujours_refusee |
| 4 | N0 docstring | « 35600000009075, the Rennes establishment, fails Luhn and is valid » | démontrée | test_le_siret_de_rennes_echoue_a_luhn_et_reste_valide |
| 5 | N0 docstring | « the report says which one was applied » | démontrée | test_le_rapport_dit_quelle_cle_a_ete_appliquee |
| 6 | N0 docstring | « Left out, the length decides » | démontrée | test_la_longueur_decide_quand_lappelant_ne_declare_rien |
| 7 | N0 docstring | « Nothing here raises on bad input » | démontrée | test_aucune_entree_ne_leve |
| 8 | N0 commentaire | « Anything else surviving the clean-up is refused rather than quietly dropped » | démontrée | test_les_separateurs_sont_ceux_quon_colle_et_rien_dautre |
| 9 | verdict_rationale | « une clé de Luhn écrite à la main répond faux là où la bibliothèque répond vrai » | démontrée | test_le_siret_de_rennes_echoue_a_luhn_et_reste_valide (Luhn réimplémenté dans le test) |
| 10 | Les deux langages | la fiche montre deux extraits, elle affirme la même chose des deux | démontrée | test_python_et_javascript_rendent_le_meme_rapport (57 entrées) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Cent mille contrôles de « 732 829 320 00074 » sur la machine de travail :
**0,0107 ms par contrôle en Python, 0,0015 ms en JavaScript**. La classe
affichée est `<1 ms`, avec deux ordres de grandeur de marge. Le test ne garde
qu’une borne d’effondrement — dix mille contrôles en moins de dix secondes,
soit une marge de mille sur la mesure (T7).

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure : il n’y a rien
à apprendre d’une fonction publiée, et la question qui reste au-dessus de la
clé — l’existence de l’entreprise — se pose à un répertoire, pas à un modèle.
Aucun code n’existe pour ces niveaux, donc aucun test.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait ne lève sur aucune entrée, y compris `None`, un entier, des
octets et un mégaoctet de texte.
