# rank-products-by-relevance — relevé du testeur

> **Tour 2 — contre-épreuve : quatre marquages restent, à reprendre par le rédacteur.**
> - **DÉFAUT T2-6 (N0, JavaScript) — non traité au tour 1** : des poids incomplets
>   (`{ text: 1 }`) rendent un score nul pour tous les produits, sans erreur ;
>   Python lève `KeyError`. Le rédacteur l'avait laissé « à trancher » : le test
>   de production qui épinglait ce score nul est retiré, le `DÉFAUT` reste.
> - **DÉFAUT T2-5 (N0, py/js)** : un poids `NaN` ou infini passe le refus des
>   poids négatifs ; le score vaut `nan` (Python), `NaN` ou 0 (JavaScript).
> - **DÉFAUT T2-7 (N0 et N1, JavaScript)** : une marge, une popularité ou un
>   signal `null` ou écrit en chaîne passe le nouveau contrôle d'échelle
>   (`null >= 0 && null <= 1` est vrai) ; Python lève `TypeError`.

Passe 1 du lot 15. Niveaux disponibles : N0 (verdict) et N1. Tests dans `content/snippets/rank-products-by-relevance/` :

| Fichier | Tests | Dont d'origine (renommés) | Marqués |
|---|---|---|---|
| n0.test.py / n0.test.js | 30 / 32 | 10 / 10 | Py : 3 INFIRMÉ + 1 DÉFAUT ; JS : 3 INFIRMÉ + 2 DÉFAUT |
| n1.test.py / n1.test.js | 26 / 28 | 8 / 9 | Py : 2 INFIRMÉ + 2 DÉFAUT ; JS : 3 INFIRMÉ + 3 DÉFAUT |

Ajoutés : 38 en Python, 41 en JavaScript. `node scripts/test-snippets.mjs rank-products-by-relevance` : vert.

