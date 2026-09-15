# moderate-user-comments — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/moderate-user-comments/n{0,1,2,3}.test.{py,js}`.
Un test nommé ci-dessous existe dans les deux langages, sauf mention « py seul » ou « js seul ».

`node scripts/test-snippets.mjs moderate-user-comments` : vert. 62 tests existaient,
tous renommés en français, assertions gardées. Un nom de test était faux :
`test_an_empty_batch_never_reaches_the_model` (N2) n'asserte que le résultat `[]`,
alors que le modèle est bien appelé avec `[]` ; le test renommé porte l'assertion
et est marqué `INFIRMÉ`. 80 tests ajoutés (142 au total).

Marquages : N0 — 3 `INFIRMÉ` et 1 `DÉFAUT` en Python, 3 et 2 en JavaScript ;
N1 — 1 `INFIRMÉ` en Python, 4 `INFIRMÉ` et 3 `DÉFAUT` en JavaScript ; N2 — 2
`INFIRMÉ` et 2 `DÉFAUT` en Python, 2 et 1 en JavaScript ; N3 — 1 `INFIRMÉ` et 1
`DÉFAUT` en Python, 1 et 2 en JavaScript.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Une graphie absente de la liste passe intacte : « bl0rptard », « blorp-tard », les lettres espacées une à une » | démontrée (et « blorptardd ») ; témoin « blorptard » signalé | test_point_de_rupture_une_graphie_absente_de_la_liste_passe_intacte |
| 2 | N0 breaking_point | « le message « he called me a blorptard, please remove his comment » est signalé exactement comme l'insulte qu'il rapporte » | démontrée pour le drapeau et le terme (signalement, attaque, plaisanterie identiques) ; témoin : commentaire ordinaire non signalé | test_point_de_rupture_le_signalement_est_signale_exactement_comme_l_insulte |
| 3 | N0 breaking_point | « et rien dans le résultat ne les distingue » | INFIRMÉE : la fenêtre de contexte et la position les distinguent | test_rien_dans_le_resultat_ne_distingue_le_signalement_de_l_insulte |
| 4 | N0 escalate_when | « Vos modérateurs passent leur journée à classer sans suite… » | non testable : exploitation | — |
| 5 | N0 name | « Liste de termes après normalisation, avec fenêtre de contexte » | démontrée (#6 à #12) | — |
| 6 | N0 docstring | « auditable: every decision can be traced back to one word in a list you control » | démontrée | test_chaque_decision_se_ramene_a_un_mot_de_la_liste |
| 7 | N0 docstring | « Accents and case are spellings of the same word, so they are folded before matching » | démontrée, la liste est normalisée aussi | test_la_normalisation_replie_la_casse_et_les_accents |
| 8 | N0 docstring | « Nothing else is touched: folding further would start inventing matches » | INFIRMÉE : NFKD replie aussi pleine largeur, ligatures, exposants ; Python `casefold` replie « ß » en « ss » | test_rien_d_autre_que_la_casse_et_les_accents_n_est_touche |
| 9 | N0 docstring | « the function returns the words around each hit. A human reads the window and decides » | démontrée (sortie exacte) | test_signale_un_terme_liste_et_montre_son_contexte |
| 10 | N0 commentaire | « Letters and digits, in any script. Punctuation and underscores separate » | démontrée (cyrillique, souligné, virgule ; « 42blorptard » reste un seul mot) | test_les_lettres_et_chiffres_de_toute_ecriture_la_ponctuation_et_le_souligne_separent |
| 11 | N0 review | « `window` is a number of words on each side » | démontrée pour 3, 1, 0 ; coupée aux bords | test_la_fenetre_compte_des_mots_de_chaque_cote, test_la_fenetre_est_coupee_aux_bords_du_commentaire |
| 12 | N0 review | « Return every listed term found in `text` » | démontrée pour plusieurs occurrences ; INFIRMÉE pour un terme de plusieurs mots, jamais trouvé | test_rend_chaque_occurrence_pas_seulement_la_premiere, test_un_terme_de_deux_mots_est_trouve |
| 13 | N0 review | « `terms` is yours: the list is policy, not code » ; « Widen it when your reviewers keep asking » | non testable : conseil | — |
| 14 | N0 risks / latency | `deterministic`, `vendor_lock: none`, `data_egress: none`, `testability: unit`, `<1 ms` | démontrée | test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard, test_un_commentaire_se_verifie_en_moins_d_une_milliseconde |
| 15 | N0 regulatory | « le commentaire ne quitte pas votre infrastructure, et l'extrait signale sans trancher » | démontrée pour la sortie réseau ; « sans trancher » : l'extrait rend quand même un booléen `flagged` | — |
| 16 | N0 production | vide, liste vide, 98 Ko, pleine largeur, BOM | démontrée | test_production_… |
| 17 | N0 production, encodage | accent tapé en NFD (« flarnwît ») | DÉFAUT : non signalé | test_defaut_un_terme_avec_accent_decompose_est_signale |
| 18 | N0 production, casse | « SCHEISSE » pour le terme « scheiße » | démontrée en Python (`casefold`) ; DÉFAUT en JavaScript (`toLowerCase`) | test_production_pleine_largeur_marque_d_ordre_et_casefold (py) / 'DÉFAUT : toLowerCase ne replie pas « ß »…' (js) |
| 19 | N1 breaking_point | « « people like you should not be allowed to have an account here » […] reste sous le seuil » | démontrée : py 0,42, js 0,14 ; témoin : l'attaque passe | test_point_de_rupture_l_hostilite_sans_forme_apprise_reste_sous_le_seuil |
| 20 | N1 breaking_point | « ne réemploie aucune forme vue à l'entraînement » | INFIRMÉE : 44 de ses 114 n-grammes sont dans le vocabulaire | test_la_phrase_hostile_ne_reemploie_aucune_forme_vue |
| 21 | N1 breaking_point | « le signalement « he called me a blorptard, please remove his comment » repasse au-dessus » | démontrée : py 0,63, js 0,82 ; témoin ordinaire dessous | test_point_de_rupture_le_signalement_repasse_au_dessus |
| 22 | N1 breaking_point | « Le modèle apprend un vocabulaire, pas une intention » ; « Un corpus plus fourni déplace la frontière sans changer ce que le modèle regarde » | non testable : propriété générale | — |
| 23 | N1 escalate_when | « L'hostilité qui vous échappe est écrite en langue ordinaire » | non testable | — |
| 24 | N1 docstring | « « bl0rptard » et « blorptardd » partagent l'essentiel de leurs traits avec la forme montrée » | démontrée : 54 % et 78 % des n-grammes | test_bl0rptard_et_blorptardd_partagent_l_essentiel_de_leurs_traits |
| 25 | N1 docstring | « une variante que personne n'a ajoutée à une liste obtient quand même une note » | démontrée, et N0 les laisse passer | test_attrape_les_graphies_qui_dejouent_une_liste |
| 26 | N1 train py | « Character n-grams rather than words, because […] a word-level model only knows the exact tokens it was shown » | démontrée : le modèle par mots donne à « blorptardd » le score d'un mot inconnu (0,518) | test_des_n_grammes_de_caracteres_plutot_que_des_mots (py seul) |
| 27 | N1 train py | « `class_weight="balanced"` because […] an unweighted model learns to say no to everything » | démontrée : 2 insultes pour 36 commentaires, sans pondération 0/8 attrapée, avec 2/8 | test_sans_ponderation_un_corpus_desequilibre_apprend_a_tout_laisser_passer (py) |
| 28 | N1 train js | « Each class is weighted by its rarity, because […] an unweighted model learns to allow everything » | INFIRMÉE en JS : même corpus, le modèle pondéré attrape 0/8 | 'INFIRMÉ : chaque classe est pondérée par sa rareté…' (js) |
| 29 | N1 commentaire py | « `C` above one because a couple of dozen short examples under the default regulariser leave every score sitting near a half » | démontrée : C=1, scores entre 0,35 et 0,66 ; C=10, entre 0,11 et 0,90 | test_c_au_dessus_de_un_parce_que_le_regulariseur_par_defaut_laisse_tout_pres_d_un_demi (py) |
| 30 | N1 docstring | « Le modèle entier est un vecteur de poids […] chaque poids peut être imprimé et discuté » | démontrée en Python (1 208 poids nommés, le plus fort « arn ») ; INFIRMÉE en JS : un poids est une case de hachage partagée (2 006 n-grammes, 499 poids non nuls) | test_le_modele_entier_est_un_vecteur_de_poids_qu_on_peut_imprimer (py) / 'INFIRMÉ : « chaque poids peut être imprimé et discuté »…' (js) |
| 31 | N1 docstring | « assez petit pour vivre à côté du code, il s'entraîne le temps que vous lisiez » | démontrée : 32 Ko sérialisés (py), 1 024 poids (js) ; entraînement 10 ms py, 41 ms js | test_assez_petit_… |
| 32 | N1 docstring js | « une régression logistique sur des n-grammes de caractères hachés tient en quarante lignes » | INFIRMÉE : 41 lignes de code | 'INFIRMÉ : « … tient en quarante lignes » ; n1.js en compte 41' (js) |
| 33 | N1 docstring | « En modération, cette dernière propriété vaut mieux qu'un point de justesse » | non testable : jugement | — |
| 34 | N1 is_abusive / score | seuil à l'appelant (vers 1 moins de faux positifs) ; « How strongly the model reads this comment » | démontrée : monotonie, tout à 0, rien à 1 ; score dans [0, 1] | test_le_seuil_est_a_l_appelant, test_le_score_est_une_probabilite |
| 35 | N1 test (existant) | sépare son corpus ; laisse passer deux commentaires ordinaires inédits | démontrée | test_separe_le_corpus_…, … |
| 36 | N1 risks / latency | `deterministic`, `vendor_lock: library`, `<1 ms` | démontrée (py : sklearn ; js : aucune dépendance) ; mesuré 0,5 ms py, 0,05 ms js | test_n1_est_deterministe_et_s_appuie_sur_scikit_learn, test_une_note_prend_moins_d_une_milliseconde |
| 37 | N1 risks / regulatory | `data_egress: own-infra`, `testability: statistical`, `footprint: low`, les deux lignes | non testable : déclaratif, juridique | — |
| 38 | N1 production | commentaire vide | démontrée en Python (0,45, non signalé) ; DÉFAUT en JavaScript (0,67, signalé) | test_production_un_commentaire_vide_n_est_pas_signale (py) / 'DÉFAUT : un commentaire vide est jugé injurieux' (js) |
| 39 | N1 production | corpus vide ou d'une seule classe | démontrée en Python (`ValueError`) ; DÉFAUT en JavaScript | test_production_un_corpus_vide_ou_d_une_seule_classe_est_refuse (py) / 'DÉFAUT : un corpus vide ou d'une seule classe est accepté…' (js) |
| 40 | N1 production | hachage des n-grammes (JS) | DÉFAUT : 499 cases occupées sur 1 024 pour 2 006 n-grammes | 'DÉFAUT : le hachage FNV multiplie en flottant…' (js) |
| 41 | N1 production | 98 Ko ; pleine largeur ; NFD | démontrée : < 2 s ; « ｂｌｏｒｐｔａｒｄ » signalé ; score défini | test_production_… |
| 42 | verdict_rationale | « N0 et N1 tombent sur le même exemple du test, le signalement d'une insulte marqué comme l'insulte elle-même » | démontrée | test_n0_et_n1_tombent_sur_le_meme_exemple_du_signalement (dans n1.test) |
| 43 | verdict_rationale | « Le classifieur auto-hébergé lit ce contexte » | non testable ici, et jamais montré : aucun test N2 ne soumet le signalement au modèle. La recommandation N2 repose sur une affirmation que la fiche ne démontre pas | — |
| 44 | verdict_rationale | « et vous laisse les deux seuils, dont celui qui envoie un commentaire à un humain » | démontrée | test_deux_seuils_une_bande_pour_un_humain |
| 45 | verdict_rationale | « N3 rendrait au fournisseur le sens de chaque catégorie, l'étalonnage… » ; « l'échange ne se défend que si… » | non testable : jugement | — |
| 46 | N2 breaking_point | « Le modèle note la toxicité, l'insulte et la menace » | INFIRMÉE par la documentation : `unitary/unbiased-toxic-roberta` (Python) rend 16 étiquettes (toxicity, severe_toxicity, obscene, identity_attack, insult, threat, sexual_explicit, et neuf étiquettes de mention d'identité) ; `Xenova/toxic-bert` (JS) en rend 6 (toxic, severe_toxic, obscene, threat, insult, identity_hate), sans « toxicity » | — (config.json des deux modèles) |
| 47 | N2 breaking_point | « le test lui soumet « he lives at the corner of rue des Lilas… », qui n'est aucune des trois, ressort bas partout et part en publication. Le code est juste » | démontrée pour la plomberie (notes basses → `allow`) ; que le modèle réel note bas : non testable, les notes sont écrites par le test | test_point_de_rupture_un_prejudice_sans_etiquette_note_bas_partout_part_en_publication |
| 48 | N2 escalate_when | « Le préjudice qui vous occupe n'a d'étiquette dans aucun modèle disponible » | non testable | — |
| 49 | N2 docstring | « Un encodeur distillé, affiné sur un corpus de modération » | INFIRMÉE par la documentation : les deux modèles sont des modèles de base à 12 couches (RoBERTa-base, BERT-base), pas des modèles distillés | — (config.json) |
| 50 | N2 docstring | « Il lit un contexte que les n-grammes de N1 ne peuvent pas lire, et il reste dans votre infrastructure » | non testable : modèle réel | — |
| 51 | N2 docstring | « le regroupement en lots, les seuils, et la réponse à « que fait le code quand le modèle ne dit rien d'exploitable » » | démontrée | test_le_lot_entier_part_en_un_appel, test_les_seuils_sont_a_l_appelant, test_une_ligne_inexploitable_part_chez_un_humain_plutot_que_publiee |
| 52 | N2 moderate | « The whole batch goes in one call » | démontrée (y compris 1 000 commentaires) | test_le_lot_entier_part_en_un_appel, test_production_mille_commentaires_en_un_lot |
| 53 | N2 moderate | « a batch of a hundred is one pass through the model » | INFIRMÉE pour Python par la documentation : le pipeline `transformers` ne regroupe pas par défaut (« batch inference is disabled by default », `batch_size` non fourni) ; non testable ici. En JS, Transformers.js passe le tableau en une fois | — |
| 54 | N2 commentaire | « Two thresholds, not one: between "obviously fine" and "obviously not" there is a band that belongs to a human » | démontrée, valeurs aux limites (0,9 ; 0,8999 ; 0,6 ; 0,5999) | test_deux_seuils_une_bande_pour_un_humain |
| 55 | N2 _decide | « Keep the strongest label, and fall back to a human when nothing is usable. Falling back to "allow" would […] silently publish » | démontrée : vide, texte, `None`, NaN, booléen, 1,5, −0,1 → `review` | test_garde_l_etiquette_la_plus_forte_…, test_une_ligne_inexploitable_… |
| 56 | N2 moderate | « the model returned one row per comment, and did not » | démontrée (ligne en moins et ligne en trop) | test_une_reponse_de_mauvaise_longueur_leve_plutot_que_de_decaler_les_commentaires |
| 57 | N2 test (existant) | « an empty batch never reaches the model » | INFIRMÉE : `calls == [[]]` | test_un_lot_vide_n_atteint_jamais_le_modele |
| 58 | N2 ToxicityModel | « The real model, loaded once and kept in memory for the process » | INFIRMÉE : `moderate` sans classifieur construit (py) ou charge (js) le modèle à chaque appel | test_le_vrai_modele_est_charge_une_fois_pour_le_processus |
| 59 | N2 moderate | « `classifier` is injected so this can be tested without downloading the weights. In production it defaults to the real model » ; surface de la bibliothèque | démontrée : sans classifieur, `ModuleNotFoundError: transformers` (py), `ERR_MODULE_NOT_FOUND @huggingface/transformers` (js) ; `predict` convertit la sortie à la forme du pipeline | test_le_classifieur_est_injecte_…, test_predict_convertit_la_sortie_du_pipeline_… |
| 60 | N2 regulatory | « Décision de modération prise sans intervention humaine dès qu'un commentaire franchit le seuil de blocage » | démontrée | test_une_decision_de_blocage_est_prise_sans_humain (py) |
| 61 | N2 regulatory / risks | autres lignes ; `deterministic`, `own-infra`, `statistical`, `moderate`, `~100 ms`, `faible` | non testable : modèle réel | — |
| 62 | N2 production, malveillante | modèle par défaut Python : étiquettes de mention d'identité | DÉFAUT (py) : le maximum sur toutes les étiquettes bloque un commentaire qui mentionne une identité | test_defaut_une_etiquette_de_mention_d_identite_ne_bloque_pas_un_commentaire (py seul) |
| 63 | N2 production, autre type | ligne `{"label": …, "score": …}` | DÉFAUT : décision `block` étiquetée « score » | test_defaut_une_ligne_d_une_autre_forme_ne_devient_pas_une_decision |
| 64 | N2 production | 1 000 commentaires ; égalité entre étiquettes ; vide, NFD, emoji, BOM | démontrée | test_production_… |
| 65 | Essai figé | six cas : « Une insulte adressée à quelqu'un » bloquée, « Un commentaire de lecteur ordinaire » publié, « Un avis cinglant » en relecture, « seuils resserrés » bloqué, « Le modèle ne renvoie rien d'utilisable » chez un humain, « Une adresse personnelle » publiée ; « Un appel pour le lot » | démontrée (py : notes lues dans l'essai ; js : `essai.run`) | test_l_essai_fige_six_cas |
| 66 | Essai figé, why | « Il n'est ni toxique, ni insultant, ni menaçant au sens de la liste d'étiquettes du modèle : il ressort bas partout » | non testable : les notes sont celles du cas (la note de l'essai le dit) ; même réserve que #47 | — |
| 67 | Essai figé, why | « l'élargir demande un corpus étiqueté à vous, c'est-à-dire le coût qu'on prête à N1 et qu'on suppose absent ici » | non testable | — |
| 68 | N3 breaking_point | « « the diagram is much clearer than the text » revient noté en harcèlement au-delà du seuil de blocage, et la fonction bloque, correctement selon sa propre logique. Aucun trait à inspecter, aucun poids à imprimer » | démontrée pour la plomberie : la décision ne contient que les notes du fournisseur ; témoin : noté bas, publié | test_point_de_rupture_un_commentaire_anodin_note_harcelement_est_bloque_sans_rien_pour_le_contester |
| 69 | N3 breaking_point | « le nombre du fournisseur, qui change au calendrier du fournisseur » | non testable | — |
| 70 | N3 docstring | « Le code le plus court à écrire de toute l'échelle » | INFIRMÉE : c'est le plus long (py 42 lignes contre 19, 14, 32 ; js 47 contre 18, 41, 36) | test_n3_est_le_code_le_plus_court_de_l_echelle |
| 71 | N3 docstring | « le texte des commentaires de vos utilisateurs, qui sort de chez vous à chaque appel » ; `data_egress: third-party` | démontrée : le commentaire est dans l'invite, tel quel | test_envoie_le_commentaire_et_les_categories_a_temperature_zero |
| 72 | N3 docstring | « plafonner l'entrée, réessayer, refuser d'agir sur une réponse qui n'a pas la forme demandée » | démontrée : 4 001 refusé avant appel, 4 000 accepté ; 3 essais, pas un de plus ; neuf réponses inutilisables lèvent après 3 appels | test_refuse_…, test_une_panne_…, test_une_reponse_sans_aucune_categorie_utilisable_… |
| 73 | N3 _ask | « A category the model invented is dropped, one it omitted is simply absent. An answer with none of them left is unusable, and unusable is raised » | démontrée | test_une_categorie_inventee_…, test_production_une_reponse_partielle_… |
| 74 | N3 commentaire | « Temperature zero, because a moderation decision that changes between two identical calls cannot be explained » | démontrée pour l'envoi ; l'effet sur le modèle non testable | idem #71 |
| 75 | N3 commentaire | « A model charges by the token, and a comment that long is a bug or an attack » | non testable ; précision : 4 000 caractères font environ 600 mots, un commentaire légitime long lève `ValueError` au lieu d'aller en relecture | — |
| 76 | N3 client par défaut | `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)` | DÉFAUT | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 77 | N3 production | vide ; injection ; réponse partielle ; zéro essai | démontrée | test_production_… |
| 78 | N3 production, encodage | 4 000 emojis | démontrée en Python ; DÉFAUT en JavaScript | test_production_quatre_mille_emojis_sont_acceptes_en_python (py) / 'DÉFAUT : le plafond compte des unités UTF-16' (js) |
| 79 | N3 risks / regulatory | `deterministic: false`, `hard`, `provider`, `high`, `~1 s`, `élevé`, trois lignes | non testable | — |
| 80 | scenario | « la même insulte est tantôt l'attaque, tantôt la citation de cette attaque […] tantôt une plaisanterie » ; « ce qui sort de la chaîne n'est pas un score, c'est une décision » | démontrée pour N0 (#2) ; le reste non testable | — |

## Non testable, et pourquoi

- **#4, #13, #22, #23, #33, #45, #48, #67, #69, #80 (partie)** : exploitation, conseils, jugements.
- **#37, #61, #79** : déclaratif, juridique, modèle ou fournisseur réels.
- **#43** : l'affirmation qui porte la recommandation N2 (« le classifieur lit ce contexte ») n'est démontrée par aucun test ni aucune source. Le double ne peut pas la montrer ; la fiche devrait la sourcer (fiche du modèle, évaluation publiée) ou la retirer.
- **#47, #66** : « ressort bas partout » décrit une note écrite par le test. La charte classe comme fausse une affirmation qui attribue au modèle ce que le double écrit ; la phrase doit dire que la note est simulée.
- **#50, #53 (JS)** : comportement du modèle réel.

## Infirmé, et ce que le code fait réellement

- **#3 — N0 breaking_point : « rien dans le résultat ne les distingue ».** `review(REPORT)` rend `{"term": "blorptard", "position": 4, "context": "called me a blorptard please remove his"}`, `review(ATTACK)` rend `{"term": "blorptard", "position": 5, "context": "this forum you blorptard"}`. Le drapeau et le terme sont identiques ; la fenêtre, que la docstring présente comme la pièce qui permet à un humain de trancher, les distingue. La phrase contredit la docstring.
- **#8 — N0 docstring : « Nothing else is touched ».** NFKD replie les formes de compatibilité : `normalise("ｂｌｏｒｐｔａｒｄ") == "blorptard"`, `normalise("ﬁn²") == "fin2"` ; Python `casefold` fait « ß » → « ss ». Le repli attrape donc des graphies en pleine largeur, ce qui est utile, mais n'est pas « rien d'autre ».
- **#12 — N0 : « Return every listed term found in text ».** La comparaison se fait mot par mot : un terme de la liste qui contient une espace (« sale type ») n'est jamais trouvé, et rien ne l'indique.
- **#20 — N1 breaking_point : « ne réemploie aucune forme vue à l'entraînement ».** 44 des 114 n-grammes de la phrase sont dans le vocabulaire (« you », « not », « here », « an »…). Elle réemploie des formes, mais celles des commentaires ordinaires.
- **#28 — N1 JS : pondération par rareté.** Corpus de 2 insultes et 36 commentaires ordinaires (le corpus du test répété) : le modèle JS pondéré attrape 0 des 8 insultes restantes ; Python pondéré en attrape 2, Python non pondéré 0. La pondération JS ne remplit pas le rôle que la docstring lui donne sur ce cas.
- **#30 — N1 JS : « chaque poids peut être imprimé et discuté ».** Le modèle JS est un vecteur de 1 024 cases de hachage sans vocabulaire : un poids n'a pas de n-gramme associé, et chaque case en porte plusieurs (2 006 n-grammes, 499 cases non nulles). Imprimable, pas discutable. Vrai en Python (`get_feature_names_out`).
- **#32 — N1 JS : « quarante lignes ».** 41.
- **#46 — N2 : « Le modèle note la toxicité, l'insulte et la menace ».** Configs publiées (`config.json`, `id2label`) : Python `unitary/unbiased-toxic-roberta`, 16 étiquettes, `problem_type: multi_label_classification` ; JavaScript `Xenova/toxic-bert` (conversion de `unitary/toxic-bert`), 6 étiquettes. **Les deux langages n'utilisent pas le même modèle**, et leurs étiquettes n'ont pas les mêmes noms (`toxicity` contre `toxic`) : les tests, l'essai et la fiche emploient `toxicity`, qui n'existe pas dans le modèle JS.
- **#49 — N2 docstring : « Un encodeur distillé ».** Les deux configs indiquent 12 couches cachées de 768 dimensions : RoBERTa-base et BERT-base, pas des modèles distillés.
- **#53 — N2 : « a batch of a hundred is one pass through the model ».** Documentation de `transformers` (v4.57, « Batch inference ») : « batch inference is disabled by default » ; `pipeline(...)(liste)` traite les entrées une par une tant que `batch_size` n'est pas fourni, et l'extrait Python ne le fournit pas. L'affirmation est fausse pour Python ; pour JS, Transformers.js passe le tableau au modèle en une fois.
- **#57 — N2, test existant : « an empty batch never reaches the model ».** `moderate([], classifier)` appelle `classifier.predict([])` ; avec le classifieur par défaut, cela charge le modèle pour un lot vide.
- **#58 — N2 : « The real model, loaded once and kept in memory for the process ».** Python : `classifier = classifier or ToxicityModel()` dans `moderate` ; JS : `classifier ?? (await ToxicityModel.load())`. Sans classifieur injecté, chaque appel à `moderate` recharge le pipeline (deux appels, deux chargements dans le test). Rien ne garde le modèle pour le processus.
- **#70 — N3 docstring : « Le code le plus court à écrire de toute l'échelle ».** Lignes de code hors docstrings et commentaires : Python N0 19, N1 14, N2 32, N3 42 ; JS N0 18, N1 41, N2 36, N3 47. N3 est le plus long dans les deux langages (et dépasse le plafond de 40 lignes de la charte des extraits).

## Défauts de production

- **#17 — N0, accent en NFD.** Le découpage en mots (`[^\W_]+`, `[\p{L}\p{N}]+`) a lieu avant la normalisation et exclut la marque combinante : « flarnwît » devient « flarnwi » et « t », et n'est pas signalé alors que « flarnwît » composé l'est.
- **#18 — N0 JavaScript, « ß ».** `toLowerCase` ne replie pas « ß » : « SCHEISSE » n'est pas trouvé pour « scheiße » en JS, il l'est en Python.
- **#38 — N1 JavaScript, commentaire vide.** `score(model, "")` vaut 0,671 : un commentaire vide est jugé injurieux au seuil 0,5. Python : 0,445.
- **#39 — N1 JavaScript, corpus vide ou d'une seule classe.** `train([], [])` rend un modèle à poids nuls (score 0,5 partout, tout est signalé) ; `train([...], [1, 1])` rend un modèle qui signale « thank you for the article » (0,985). Python lève `ValueError` dans les deux cas.
- **#40 — N1 JavaScript, hachage dégradé.** `((h ^ c) * 16777619) >>> 0` multiplie en flottant au-delà de 2^53 et perd les bits bas avant la troncature (le harnais du dépôt le signale et utilise `Math.imul`). Les 2 006 n-grammes du corpus n'occupent que 499 cases sur 1 024, là où une répartition uniforme en occuperait environ 880 : plus de collisions, donc des traits confondus.
- **#62 — N2 Python, étiquettes d'identité.** `_decide` prend le maximum sur toutes les étiquettes. Le modèle Python par défaut rend neuf étiquettes de mention d'identité (`male`, `female`, `muslim`, `black`…). Un commentaire qui mentionne une identité sans aucune hostilité (`muslim` 0,95, `toxicity` 0,01) est bloqué avec l'étiquette « muslim ». Le modèle JS n'a pas ces étiquettes.
- **#63 — N2, ligne d'une autre forme.** Si le classifieur rend `{"label": "toxicity", "score": 0.95}` (sortie `top_k=1` d'un pipeline) au lieu d'un dictionnaire étiquette → note, `_decide` garde la « note » `score` : décision `block`, étiquette « score ». Aucune erreur.
- **#76 — N3, client par défaut.** Python `OpenAI()`, JS `new OpenAI()`, puis `client.complete(prompt=…, temperature=0)` : méthode inexistante sur le client du kit `openai` (vérifié par l'orchestrateur, 3.14.0 et 7.15.0). Surface réelle : `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`, `model` obligatoire et jamais fourni. L'erreur est attrapée par `except Exception` / `catch`, retentée trois fois, et sort en `ModerationUnavailable`.
- **#78 — N3 JavaScript, plafond en unités UTF-16.** 4 000 emojis font 8 000 unités et lèvent `RangeError` en JS ; Python les accepte.

**N2, surface des bibliothèques réelles (consigne).** Python : `pipeline("text-classification", model=…, top_k=None)` puis `pipe(liste)` rend une liste de listes de `{label, score}` : l'appel existe et `predict` le convertit (test avec la forme du pipeline). JavaScript : `pipeline('text-classification', name)` puis `pipe(liste, { top_k: null })` : dans le source de Transformers.js (`pipelines/text-classification.js`), `top_k` vaut 1 par défaut, `null` rend toutes les étiquettes, un tableau en entrée rend un tableau de tableaux, et un modèle `multi_label_classification` passe par une sigmoïde : l'appel existe. Aucune ligne `DÉFAUT` pour l'appel lui-même ; les défauts sont #46, #53, #58.

## Précisions pour le rédacteur

- **Deux modèles, deux paquets.** N2 Python : `unitary/unbiased-toxic-roberta` ; N2 JS : `Xenova/toxic-bert`, via `@huggingface/transformers`. La fiche voisine fuzzy-match-company-names emploie `@xenova/transformers` : le catalogue mélange l'ancien et le nouveau nom du paquet.
- **Scores N1 divergents entre langages** : hostile 0,42 (py) contre 0,14 (js) ; signalement 0,63 contre 0,82. Les conclusions tiennent des deux côtés, pas les valeurs.
- **N1 Python, lettres espacées** : « you are a b l o r p t a r d » vaut 0,5005, signalé à un dix-millième du seuil.
- **#15 « signale sans trancher »** : l'extrait rend `flagged`, un booléen que l'appelant peut appliquer tel quel.

## Pour la charte

- **Vérifier l'étiquetage des modèles N2 contre leur `config.json`** : `id2label`, `problem_type`, nombre de couches. Trois affirmations de cette fiche (#46, #49, #62) tombent à la lecture de ces deux fichiers.
- **Les noms de tests sont des affirmations** : un nom de test existant disait le contraire de ce que le code fait (#57). La charte les compte-t-elle dans le périmètre ? Je les ai traités comme tels.
- **Comptage de lignes** : trois affirmations de ce lot portent sur une longueur de code (« quarante lignes », « trente lignes », « le plus court »). Une fonction commune de comptage, dans `_harness/`, éviterait que chaque testeur invente la sienne.
- **Recommandation fondée sur le double** : la charte devrait interdire qu'un verdict repose sur une affirmation que seul le modèle réel pourrait démontrer (#43), sauf source citée.
