# detect-language-of-text — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/detect-language-of-text/n{0,1,3}.test.{py,js}`.
Avant : 44 tests. Après : 152 (n0.py 25, n0.js 29, n1.py 24, n1.js 24, n3.py 25,
n3.js 25). Les tests d'origine sont renommés en français, assertions gardées. Les
quatre tests de l'essai vivent dans `n0.test.js`.

`node scripts/test-snippets.mjs detect-language-of-text` : vert, avec les
marquages ci-dessous.

Échantillons d'entraînement : les trois paragraphes des tests d'origine (fr, en,
es), inchangés. Seuil N1 : 0,9, celui des tests d'origine.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « chat » ressort en anglais » | démontrée (py, js), témoin : phrase française → fr | test_point_de_rupture_chat_ressort_en_anglais |
| 2 | N0 breaking_point | « ses quatre trigrammes étant ceux que l'anglais emploie dans « that » et « what » » | INFIRMÉE (py, js) : « ␣ch », « cha », « hat », « at␣ » ; seuls « hat » (rang 25) et « at␣ » (rang 11) sont dans le profil anglais ; « ␣ch » et « cha » ne sont dans aucun profil et coûtent 300 partout. Distances : en 158, es 300, fr 300. « what » n'apparaît pas dans l'échantillon anglais | test_infirme_les_quatre_trigrammes_de_chat_sont_dans_le_profil_anglais |
| 3 | N0 breaking_point | « sur « ça va », les trois langues sont à la distance maximale et c'est l'ordre alphabétique qui répond » | démontrée (py, js), témoin : profils fournis dans un autre ordre, même réponse « en » | test_point_de_rupture_sur_ca_va_les_trois_langues_sont_a_la_distance_maximale_et_l_ordre_alphabetique_repond |
| 4 | N0 breaking_point | « sur une phrase française suivie d'une phrase anglaise, l'espagnol arrive deuxième alors qu'il n'est nulle part dans le texte » | démontrée (py, js) : classement fr, es, en ; écart 3,4 contre 12,1 sur la phrase française seule | test_point_de_rupture_sur_une_phrase_francaise_suivie_d_une_anglaise_l_espagnol_arrive_deuxieme |
| 5 | N0 name | « Profils de trigrammes de caractères, distance de rang » | démontrée (py, js) | test_detecte_une_phrase_dans_chaque_langue, test_un_profil_classe_les_trigrammes_frequents_en_tete |
| 6 | N0 docstring / scenario | « le modèle entier tient en quelques centaines de chaînes courtes par langue » ; « quelques centaines de chaînes de trois lettres » | démontrée (py, js) : 300 trigrammes au plus par langue, tous de trois caractères | test_le_modele_entier_tient_en_quelques_centaines_de_chaines_de_trois_caracteres |
| 7 | N0 docstring | « « ent », « les », « eur » en français, « the », « ing » en anglais, « que », « los » en espagnol » | démontrée (py, js) : chacun est mieux classé dans sa langue que dans les deux autres. Nuance : « que » est au rang 34 en espagnol et 37 en français, « ent » est aussi au rang 17 en espagnol ; ce ne sont pas des trigrammes propres à une langue | test_chaque_langue_classe_ses_trigrammes_cites_mieux_que_les_autres_langues |
| 8 | N0 docstring | « les mots sont entourés d'espaces avant d'être découpés […] « les » au milieu d'un mot n'est pas l'article » | démontrée (py, js) : « les » donne « ␣le », « tables » donne « les » mais pas « ␣le » | test_le_bourrage_d_espaces_distingue_l_article_du_milieu_de_mot |
| 9 | N0 docstring | « Un rang survit sans changer à un échantillon quatre fois plus long, et à un texte quatre fois plus court » | démontrée (py, js) au sens littéral : le même texte répété quatre fois donne le même profil et la même distance. Un échantillon différent et plus long change les rangs : la phrase ne vaut que pour la répétition | test_un_rang_survit_a_un_echantillon_quatre_fois_plus_long_et_a_un_texte_quatre_fois_plus_court |
| 10 | N0 docstring | « Déterministe, sans dépendance » (py : « standard library only ») | démontrée (py : re, unicodedata, collections ; js : aucun import) | test_l_extrait_est_deterministe_et_n_importe_que_la_bibliotheque_standard |
| 11 | N0 commentaire de WORDS | « Letters only. Digits, punctuation and symbols say nothing about a language, and a text full of them would drown the trigrams that do » | démontrée (py, js) | test_les_chiffres_la_ponctuation_et_les_symboles_ne_produisent_aucun_trigramme |
| 12 | N0 docstring de profile | « Ties are broken alphabetically, so the same sample always gives the same profile » | démontrée (py, js) | test_a_egalite_de_compte_le_profil_est_trie_alphabetiquement |
| 13 | N0 docstring de distance | « A trigram the language never uses costs the maximum » ; « Dividing by the number of trigrams keeps a long text and a short one on the same scale » | démontrée (py, js) ; la seconde moitié par le test 9 | test_un_trigramme_absent_de_la_langue_coute_le_maximum |
| 14 | N0 docstring de ranked | « Every candidate language, closest first. The caller gets the gap between the first two » | démontrée (py, js) | test_ranked_rend_toutes_les_langues_et_l_ecart_entre_les_deux_premieres |
| 15 | N0 docstring de detect | « It always returns one, even when it should not » | démontrée (py, js) sur texte vide et texte sans lettre. Limite : sans aucun profil, il lève (voir 21) | test_detect_rend_toujours_une_langue_meme_quand_il_ne_devrait_pas |
| 16 | N0 escalate_when | « vous voyez l'écart entre les deux premières langues tomber à zéro » sur deux ou trois mots | démontrée (py, js) sur « ça va » ; la condition d'exploitation elle-même est non testable | test_escalate_when_l_ecart_tombe_a_zero_sur_deux_mots |
| 17 | N0 risks.deterministic / data_egress / testability / regulatory | `true` ; `none` ; `unit` ; « le texte ne quitte pas votre infrastructure » | démontrée (py, js) | test_l_extrait_est_deterministe_et_n_importe_que_la_bibliotheque_standard |
| 18 | N0 (test d'origine) | casse, accents manquants, ponctuation | démontrée (py, js) | test_la_casse_les_accents_manquants_et_la_ponctuation_ne_changent_pas_la_reponse |
| 19 | N0 production | texte vide, texte blanc | démontrée : distance maximale partout, pas d'exception | test_production_texte_vide_et_texte_sans_lettre_rendent_une_distance_maximale_sans_exception |
| 20 | N0 production | un million de caractères ; un « mot » de 100 000 lettres | démontrée : borne large tenue | test_production_un_texte_d_un_million_de_caracteres_…, test_production_un_mot_de_cent_mille_lettres_… |
| 21 | N0 production | aucun profil fourni | démontrée : exception plutôt qu'une langue inventée. L'erreur n'est pas nommée : `IndexError` (py), `TypeError` (js) | test_production_sans_aucun_profil_detect_leve_au_lieu_d_inventer_une_langue |
| 22 | N0 production | NFD, espace insécable, largeur nulle, BOM, emoji | démontrée (py, js) : même langue ; NFD donne exactement le même classement | test_production_accents_decomposes_…, test_production_espaces_insecables_largeur_nulle_bom_et_emoji_… |
| 23 | N0 production | taille de profil 0 et 1 | démontrée | test_production_taille_de_profil_aux_limites |
| 24 | N1 breaking_point | « il répond français avec une quasi-certitude et le seuil qui s'abstenait sur « ça va » ne se déclenche pas » | démontrée (py, js) : P(fr) > 0,99, témoin : abstention sur « ça va » au même seuil | test_point_de_rupture_sur_le_texte_bilingue_le_modele_repond_francais_avec_une_quasi_certitude |
| 25 | N1 breaking_point | « le modèle n'a plus l'hésitation de N0 » | démontrée (py, js) : l'écart de N0 fond de plus de moitié, P(fr) de N1 reste > 0,99 | test_point_de_rupture_le_modele_n_a_plus_l_hesitation_de_n0_sur_le_texte_bilingue |
| 26 | N1 breaking_point | « un texte portugais ressort en espagnol » (au-dessus du seuil) | démontrée (py, js), témoin : phrase espagnole | test_point_de_rupture_un_texte_portugais_ressort_en_espagnol_au_dessus_du_seuil |
| 27 | N1 breaking_point | « un texte allemand en anglais, tous deux au-dessus du seuil » | démontrée (py, js), témoin : phrase anglaise | test_point_de_rupture_un_texte_allemand_ressort_en_anglais_au_dessus_du_seuil |
| 28 | N1 breaking_point | « La probabilité est un produit sur tous les n-grammes du texte : elle sature bien avant que les indices ne le justifient » | démontrée par 24 et 25 ; « bien avant que les indices ne le justifient » est un jugement, non testable en soi | — |
| 29 | N1 name | « Classifieur bayésien naïf sur n-grammes de caractères » | démontrée (py, js) | test_detecte_une_phrase_dans_chaque_langue |
| 30 | N1 docstring | « Les mêmes traits qu'en N0, un à trois caractères » | démontrée pour « un à trois caractères, bornés aux mots » (py, js). Nuance : ce ne sont pas les mêmes traits qu'en N0, qui ne prend que des trigrammes et écarte chiffres et ponctuation ; N1 découpe sur les espaces et garde tout | test_les_traits_sont_des_n_grammes_d_un_a_trois_caracteres_bornes_aux_mots |
| 31 | N1 docstring de train (py) | « `char_wb` cuts n-grams inside word boundaries […] exactly as the padding of N0 did » | démontrée (py) ; js : même découpe par `ngrams` | idem |
| 32 | N1 docstring | « N0 répond « français » ; celui-ci répond « français, et voici de combien il devance l'espagnol » » | démontrée (py, js) | test_la_reponse_dit_de_combien_la_premiere_langue_devance_les_autres |
| 33 | N1 docstring | « Un détecteur qui sait s'abstenir » ; detect : « or None when the model is not sure enough » | démontrée (py, js) | test_il_sait_s_abstenir_la_ou_n0_devait_repondre |
| 34 | N1 docstring de detect | « Leave it at zero to always get a name, as N0 does » | démontrée (py, js) | test_a_minimum_zero_il_rend_toujours_un_nom_comme_n0 |
| 35 | N1 docstring de probabilities | « they always sum to one, over the languages the model was trained on and no others » | démontrée (py, js), y compris sur portugais, allemand, texte vide, et une seule langue apprise (P = 1) | test_les_probabilites_somment_a_un_sur_les_seules_langues_apprises, test_production_une_seule_langue_apprise_… |
| 36 | N1 docstring de train / commentaire ALPHA | « an n-gram this language never used should count against it, without ruling it out on a single character » | démontrée (py, js) : « ñ » absent du français, la phrase française suivie de « ñ » reste fr au seuil 0,9 ; « ñ » seul → es | test_un_lissage_leger_un_caractere_jamais_vu_ne_disqualifie_pas_la_langue |
| 37 | N1 docstring (py) | « Le modèle est une table de comptes » | démontrée (py : `feature_count_` entier, total = nombre de n-grammes de l'échantillon ; js : `counts`) | test_le_modele_est_une_table_de_comptes |
| 38 | N1 docstring (py) | « L'entraînement tient en un paragraphe par langue et une fraction de seconde » | non testable : chiffre de durée. Mesuré de l'ordre de quelques millisecondes sur la machine de test, sans que ce soit publiable | — |
| 39 | N1 docstring (js) | « Écrit en entier plutôt que tiré d'une bibliothèque » | démontrée (js : aucun import). La version Python, elle, tire scikit-learn : les deux docstrings diffèrent, ce que doc.fr.yaml reflète | test l'extrait n'importe rien / test_l_extrait_n_importe_que_scikit_learn |
| 40 | N1 docstring (js) | « un bayésien naïf multinomial, c'est trente lignes de comptage » | non testable comme tel (ordre de grandeur). Constat : 44 lignes de code non vides hors commentaires dans n1.js | — |
| 41 | N1 commentaire (js) | « multiplying a few thousand small numbers underflows to zero » (d'où la somme des logarithmes) | démontrée (py, js) : sur un million de caractères, P(fr) = 1, somme = 1, pas de NaN | test_production_un_texte_d_un_million_de_caracteres_termine_sans_debordement_numerique |
| 42 | N1 (test d'origine) | « a single word is enough when it is a distinctive one » ; « chat » anglais avec certitude | démontrée (py, js) | test_un_seul_mot_suffit_quand_il_est_distinctif, test_chat_est_anglais_avec_certitude |
| 43 | N1 risks.deterministic / data_egress | `true` ; `none` | démontrée (py, js) | test_deux_entrainements_…, test_l_extrait_n_importe_que_scikit_learn |
| 44 | N1 risks.testability | `statistical` | non testable : qualification. Constat : les tests sont des tests unitaires déterministes sur échantillons figés | — |
| 45 | N1 regulatory | « l'échantillon d'entraînement est un texte de langue, pas les messages de vos utilisateurs » | non testable : dépend de l'usage | — |
| 46 | N1 escalate_when | « Vous devez reconnaître une langue dont vous n'avez aucun échantillon » | démontrée pour le constat (26, 27) ; le conseil est non testable | — |
| 47 | N1 production | texte vide et blanc | démontrée : loi a priori, 1/3 chacune | test_production_texte_vide_et_texte_blanc_rendent_la_loi_a_priori |
| 48 | N1 production | NFD, espaces insécables, largeur nulle, BOM, emoji | démontrée (py, js) au seuil 0,9 | test_production_accents_decomposes_espaces_insecables_largeur_nulle_bom_et_emoji |
| 49 | N1 production | seuil exactement égal, juste au-dessus, à 1 | démontrée (py, js) : `>=` | test_production_seuil_exactement_egal_juste_au_dessus_et_a_un |
| 50 | N3 breaking_point | « Le test lui fait répondre « es », assorti d'une confiance de son cru, sur une phrase manifestement française : l'extrait […] rend le mauvais code » | démontrée (py, js), témoin : réponse « fr » → fr | test_point_de_rupture_la_confiance_est_ecrite_par_le_modele_… |
| 51 | N3 breaking_point | « La confiance est écrite par le modèle, pas mesurée » | démontrée (py, js) : une confiance de 0,01 rend le même code, rien ne la lit | test_point_de_rupture_la_confiance_n_est_pas_mesuree_… |
| 52 | N3 breaking_point | « l'extrait valide la forme, la trouve parfaite » | INFIRMÉE (py, js) : l'extrait ne lit que `language`. Une réponse sans `confidence`, ou avec `"confidence": "très sûr"`, passe sans erreur : la forme n'est pas validée | test_infirme_l_extrait_valide_la_forme_de_la_reponse_confiance_comprise |
| 53 | N3 breaking_point | « Il ne lève une erreur que sur ce qu'il peut voir, de la prose là où du JSON était demandé, ou une langue absente de la liste » | démontrée (py, js) | test_point_de_rupture_de_la_prose_…, test_point_de_rupture_une_langue_absente_de_la_liste_… |
| 54 | N3 docstring | « cap the input » ; commentaire « Refusing oversized input is […] a cost control » | démontrée (py, js) : 8 000 passe, 8 001 refusé sans appel | test_refuse_une_entree_trop_grande_…, test_production_exactement_8000_… |
| 55 | N3 docstring / commentaire | « send only an excerpt » ; « Sending the whole document is […] paying by the token for nothing » | démontrée (py, js) : les 600 premiers caractères exactement. « A language is decided in the first few sentences » est une affirmation sur le modèle : non testable | test_n_envoie_qu_un_extrait_des_600_premiers_caracteres |
| 56 | N3 docstring | « retry on failure » | démontrée (py, js) : 3 appels, pas un de plus | test_une_panne_est_retentee_…, test_une_panne_persistante_est_retentee_trois_fois_pas_une_de_plus |
| 57 | N3 docstring | « parse an answer that is only probably valid JSON » | démontrée (py, js) : balises Markdown, JSON tronqué, vide, `null`, chaîne, tableau → `DetectionUnavailable` après 3 appels. Constat : un JSON entouré de ```json, forme fréquente, coûte trois appels et échoue | test_production_une_reponse_hors_format_leve_apres_trois_essais |
| 58 | N3 docstring | « normalise a code the model may write in half a dozen ways » | démontrée pour fr, FR, « ␣fr␣ », fr-CA, FR-ca | test_normalise_les_formes_courantes_d_un_code |
| 59 | N3 commentaire | « Models answer "fr", "FR", "fr-CA" and "French" for the same thing » (présentées comme gérées) | INFIRMÉE (py, js) : « French » et « fr_CA » lèvent `DetectionUnavailable`, ils ne sont pas normalisés. L'issue est sûre (pas de mauvais code), mais le commentaire et la docstring laissent croire le contraire | test_infirme_french_et_fr_ca_sont_normalises_en_fr |
| 60 | N3 docstring | « refuse an answer that is outside the list it was given » ; `und` → None | démontrée (py, js) | test_point_de_rupture_une_langue_absente_…, test_rend_none_quand_le_modele_dit_und |
| 61 | N3 commentaire | « Temperature zero » | démontrée : `temperature == 0` dans la requête. Que cela rende le modèle reproductible est non testable | test_envoie_le_texte_et_la_liste_triee_a_temperature_zero |
| 62 | N3 docstring de detect | « `client` is injected […] In production it defaults to a real provider client » | DÉFAUT (py, js) : le client par défaut est `OpenAI()` / `new OpenAI()`, et le code appelle `client.complete(prompt=…, temperature=0)`, méthode absente du kit publié (`openai` 3.14.0 py, 7.15.0 js, vérifié par l'orchestrateur) ; la surface réelle est `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`. Aucun `model` n'est passé. Contre un double à la forme du vrai client, l'`AttributeError` / `TypeError` est avalée par la boucle de réessai (`except Exception`) et ressort en `DetectionUnavailable` après trois tentatives : l'erreur de programmation se déguise en panne du fournisseur | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 63 | N3 docstring | « The one thing this rung genuinely adds is that it needs no sample of the language » | non testable : affirmation sur le modèle | — |
| 64 | N3 docstring | « The one thing it cannot do is tell you it is wrong » | démontrée pour la part du code (50, 51) ; ce que fait le modèle est non testable | — |
| 65 | N3 risks.data_egress / regulatory | `third-party` ; « des données personnelles que rien dans l'appel ne retire » | démontrée (py, js) : nom, téléphone et adresse partent tels quels dans le prompt | test_le_texte_part_tel_quel_chez_le_fournisseur_donnees_personnelles_comprises |
| 66 | N3 risks.deterministic / testability | `false` ; `hard` | non testable : propriété du modèle | — |
| 67 | N3 regulatory | « Localisation du traitement à vérifier » ; « Ne vous dispense pas de vos propres obligations » | non testable : juridique | — |
| 68 | N3 production | texte vide ou blanc | DÉFAUT (py, js) : un appel payé pour un extrait vide (le double répond « und », l'extrait rend None après 1 appel) | test_defaut_un_texte_vide_ne_coute_aucun_appel |
| 69 | N3 production | emoji à la frontière de l'extrait | py : démontrée ; js : DÉFAUT, `slice` coupe en unités UTF-16 et envoie une moitié de paire de substitution seule (`prompt.isWellFormed()` faux) | test_production_un_emoji_a_la_frontiere_… / DÉFAUT : un emoji à la frontière de l'extrait est coupé en deux |
| 70 | N3 production | 5 000 emoji | py : démontrée (5 000 caractères, accepté) ; js : DÉFAUT, `text.length` vaut 10 000, refusé en `RangeError`. Le plafond « 8000 characters » ne veut pas dire la même chose dans les deux langages | test_production_cinq_mille_emoji_… / DÉFAUT : cinq mille emoji comptent pour dix mille caractères |
| 71 | N3 production | NFD, espace insécable, largeur nulle | démontrée : partent intacts | test_production_accents_decomposes_et_espaces_insecables_partent_intacts |
| 72 | N3 production | `language` nul, numérique, absent | démontrée : `DetectionUnavailable`, jamais un code | test_production_une_langue_nulle_ou_numerique_leve_sans_devenir_un_code |
| 73 | N3 production, malveillante | le texte demande au modèle d'ignorer ses consignes et de répondre « it » | démontrée : hors liste, refusé. Une injection qui obtient une langue de la liste passe (c'est le point de rupture 50) | test_production_une_injection_qui_obtient_une_langue_hors_liste_est_refusee |
| 74 | N3 production | `attempts=0` | démontrée : `DetectionUnavailable` sans appel ; message peu utile (« None » en py, « undefined » en js) | test_production_zero_essai_leve_sans_appel |
| 75 | verdict_rationale | « Son seul signal est l'écart entre les deux premières langues, et cet écart s'effondre exactement là où il le faut, sur le message bilingue ; la probabilité de N1 fait l'inverse et monte à la quasi-certitude » | démontrée (py, js) | test_verdict_la_probabilite_de_n1_monte_a_la_quasi_certitude_quand_l_ecart_de_n0_s_effondre |
| 76 | verdict_rationale | « son seuil vous protège des textes courts et de rien d'autre » | INFIRMÉE (py, js) : sur « chat », quatre lettres, P(en) = 0,999997 et le seuil de 0,9 rend « en ». Le seuil protège de « ça va », pas des textes courts en général. Le test d'origine de N1 le montrait déjà | test_infirme_le_seuil_de_n1_protege_des_textes_courts |
| 77 | verdict_rationale | « N0 l'emporte sur […] savoir quand se taire » ; « Montez à N1 le jour où vous devez répondre sur un ou deux mots » | non testable : jugement et conseil. À rapprocher de 76 et de l'essai : sur « chat », N0 ne se tait pas non plus (écart de 142 sur 300) | — |
| 78 | scenario | « un problème réglé depuis les années quatre-vingt-dix » | non testable par le code ; sourcé par Cavnar & Trenkle (1994) en lecture complémentaire | — |
| 79 | scenario | « La difficulté […] est de savoir se taire sur un message de deux mots, ou sur un message qui en contient deux » | non testable : description du problème | — |
| 80 | N2 unavailable_reason | « ne se distingue de N1 qu'en dessous de quelques dizaines de caractères » ; « la langue d'interface […] tranchent mieux que n'importe quel modèle » | non testable : pas de code N2, et aucun banc d'essai ni source cité pour le seuil de « quelques dizaines de caractères » | — |
| 81 | essai, cas 1 et 2 | message de support et message crié → français | démontrée (fr, en) | essai : le message de support et le même message crié ressortent en français |
| 82 | essai, cas « chat », why | « ressort en anglais, avec un écart large qui a toutes les apparences de la confiance. Quatre trigrammes seulement, et ce sont ceux que l'anglais emploie dans « that » et « what » » | démontrée pour « anglais », « écart large » (142, plus large que sur la phrase française) et « quatre trigrammes » ; INFIRMÉE pour « ce sont ceux que l'anglais emploie » (voir 2) | essai : « chat » ressort en anglais avec un écart large…, test_infirme_les_quatre_trigrammes_… |
| 83 | essai, cas bilingue, why | « la deuxième est l'espagnol […] l'écart s'effondre » | démontrée | essai : le message bilingue a l'espagnol en deuxième… |
| 84 | essai, sortie | « c'est l'ordre alphabétique qui répond » sur distance maximale | démontrée (fr, en) | essai : sur « ça va », la sortie dit que l'ordre alphabétique répond |

## Non testable, et pourquoi

- 38, 40 : chiffres de durée ou de volume de code ; la charte interdit de publier
  une mesure par un test.
- 44, 66 : qualifications de risque qui portent sur la nature du test ou du
  modèle.
- 45, 67 : usage et obligations juridiques.
- 28 (en partie), 46 (conseil), 55 (le modèle décide en quelques phrases), 61
  (reproductibilité du modèle), 63, 64 (en partie) : ce que fait le modèle, ou
  un jugement.
- 77, 79 : jugement et description du problème.
- 78 : fait historique, sourcé en lecture complémentaire.
- 80 : pas de code N2 ; le seuil « quelques dizaines de caractères » n'a ni
  source ni mesure dans le dépôt. Le rédacteur devrait le sourcer ou le retirer.

## Infirmé, et ce que le code fait réellement

- **2 et 82** : « chat » ne produit pas « les quatre trigrammes que l'anglais
  emploie dans that et what ». Il en produit quatre, dont deux seulement
  (« hat », « at␣ ») sont dans le profil anglais. « ␣ch » et « cha » sont
  absents des trois profils. La réponse anglaise tient à ces deux trigrammes,
  qui ramènent la distance anglaise à 158 quand les deux autres restent à 300.
- **52** : l'extrait N3 ne valide pas la forme de la réponse ; il ne lit que
  `language`. `confidence` peut manquer ou être du texte.
- **59** : « French » et « fr_CA » ne sont pas normalisés en « fr » ; ils lèvent
  `DetectionUnavailable`. Le code normalise la casse, les espaces et le
  sous-tag après un tiret, pas le nom de la langue ni le tiret bas.
- **76** : le seuil de N1 ne protège pas des textes courts : « chat » passe à
  0,999997.

## Défauts de production

- **62** : client par défaut N3 incompatible avec le kit publié (détail dans le
  tableau), et la boucle de réessai qui attrape toute exception transforme cette
  erreur de programmation en trois appels et une `DetectionUnavailable`.
- **68** : un texte vide ou blanc déclenche un appel payant.
- **69, 70 (JavaScript)** : l'extrait et le plafond comptent en unités UTF-16 ;
  un emoji peut être coupé en deux dans le prompt, et un texte d'emoji est
  refusé à la moitié de la taille annoncée. Python compte en points de code.

## Pour la charte

- Le préfixe `INFIRMÉ` d'un test qui ne vaut que dans un langage (69, 70) : même
  remarque que sur la fiche add-autocomplete, la charte ne dit pas quoi faire du
  nom jumeau.
- La charte pourrait exiger, pour tout extrait N3, un test « texte vide » qui
  compte les appels, et un test « réponse JSON entourée de balises Markdown » :
  c'est la forme la plus fréquente d'une réponse hors format, et elle coûte ici
  le nombre maximal d'appels.
- Le double `FakeLLM` expose `complete`, qui n'existe pas dans le vrai kit : il
  entretient le défaut 62 dans toutes les fiches N3. Le test de forme du vrai
  client est écrit dans chaque fichier de test, faute de double partagé.

## Tour 2 — contre-épreuve

Après `90e0aba` (corrections du rédacteur, tour 1). Tests : n0.py 25, n0.js 29
(inchangés en nombre), n1.py 24 → 25, n1.js 24 → 25, n3.py 25 → 32, n3.js 25 →
32 ; 16 tests ajoutés, 5 marqués réécrits sur la nouvelle phrase, 8 renommés,
aucun retiré. Les doubles locaux `RealShapedClient` sont remplacés par
`_harness/fake_sdk.py` / `fake-sdk.mjs`. **Plus aucun marquage.**
`node scripts/test-snippets.mjs detect-language-of-text` : vert.

### Lignes « À retester »

| # | Ligne du tour 1 | Désormais | Test |
|---|---|---|---|
| 2 | N0 breaking_point : « de ses quatre trigrammes, les deux derniers figurent dans le profil anglais, qui les tient de « that » et de « at », et aucun ne figure dans les profils français et espagnol » | démontrée (py, js) : présence dans le profil anglais `[False, False, True, True]` ; aucun dans fr ni es ; les seuls mots de l'échantillon anglais qui produisent « hat » ou « at␣ » sont « that » et « at » ; témoin : fr et es restent à 300, en descend | test_point_de_rupture_de_ses_quatre_trigrammes_les_deux_derniers_sont_dans_le_profil_anglais_aucun_ailleurs |
| 82 | essai, why de « chat » : « dont deux, « hat » et « at », que l'échantillon anglais emploie dans « that » et « at », et qu'aucun des deux autres n'emploie » | démontrée (js) : seul l'échantillon anglais produit l'un des deux trigrammes ; les distances affichées par l'essai sont celles des échantillons des tests | essai : « chat » ressort en anglais avec un écart large, et le cas est marqué en échec |
| 76, 77 | verdict_rationale : « il s'abstient sur « ça va » mais laisse passer « chat » en anglais au-dessus du seuil, et qu'il ne connaît que les langues apprises » | démontrée (py, js) au seuil 0,9 ; l'allemand ressort en anglais au-dessus du seuil, les probabilités ne portent que sur fr, en, es. Ajout : N0 ne se tait pas non plus sur « chat » (écart > 100) | test_verdict_le_seuil_s_abstient_sur_ca_va_mais_laisse_passer_chat_en_anglais_et_ne_connait_que_les_langues_apprises, test_verdict_n0_ne_se_tait_pas_non_plus_sur_chat |
| 52 | N3 breaking_point : « Une confiance écrite par le modèle n'est pas mesurée, et l'extrait n'en lit aucune » | démontrée (py, js) : le prompt ne contient plus « confidence » ; absente, textuelle ou négative, elle ne change pas le code rendu. Les tests « 0,99 puis 0,01 » existants démontrent la suite de la phrase | test_point_de_rupture_l_extrait_ne_lit_aucune_confiance_et_n_en_demande_pas |
| 59 | N3 commentaire : « "fr", "FR", "fr-CA" and the locale form "fr_CA" are all read as "fr". A language name such as "French" is not a code, and is refused below » | démontrée (py, js), scindée : « fr_CA » et « FR_ca » rendent « fr » ; « French » et « français » lèvent `DetectionUnavailable` après un seul appel | test_normalise_les_formes_courantes_d_un_code, test_un_nom_de_langue_comme_french_n_est_pas_un_code_et_il_est_refuse |
| 58 | N3 docstring : « normalise a code the model may write in capitals, with a region or with stray spaces » | démontrée (py, js) | test_normalise_les_formes_courantes_d_un_code |
| 62 | N3 client par défaut | démontrée (py, js) contre le double du harnais, sans méthode `complete` : endpoint `chat.completions`, `model == MODEL == "gpt-4.1-mini"`, `messages == [{role: user, content: prompt exact}]`, `temperature == 0`, un seul appel ; `content` nul → `DetectionUnavailable` après trois appels au kit ; panne du kit retentée deux fois puis réussie, trois pannes → erreur. Python : sans client, `from openai import OpenAI` puis `OpenAI()` est bien appelé (module remplacé dans `sys.modules`). JavaScript : un modèle passé à `providerClient` est celui envoyé | test_production_l_adaptateur_par_defaut_appelle_la_surface_du_vrai_kit, test_production_l_adaptateur_une_reponse_sans_contenu_leve_apres_trois_essais, test_production_l_adaptateur_une_panne_du_kit_est_retentee, test_production_sans_client_le_kit_openai_est_construit_et_appele (py), l'adaptateur, un modèle passé en argument est celui envoyé (js) |
| 62 | « le défaut n'est construit qu'après les contrôles d'entrée » (corrections) | démontrée (py, js) : sans client, texte vide, blanc et trop long ne construisent rien ; témoin js : un texte ordinaire va jusqu'à l'import du kit absent | test_production_le_client_par_defaut_n_est_construit_qu_apres_les_controles_d_entree |
| 68 | texte vide ou blanc | démontrée (py, js), renommé | test_production_un_texte_vide_ou_blanc_ne_coute_aucun_appel |
| 69 | js : emoji à la frontière de l'extrait ; commentaire « Counted in characters, as Python counts them » | démontrée (py, js), renommé | production : un emoji à la frontière de l'extrait n'est pas coupé en deux |
| 70 | js : 5 000 emoji | démontrée (py, js) ; ajout js : 8 000 emoji passent, 8 001 sont refusés, l'extrait envoyé fait 600 emoji | production : cinq mille emoji font cinq mille caractères, pas dix mille |
| — | nouveaux cas : blancs Unicode, 8 001 blancs | démontrée : NBSP, U+3000, U+2028 seuls → `None` sans appel (py, js) ; U+200B seul → un appel (py, js) ; 8 001 espaces → `ValueError` / `RangeError` avant le test de blancheur, 8 000 espaces → `None` sans appel | test_production_espaces_insecables_et_ideographiques_seuls_ne_coutent_aucun_appel, test_production_un_caractere_de_largeur_nulle_seul_n_est_pas_blanc_et_coute_un_appel, test_production_8001_caracteres_blancs_sont_refuses_avant_le_test_de_blancheur |

### Phrases nouvelles ou modifiées

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| T2-1 | N0 docstring | « The idea comes from Cavnar and Trenkle, in 1994 » | non testable : fait bibliographique, sourcé en lecture complémentaire | — |
| T2-2 | N0 docstring | « Each language uses some trigrams far more than others: "ent", "les", "eur" in French… » | démontrée (py, js) : chaque trigramme cité est mieux classé dans sa langue que dans les deux autres | test_chaque_langue_classe_ses_trigrammes_cites_mieux_que_les_autres_langues |
| T2-3 | N0 docstring | « A count grows with the length of the text, a rank does not: the same text repeated four times keeps every rank. And the distance is divided by the number of trigrams, so a long text and a short one land on the same scale » | démontrée (py, js) : compte de « les » multiplié par quatre, profil et distance identiques. Le test d'origine (échantillon répété) est gardé et renommé | test_le_meme_texte_repete_quatre_fois_garde_tous_ses_rangs_et_sa_distance |
| T2-4 | N1 docstring | « Features close to those of N0, n-grams of one to three characters cut at word boundaries » | démontrée (py, js) | test_les_traits_sont_des_n_grammes_d_un_a_trois_caracteres_bornes_aux_mots |
| T2-5 | N1 docstring js | « multinomial naive Bayes is nothing but counting, and fits in this file » | démontrée pour « nothing but counting » (test_le_modele_est_une_table_de_comptes) et « in this file » (aucun import) ; plus aucun nombre de lignes n'est affirmé, aucun test n'en épingle | l'extrait n'importe rien |
| T2-6 | N3 commentaire d'EXCERPT_CHARACTERS | « N0 and N1 already name the language of a single sentence, and the model bills every token past it » | démontrée pour la première moitié par les tests N0 et N1 (« détecte une phrase dans chaque langue », une phrase par langue) ; la facturation au jeton est non testable ici | test_detecte_une_phrase_dans_chaque_langue (n0, n1), test_n_envoie_qu_un_extrait_des_600_premiers_caracteres |
| T2-7 | N3 commentaire | « Pass any object with a `complete(prompt=..., temperature=...)` method » | démontrée (py, js) : tous les tests à `FakeLLM` passent par cette seule méthode | (suite n3) |
| T2-8 | N3 commentaire | « No content at all (a refusal) is as unusable as prose » | démontrée (py, js) | test_production_l_adaptateur_une_reponse_sans_contenu_leve_apres_trois_essais |
| T2-9 | N3 MODEL | « an example id: check the parameters your model accepts » | non testable : conseil ; la valeur envoyée est démontrée (T2 ligne 62) | — |
| T2-10 | N2 unavailable_reason | fastText : 176 langues, Wikipédia et deux autres corpus, CC BY-SA 3.0 ; « un paragraphe par langue suffit à N0 et N1 » ; indices gratuits (Accept-Language…) | non testable : pas de code N2, faits sourcés à l'extérieur. « Un paragraphe par langue suffit » est démontré par les suites N0 et N1, entraînées sur un paragraphe | — |
| T2-11 | N0, N3 retirés | « half a dozen ways », « a fraction of a second », « trente lignes », « what » | retirés : plus d'affirmation, plus de test | — |

### Constat sans marquage, pour le relecteur

- **U+FEFF seul** : Python appelle le modèle (`str.strip` ne retire pas la
  marque d'ordre des octets), JavaScript rend `null` sans appel (`trim` la
  retire). La fiche dit « None when the text is blank » dans les deux
  langages ; une BOM seule n'est pas clairement « blanche », le coût est d'un
  appel. Démontré tel quel dans chaque langage, non marqué.
- U+200B seul coûte un appel dans les deux langages, identiquement.
