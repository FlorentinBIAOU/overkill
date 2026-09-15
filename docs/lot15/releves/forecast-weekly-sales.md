# forecast-weekly-sales — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/forecast-weekly-sales/n{0,1}.test.{py,js}`.
Chaque test nommé ci-dessous existe dans les deux langages, au nom près
(`test_point_de_rupture_…` en Python, `'point de rupture : …'` en JavaScript),
sauf mention contraire.

`node scripts/test-snippets.mjs forecast-weekly-sales` : vert, avec 2 `INFIRMÉ`
et 6 `DÉFAUT` par langage (le détail est plus bas). 30 tests existaient, tous
renommés en français avec leurs assertions gardées ; les deux assertions de
point de rupture de N0 (`> 1.25 × réalisé`, `> 1.10 ×`) ont été resserrées en
valeurs exactes (`1,274 ± 0,005`, `1,124 ± 0,005`) et dotées d'un témoin. 73 tests
ajoutés (103 au total).

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « un concurrent ouvre, les huit dernières semaines reculent l'une après l'autre, et la prévision reste loin au-dessus de ce que le magasin encaisse » | démontrée : 27,4 % au-dessus (témoin sans recul : 1,4 %) | test_point_de_rupture_une_rupture_de_tendance_laisse_la_prevision_loin_au_dessus |
| 2 | N0 breaking_point | « — elle y restera » | démontrée tant que le recul continue : 16 prévisions glissantes successives toutes > 1,2 × le réalisé. Voir précision plus bas | test_point_de_rupture_la_prevision_reste_au_dessus_tant_que_le_recul_continue |
| 3 | N0 breaking_point | « une seule semaine de promotion entre dans la moyenne comme du commerce ordinaire et gonfle la prévision de la semaine suivante » | démontrée : +12,4 % | test_point_de_rupture_une_semaine_de_promotion_gonfle_la_prevision_suivante |
| 4 | N0 breaking_point | « la moyenne mobile n'a pas de pente et pas de notion d'événement » | démontrée (pente : #5 ; événement : #3) | test_point_de_rupture_la_moyenne_mobile_n_a_pas_de_pente |
| 5 | N0 escalate_when | « toujours sous le réalisé pendant que vous grandissez, toujours au-dessus pendant que vous reculez » | démontrée : 52 prévisions glissantes, toutes du même côté | test_point_de_rupture_la_moyenne_mobile_n_a_pas_de_pente |
| 6 | N0 name | « Coefficients saisonniers lus dans l'historique, puis moyenne mobile » | démontrée | test_la_forme_saisonniere_est_lue_dans_l_historique, test_diviser_la_saison_moyenner_puis_remettre_la_forme_retrouve_une_serie_multiplicative |
| 7 | N0 docstring | « Estimez la forme sur l'historique entier, divisez-la, faites la moyenne de ce qui reste sur les dernières semaines, puis remettez la forme » ; commentaire « la moyenne ci-dessous mesure le niveau seul » | démontrée : prévision exacte (1e-12) d'une série niveau × forme | test_diviser_la_saison_moyenner_puis_remettre_la_forme_retrouve_une_serie_multiplicative |
| 8 | N0 docstring | « Ce que ceci ne modélise délibérément pas, c'est une tendance […] elle suit un changement de régime au lieu de l'anticiper » | démontrée | test_point_de_rupture_la_moyenne_mobile_n_a_pas_de_pente |
| 9 | N0 docstring | « et le test le dit tout haut » | démontrée (les tests #1 à #4 existent) | — |
| 10 | N0 docstring | « it still carries most small businesses » / « elle porte encore la plupart des petits commerces » | non testable : fait de marché, sans source | — |
| 11 | N0 docstring | « short enough to read in one sitting » | non testable : appréciation | — |
| 12 | N0 docstring py / js | « Standard library only » / « No dependency » ; risks `vendor_lock: none` | démontrée : imports Python ⊂ `sys.stdlib_module_names` ({statistics}) ; aucun `import` en JS | test_n0_n_emploie_que_la_bibliotheque_standard / 'n0 n'emploie aucune dépendance' |
| 13 | N0 seasonal_coefficients | « A coefficient of 1.2 for week 50 means that week 50 usually sells twenty per cent above the year's level » | démontrée (1,2 exact quand la semaine 50 vaut 1,2 × la moyenne annuelle) | test_un_coefficient_de_1_2_signifie_vingt_pour_cent_au_dessus_du_niveau_de_l_annee |
| 14 | N0 seasonal_coefficients | « rescaled to average one, so putting the shape back neither inflates nor deflates the forecast » | démontrée, y compris sur 130 semaines (nombre non entier de cycles) | test_la_forme_saisonniere_est_lue_dans_l_historique, test_remettre_la_forme_ne_gonfle_ni_ne_degonfle_la_prevision |
| 15 | N0 forecast | « The history and the forecast share one clock […] The caller never has to align the series on a January » | démontrée : historique commencé en semaine 13, prévision exacte | test_l_historique_et_la_prevision_partagent_une_meme_horloge |
| 16 | N0 forecast | « A short window reacts fast […]; a long one is steadier and slower to notice a change » | démontrée : erreur fenêtre 2 = 63 contre 141 pour fenêtre 12 après une marche ; dispersion 37,8 contre 52,7 sur une série bruitée | test_une_fenetre_courte_reagit_vite_une_fenetre_longue_est_plus_stable |
| 17 | N0 forecast | « `window` is the only real knob » | non testable : appréciation (`season_length` et `horizon` sont aussi des paramètres) | — |
| 18 | N0 message d'erreur | « a seasonal coefficient needs two full cycles at the very least » | démontrée : 103 semaines refusées, 104 acceptées | test_refuse_un_historique_plus_court_que_deux_cycles |
| 19 | N0 risks | `deterministic: true` | démontrée | test_n0_est_deterministe |
| 20 | N0 risks | `data_egress: none` | démontrée : tous les tests tournent sous la garde réseau (conftest.py, no-network.mjs) | toute la suite |
| 21 | N0 risks | `testability: unit` | démontrée : la suite est unitaire, sans service | toute la suite |
| 22 | N0 latency | « <1 ms » | démontrée : meilleur de 5 × 50 appels < 1 ms (mesuré ici : 0,02 ms en Python, 0,05 ms en JS) | test_une_prevision_prend_moins_d_une_milliseconde |
| 23 | N0 cost / footprint | `nul` / `negligible` | non testable : ordre de grandeur déclaratif, cohérent avec #12 et #22 | — |
| 24 | N0 regulatory | les deux lignes (série agrégée, registre des traitements) | non testable : qualification juridique | — |
| 25 | N0 test (existant) | prévoit à 2 % près ; les deux langages concordent à 1e-6 ; un horizon rend une valeur par semaine ; une série plate rend sa valeur | démontrée | test_prevoit_…, test_les_deux_langages_…, test_un_horizon_…, test_une_serie_plate_… |
| 26 | N0 production | entrée vide | démontrée : refus nommé (`ValueError` / `RangeError`) | test_production_une_entree_vide_est_refusee_par_une_erreur_nommee |
| 27 | N0 production | entrée très grande : 15 600 semaines (100 × le nominal) | démontrée : < 2 s, 2,5 % du réalisé (mesuré 1 ms py, 7 ms js) | test_production_trois_cents_ans_de_semaines_terminent_vite_et_juste |
| 28 | N0 production | valeur non numérique, Python (`None`, `"1000"`) | démontrée : `TypeError` | test_production_une_valeur_non_numerique_leve_une_erreur_de_type (Python seul) |
| 29 | N0 production | semaine manquante `NaN` (py) ; `NaN`, `null`, `"1000"` (js) | DÉFAUT : prévision `NaN` sans erreur ; en JS `null` compté zéro (757 au lieu de 1004) | test_defaut_une_semaine_manquante_ne_rend_pas_une_prevision_nan / 'DÉFAUT : une valeur manquante ou non numérique ne lève aucune erreur' |
| 30 | N0 production | valeur limite zéro : une semaine fermée chaque année | DÉFAUT : `ZeroDivisionError` en Python, `NaN` en JS quand la semaine fermée est dans la fenêtre | test_defaut_une_semaine_fermee_chaque_annee_ne_fait_pas_tomber_la_prevision |
| 31 | N0 production | historique entièrement nul | démontrée : prévoit 0 | test_production_un_historique_entierement_nul_prevoit_zero |
| 32 | N0 production | `window=1`, `horizon=0` | démontrée | test_production_une_fenetre_d_une_semaine_ne_garde_que_la_derniere, test_un_horizon_rend_une_valeur_par_semaine |
| 33 | N0 production | `window=0` | DÉFAUT : moyenne de tout l'historique, sans erreur (`[-0:]` et `slice(-0)` rendent la liste entière) | test_defaut_une_fenetre_nulle_est_refusee |
| 34 | N1 breaking_point | « les vingt dernières semaines s'installent à un niveau nettement plus bas : l'ajustement coupe la poire en deux entre l'ancien monde et le nouveau » | démontrée : 1 310 entre 1 025 (nouveau) et 1 464 (ancien) ; témoin sans rupture à 1,2 % | test_point_de_rupture_une_rupture_de_regime_est_moyennee |
| 35 | N1 breaking_point | « et prévoit un niveau que le magasin n'a plus atteint depuis cinq mois » | démontrée : 1 310 > maximum des 20 dernières semaines (1 025) | test_point_de_rupture_une_rupture_de_regime_est_moyennee |
| 36 | N1 breaking_point | « Les moindres carrés pèsent une semaine d'il y a trois ans exactement comme la semaine dernière » | démontrée : la solution annule le gradient de la somme des carrés non pondérée | test_point_de_rupture_les_moindres_carres_pesent_chaque_semaine_pareil |
| 37 | N1 breaking_point | « Rien n'est faux dans le modèle ; c'est l'hypothèse qu'une seule droite décrit tout l'historique qui l'est » | non testable : interprétation | — |
| 38 | Essai, cas qui échoue | « moins de neuf cents pains par semaine depuis l'ouverture d'un concurrent, il y a vingt semaines », « la prévision en annonce plus de mille », « un niveau qu'elle n'a plus atteint depuis », « une croissance de plus de quatre-vingts pains par an », « perdu trente pour cent de ses ventes » | démontrée : max 867 ; prévision 1 071 ; +81,8 par an ; rupture exactement à la semaine 84 sur 104 ; rapport 0,700 | test_point_de_rupture_l_essai_du_concurrent_prevoit_plus_de_mille_et_lit_encore_une_croissance |
| 39 | Essai, cas qui échoue | « Les moindres carrés pèsent une semaine d'il y a deux ans exactement comme la semaine dernière » | démontrée (même propriété que #36) | test_point_de_rupture_les_moindres_carres_pesent_chaque_semaine_pareil |
| 40 | Essai, cas | « Deux ans dans une boulangerie qui monte », « Deux ans sans tendance, mais avec des saisons », « Cinq semaines d'historique » (refusé) | démontrée : 104 semaines, +207,4 par an ; 104 semaines, -0,6 par an ; 5 semaines refusées | test_l_essai_lit_la_croissance_des_boulangeries_et_refuse_cinq_semaines |
| 41 | N1 name / docstring | « Moindres carrés sur variables calendaires : tendance et harmoniques » ; « une constante, le nombre de cycles écoulés, et quelques paires de sinus et de cosinus » ; « This is the whole model » | démontrée | test_la_ligne_de_la_matrice_est_tout_le_modele |
| 42 | N1 docstring | « Here the level, the slope and the seasonal shape are estimated together » ; verdict « Il estime la pente que N0 ignore » | démontrée : N0 toujours sous le réalisé, N1 des deux côtés, erreur moyenne divisée par plus de 2 | test_estime_la_pente_que_n0_ignore, test_prolonge_la_tendance_sur_six_mois |
| 43 | N1 fit / scenario / verdict | « `coefficients[1]` is the growth per cycle, in the unit of the series » ; « la croissance annuelle lue dans vos propres ventes » ; « un test qui relit la pente dans la série » | démontrée : 208 ± 2 | test_relit_la_croissance_annuelle_dans_la_serie |
| 44 | N1 docstring py | « Two pairs are enough to draw a Christmas peak and a summer dip » | démontrée : pic prévu en semaine 49 (vrai : 50), creux en 32 (vrai : 30) | test_deux_paires_dessinent_un_pic_de_noel_et_un_creux_d_ete |
| 45 | N1 docstring py | « more pairs start drawing the noise as well » | INFIRMÉE : sur un pic de Noël de trois semaines bruité à ±6 %, l'erreur hors échantillon vaut 36,5 (2 paires), 27,8 (3), 14,6 (4), 7,8 (6), 9,1 (10) | test_au_dela_de_deux_paires_on_commence_a_dessiner_le_bruit |
| 46 | N1 docstring | « Counting the trend in cycles […] keeps the columns of the design matrix on comparable scales » / « keeps those equations well behaved » | démontrée : rapport des diagonales de XᵀX < 10 en cycles, > 10 000 en semaines ; conditionnement 4,6 contre 190 (Python) | test_compter_en_cycles_garde_la_matrice_a_des_echelles_comparables |
| 47 | N1 docstring | « it makes the coefficient readable on its own: it is the growth per year » | démontrée avec `season_length=52` (#43). Précision : c'est la croissance par cycle ; « par an » seulement pour une saison de 52 | test_relit_la_croissance_annuelle_dans_la_serie |
| 48 | N1 docstring js | « solved through the normal equations and a Gaussian elimination, twenty lines that no dependency is worth » | démontrée pour « no dependency » ; « twenty lines » : `solve` fait 17 lignes, les équations normales 6 : ordre de grandeur juste, non testable en tant que chiffre | 'n1 n'emploie aucune dépendance' |
| 49 | N1 fit | « Returns a model you can inspect » ; N2 unavailable_reason « cent cinquante-six nombres, dont N1 tire déjà six coefficients lisibles un par un » | démontrée | test_six_coefficients_lisibles_un_par_un_sur_cent_cinquante_six_nombres |
| 50 | N1 message d'erreur | « fewer weeks of history than features to estimate » | démontrée : 5 semaines refusées, 6 acceptées | test_refuse_un_historique_plus_court_que_le_nombre_de_variables |
| 51 | N1 test (existant) | « both languages agree to the sixth decimal » (numpy contre Gauss) | démontrée ; aussi sur 15 600 semaines (63 259,968239) | test_les_deux_langages_…, test_production_trois_cents_ans_… |
| 52 | N1 risks | `deterministic: true` ; scenario « se rejoue à l'identique » | démontrée | test_n1_est_deterministe |
| 53 | N1 risks | `vendor_lock: library` | démontrée côté Python (imports = {math, numpy}) ; en JS aucune dépendance | test_n1_n_emploie_que_numpy_hors_bibliotheque_standard / 'n1 n'emploie aucune dépendance' |
| 54 | N1 risks | `data_egress: none`, `testability: unit` | démontrée (garde réseau, suite unitaire) | toute la suite |
| 55 | N1 latency | « <1 ms » | démontrée : meilleur de 5 × 50 ajustements + prévisions < 1 ms (mesuré 0,10 ms py, 0,02 ms js) | test_un_ajustement_et_une_prevision_prennent_moins_d_une_milliseconde |
| 56 | N1 cost / footprint | `négligeable` / `low` | non testable : déclaratif | — |
| 57 | N1 regulatory | les deux lignes | non testable : qualification juridique | — |
| 58 | verdict_rationale | « Restez à N0 si votre niveau ne bouge pas […] sur une série plate les deux niveaux rendent le même nombre » | démontrée : 750 et 749,9999999999997 (écart 3e-13) | test_sur_une_serie_plate_n0_et_n1_rendent_le_meme_nombre |
| 59 | verdict_rationale | « parce qu'un modèle qui a trouvé une tendance que personne dans la maison ne reconnaît est un modèle dont il faut se méfier » ; « La montée coûte peu » | non testable : conseil | — |
| 60 | N1 escalate_when | « réajuster sur la période qui suit la rupture » | démontrée sur l'exemple de la fiche : la prévision revient à 6,2 % du réalisé (contre 27,9 % avant) | test_reajuster_apres_la_rupture_rapproche_la_prevision |
| 61 | N1 escalate_when | « et relire le coefficient de croissance » | INFIRMÉE : réajusté sur les vingt semaines d'après la rupture, le coefficient vaut -7 760 par an, pour une croissance réelle de +146 | test_apres_reajustement_le_coefficient_de_croissance_se_relit |
| 62 | N1 escalate_when | « Il n'y a pas de niveau au-dessus dans cette fiche » | démontrée par le frontmatter (N2 et N3 `available: false`) | — |
| 63 | scenario | « La réponse revient rédigée, plausible, et différente au prochain appel » | non testable : comportement d'un modèle de langue, pas de N3 dans cette fiche | — |
| 64 | scenario | « L'arithmétique […] tient sur une page » | non testable : appréciation (n0 : 55 lignes, n1 : 58 lignes Python avec docstrings) | — |
| 65 | N2 unavailable_reason | « Un modèle profond de séries temporelles s'entraîne sur des milliers de séries, ou sur des décennies d'observations » ; « le service permanent à exploiter serait bien réel » | non testable : fait extérieur, à sourcer | — |
| 66 | N3 unavailable_reason | « La réponse change d'un appel à l'autre, aucun coefficient ne se relit » | non testable : comportement d'un modèle, aucun extrait N3 | — |
| 67 | N1 production | entrée vide | DÉFAUT : `IndexError` (Python) / `TypeError` (JS) sur `design[0]`, au lieu du refus nommé que reçoit un historique de cinq semaines | test_defaut_une_entree_vide_est_refusee_par_une_erreur_nommee |
| 68 | N1 production | entrée très grande : 15 600 semaines | démontrée : < 5 s (mesuré 14 ms py, 5 ms js), 63 259,97 contre 63 280 réels | test_production_trois_cents_ans_de_semaines_terminent_vite_et_juste |
| 69 | N1 production | semaine manquante : `None`/`NaN` (py), `NaN`/`null` (js) | DÉFAUT : Python convertit `None` en `NaN` et rend `NaN` ; JS rend `NaN`, ou compte `null` pour zéro (1 350 au lieu de 1 424) | test_defaut_une_semaine_manquante_ne_rend_pas_une_prevision_nan |
| 70 | N1 production | valeurs aux limites : historique de 10, 20, 26 semaines (entre le minimum accepté, 6, et un cycle) | DÉFAUT : accepté ; croissance lue +899 850, +23 219, +5 090 par an pour une série à +208 ; prévision à 10 semaines fausse de 27 % | test_defaut_un_historique_de_moins_d_un_cycle_ne_rend_pas_une_croissance_absurde |
| 71 | N1 production | `horizon=0` | démontrée : liste vide | test_production_un_horizon_nul_rend_une_liste_vide |

## Non testable, et pourquoi

- **#10** « elle porte encore la plupart des petits commerces » : fait de marché, aucune source dans la fiche. À sourcer ou retirer.
- **#11, #17, #64** : appréciations de lecture (« se lit d'une traite », « le seul vrai réglage », « tient sur une page »). Pour #17, noter que `season_length` et `horizon` sont aussi des paramètres ; le réglage qui change la prévision sur une série donnée est bien `window`.
- **#23, #56** coût et empreinte : vocabulaire déclaratif du frontmatter.
- **#24, #57** régulation : qualification juridique.
- **#37, #59** : interprétations et conseils.
- **#48** « twenty lines » : chiffre rédactionnel ; compté, `solve` fait 17 lignes et les équations normales 6.
- **#63, #66** : comportement d'un modèle de langue, aucun extrait N3 dans la fiche.
- **#65** : fait extérieur sur l'entraînement des modèles profonds de séries temporelles, à sourcer.
- Encodage inattendu (NFD, espaces insécables, emoji, BOM) : sans objet, l'entrée est une liste de nombres. Remplacé par les valeurs non numériques (#28, #29, #69).
- Entrée malveillante : sans objet (ni expression régulière, ni texte, ni modèle).
- Consigne « DÉFAUT N3 `client.complete` » : sans objet, la fiche n'a ni N2 ni N3 disponibles.

## Infirmé, et ce que le code fait réellement

- **#45 — N1, docstring Python et `doc.fr.yaml` (`n1.py`) : « Deux paires suffisent […] ; au-delà, on commence à dessiner le bruit aussi. »**
  Sur une série de 156 semaines avec un pic de Noël gaussien centré semaine 50 (écart-type 3 semaines, +35 %), un creux d'été centré semaine 30 (écart-type 5 semaines, -20 %) et un bruit uniforme ±60 (±6 %), l'erreur moyenne de la prévision sur l'année suivante, mesurée contre la forme vraie, vaut 36,5 avec 2 paires, 27,8 avec 3, 14,6 avec 4, 7,8 avec 6 et 9,1 avec 10. Le bruit ne commence à coûter qu'au-delà de 6 paires. Deux paires placent bien le pic et le creux (#44) mais ne dessinent pas un pic étroit : un pic de trois semaines demande plus d'harmoniques. L'affirmation est vraie pour une forme lisse, fausse pour un pic de Noël réaliste. Elle n'est que dans le docstring Python, pas dans le JS.
- **#61 — N1 escalate_when : « réajuster sur la période qui suit la rupture, et relire le coefficient de croissance. »**
  Sur l'exemple même du point de rupture (rupture il y a vingt semaines), `fit(history[-20:])` rend une prévision correcte (à 6,2 % du réalisé, #60) mais des coefficients sans aucun sens : croissance -7 759,7 par an, constante 2 215,8, premier sinus 875,7, premier cosinus -1 580,1, pour une série qui croît en réalité de +145,6 par an. Vingt semaines ne couvrent pas une saison : la tendance et les harmoniques sont presque colinéaires et se compensent. Le coefficient ne se relit qu'à partir d'environ un cycle d'historique (#70 : +468 à 40 semaines, +225 à 52, +213 à 78). Le conseil tient pour la prévision, pas pour la relecture de la croissance, tant que la période d'après rupture est plus courte qu'une saison.

## Défauts de production

- **#29 — N0, valeur manquante.** Python : un `NaN` dans l'historique rend `[nan]` sans erreur. JavaScript : `NaN` et `"1000"` rendent `[NaN]`, `null` est compté zéro et rend 757,06 au lieu de 1 003,62, sans erreur. (Python lève bien `TypeError` sur `None` et `"1000"`, #28.)
- **#30 — N0, une semaine sans vente chaque année** (commerce fermé la dernière semaine de décembre, cas courant). Le coefficient de cette position vaut 0 et `value / coefficients[...]` divise par zéro : Python lève `ZeroDivisionError: float division by zero` sur tout historique qui contient une telle semaine ; JavaScript calcule `0 / 0 = NaN` et rend `[NaN]` dès que la semaine fermée tombe dans la fenêtre (sinon la prévision est correcte, et celle de la semaine fermée vaut 0).
- **#33 — N0, `window=0`.** `deseasonalised[-0:]` (Python) et `slice(-0)` (JS) rendent la liste entière : la prévision devient la moyenne de trois ans (1 000,0) au lieu d'être refusée.
- **#67 — N1, entrée vide.** `design[0]` n'existe pas : `IndexError: list index out of range` en Python, `TypeError: Cannot read properties of undefined (reading 'length')` en JavaScript. La garde `len(history) < len(design[0])` est placée après l'accès qu'elle devrait protéger.
- **#69 — N1, valeur manquante.** Python : `np.array([..., None], dtype=float)` convertit `None` en `nan`, la prévision vaut `[nan]`. JavaScript : `NaN` rend `[NaN]` ; `null` est multiplié comme zéro et rend 1 350,30 au lieu de 1 424,00. Aucune erreur dans les deux cas.
- **#70 — N1, historique plus court qu'un cycle.** La seule garde est « au moins six semaines ». Entre 6 et une cinquantaine de semaines, l'ajustement est accepté et le coefficient de croissance, le nombre que la fiche dit de montrer au commerçant avant la prévision, est absurde : +899 850 par an à 10 semaines, +23 219 à 20, +5 090 à 26, +468 à 40, pour une série à +208. La prévision à 10 semaines vaut 1 185,6 pour 935,3 réels (+27 %). Les deux langages concordent sur ces valeurs.

## Précisions pour le rédacteur (affirmations démontrées, mais à resserrer)

- **#2 « elle y restera »** n'est vrai que si le recul continue. Si le niveau se stabilise après les huit semaines de recul, la moyenne mobile rattrape : l'écart passe de 21 % à 7-12 % en quatre semaines (il ne tombe pas à zéro parce que le recul a aussi pollué les coefficients saisonniers de ces huit positions).
- **#3 promotion** : la semaine forte n'entre pas seulement dans la moyenne, elle gonfle aussi le coefficient saisonnier de sa propre position (c'est pourquoi une fenêtre d'une semaine après une semaine à 1,5 × prévoit 1 414 et non 1 650, #32).
- **#47** : `coefficients[1]` est la croissance **par cycle**. « Par an » n'est vrai qu'avec `season_length=52`.
- **#58** : « le même nombre » est vrai à 3e-13 près, pas au bit près (750 contre 749,9999999999997). Sur une série sans tendance mais saisonnière, les deux niveaux diffèrent : N0 1 003,6, N1 999,8, pour 990 réels.
- **#16** : la fenêtre longue n'est « plus stable » que modestement sur la série testée (dispersion 37,8 contre 52,7, rapport 1,4).

## Pour la charte

- **Latence publiée.** La charte dit qu'une borne de temps n'est jamais un chiffre publié ; or le frontmatter publie `latency: "<1 ms"`. J'ai testé l'affirmation directement (meilleur de 5 séries de 50 appels < 1 ms), ce qui laisse une marge de 10 à 50 fois sur cette machine. La charte devrait dire si la latence du frontmatter se teste ainsi, ou reste déclarative.
- **Les marquages `INFIRMÉ`/`DÉFAUT` en JavaScript** : le modèle `assert.rejects(async () => { … })` passe aussi si le code lève une erreur sans rapport (un `TypeError` d'implémentation). J'ai ajouté `assert.AssertionError` en second argument pour que seul l'échec de l'assertion compte. À porter dans le modèle de la charte.
- **Les essais en JavaScript seulement** : pour tester leurs affirmations en Python sans recopier les données, le test Python lit les chaînes `input: '…'` du fichier d'essai. La charte pourrait fixer cette pratique.
- **« Encodage inattendu » pour une entrée numérique** : la charte ne dit pas quoi en faire. J'ai pris valeurs manquantes (`None`, `NaN`, `null`) et nombres en chaîne ; à écrire.

## Tour 2 — contre-épreuve

Après `21c53cd` (corrections du rédacteur, tour 1), qui laissait la suite rouge
sur trois tests. Tests : n0.py 26, n0.js 25 (inchangés en nombre), n1.py 26 → 29,
n1.js 26 → 30 ; 7 tests ajoutés, 2 marqués et 3 rouges réécrits sur les
nouvelles phrases, 12 renommés `production : …` ou sur la nouvelle phrase, aucun
retiré. **Plus aucun marquage.** `node scripts/test-snippets.mjs
forecast-weekly-sales` : vert.

### Lignes « À retester »

| # | Ligne du tour 1 | Désormais | Test |
|---|---|---|---|
| 2 | N0 breaking_point : « elle y reste tant que le recul continue » | démontrée (py, js) : seize prévisions glissantes > 1,2 × le réalisé pendant le recul ; témoin ajouté : si le niveau se stabilise après huit semaines de recul, chaque prévision dès la quatrième semaine est < 1,15 × le réalisé | test_point_de_rupture_la_prevision_reste_au_dessus_tant_que_le_recul_continue |
| 17 | N0 docstring : « `window` trades reactivity for stability » | démontrée (py, js) par le test de #16 (fenêtre courte plus réactive, longue plus stable) | test_une_fenetre_courte_reagit_vite_une_fenetre_longue_est_plus_stable |
| 29 | N0 semaine manquante ; commentaire « A missing week must be refused, not averaged into a NaN forecast (or counted as zero) » | démontrée : py `NaN`, `inf` → `ValueError` « finite number » (`None`, `"1000"` → `TypeError`, #28) ; js `NaN`, `null`, `"1000"`, `Infinity`, `undefined` → `TypeError` « finite number » | test_production_une_semaine_manquante_nan_ou_infinie_est_refusee / production : une valeur manquante ou non numérique est refusée |
| 30 | N0 semaine fermée chaque année ; commentaire « A week closed every year has a zero coefficient and says nothing about the level » | démontrée (py, js) : coefficient 51 nul ; la dernière semaine de l'historique est fermée, le niveau est exactement la moyenne désaisonnalisée des semaines 151 à 154 ; prévision finie sur un cycle, et nulle pour la semaine fermée | test_production_une_semaine_fermee_chaque_annee_ne_fait_pas_tomber_la_prevision |
| 33 | N0 `window < 1` | démontrée (py, js) : 0, -1, -4 refusés (« at least one week ») ; témoin : 1 accepté | test_production_une_fenetre_nulle_ou_negative_est_refusee |
| 45 | N1 docstring py : « Two pairs are enough to place a Christmas peak and a summer dip; a peak only a few weeks wide needs more pairs to reach its full height » | démontrée (py, js) : deux paires placent le pic (semaine 49) et le creux (32) ; hauteur 1 239 à deux paires, 1 325 à quatre, 1 362 à six pour un pic à 1 350 ; erreur 36,5 > 14,6 > 7,8 | test_deux_paires_placent_un_pic_de_noel_et_un_creux_d_ete, test_un_pic_de_quelques_semaines_demande_plus_de_paires_pour_atteindre_toute_sa_hauteur |
| 47 | N1 docstring : « it is the growth per cycle, per year with the default 52-week season » | démontrée (py, js) : une unité par semaine donne 13 avec une saison de 13 semaines, 52 avec la saison par défaut | test_le_coefficient_est_la_croissance_par_cycle_donc_par_an_avec_la_saison_de_52_semaines |
| 58 | verdict_rationale : « la même prévision, à l'erreur d'arrondi près » | démontrée (py, js), écart < 1e-9 ; renommé | test_sur_une_serie_plate_n0_et_n1_rendent_la_meme_prevision_a_l_erreur_d_arrondi_pres |
| 60 | N1 escalate_when : « réajuster sur la période qui suit la rupture dès qu'elle couvre un cycle complet » | démontrée (py, js) sur une série de quatre ans, rupture au début de la quatrième année : la prévision réajustée sur 52 semaines est à 2,6 % du réalisé (1 180,8 pour 1 212,4), l'ajustement sur tout l'historique à 6,8 %. Série et bornes changées : l'ancien test réajustait sur vingt semaines, désormais refusées ; la borne « quatre fois plus près » devient « deux fois » | test_reajuster_sur_un_cycle_complet_apres_la_rupture_rapproche_la_prevision |
| 61 | N1 escalate_when : « puis relire le coefficient de croissance » | démontrée (py, js) : 138,8 lu pour +145,6 (à 5 %) | test_apres_reajustement_sur_un_cycle_complet_le_coefficient_de_croissance_se_relit |
| 61 | N1 escalate_when : « Plus tôt, l'extrait refuse l'ajustement : sur vingt semaines, la tendance et la saison se confondent, et le coefficient de croissance ne se relit plus » | démontrée (py, js) : `fit` refuse les vingt semaines ; les mêmes moindres carrés résolus hors de l'extrait (numpy en Python, équations normales et Gauss écrites dans le test JavaScript) lisent -7 759,7 par an | test_sur_vingt_semaines_l_extrait_refuse_et_la_tendance_se_confond_avec_la_saison |
| 67 | N1 entrée vide | démontrée (py, js) : refus nommé « fewer weeks » | test_production_une_entree_vide_est_refusee_par_une_erreur_nommee |
| 69 | N1 semaine manquante | démontrée : py `None`, `NaN`, `inf` → `ValueError` « finite number » ; js `NaN`, `null`, `Infinity`, `"1000"` → `TypeError` | test_production_une_semaine_manquante_est_refusee |
| 70 | N1 moins d'un cycle ; docstring « Less than one full cycle of history cannot tell the trend from the season, so it is refused » | démontrée (py, js) : 6, 10, 20, 26, 51 semaines refusées (« less than one full cycle »), 52 acceptées ; le cycle est celui qu'on passe (13 acceptées, 12 refusées pour une saison de 13). Le test d'origine « six semaines acceptées » décrivait le défaut réparé : réécrit. L'ancien test de production (`try/continue`) passait aussi sur un refus ; il exige désormais le refus nommé | test_refuse_moins_d_un_cycle_complet_et_accepte_exactement_un_cycle, test_production_un_historique_de_moins_d_un_cycle_ne_rend_pas_une_croissance_absurde |
| — | garde « fewer weeks than features » encore atteignable | démontrée (py, js) : 52 semaines et 30 paires (62 variables) → « fewer weeks » ; témoin : 25 paires (52 variables) accepté | test_refuse_un_historique_plus_court_que_le_nombre_de_variables |
| — | essai, libellé de refus « Refusé : historique trop court » / « Refused: history too short » | démontrée (js) : cinq semaines → message « fewer weeks » de l'extrait, 51 semaines → « less than one full cycle » ; témoin : 52 semaines affichent le tableau | essai : un historique refusé s'affiche « historique trop court », avec le message de l'extrait |

### Phrases nouvelles ou modifiées, non testables

| # | Où | Affirmation (citée) | Statut |
|---|---|---|---|
| T2-1 | scenario | « Par défaut, la même question posée deux fois peut recevoir deux réponses : la documentation d'un fournisseur le dit en toutes lettres » | non testable : pas de N3, fait sourcé (OpenAI Cookbook) |
| T2-2 | scenario | « tient dans les deux extraits ci-dessous, se rejoue à l'identique, et livre au passage un coefficient qui se relit » | « se rejoue à l'identique » et « un coefficient qui se relit » démontrés (test_n0_est_deterministe, test_n1_est_deterministe, test_relit_la_croissance_annuelle_dans_la_serie) ; « tient dans » : appréciation |
| T2-3 | N2 unavailable_reason | DeepAR « tire sa force de l'apprentissage sur un grand nombre de séries apparentées » ; « Le modèle serait à entraîner, à conserver et à réentraîner » | non testable : pas de code N2 ; « cent cinquante-six nombres, six coefficients » reste démontré (test_six_coefficients_lisibles_un_par_un_sur_cent_cinquante_six_nombres) |
| T2-4 | N3 unavailable_reason | « Par défaut, un fournisseur ne garantit pas la même réponse d'un appel à l'autre » | non testable : pas de code N3, fait sourcé |
| T2-5 | N1 docstring js | « short enough that no dependency is worth it » | « no dependency » démontré (aucun import) ; plus aucun nombre de lignes affirmé, aucun test n'en épingle |
| T2-6 | N0 docstrings | « it still carries most small businesses », « short enough to read in one sitting » retirés | plus d'affirmation (#10, #11 clos) |