Tests d'origine : tous conservés. Le point de rupture N1 d'origine ne vérifiait pas « aucun surcroît de trafic n'y changera rien » ni son témoin ; c'est ajouté. Le test JS « the hand-written fit agrees with the Python one » comparait à des constantes recopiées ; il compare désormais aussi à l'exécution réelle de `n1.py`, sur quatre journaux.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Le test les règle sur le catalogue d’automne, où les produits populaires étaient aussi les pertinents » | démontrée (poids 3/2/1/6 : Route 5 en tête sur « chaussures de course ») | test_point_de_rupture_les_poids_regles_a_lautomne_font_le_bon_ordre_sur_le_catalogue_dautomne |
| 2 | N0 breaking_point | « au printemps, une gamme qui n’a presque rien vendu perd sur sa propre requête, « sandales randonnée », contre le succès de la saison précédente — mêmes poids, même code » | démontrée : Route 5 (texte 0) passe devant les sandales (texte 1) | test_point_de_rupture_au_printemps_sandales_randonnee_perd_contre_le_succes_de_la_saison_precedente |
| 3 | N0 breaking_point | « Rien ne le signale : ni exception, ni test rouge, ni ligne de journal » | démontrée : aucune exception, aucun avertissement, aucun enregistrement de journal, rien sur stdout/stderr (Python) ni sur `console` (JS) | même test |
| 4 | N0 breaking_point | « Il faut que quelqu’un s’en aperçoive et déplace un nombre » | démontrée (témoin : texte 12 remet la nouveauté en tête, même code) | test_point_de_rupture_temoin_deplacer_un_nombre_remet_la_nouveaute_en_tete |
| 5 | N0 name | « Score pondéré sur quatre signaux ramenés à la même échelle » | INFIRMÉE en partie : voir rang 11 | — |
| 6 | N0 docstring | « Deterministic, standard library only / no dependency » | démontrée (même appel, même sortie ; ouverture de fichier interdite) | test_deterministe_le_meme_appel_rend_le_meme_ordre, test_aucun_fichier_ecrit |
| 7 | N0 docstring | « the four weights are arguments, not constants buried in the code » | démontrée | test_les_poids_sont_des_arguments_pas_des_constantes_cachees |
| 8 | N0 docstring | « the answer arrives in an afternoon rather than in a retraining cycle » | non testable : organisation humaine (le mécanisme, un poids changé, est démontré au rang 4) | — |
| 9 | N0 commentaire | « Fixing it keeps the arithmetic identical everywhere, which is what makes a ranking reproducible » ; test : « The order the two language versions must both produce » | démontrée : 27 appels (requêtes accentuées, NFD, insécable, emoji, vide, ponctuation seule ; trois jeux de poids), titres, scores et signaux identiques au bit près entre Python et Node | test_python_et_javascript_rendent_le_meme_classement_et_les_memes_scores |
| 10 | N0 docstring | « a weight of two really does mean twice as much » | démontrée | test_un_poids_de_deux_compte_vraiment_deux_fois_plus |
| 11 | N0 docstring | « Every signal is reduced to the same nought-to-one scale before the weights touch it » | INFIRMÉE : seuls `text` et `availability` sont dans [0, 1] par construction ; `margin` et `popularity` sont recopiés tels quels. Une marge saisie en pourcentage (35) reste 35 et écrase les trois autres signaux | test_infirme_chaque_signal_est_ramene_entre_zero_et_un |
| 12 | N0 docstring | « the score itself stays inside the same scale whatever the weights » | INFIRMÉE : avec un poids négatif, la moyenne pondérée sort de [0, 1] (texte 2, marge −1 → score 2,0). N1 apprend précisément des poids négatifs (rang 36). Démontrée pour des poids positifs et des signaux dans l'échelle | test_infirme_le_score_reste_entre_zero_et_un_quels_que_soient_les_poids, test_le_score_reste_entre_zero_et_un_pour_des_poids_positifs_et_des_signaux_dans_lechelle |
| 13 | N0 docstring | « The sort is stable, so two products the score cannot separate stay in the order the catalogue gave them » | démontrée (deux jumeaux dans les deux ordres, cent jumeaux) | test_le_tri_est_stable_a_egalite |
| 14 | N0 docstring | « An unstable sort would reshuffle equal results between two page loads » | non testable : les deux tris utilisés sont stables, il n'y a pas de tri instable à observer | — |
| 15 | N0 docstring de fold | « Lowercase and drop accents, so that "crème" finds "creme" » | démontrée, dans les deux sens | test_les_accents_et_la_casse_sont_ignores |
| 16 | N0 docstring de terms | « Split on anything that is not a letter or a digit » | démontrée (`T-shirt col-V, 42/44`) | test_tout_ce_qui_nest_ni_lettre_ni_chiffre_separe_les_termes |
| 17 | N0 docstring de textMatch | « a shopper who types "chauss" is looking for "chaussures" » | démontrée | test_un_prefixe_suffit |
| 18 | N0 docstring de textMatch | « and a shopper who types the plural is looking for the singular too » | INFIRMÉE : le préfixe fait l'inverse. « sandales » ne trouve pas « Sandale » (0) ; « sandale » trouve « Sandales » (témoin) | test_infirme_une_requete_au_pluriel_trouve_le_produit_au_singulier, test_le_singulier_trouve_le_pluriel |
| 19 | N0 docstring de rank | « hand back the reason for each place […] whoever asks why a product came third can see which signal held it back » | démontrée (signaux rendus, score recalculable) | test_le_classement_dit_pourquoi |
| 20 | N0 test d'origine | « availability is a signal among others, not a filter » | démontrée | test_la_disponibilite_est_un_signal_parmi_dautres_pas_un_filtre |
| 21 | N0 risks | `deterministic: true`, `data_egress: none`, `testability: unit` | démontrée (rang 6, garde réseau, tests unitaires) | — |
| 22 | N0 risks.regulatory | « aucune donnée personnelle n’entre dans le score, et le catalogue ne quitte pas votre infrastructure » | démontrée : des champs client ajoutés aux produits ne changent aucun score ; garde réseau | test_aucune_donnee_hors_des_quatre_signaux_nentre_dans_le_score |
| 23 | N0 risks.regulatory | « La marge est un paramètre de classement explicite : l’information due […] est à vérifier selon votre statut d’intermédiaire » | démontrée pour « explicite » (poids `margin`) ; la portée juridique est non testable | test_les_poids_sont_des_arguments_pas_des_constantes_cachees |
| 24 | N0 latency | « <1 ms » | démontrée pour six produits (mille classements en moins d'une seconde) | test_un_classement_de_six_produits_prend_moins_dune_milliseconde |
| 25 | N0 cost / footprint | `nul`, `negligible` | non testable : déclaration d'ordre de grandeur | — |
| 26 | N0 escalate_when | « Vous rejouez le même arbitrage […] à chaque changement de saison, et votre journal de clics est assez fourni » | non testable : situation d'usage | — |
| 27 | essai, why | « Le seul produit qui répond exactement à la requête arrive troisième, derrière une paire de chaussures de course et des chaussettes » | démontrée en français et en anglais (seul produit à 100 % de texte, troisième) | l’essai : la nouveauté arrive troisième… (JS), test_lessai_la_nouveaute_arrive_troisieme_derriere_des_chaussures_de_course_et_des_chaussettes (Py) |
| 28 | essai, why | « la popularité pèse deux fois le texte » | démontrée (6 contre 3) | idem |
| 29 | essai, why | « une nouveauté n’a par définition aucune popularité » | non testable : phrase générale ; la donnée de l'essai porte une popularité de 0,05, pas zéro (remarque 3) | — |
| 30 | essai, note | « La cellule surlignée est le signal qui a le plus poussé le premier produit » | démontrée (popularité, 6 × 0,80) | l’essai : la cellule surlignée… (JS seul) |
| 31 | N0 production | requête vide, ponctuation seule | démontrée : texte 0 partout, ordre commercial | test_production_une_requete_vide_laisse_les_signaux_commerciaux_decider |
| 32 | N0 production | catalogue vide ; poids tous nuls | démontrée : `[]` ; score 0 et ordre du catalogue | test_production_un_catalogue_vide_donne_un_classement_vide, test_production_des_poids_tous_nuls_rendent_zero_et_lordre_du_catalogue |
| 33 | N0 production | 10 000 produits, requête de 60 mots | démontrée (sous 10 s) | test_production_dix_mille_produits_et_une_longue_requete_terminent_vite |
| 34 | N0 production | NFD, insécable, emoji, casse ; largeur nulle | démontrée ; un U+200B coupe le mot en deux termes (0,5) | test_production_nfd_insecable_largeur_nulle_emoji_et_casse_mixte |
| 35 | N0 production | écritures dont les voyelles sont des marques (devanagari) | DÉFAUT : le repli ôte toute marque. « हिंदी » devient « ह » + « द » en Python (texte 0,5 sur le mot « हद ») et « हद » en JavaScript (texte 1) : faux positifs, et divergence entre les langages | test_defaut_un_mot_en_devanagari_ne_trouve_pas_un_autre_mot |
| 36 | N0 production | champ manquant, poids incomplets | Python : démontrée, `KeyError` / `TypeError`. JavaScript : DÉFAUT, une popularité `undefined` donne un score NaN rangé comme une égalité ; des poids incomplets donnent un total NaN que `total ? … : 0` change en score 0 pour tous, sans erreur | test_production_un_champ_manquant_leve_une_erreur (Py) ; DÉFAUT : un produit sans popularité ou des poids incomplets… (JS) |
| 37 | N1 breaking_point | « Le test donne la même marge à tous les produits de toutes les pages : la colonne correspondante ne contient plus que des zéros » | démontrée | test_point_de_rupture_une_marge_identique_partout_donne_une_colonne_de_zeros |
| 38 | N1 breaking_point | « le poids appris vaut exactement zéro » | démontrée (`== 0`, dans les deux langages) ; témoin : non nul sur le journal où la marge varie | test_point_de_rupture_le_poids_appris_vaut_exactement_zero |
| 39 | N1 breaking_point | « une page où la marge est la seule différence entre deux produits ressort avec deux scores identiques » | démontrée ; témoin : scores différents avec les poids du journal d'origine | test_point_de_rupture_une_page_ou_seule_la_marge_differe_rend_deux_scores_identiques |
| 40 | N1 breaking_point | « aucun surcroît de trafic n’y changera rien : seul un changement de ce qu’on montre le peut » | démontrée : dix fois le journal, poids toujours 0 ; une seule page où la marge varie le rend non nul | test_point_de_rupture_aucun_surcroit_de_trafic_ny_change_rien |
| 41 | N1 breaking_point | « Le modèle n’est pas faux, il est aveugle » | non testable : image | — |
| 42 | N1 name, docstring | « Pondérations apprises du journal de clics, paire par paire » ; « Each such pair becomes one training row, the difference between the two signal vectors » | démontrée | test_une_paire_devient_deux_lignes_de_sens_oppose |
| 43 | N1 docstring | « a logistic regression on those differences gives back the weights of the original score » | démontrée : journal synthétique de 300 pages dont l'acheteur suit (0,5 ; 0,3 ; 0 ; 0,2), poids retrouvés à 0,05 près dans les deux langages | test_la_regression_redonne_les_poids_du_score_dorigine |
| 44 | N1 docstring | « Every pair is added in both directions […] That keeps the two classes balanced » | démontrée | test_les_deux_classes_sont_equilibrees |
| 45 | N1 docstring | « it is why the model carries no intercept: a constant would shift both directions of the same pair the same way » | démontrée : ajustée, l'ordonnée à l'origine sort à moins de 10⁻⁶ (Python, scikit-learn) ; la moyenne des étiquettes vaut exactement ½ (JS) | test_une_ordonnee_a_lorigine_sortirait_nulle_sur_des_paires_symetriques |
| 46 | N1 docstring | « Nothing else changes: the serving code, the explanation shown to the shop, the scale of the score, all stay as they were » | INFIRMÉE pour l'échelle : N0 rend une moyenne dans [0, 1], N1 une somme de poids signés normalisés, dans [−1, 1] ; avec les poids appris du journal du test, un produit rentable sans autre signal reçoit −0,25. « serving code » : N1 a sa propre fonction `rank`, qui rend `{candidate, score}` et non `{product, score, signals}` | test_infirme_lechelle_du_score_reste_celle_de_n0 |
| 47 | N1 docstring de rank | « Same weighted sum as N0, same stable sort, same explanation returned » | démontrée pour des poids positifs (même ordre que N0, tri stable, signaux dans `candidate`) ; INFIRMÉE en général : voir rang 58 | test_meme_somme_ponderee_meme_tri_stable_meme_explication |
| 48 | N1 docstring de pairs | « Logging the signals rather than recomputing them later matters » | non testable : consigne d'exploitation | — |
| 49 | N1 docstring de learn_weights | « Dividing by the total absolute weight […] It changes no ranking: scaling every weight scales every score the same way » | démontrée (coefficients bruts et normalisés, même ordre ; ×7 en JS) | test_les_poids_sont_sur_une_echelle_lisible_et_la_mise_a_lechelle_ne_change_aucun_ordre |
| 50 | N1 docstring de learn_weights | « comparable between two months of log » | non testable tel quel | — |
| 51 | N1 test d'origine | « learns that relevance and stock are what shoppers follow », « the log can disagree with the shop » | démontrée | test_apprend_que_la_pertinence_et_le_stock_guident_les_acheteurs, test_le_journal_peut_contredire_la_boutique |
| 52 | N1 test JS | « Two decimals of agreement is what says the thirty lines above are the same model » | démontrée sur quatre journaux dont les signaux sont dans [0, 1] ; DÉFAUT hors échelle (rang 64) | test_python_et_javascript_apprennent_les_memes_poids_a_deux_decimales |
| 53 | N1 docstring (js) | « The fit is thirty lines of gradient descent rather than a dependency » | démontrée : `pairs` + `learnWeights` font 37 lignes non vides hors commentaires (borne 40) | l’ajustement tient en une trentaine de lignes (JS seul) |
| 54 | N1 commentaire (js) | « The penalty keeps a signal the log never varied at exactly nought, rather than letting it drift on noise » | INFIRMÉE : sans pénalité (`regularisation: Infinity`), le poids reste exactement nul aussi ; c'est la colonne de zéros (gradient nul, départ à zéro) qui le garde à zéro, pas la pénalité | INFIRMÉ : la pénalité est ce qui garde à zéro… (JS seul) |
| 55 | N1 risks | `deterministic: true` | démontrée | test_deterministe_le_meme_journal_redonne_les_memes_poids |
| 56 | N1 latency | « <1 ms » | démontrée pour le service (mille classements de page de cinq produits sous une seconde) ; l'apprentissage n'est pas concerné | test_servir_une_page_de_cinq_produits_prend_moins_dune_milliseconde |
| 57 | N1 risks | `data_egress: own-infra`, `testability: statistical`, `vendor_lock: library`, `footprint: low`, `cost: négligeable` ; regulatory (journal de clics, registre, paramètres de classement) | non testable : déclarations et portée juridique. À noter : `vendor_lock: library` vaut pour Python (scikit-learn) ; la version JS n'a aucune dépendance | — |
| 58 | verdict_rationale | « N1 ne coûte rien de plus au service — la même somme pondérée, la même explication » ; « gardez la même fonction de service » | INFIRMÉE : la fonction de service de N0 divise par la **somme signée** des poids. Avec des poids appris dont la somme est négative (journal où l'acheteur prend le produit le moins pertinent), `n0.rank` rend l'ordre inverse de `n1.rank` ; une somme nulle y met tous les scores à 0 | test_infirme_la_fonction_de_service_de_n0_classe_comme_n1_avec_les_poids_appris |
| 59 | verdict_rationale | « la fonction rend les signaux à côté du score, et une réclamation du rayon se règle en déplaçant un nombre » | démontrée (rangs 4, 19) | — |
| 60 | verdict_rationale | « son propre test montre qu’il n’apprend rien d’un signal que le classement précédent n’a pas fait varier » | démontrée (rangs 37–40) | — |
| 61 | N1 production | journal vide, pages vides, page d'un résultat, aucun clic | démontrée : erreur nommée « nothing to learn from » | test_production_un_journal_vide_et_des_pages_vides_levent_lerreur_nommee, test_un_journal_sans_un_clic_nenseigne_rien |
| 62 | N1 production | cent fois le journal du test ; signaux tous à 0 ou à 1 | démontrée (mêmes signes de poids ; 0,25 chacun) | test_production_cent_fois_le_journal_du_test_apprend_vite_et_les_memes_poids, test_production_valeurs_aux_limites_tous_les_signaux_a_zero_ou_a_un |
| 63 | N1 production | journal sans aucune différence entre cliqué et ignoré | DÉFAUT : Python lève `ZeroDivisionError`, JavaScript rend quatre poids NaN ; ni l'un ni l'autre ne lève l'erreur nommée | test_defaut_un_journal_sans_aucune_difference_leve_lerreur_nommee |
| 64 | N1 production | signal hors de [0, 1] (popularité en pourcentage) | DÉFAUT : rien ne le refuse ; scikit-learn converge (popularité ≈ 0,00), la descente de gradient à pas fixe 0,5 oscille et rend −0,49 : les deux langages ne sont plus le même modèle | test_defaut_des_signaux_hors_echelle_font_diverger_les_deux_langages |
| 65 | N1 production | signal manquant | Python : démontrée, `TypeError` (None) et `ValueError` (NaN). JavaScript : DÉFAUT, `undefined` rend des poids NaN sans erreur | test_production_un_signal_manquant_leve_une_erreur (Py) ; DÉFAUT : un signal manquant rend des poids NaN (JS) |
| 66 | scenario | « On voit passer la liste des produits et la requête à un modèle généraliste » ; « l’ordre juste n’existe pas indépendamment de la boutique » | non testable : constat et thèse | — |
| 67 | scenario | « un classement dont chaque place s’explique et se rejoue à l’identique le lendemain » | démontrée pour N0 (rangs 6, 19) | — |
| 68 | N2 unavailable_reason | « trois sont des chiffres de gestion […] qu’aucun encodeur sémantique ne connaît » | non testable : raisonnement, aucun code N2 | — |
| 69 | N3 unavailable_reason | « la même requête doit rendre le même ordre le lendemain. Un modèle généraliste ne donne ni l’un ni l’autre » | non testable : aucun code N3 ; à sourcer ou formuler comme raisonnement | — |

## Non testable, et pourquoi

- Rangs 8, 14, 26, 41, 48, 50, 66 : organisation humaine, images, consignes ou thèses, sans comportement de code.
- Rangs 25, 57 : déclarations d'ordre de grandeur et portée juridique.
- Rangs 68, 69 : niveaux sans code.
- Rang 29 : phrase générale de l'essai (voir remarque 3).

## Infirmé, et ce que le code fait réellement

- **Rang 11 — « Every signal is reduced to the same nought-to-one scale ».** Le code ne réduit rien : `margin` et `popularity` sont lus tels quels. C'est l'appelant qui doit les fournir entre 0 et 1, et rien ne le vérifie. Le nom du niveau (« ramenés à la même échelle ») hérite de l'erreur.
- **Rang 12 — « the score stays inside the same scale whatever the weights ».** Vrai pour des poids positifs seulement. Un poids négatif, que N1 produit sur le journal même de la fiche, fait sortir la moyenne de [0, 1].
- **Rang 18 — « a shopper who types the plural is looking for the singular too ».** Le préfixe sert le singulier vers le pluriel, pas l'inverse : « sandales » ne trouve pas « Sandale ».
- **Rang 46 — N1 « the scale of the score […] stay as they were ».** Le score N1 va de −1 à 1.
- **Rang 54 — commentaire JS sur la pénalité.** Sans pénalité, le poids d'une colonne nulle reste nul.
- **Rang 58 — verdict « la même somme pondérée », « gardez la même fonction de service ».** N0 est une moyenne divisée par la somme signée des poids, N1 une somme : passer des poids appris à la fonction de N0 inverse l'ordre quand leur somme est négative, et l'annule quand elle est nulle.

## Défauts de production

- **N0, écritures à voyelles combinantes (rang 35).** Le repli des accents retire toutes les marques : faux positifs en devanagari, arabe voyellé, thaï, etc., et résultats différents entre Python et JavaScript.
- **N0 JavaScript, champ ou poids manquant (rang 36).** NaN silencieux, ou score nul pour tous ; Python lève.
- **N1, journal sans différence (rang 63).** `ZeroDivisionError` en Python, poids NaN en JavaScript, au lieu de l'erreur nommée déjà prévue pour un journal vide.
- **N1, signaux hors échelle (rang 64).** La descente de gradient JS à pas fixe diverge ; Python non. Aucun contrôle d'échelle en entrée.
- **N1 JavaScript, signal manquant (rang 65).** Poids NaN sans erreur.

## Remarques pour le rédacteur

1. N1 `rank` ne rend pas la même forme que N0 (`candidate` au lieu de `product` et `signals`) : « the explanation shown to the shop stays as it was » est vrai au sens où les signaux sont dans `candidate`, pas au sens où le code de service est le même.
2. `in_stock` absent : `KeyError` en Python, hors stock en JavaScript (`undefined` est faux). Une valeur `"false"` (chaîne) compte comme en stock dans les deux.
3. L'essai dit « une nouveauté n'a par définition aucune popularité » alors que sa donnée porte 0,05 ; la démonstration tient, la phrase est plus forte que l'exemple.
4. Un U+200B dans la requête coupe un mot en deux termes (« rando » + « nnée »), et divise le score texte par deux.

## Pour la charte

- Plusieurs affirmations de cette fiche portent sur la **relation entre deux niveaux** (« même somme pondérée », « même échelle », « gardez la même fonction de service »). La charte range ces phrases dans les affirmations transverses mais ne dit pas qu'il faut les tester en croisant les deux extraits (N1 nourri dans la fonction de N0). C'est ce croisement qui a trouvé le rang 58.
- Un journal synthétique « dont on connaît la réponse » (clics générés depuis des poids connus) est le seul moyen de démontrer « la régression redonne les poids d'origine ». Un générateur à formule simple produit des données dégénérées (premier essai : poids faux de 0,12) ; la charte pourrait recommander un générateur pseudo-aléatoire entier partagé entre les deux langages (MINSTD ici).

## Tour 2 — contre-épreuve

Après `4151507` (corrections du rédacteur, tour 1). Tests : n0.py 30 → 34,
n0.js 32 → 38, n1.py 26 → 28, n1.js 28 → 30. `node scripts/test-snippets.mjs
rank-products-by-relevance` : vert, avec un `DÉFAUT` en n0.py, trois en n0.js,
un en n1.js, signalés en tête.

Retirés, remplacés par le test de ce que la fiche dit désormais : n0
`…infirme_une_requete_au_pluriel…`, `…infirme_chaque_signal_est_ramene…`,
`…infirme_le_score_reste_entre_zero_et_un_quels_que_soient_les_poids` (py, js) ;
n1 `…infirme_lechelle_du_score_reste_celle_de_n0`,
`…infirme_la_fonction_de_service_de_n0…` (py, js), `INFIRMÉ : la pénalité…` et
`l'ajustement tient en une trentaine de lignes` (js) ; n1
`…defaut_des_signaux_hors_echelle_font_diverger…` (py, js) et `DÉFAUT : un
signal manquant rend des poids NaN` (js). Retirée : l'assertion « des poids
incomplets rendent zéro partout » du test JS `production : un produit sans champ
inStock…`, qui épinglait le défaut T2-6. Les anciens marquages JavaScript de
cette fiche utilisaient `assert.throws` sans type : ils passaient pour n'importe
quelle exception (le `DÉFAUT` sur la popularité `undefined` passait déjà parce
que `rank` lève désormais `RangeError`). Les marquages restants suivent la
charte (`assert.rejects(…, assert.AssertionError)`).

### Lignes « À retester »

| # | Ligne | Désormais | Test |
|---|---|---|---|
| 11, 5 | N0 docstring, name : « margin and popularity because a value outside is refused rather than left to swamp the others » ; « quatre signaux compris entre zéro et un » | démontrée (py, js) : marge 35 et popularité 80 lèvent l'erreur nommée ; −0,0001, 1,0000001, NaN, infini refusés, aussi à travers `rank` ; 0 et 1 acceptés ; texte et disponibilité dans [0, 1] par construction. Voir T2-7 pour `null` et les chaînes en JavaScript | test_une_marge_ou_une_popularite_hors_de_l_echelle_est_refusee, test_le_texte_et_la_disponibilite_sont_entre_zero_et_un_par_construction |
| 12 | N0 docstring : « the score, a mean over weights that cannot be negative, stays inside the same scale » | démontrée (py, js) pour un poids négatif (texte 2, marge −1 lève ; −1e−9 lève ; 0 accepté) et, comme au tour 1, pour des poids positifs ; DÉFAUT pour un poids NaN ou infini (T2-5) | test_un_poids_negatif_est_refuse, test_le_score_reste_entre_zero_et_un_pour_des_poids_positifs_et_des_signaux_dans_lechelle |
| 18 | N0 docstring de text_match : « "sandale" finds "sandales". Not the other way round » | démontrée (py, js) : « sandales » → 0 sur « Sandale de marche », 0,5 sur « Sandale de randonnée » ; témoin : le singulier trouve le pluriel | test_une_requete_au_pluriel_ne_trouve_pas_le_produit_au_singulier, test_le_singulier_trouve_le_pluriel |
| 35 | N0 `fold` (U+0300–U+036F) et `terms` (marques gardées) | démontrée (py, js), même sortie : « हिंदी » ne trouve pas « हद » ni « मलक » « मालिक » ; « مَلِك » ne trouve pas « مَلَك » ; chacun se trouve lui-même ; « Việt Nam, Évry, Ångström » replié ; U+0300 et U+036F ôtés, U+1DC4 gardé | test_seules_les_diacritiques_de_u0300_a_u036f_sont_retirees, test_les_voyelles_du_devanagari_et_de_l_arabe_restent_des_mots_differents, test_production_un_mot_en_devanagari_ou_en_arabe_voyelle_ne_trouve_pas_un_autre_mot |
| 36 | N0 champ ou poids manquant | démontrée (js) : popularité `undefined`, marge absente → `RangeError` (commentaire « Also catches a missing field ») ; Python : `TypeError` (None, chaîne), `KeyError` (champ ou poids absent). **DÉFAUT (js)** pour des poids incomplets : T2-6 | production : un produit sans popularité ou sans marge est refusé (js) ; test_production_un_champ_manquant_leve_une_erreur (py) |
| 46 | N1 docstring : « The signals shown to the shop stay the same; the score does not. Learned weights can be negative, so the score is a plain sum over weights whose absolute values add up to one, between minus one and one, where N0 takes a mean of weights that cannot be negative » | démontrée (py, js) : avec les poids appris, un produit rentable sans autre signal reçoit le poids de la marge (négatif) ; signaux rendus inchangés ; bornes −1 et 1 atteintes ; 400 produits du journal synthétique dans [−1, 1] ; `n0.score` refuse ces poids | test_le_score_de_n1_est_une_somme_entre_moins_un_et_un_la_ou_n0_est_une_moyenne |
| 47 | N1 docstring de rank : « A sum weighted over the same signals, the same stable sort, the signals handed back with each candidate. Not N0's mean: dividing by the signed total of learned weights would reverse the order when that total is negative, and wipe it out when it is nought » | démontrée (py, js) : tri stable, signaux dans `candidate`, même ordre que N0 pour des poids positifs ; la moyenne par total signé, recalculée dans le test, rend l'ordre inverse de `rank` quand le total est négatif et zéro partout quand il est nul, alors que `rank` sépare les deux produits | test_somme_ponderee_des_memes_signaux_meme_tri_stable_signaux_rendus, test_diviser_par_le_total_signe_inverserait_l_ordre_ou_l_effacerait |
| 58 | verdict_rationale : « une somme pondérée des mêmes signaux, rendus à côté du score » ; « servez alors avec sa propre fonction : des poids appris peuvent être négatifs, et la moyenne de N0 les refuse » | démontrée (py, js) : `n0.rank` lève avec les poids appris sur `AGAINST_THE_SHOP` ; `n1.rank` classe, signaux et score rendus | test_n0_refuse_les_poids_appris_negatifs_il_faut_servir_avec_la_fonction_de_n1 |
| 54 | N1 commentaire JS : « The penalty of scikit-learn's `C`, divided by the row count because the gradient above is a mean: it is what makes both versions fit one model » | démontrée (py, js) pour C = 0,1 et 1, sur le journal et le journal triplé : poids identiques à 0,01 ; le journal triplé apprend d'autres poids (texte 0,44 → 0,40) et JavaScript suit. Constat : à C = 10 sur le journal triplé, l'écart atteint 0,011 sur la disponibilité (600 pas ne suffisent plus à converger, la pénalité n'est pas en cause) ; non marqué, aucune phrase ne promet d'autre C | test_la_penalite_divisee_par_le_nombre_de_lignes_fait_le_meme_modele_pour_plusieurs_c |
| 53 | N1 docstring JS : « The fit is forty lines of gradient descent rather than a dependency » | démontrée pour « gradient descent rather than a dependency » (aucun import ; un pas ne rend pas les poids de six cents ; zéro pas lève). « forty lines » : non épinglé par test (décision n° 10) ; mesuré : `inScale`, `pairs` et `learnWeights` font 40 lignes non vides hors commentaires | l'ajustement est une descente de gradient écrite en entier, sans dépendance (js seul) |
| 63 | N1 journal sans différence | démontrée (py, js) ; test renommé `production : …` | test_production_un_journal_sans_aucune_difference_leve_lerreur_nommee |
| 64 | N1 signaux hors de [0, 1] | démontrée (py, js) : popularité en pourcentage, −0,0001, 1,0000001, infini refusés ; une page fautive sans clic aussi ; 0 et 1 acceptés | test_production_des_signaux_hors_echelle_sont_refuses |
| 65 | N1 signal manquant | démontrée (py : `TypeError` sur None et chaîne, `ValueError` sur NaN ; js : `RangeError` sur `undefined` et NaN) ; **DÉFAUT (js)** pour `null` et une chaîne : T2-7 | test_production_un_signal_manquant_leve_une_erreur (py) / production : un signal manquant est refusé (js) |
| 29 | essai, why : « cette nouveauté n'a presque aucune popularité » | démontrée : 5 % dans le tableau de l'essai, la plus faible (js, sur l'essai) ; 0,05, le minimum du catalogue de printemps (py) | l'essai : la nouveauté arrive troisième… |

### Phrases nouvelles ou modifiées, code modifié

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| T2-1 | N0 docstring de terms | « Split on anything that is not a letter, a mark or a digit » | démontrée (py, js) : `T-shirt col-V, 42/44` ; « हिंदी फ़िल्में » donne deux termes marques comprises | test_tout_ce_qui_nest_ni_lettre_ni_marque_ni_chiffre_separe_les_termes, test_les_voyelles_du_devanagari_et_de_l_arabe_restent_des_mots_differents |
| T2-2 | N0 docstring de fold | « Only the diacritics Latin scripts use (U+0300 to U+036F) are dropped: in Devanagari or Arabic the vowel signs are marks too, and dropping them would turn one word into another » | démontrée (py, js) : rang 35 | idem |
| T2-3 | N1 docstring | « The score is built on the same four signals as N0, each between nought and one » | démontrée (py, js) : rang 64 | test_production_des_signaux_hors_echelle_sont_refuses |
| T2-4 | N1 docstring JS de inScale | « Every signal between 0 and 1, the scale N0 serves them on; undefined fails too » | démontrée (js) pour `undefined` et NaN ; DÉFAUT pour `null` et une chaîne (T2-7) | production : un signal manquant est refusé |
| T2-5 | N0 `score` (code modifié) | refus des poids négatifs ; « stays inside the same scale » | **DÉFAUT (py, js)** : `nan < 0` et `inf < 0` sont faux. Python : `score(…, text=nan)` et `score(…, text=inf)` valent `nan`. JavaScript : `text: NaN` rend 0 pour tous (total NaN), `text: Infinity` rend NaN. Le tri range alors les produits dans un ordre quelconque, sans erreur | DÉFAUT : test_defaut_un_poids_nan_ou_infini_est_refuse_ou_garde_le_score_dans_l_echelle |
| T2-6 | N0 JavaScript, poids incomplets (rang 36, seconde moitié) | — | **DÉFAUT (js), non traité** : `rank(CATALOGUE, 'x', { text: 1 })` rend un score nul pour les cinq produits, dans l'ordre du catalogue, sans erreur ; Python lève `KeyError`. Tranché : un classement entièrement nul rendu comme un résultat est indéfendable en production ; l'assertion du test de production qui l'affirmait est retirée | DÉFAUT : des poids incomplets rendent un score nul pour tous les produits, sans erreur (js) |
| T2-7 | N0 `signals` et N1 `inScale`, JavaScript (code modifié) | « a value outside is refused » ; « undefined fails too » | **DÉFAUT (js)** : `null >= 0 && null <= 1` est vrai. `signals({ …, margin: null })` rend `margin: null`, compté zéro dans le score ; `margin: '0.5'` passe et ressort en chaîne dans les signaux ; `pairs` accepte un signal `null` (compté zéro) ou `'0.9'`. Python lève `TypeError` dans les deux cas : les deux langages divergent sur une valeur courante d'un JSON ou d'une base | DÉFAUT : une marge null ou écrite en chaîne passe le contrôle d'échelle (n0.js) ; DÉFAUT : un signal null ou écrit en chaîne passe le contrôle d'échelle (n1.js) |
| T2-8 | N1 risks.regulatory, N2 et N3 unavailable_reason, sources | registre des activités de traitement ; « qui ne figurent dans aucun texte qu'un encodeur sémantique pourrait lire » ; « son API n'est pas déterministe par défaut, de l'aveu même du fournisseur » | non testable : portée juridique, niveaux sans code, citation de documentation | — |

### Constats sans marquage

- La requête « filet » ne trouve pas « ﬁlet » (ligature U+FB01) : NFD ne la
  décompose pas, et aucune phrase ne promet un repli de compatibilité.
- Une requête arabe sans voyelles (« ملك ») ne trouve pas un titre voyellé
  (« مَلِك ») : conséquence directe de la phrase de `fold`, qui garde les
  marques ; l'usage courant écrit l'arabe sans voyelles. À peser par le
  rédacteur, non marqué.
- En Python, `True` passe le contrôle d'échelle comme 1 (booléen entier).
