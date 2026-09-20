# extract-fields-from-a-log-line — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « rend timestamp « Oct », host « 10 » et tag « 13:55:36 serveur1 sshd[1234] », et la ligne n’est pas rejetée » | démontrée | test_point_de_rupture_un_motif_trop_lache_decoupe_faux_sans_rien_signaler |
| 2 | N0 breaking_point | « le témoin : le motif de la fiche […] rend les quatre champs justes » | démontrée | test_point_de_rupture_temoin_le_motif_de_la_fiche_rend_les_quatre_champs_justes |
| 3 | N0 docstring, verdict_rationale | « A line that does not match is never dropped » | démontrée | test_une_ligne_qui_ne_correspond_pas_est_rendue_jamais_perdue (le numéro est celui du fichier) |
| 4 | N0 docstring, verdict_rationale | « the RFC 3164 syslog format carries neither year nor time zone » | démontrée | test_lhorodatage_est_rendu_tel_quil_est_ecrit |
| 5 | N0 docstring, verdict_rationale | « Python spells a named group `(?P<name>…)` and JavaScript `(?<name>…)` » | démontrée | test_la_notation_nommee_est_compilee_dans_la_syntaxe_du_langage |
| 6 | N0 — trois formats livrés | chacun lit sa ligne | démontrée | test_les_trois_formats_livres_lisent_leurs_lignes |
| 7 | N0 escalate_when | « la liste des lignes rejetées grossit » | démontrée | test_production_une_trace_dexception_donne_une_ligne_et_des_rejets |
| 8 | Les deux langages | découpage, rejets et raison identiques | démontrée | test_python_et_javascript_rendent_le_meme_decoupage (11 cas) |
| 9 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure et de volume | — |

## La mesure de latence

Cent mille lignes d’un journal d’accès découpées en une passe, sur la machine
de travail : **0,00162 ms par ligne en Python, 0,00217 ms en JavaScript**,
soit environ 0,16 s et 0,22 s pour les cent mille. La classe affichée est
`<1 ms`. Le test ne garde qu’une borne d’effondrement : cent mille lignes en
moins de soixante secondes, et une ligne hostile de cent mille caractères en
moins de dix.

## Le chiffre qui porte le verdict

C’est le volume, et il est mesuré ici : quelques microsecondes par ligne d’un
côté, un aller-retour réseau de l’autre. Sur un journal d’accès qui produit des
millions de lignes par jour, la comparaison n’a pas besoin d’être raffinée.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure et de volume.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Une ligne vide, une ligne qui n’est pas du texte, une ligne tronquée et
une ligne de cent mille caractères rendent chacune un rejet nommé.
