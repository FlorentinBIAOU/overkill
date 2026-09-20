# extract-product-data-from-a-shop-page — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le JSON-LD annonce 24,90 quand le corps de la page affiche 19,90 » | démontrée | test_point_de_rupture_le_bloc_publie_peut_ne_plus_correspondre_a_la_page |
| 2 | N0 breaking_point | « le témoin : sur la même page en accord avec elle-même » | démontrée | test_point_de_rupture_temoin_sur_une_page_en_accord_le_prix_est_celui_affiche |
| 3 | N0 docstring | « Le nom, la référence, la marque, le prix, la devise et la disponibilité » | démontrée | test_les_six_champs_sont_lus_et_normalises |
| 4 | N0 commentaire | « a URL, a bare name, or an http URL from before the site moved to https » | démontrée | test_la_disponibilite_est_la_meme_ecrite_de_trois_facons |
| 5 | N0 docstring | « every one found is returned and the caller chooses » | démontrée | test_tous_les_produits_de_la_page_sont_rendus_et_la_page_ne_dit_pas_lequel |
| 6 | N0 docstring, verdict_rationale | « rather than read it as one thousand or as one, the price comes back as None » | démontrée | test_un_prix_qui_nest_pas_un_nombre_revient_nul_avec_son_texte |
| 7 | N0 docstring | « knows whether the page is silent or whether its JSON-LD is broken » | démontrée | test_une_page_muette_et_une_page_cassee_ne_se_confondent_pas |
| 8 | N0 commentaire, verdict_rationale | « twenty thousand times with no closing tag makes the engine retry from every opening » | démontrée | test_production_entree_tres_grande_et_terminaison_rapide |
| 9 | N3 breaking_point | « la devise écrite « € » […] est comptée comme inventée » | démontrée | test_point_de_rupture_la_garde_verifie_dou_vient_une_valeur_pas_ce_quelle_veut_dire |
| 10 | N3 breaking_point | « le témoin : un prix que la page ne contient pas […] est bien écarté » | démontrée | test_point_de_rupture_temoin_un_prix_absent_de_la_page_est_bien_ecarte |
| 11 | N3 docstring | « the tags come off and what is left is capped » | démontrée | test_la_page_est_debarrassee_de_son_balisage_avant_de_partir, test_la_page_est_coupee_au_budget_pas_refusee |
| 12 | N3 docstring | « `content` of None is not a value » | démontrée | test_un_refus_du_modele_nest_pas_passe_au_decodeur |
| 13 | N3 — adaptateur (T2) | le client par défaut parle au vrai kit | démontrée | test_ladaptateur_par_defaut_parle_au_vrai_kit / « l’adaptateur par défaut parle au vrai kit » |
| 14 | N3 — clôture de code | une seule clôture se décode, deux ou du texte autour lèvent | démontrée | test_une_reponse_dans_une_cloture_de_code_est_decodee |
| 15 | N3 — réessais | « a failure is retried the number of times announced » | démontrée | test_une_panne_est_retentee_le_nombre_de_fois_annonce |
| 16 | Les deux langages | rapport N0 identique | démontrée | test_python_et_javascript_rendent_le_meme_rapport (17 pages) |
| 17 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 18 | N3 latency `~1 s` | classe de latence | non mesurable ici : c’est l’appel au fournisseur | test_production_la_lecture_tient_la_classe_de_latence_annoncee (part locale) |
| 19 | N1 / N2 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La mesure de latence

Vingt mille lectures de la même page sur la machine de travail : **0,0084 ms en
Python, 0,0043 ms en JavaScript**. La classe affichée pour N0 est `<1 ms`.

La classe de N3, `~1 s`, est celle d’un appel à un fournisseur, que le double
ne mesure pas. Le test ne borne que la part locale — découpe du balisage et
vérification des valeurs.

## Un défaut de production trouvé et corrigé pendant l’écriture

La première version repérait les blocs avec une expression régulière
(`<script …>(.*?)</script`). Le test d’entrée hostile l’a mise en échec :
vingt mille balises `<script type='application/ld+json'>` sans fermeture font
dépasser dix secondes, parce que le moteur reprend depuis chaque ouverture.
Le balayage est désormais écrit à la main, en une passe sur la chaîne : la même
entrée prend 3,6 ms en JavaScript. L’extrait le dit dans un commentaire, parce
qu’une expression régulière appliquée à une page qu’on n’a pas écrite est un
déni de service qui attend.

## Ce que le double simule, et ce que le test établit

Pour N3 : le double rend une réponse figée. Ce qui est établi — la page est
dépouillée de son balisage, coupée au budget, la requête porte les champs
demandés et une température nulle, une clôture de code unique se décode, deux
clôtures ou du texte autour lèvent, un contenu nul est traité comme un refus,
une panne est retentée le nombre de fois annoncé, et toute valeur absente du
texte envoyé est écartée. Ce qui n’est pas établi : que le modèle lise bien.

Une asymétrie du harnais mérite d’être notée : `fake_llm.py` rend `None` tel
quel, `fake-llm.mjs` le sérialise en `"null"`. Le cas du refus est donc posé
côté JavaScript avec un client dont `complete` rend `null`, comme le fait
l’adaptateur sur un `content` nul.

## Non testable, et pourquoi

N1 et N2 sont fermés par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien à la fin. Le défaut trouvé en cours d’écriture est décrit plus haut.
