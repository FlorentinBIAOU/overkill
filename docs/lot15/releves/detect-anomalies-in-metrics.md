# detect-anomalies-in-metrics — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/detect-anomalies-in-metrics/n{0,1}.test.{py,js}`
(N2 et N3 non disponibles). Avant : 22 tests. Après : 104 (n0.py 26, n0.js 34,
n1.py 22, n1.js 22). Les tests d'origine sont renommés en français, assertions
gardées. L'essai interactif (niveau N0, fenêtre de 12) est testé dans
`n0.test.js`, neuf tests.

`node scripts/test-snippets.mjs detect-anomalies-in-metrics` : vert, avec les
marquages ci-dessous. Le test `DÉFAUT` de lenteur de N1 Python dure une dizaine
de secondes à lui seul.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Le test fait grimper la métrique de quarante points par minute pendant plus d'une heure […] Pas un seul point n'est signalé » | démontrée (py, js) : 72 minutes, aucun verdict positif ; témoin : la marche est signalée | test_point_de_rupture_une_derive_lente_n_est_jamais_signalee |
| 2 | N0 breaking_point | « la série finit à plus du triple de son niveau de repos » | démontrée (py, js) : 3 960 pour un repos de 1 200 (×3,3) | test_point_de_rupture_la_serie_finit_a_plus_du_triple_… |
| 3 | N0 breaking_point | « chaque pas reste loin en deçà de l'écart toléré, et la fenêtre a déjà avalé les précédents » | démontrée (py, js) : le pas de 40 vaut 13 % de l'écart toléré le plus étroit (311,346) ; l'habituel finit au-dessus de 3 000. Précision à porter : l'écart mesuré, lui, monte jusqu'à 96 % de la tolérance ; la dérive passe à 4 % de l'alerte, pas « loin en deçà » | test_point_de_rupture_chaque_pas_reste_en_deca_… |
| 4 | N0 breaking_point | « La même hausse totale livrée d'un coup est signalée dès sa première minute, et pour une douzaine de minutes seulement » | démontrée (py, js) : minutes 48 à 59, douze exactement | test_point_de_rupture_la_marche_est_signalee_… |
| 5 | N0 name, docstring | « Seuil robuste sur médiane et écart absolu médian, en fenêtre glissante » ; « standard library only » / « no dependency » | démontrée (py : `dataclasses`, `statistics` ; js : aucun import) | test_signale_une_pointe_…, test_l_extrait_n_importe_que_… |
| 6 | N0 docstring ; verdict_rationale | « "measured 4800, usual 1200, allowed up to 1511" […] the same three numbers the threshold itself used » ; « le test la vérifie nombre par nombre » | démontrée (py, js) : 4 800, 1 200, 3 600, 311,346, 1 200 + 311 = 1 511, décision = écart > limite | test_le_verdict_porte_le_raisonnement_… |
| 7 | N0 docstring ; scenario | « One incident drags both, so a large enough spike widens the very band that was supposed to catch it » | démontrée (py, js) avec une moyenne et un écart type écrits dans le test : une pointe à 20 000 cache la suivante à 4 800 ; sur une fenêtre de 12 qui contient le point, aucune pointe, si grosse soit-elle, ne dépasse 3,5 écarts types (au plus 11/√12 ≈ 3,18). Constat : sur l'exemple des tests (4 800 puis 4 700), la moyenne et l'écart type signalent aussi les deux ; le commentaire du test d'origine (« A mean and a standard deviation would have done both ») était faux pour ces nombres | test_moyenne_et_ecart_type_une_pointe_assez_grosse_… |
| 8 | N0 docstring | « The median and the median absolute deviation ignore up to half the window » | démontrée pour le point de rupture : jusqu'à 11 aberrations sur 24 l'habituel tient (1 320), à 12 il part (50 660). Précision : « ignorent » est trop fort, à 11 aberrations l'écart toléré quadruple (1 245 au lieu de 311) ; et « jusqu'à la moitié » s'arrête strictement avant la moitié sur une fenêtre paire | test_la_mediane_resiste_jusqu_a_moins_de_la_moitie_… |
| 9 | N0 commentaire NORMAL_SCALE | « Scaling that puts the median absolute deviation on the same footing as a standard deviation for normally distributed data » | démontrée (py, js) : 1,4826 = 1/Φ⁻¹(3/4) arrondi | test_le_facteur_1_4826_… |
| 10 | N0 commentaire NORMAL_SCALE | « so that a threshold of 3.5 keeps the meaning it has everywhere else » | INFIRMÉE (py, js) : sur 20 000 points de bruit gaussien pur, 3,5 écarts types devraient en signaler 0,047 % ; avec la fenêtre de 24 par défaut, 0,75 % sont signalés (seize fois plus), plus de 2 % avec la fenêtre de 12 de l'essai. L'écart absolu médian estimé sur 24 points est trop bruité pour que 3,5 garde son sens. À la minute, cela fait une dizaine d'alertes par jour sur une métrique saine, contre le besoin « et pas le reste du temps » | test_infirme_le_seuil_de_3_5_…, test_constat_taux_de_fausses_alertes_… |
| 11 | N0 docstring de scan ; commentaires de Verdict | « The first `window` points get no verdict at all » ; « median of the window that came before » ; écart, limite ; js : « Middle value, or the average of the two middle ones on an even count » | démontrée (py, js) | test_une_serie_plus_courte_…, test_l_habituel_est_la_mediane_…, la médiane JavaScript est celle de Python… |
| 12 | N0 docstring d'anomalies | « The subset a pager should see, each one still carrying its numbers » | démontrée (py, js) | test_anomalies_est_le_sous_ensemble_de_scan |
| 13 | N0 risks ; scenario | `deterministic: true`, `none`, `unit` ; « se rejouer à l'identique et porter ses chiffres » ; « en arithmétique de bibliothèque standard » | démontrée (py, js) | test_deux_executions_…, test_l_extrait_n_importe_que_… |
| 14 | N0 regulatory | « une métrique indexée par utilisateur est une donnée personnelle » | non testable : juridique | — |
| 15 | N0 latency, cost ; verdict_rationale | « <1 ms » ; « sans coût marginal » | non testable : ordre de grandeur déclaré | — |
| 16 | N0 escalate_when | « chaque métrique était dans sa plage habituelle, seule leur combinaison ne l'était pas » | non testable : condition d'exploitation. Voir 17 : la « plage habituelle » de N0 est la fenêtre, pas la plage de l'exploitation | — |
| 17 | N1 docstring (py, js) ; verdict_rationale | « Night-time traffic with daytime errors is one such minute, and no single-series threshold will ever ring for it » ; test N1 : « no threshold on a single series — N0's included — can ever ring » ; « N1 voit ce que N0 ne verra jamais » | INFIRMÉE (py, js) sur les données mêmes des tests N1 : dans l'ordre de la série (jour, puis nuit, puis les deux minutes cassées), N0 signale les erreurs aux minutes 90 et 91 et le trafic à la minute 91. N0 juge contre les 24 minutes précédentes, où 9,6 erreurs sont loin de la nuit (3 ± 0,5). Les six valeurs sont bien dans la plage de toute l'exploitation, mais ce n'est pas ce que N0 regarde. L'exemple ne démontre pas l'argument de N1 ; il faudrait une minute dont chaque métrique est habituelle pour sa propre fenêtre | test_infirme_n0_ne_sonne_pas_pour_les_minutes_que_n1_signale (n0) |
| 18 | N0 production | série vide ; 12 000 minutes ; une semaine en fenêtre d'un jour ; seuil zéro ; écart égal à la limite ; valeurs négatives et 1e290 ; fenêtre nulle (Python : `StatisticsError`, sous-classe de `ValueError`) | démontrée (py, js). Constat : un point NaN n'est jamais signalé, et la pointe suivante reste signalée | test_production_… |
| 19 | N0 production | compteur nul plus d'une minute sur deux (erreurs) | DÉFAUT (py, js) : écart absolu médian nul, chaque erreur isolée sonne | test_defaut_une_metrique_de_comptage_presque_toujours_nulle_… |
| 20 | N0 production | fenêtre nulle | DÉFAUT (js) : verdicts à NaN qui ne sonnent jamais, aucune erreur ; Python lève | DÉFAUT : une fenêtre nulle rend des verdicts à NaN… (js) |
| 21 | essai, note | « la valeur mesurée, ce que les douze minutes précédentes appelaient normal, l'écart entre les deux, et l'écart qui était toléré » | démontrée : cas 1, `33 / 4800 / 1180 / 3620 / 311`, surlignage sur « 4800 » | essai : une pointe à 4 800 requêtes… |
| 22 | essai, cas 1 à 3 | « Une pointe à 4 800 requêtes » ; « Deux pointes de suite » ; « Une marche de 1 400 d'un coup » | démontrée : 1 anomalie ; minutes 33 et 34 ; marche de +1 400 signalée aux minutes 12 à 17 puis absorbée | essai : … |
| 23 | essai, cas 4 | « La même hausse, étalée sur trente-six minutes » ; why : « La métrique finit à 2 720 en partant de 1 080, et pas une minute n'est signalée. La hausse est de quarante requêtes par minute » ; « signalée dès sa première minute — puis cesse de l'être » | démontrée : 36 minutes à +40 chacune, aucune anomalie, 1 080 → 2 720 | essai : la hausse étalée finit à 2 720… |
| 24 | essai, cas 4 | « La même hausse » que la marche du cas 3 | INFIRMÉE : +1 440 au bout de la rampe, +1 400 pour la marche | INFIRMÉ : le cas 4 dit « la même hausse »… |
| 25 | essai, why fr et en | « aucun écart d'une minute à la suivante n'approche l'écart toléré » / « no gap from one minute to the next comes anywhere near the allowed one » | INFIRMÉE : de minute en minute la série jugée varie jusqu'à 200 (retour de l'oscillation), 64 % de l'écart toléré de 311 ; l'écart mesuré atteint 73 % de la limite. Et ce n'est pas l'écart d'une minute à l'autre que N0 compare, c'est l'écart à la médiane de la fenêtre | INFIRMÉ : le why dit qu'« aucun écart d'une minute… » |
| 26 | essai, production | saisie « 4,800 » (en), « 4 800 » (fr) | DÉFAUT : l'analyseur de l'essai lit 4,8, ou deux points 4 et 800 ; le libellé anglais écrit lui-même « 4,800 » | DÉFAUT : l'essai lit « 4,800 » comme 4,8… |
| 27 | N1 breaking_point | « Quinze minutes de trafic de nuit portant un nombre d'erreurs de plein jour, glissées dans les données d'entraînement, suffisent pour que la forêt en fasse un troisième régime ordinaire » | démontrée (py, js). Constat : cinq minutes suffisent en Python, une seule en JavaScript | test_point_de_rupture_quinze_minutes_…, test_constat_… |
| 28 | N1 breaking_point | « La minute que le test signalait juste avant ne l'est plus » | démontrée (py, js), témoin : [90, 91] avant | test_point_de_rupture_la_minute_signalee_juste_avant_… |
| 29 | N1 breaking_point | « rien dans la sortie ne dit que quoi que ce soit a changé » | démontrée (py, js) : même liste vide qu'une flotte immobile | test_point_de_rupture_rien_dans_la_sortie_… |
| 30 | N1 breaking_point | « C'est le point de rupture de N0, monté d'un étage : ré-entraîner sur le mois écoulé, c'est décider de ce qui compte comme normal » | non testable : analogie et conseil | — |
| 31 | N1 docstring | « A point in the middle of the crowd needs many; a point out on its own needs three or four » | démontrée (py, js) pour les deux minutes cassées : 3,97 et 3,87 coupes (py), entre 3 et 5 (js) ; une minute ordinaire plus de 5,5 | test_un_point_a_l_ecart_demande_trois_ou_quatre_coupes |
| 32 | N1 production | minute hors de toute plage (un million de requêtes, d'erreurs, de millisecondes) | DÉFAUT (py, js) : non signalée au seuil 0,65 : score 0,616 (py), 0,605 (js), à peine plus qu'une minute ordinaire (0,610). Elle suit toujours la même branche et finit dans la feuille des plus grandes valeurs d'entraînement (5,7 coupes). « Un point à l'écart en demande trois ou quatre » ne vaut donc pas pour un point au-delà de ce que la forêt a vu | test_defaut_une_minute_hors_de_toute_plage_n_est_pas_signalee |
| 33 | N1 docstring | « There is nothing to label » | démontrée : `train` ne prend que les lignes | test_l_extrait_n_importe_que_scikit_learn |
| 34 | N1 docstring | « the only real knob is the size of the forest » | INFIRMÉE (py, js) : de 10 à 500 arbres (py) ou de 50 à 500 (js), les minutes signalées ne changent pas ; le seuil les fait passer de 43 à 2 (py), de 52 à 2 (js) entre 0,5 et 0,65. La docstring d'`anomalies` laisse d'ailleurs le seuil à l'appelant | test_infirme_la_taille_de_la_foret_…, test_constat_le_seuil_change_tout_… |
| 35 | N1 docstring de score | « Between zero and one. Above one half, the point took fewer cuts to isolate than the crowd did » | démontrée (py, js) : tous les scores dans ]0, 1[ ; score > 0,5 ⇔ profondeur moyenne < c(n) ; flotte immobile à 0,5 | test_au_dessus_d_un_demi_…, test_le_score_est_un_rang_…, test_une_flotte_immobile_… |
| 36 | N1 docstring d'anomalies | « Move it towards one to be woken up less often and miss more » ; « There is no value of it that turns the score into an explanation » | démontrée pour le premier membre (nombres décroissants de 0 à 1) ; le second non testable | test_le_seuil_est_a_vous |
| 37 | N1 commentaire SEED ; js generator | « the seed is part of the contract: an alert that changes between two runs on the same data is not an alert » | démontrée (py, js) ; témoin : une autre graine change le score | test_la_graine_fait_partie_du_contrat |
| 38 | N1 docstring de train | « Nothing is labelled and nothing is scaled: the cuts are drawn between the smallest and the largest value of each metric, so a metric counted in milliseconds and one counted in requests weigh the same » | démontrée (py, js) : latence divisée par mille, scores identiques à 1e-12 | test_rien_n_est_mis_a_l_echelle_… |
| 39 | N1 regulatory | « ses coupes sont tirées entre la plus petite et la plus grande valeur observée de chaque métrique, et en gardent la trace » | démontrée (py : seuils des arbres scikit-learn ; js : `cut` de chaque nœud) | test_les_coupes_sont_tirees_entre_le_minimum_et_le_maximum_observes |
| 40 | N1 docstring js | « Written out in full rather than pulled from a library […]: the classical tool is small enough to read » | non testable : jugement | — |
| 41 | N1 docstring ; verdict_rationale | « The output is a rank between zero and one, not a measured gap against a stated limit » ; « on apprend que la minute était inhabituelle, pas en quoi » | démontrée (py, js) : un nombre, une liste d'indices | test_le_score_est_un_rang_entre_zero_et_un |
| 42 | N1 risks | `deterministic: true`, `none`, `statistical`, `library` | démontrée pour les deux premiers ; qualification pour le reste | test_la_graine_…, test_l_extrait_n_importe_que_scikit_learn |
| 43 | N1 escalate_when | « quelqu'un pour décider quels régimes ont le droit d'exister » | non testable : conseil | — |
| 44 | N1 production | score égal au seuil (écarté) ; une ligne (py : 0,5) ; zéro ligne (py : `ValueError`) ; NaN (py : accepté, [90, 91]) ; 9 200 minutes (js, 136 ms) | démontrée | test_production_… |
| 45 | N1 production | zéro ou une ligne d'entraînement | DÉFAUT (js) : aucune erreur, scores NaN qui ne sonnent jamais | DÉFAUT : aucune ligne ou une seule ligne… (js) |
| 46 | N1 production | une valeur NaN dans l'entraînement | DÉFAUT (js) : 72 minutes sur 92 signalées ; scikit-learn accepte le NaN et rend [90, 91] | DÉFAUT : une valeur manquante… (js) |
| 47 | N1 production | 4 600 minutes (cinquante fois le cas des tests) | DÉFAUT (py) : `anomalies` appelle `score_samples` ligne par ligne ; une dizaine de secondes, contre quelques dizaines de millisecondes pour un appel groupé sur les mêmes lignes | test_defaut_quatre_mille_six_cents_minutes_… |
| 48 | N2 unavailable_reason | « N0 répond en trois nombres, celui-là ne répond pas » ; « un service qui décide des alertes est un service qu'il faut surveiller » | démontrée pour « trois nombres » (6) ; le reste non testable (niveau absent) | — |
| 49 | N3 unavailable_reason | « Deux appels sur la même fenêtre peuvent rendre deux verdicts » ; « un appel par minute et par métrique » | non testable : niveau absent | — |

## Non testable, et pourquoi

- 14 : juridique.
- 15 : ordre de grandeur déclaré, sans mesure publiable.
- 16, 30, 36 (en partie), 40, 43 : conditions d'exploitation, analogies,
  conseils, jugement.
- 48 (en partie), 49 : niveaux absents.

## Infirmé, et ce que le code fait réellement

- **10** : le seuil de 3,5 sur une fenêtre de 24 signale 0,75 % de bruit
  gaussien pur, seize fois le taux nominal ; plus de 2 % à 12.
- **17** : N0 signale les deux minutes que N1 est censé seul voir, dans la série
  même des tests N1. C'est l'argument central du verdict qui n'est pas démontré
  par l'exemple.
- **24, 25** : essai : 1 440 ≠ 1 400 ; les écarts d'une minute à l'autre
  approchent la tolérance (64 %), et ce n'est pas ce que N0 compare.
- **34** : la taille de la forêt ne change rien ici, le seuil change tout.
- Précisions à porter : 3 (la dérive passe à 96 % de la tolérance), 7 (les
  nombres de l'exemple ne piègent pas la moyenne), 8 (le MAD quadruple avant de
  céder).

## Défauts de production

- **19 (N0)** : compteur presque toujours nul, chaque unité sonne.
- **20 (N0 js)** : fenêtre nulle silencieuse.
- **26 (essai)** : séparateurs de milliers mal lus.
- **32 (N1)** : une minute hors de toute plage n'est pas signalée.
- **45, 46 (N1 js)** : zéro ligne, une ligne, NaN : scores NaN ou faux positifs
  en masse, sans erreur.
- **47 (N1 py)** : notation ligne par ligne, cent fois trop lente.

## Pour la charte

- Pour un seuil statistique, la charte pourrait exiger un test de taux de
  fausses alertes sur du bruit synthétique reproductible : c'est la seule façon
  de vérifier qu'un « 3,5 » veut dire ce qu'il dit une fois la fenêtre choisie.
- Quand une fiche justifie un niveau par ce qu'un autre « ne verra jamais », le
  test doit exécuter l'autre niveau sur la même donnée, dans le même ordre ; ici,
  le raisonnement tenait sur la plage globale et tombait sur la fenêtre.
- Les forêts d'isolement et, plus largement, les modèles à coupes bornées par
  l'entraînement ont un angle mort connu hors de la plage vue ; la charte
  pourrait imposer un cas « valeur très au-delà de l'entraînement ».
