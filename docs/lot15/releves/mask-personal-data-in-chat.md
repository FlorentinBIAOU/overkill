# mask-personal-data-in-chat — relevé du testeur

> **Tour 2 — contre-épreuve : deux marquages restent, à reprendre par le rédacteur.**
> - **DÉFAUT T2-7 (N0, py/js)** : le motif d'IBAN rendu insensible à la casse
>   masque une date ordinaire dont la clé tombe juste par coïncidence :
>   « rendez-vous le 10 mars 2023 pour la signature » → « rendez-vous [iban] la
>   signature » (1,4 % des phrases « le J mars|juin AAAA mot la salle »). La
>   réparation #31 annonçait que la clé écartait ce cas : elle l'écarte le plus
>   souvent, pas toujours.
> - **DÉFAUT T2-20 (N3, py/js)** : une réponse entièrement enveloppée dans une
>   seule clôture ```` ```json ```` n'est pas décodée (charte des tests, décision
>   n° 12, postérieures à la correction) : trois appels payés, puis
>   `MaskingUnavailable`.

Passe 1 du lot 15. Tests : `content/snippets/mask-personal-data-in-chat/n{0,1,3}.test.{py,js}`.
Un test nommé ci-dessous existe dans les deux langages (`test_…` en Python,
`'…'` en JavaScript), sauf mention « py seul » ou « js seul ».

`node scripts/test-snippets.mjs mask-personal-data-in-chat` : vert. 45 tests
existaient ; tous renommés en français, assertions gardées. Deux assertions ne
démontraient presque rien et ont été resserrées : `"[phone]" not in mask("O6 I2 34 56 78")`
(passerait pour n'importe quelle sortie sans l'étiquette) devient une égalité
exacte avec témoin ; `is_hiding_contact_details(model, …, threshold=0.0)` seul
(vrai pour tout modèle) est complété par la monotonie du seuil. 104 tests
ajoutés (149 au total).

Marquages : N0 — 3 `INFIRMÉ` et 5 `DÉFAUT` en Python, 3 `INFIRMÉ` et 6 `DÉFAUT`
en JavaScript ; N1 — 2 `INFIRMÉ` et 1 `DÉFAUT` en Python, 2 `INFIRMÉ` et 3
`DÉFAUT` en JavaScript ; N3 — 1 `INFIRMÉ` et 3 `DÉFAUT` en Python, 1 `INFIRMÉ`
et 4 `DÉFAUT` en JavaScript.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « zéro six douze » » / « Spelled-out digits » | démontrée : sortie identique à l'entrée ; témoin « 06 12 34 56 78 » masqué | test_point_de_rupture_les_chiffres_en_lettres_passent_au_travers |
| 2 | N0 breaking_point | « « O6 I2 34 » avec des lettres à la place des chiffres » | démontrée, avec témoin | test_point_de_rupture_les_chiffres_sosies_passent_au_travers |
| 3 | N0 breaking_point | « ou des emojis intercalés » | démontrée (« 06🙂12🙂34🙂56🙂78 »), avec témoin | test_point_de_rupture_des_emojis_intercales_passent_au_travers |
| 4 | N0 breaking_point | « le motif d'IBAN n'a pas de somme de contrôle : une référence de commande écrite « DE 12 3456 7890 1234 » est masquée à tort » | démontrée : somme ISO 13616 invalide (reste 24), masquée `[iban]` ; témoins : sans lettres de pays rien n'est masqué, un IBAN valide est masqué pareil | test_point_de_rupture_une_reference_de_commande_est_masquee_comme_un_iban |
| 5 | N0 escalate_when | « Vos utilisateurs contournent activement le filtre, et vous le voyez dans les messages signalés » | non testable : observation d'exploitation | — |
| 6 | N0 name | « Normalisation puis expressions régulières » | démontrée (#10 à #16) | — |
| 7 | N0 docstring | « Deterministic » ; risks `deterministic: true` | démontrée | test_n0_est_deterministe |
| 8 | N0 docstring py / js | « standard library only » / « no dependency » ; `vendor_lock: none` | démontrée (imports {re, unicodedata} ; aucun import JS) | test_n0_n_emploie_que_la_bibliotheque_standard / 'n0 n'emploie aucune dépendance' |
| 9 | N0 docstring, latency, scenario | « fast enough that you will never find it in a profile » ; `<1 ms` ; « en une fraction de milliseconde » | démontrée pour `<1 ms` et « fraction de milliseconde » (mesuré 0,005 ms py, 0,003 ms js) ; « jamais dans un profil » non testable | test_un_message_se_masque_en_une_fraction_de_milliseconde |
| 10 | N0 docstring | « Compatibility folding brings full-width digits […] back to their plain forms » | démontrée (« ０６ １２ ３４ ５６ ７８ » et « ＠ ») | test_le_repli_de_compatibilite_ramene_les_chiffres_pleine_largeur |
| 11 | N0 docstring + commentaire | « the narrow spaces of French typography » ; « The space characters French typography puts inside numbers, plus the word joiner » | démontrée pour U+00A0, U+2007, U+2009, U+200A, U+202F, U+2060 | test_la_normalisation_replie_les_espaces_de_la_typographie_francaise |
| 12 | N0 docstring | « the invisible joiners it leaves behind are turned into a space » | INFIRMÉE : seul U+2060 (word joiner) l'est ; U+200D (zero width joiner), que NFKC laisse aussi, reste, et « 06‍12‍34‍56‍78 » passe en clair | test_les_liants_invisibles_deviennent_une_espace |
| 13 | N0 docstring | « normalisation only changes how a character is written […] stripping punctuation would destroy the very characters an email address is made of » | démontrée pour la partie adresse (« jean.du-pont+chat@exemple.fr » intact puis masqué) ; voir DÉFAUT #29 sur ce que NFKC change d'autre | test_la_normalisation_garde_les_caracteres_d_une_adresse |
| 14 | N0 docstring | « each pattern tolerates the separators people actually type inside a number, instead of assuming one canonical form » | INFIRMÉE : « 06/12/34/56/78 » et « 06 12  34 56 78 » (double espace) passent en clair | test_chaque_motif_tolere_les_separateurs_reellement_tapes |
| 15 | N0 commentaire | « 0X XX XX XX XX, or +33 X XX XX XX XX. The separator […] may be a space, a dot or a dash, or absent » | démontrée (six écritures, sortie exacte) | test_masque_un_numero_avec_espace_point_tiret_ou_sans_separateur |
| 16 | N0 commentaire | « IBAN: two letters, two check digits, then up to thirty alphanumerics » | INFIRMÉE : le motif en accepte 10 à 28 ; l'IBAN russe valide `RU0304452522540817810538091310419` (29 après la clé, 33 au total) passe en clair. Témoin : 28 après la clé (Sainte-Lucie) masqué | test_un_iban_compte_jusqu_a_trente_caracteres_apres_la_cle, test_un_iban_de_vingt_huit_caracteres_apres_la_cle_est_masque |
| 17 | N0 commentaire | « conventionally grouped in fours » | démontrée (IBAN groupé ou collé masqué) | test_masque_un_iban_espace_ou_non |
| 18 | N0 commentaire | « Order matters: an email may contain digits that would otherwise be read as the start of a phone number » | démontrée : « jean0612345678@example.com » → `[email]` ; py seul : dans l'ordre inverse, « jean[phone]@example.com » | test_l_ordre_des_motifs_compte_pour_une_adresse_qui_contient_un_numero |
| 19 | N0 mask | « A label beats a row of asterisks: whoever reads the thread later can see that a phone number was removed » | démontrée : trois étiquettes distinctes | test_une_etiquette_nomme_ce_qui_a_ete_retire |
| 20 | N0 test (existant) | masque une adresse ; laisse le texte ordinaire ASCII intact | démontrée | test_masque_une_adresse_electronique, test_laisse_le_texte_ordinaire_intact |
| 21 | Essai, cas 1 à 3 | « Un téléphone et un email », « Un IBAN au milieu d'une phrase », « Un numéro collé, sans espaces » | démontrée en fr et en en, sortie exacte | test_l_essai_masque_ses_trois_premiers_cas_et_laisse_passer_le_numero_en_lettres |
| 22 | Essai, cas 4 | « Rien n'est masqué : la règle cherche des chiffres, et il n'y en a aucun » | démontrée : aucune chiffre dans la saisie fr ni en, sortie identique | idem |
| 23 | Essai, cas 4 | « Quelqu'un qui veut contourner le filtre le fait en deux secondes » | non testable : comportement humain | — |
| 24 | N0 risks | `data_egress: none`, `testability: unit` | démontrée (garde réseau ; suite unitaire) | toute la suite |
| 25 | N0 cost / footprint / regulatory | `nul`, `negligible`, « le message ne quitte pas votre infrastructure » | non testable : déclaratif et juridique ; l'absence de sortie réseau est démontrée par #24 | — |
| 26 | N0 production | chaîne vide | démontrée | test_production_une_chaine_vide_rend_une_chaine_vide |
| 27 | N0 production | entrée très grande : 1 000 messages (79 Ko) d'un bloc | démontrée : < 1 s, 1 000 `[phone]` et 1 000 `[email]` (mesuré 5 ms py) | test_production_mille_messages_d_un_bloc_terminent_vite |
| 28 | N0 production, malveillante | suite de 30 000 caractères de mot sans `@` | DÉFAUT : temps quadratique | test_defaut_une_longue_suite_de_lettres_se_traite_en_temps_lineaire |
| 29 | N0 production, encodage | message sans coordonnée contenant « … », « m² », « ﬁ », espace insécable | DÉFAUT : ressort réécrit | test_defaut_un_message_sans_coordonnee_ressort_intact |
| 30 | N0 production, encodage | caractères de largeur nulle U+200B, U+00AD dans un numéro | DÉFAUT : le numéro passe | test_defaut_un_caractere_de_largeur_nulle_ne_laisse_pas_passer_un_numero |
| 31 | N0 production, casse | IBAN en minuscules | DÉFAUT : passe en clair | test_defaut_un_iban_en_minuscules_est_masque |
| 32 | N0 production | « +33 (0)6 12 34 56 78 » | DÉFAUT : passe en clair | test_defaut_le_format_international_avec_zero_entre_parentheses_est_masque |
| 33 | N0 production, encodage | adresse accentuée (« josé@ », « marie.hélène@ », composée ou NFD) | démontrée en Python ; DÉFAUT en JavaScript | test_production_une_adresse_accentuee_est_masquee_en_entier (py) / 'DÉFAUT : une adresse accentuée passe en clair ou à moitié' (js) |
| 34 | N0 production, encodage | marque d'ordre des octets, casse mixte d'adresse | démontrée | test_production_marque_d_ordre_des_octets_et_casse_mixte |
| 35 | N0 production, limites | 10 chiffres masqué, 9 et 11 non, « 00 … » non | démontrée | test_production_un_numero_a_exactement_dix_chiffres |
| 36 | N1 breaking_point | « Des homoglyphes venus d'un autre alphabet […] ne portent ni chiffre ni mot connu : rien ne survit à la mise en forme, et le message passe » | démontrée : `shape` ne produit aucun `D`, message non signalé (py 0,44, js 0,01) ; témoin « O6 I2 34 56 78 » signalé | test_point_de_rupture_des_homoglyphes_cyrilliques_passent_au_travers |
| 37 | N1 breaking_point | « ou des chiffres romains » | démontrée (py 0,46, js 0,23), témoin | test_point_de_rupture_des_chiffres_romains_passent_au_travers |
| 38 | N1 breaking_point | « Le modèle ne connaît que les contournements qu'on lui a montrés » | démontrée sur un contournement absent du jeu : « null sechs zwölf » non signalé, « zero six twelve thirty four » signalé | test_point_de_rupture_le_modele_ne_connait_que_les_contournements_montres |
| 39 | N1 breaking_point | « rien ne survit à la mise en forme » | démontrée au sens « aucun chiffre » ; précision : les jetons survivent comme mots en minuscules (« об іb зч ») | test_point_de_rupture_des_homoglyphes_cyrilliques_passent_au_travers |
| 40 | N1 escalate_when | « Les contournements changent plus vite que vous ne pouvez étiqueter » | non testable : observation d'exploitation | — |
| 41 | N1 name | « Régression logistique sur la forme des jetons » | démontrée : py `LogisticRegression` de scikit-learn ; js poids + biais sur vecteur haché de 512 cases | test_n1_est_une_regression_logistique_de_bibliotheque (py) / 'n1 est écrit en entier, sans dépendance, avec un vecteur haché de taille fixe' (js) |
| 42 | N1 docstring | « Celui-ci en voit la forme : une suite de jetons surtout faits de chiffres » | démontrée | test_la_mise_en_forme_replie_chiffres_et_sosies |
| 43 | N1 docstring | « posés à côté de mots comme « call » ou « reach » » | démontrée au sens : « call me on N » pèse plus que « the code is N ». Précision : le numéro seul pèse encore plus (py 0,697 seul, 0,683 avec call, 0,652 avec mots neutres) | test_des_chiffres_poses_a_cote_de_call_pesent_plus_qu_a_cote_de_mots_neutres |
| 44 | N1 _is_digits_in_disguise | « The token must already contain one real digit […] "loll" would fold to 1011 » | démontrée, témoin « l0ll » → `DDDD` | test_la_mise_en_forme_ne_replie_pas_les_lettres_sans_chiffre_reel |
| 45 | N1 commentaire py | « Case matters for lookalikes, so fold before lowering » | démontrée : « l0 » → `DD`, « L0 » → `l0` | test_la_casse_compte_pour_les_sosies |
| 46 | N1 shape py | « Trained on shapes, it learns what a hidden number looks like » | démontrée : numéro jamais vu « 07 98 76 54 32 » signalé | test_entraine_sur_des_formes_il_attrape_un_numero_jamais_vu |
| 47 | N1 shape py | « A classifier trained on raw text memorises the training phone numbers » | INFIRMÉE sur le jeu du test : le même pipeline sans `shape` signale aussi le numéro jamais vu (0,572 ; 0,667 avec `shape`) | test_un_classifieur_sur_texte_brut_memorise_les_numeros_d_entrainement (py seul) |
| 48 | N1 test (existant) | attrape le numéro en lettres « que N0 laisse passer » ; les sosies ; laisse passer l'ordinaire | démontrée (N0 vérifié sur le même message) | test_attrape_un_numero_en_lettres_que_n0_laisse_passer, test_attrape_les_caracteres_sosies, test_laisse_passer_les_messages_ordinaires |
| 49 | N1 is_hiding | « the threshold is yours to set. Move it towards 1 if a false positive […] towards 0 if letting one through is the worse outcome » | démontrée : nombre de messages signalés décroissant de 0 à 1, tous à 0, aucun à 1, seuil inclusif (py) | test_le_seuil_est_a_vous |
| 50 | N1 test py (existant) | « catches emoji keycaps because they contain real digits » | démontrée dans les deux langages ; N0 les laisse passer | test_attrape_les_emojis_touches_parce_qu_ils_portent_de_vrais_chiffres |
| 51 | N1 docstring py | « Training data is a few hundred labelled messages, not a few million » | non testable : le jeu du test compte 16 messages ; le volume nécessaire en production n'est pas mesurable ici | — |
| 52 | N1 docstring py | « The weights are small enough to keep in the repository » | démontrée sur ce jeu : 15,9 Ko sérialisés | test_les_poids_sont_assez_petits_pour_vivre_dans_le_depot (py seul) |
| 53 | N1 docstring py | « there is no service to run: the model loads with the process » | démontrée (garde réseau) | toute la suite |
| 54 | N1 docstring js | « Written out in full rather than pulled from a library » ; commentaire « hashing trick: no vocabulary to build or ship » | démontrée | 'n1 est écrit en entier, sans dépendance, avec un vecteur haché de taille fixe' (js seul) |
| 55 | N1 docstring js | « logistic regression on hashed character n-grams is forty lines » / « tient en quarante lignes » | INFIRMÉE : n1.js compte 55 lignes de code hors commentaires et lignes vides (la charte des extraits plafonne à 40) | 'INFIRMÉ : « logistic regression on hashed character n-grams is forty lines »' (js seul) |
| 56 | N1 risks | `deterministic: true` | démontrée : deux entraînements, mêmes coefficients | test_n1_est_deterministe |
| 57 | N1 risks | `vendor_lock: library` | démontrée en Python (imports {re, sklearn}) ; en JS aucune bibliothèque | test_n1_est_une_regression_logistique_de_bibliotheque |
| 58 | N1 latency | `<1 ms` par décision | démontrée (mesuré 0,31 ms py, 0,05 ms js) | test_une_decision_prend_moins_d_une_milliseconde |
| 59 | N1 risks / cost / regulatory | `testability: statistical`, `négligeable`, `low`, les deux lignes réglementaires | non testable : déclaratif et juridique | — |
| 60 | N2 unavailable_reason | « pour un gain nul sur des motifs aussi structurés qu'un numéro ou une adresse, que N1 traite déjà » | INFIRMÉE pour les adresses : `shape` retire `@` et `.`, « jean.dupont@example.com » a exactement la forme de « jean dupont example com » ; N1 ne peut pas distinguer une adresse électronique. « un service permanent à exploiter » : non testable | test_n1_distingue_une_adresse_electronique_des_memes_mots |
| 61 | N1 production | message vide ; message de 100 Ko ; un jeton de 100 000 caractères | démontrée : décision définie, < 2 s | test_production_un_message_vide_rend_une_decision, test_production_un_message_de_cent_ko_termine_vite |
| 62 | N1 production, encodage | chiffres pleine largeur | démontrée en Python (`DD`) ; DÉFAUT en JavaScript | test_production_les_chiffres_pleine_largeur_sont_replies (py) / 'DÉFAUT : les chiffres pleine largeur ne sont pas repliés' (js) |
| 63 | N1 production, encodage | « zéro » en NFD | DÉFAUT | test_defaut_un_chiffre_en_lettres_decompose_est_reconnu |
| 64 | N1 production, vide | jeu d'entraînement vide | démontrée en Python (`ValueError`) ; DÉFAUT en JavaScript | test_production_un_jeu_d_entrainement_vide_est_refuse (py) / 'DÉFAUT : un jeu d'entraînement vide est accepté' (js) |
| 65 | N3 breaking_point | « Le modèle peut répondre n'importe quoi, y compris de la prose là où du JSON était demandé » | non testable : comportement du modèle. La plomberie qui en découle : #66 | — |
| 66 | N3 breaking_point | « Le comportement dangereux serait […] de renvoyer le message intact […] L'extrait lève une erreur » | démontrée pour la prose (témoin : réponse bien formée masquée) ; INFIRMÉE pour une liste JSON de mauvaise forme (#67) | test_point_de_rupture_une_reponse_en_prose_leve_une_erreur_plutot_que_de_laisser_passer |
| 67 | N3 breaking_point | idem, réponse `[{"value": …, "type": …}]`, `["06 12 34 56 78"]`, `[1, 2]` | INFIRMÉE : voir détail | test_point_de_rupture_une_liste_json_de_mauvaise_forme_leve_une_erreur_nommee |
| 68 | N3 docstring | « réessayer après un échec » | démontrée : 2 pannes puis succès en 3 appels ; 10 pannes → exactement 3 appels puis `MaskingUnavailable` avec le message du fournisseur ; `attempts=1` → 1 appel | test_une_panne_est_retentee_le_nombre_de_fois_annonce_pas_une_de_plus |
| 69 | N3 docstring + commentaire | « plafonner la taille de l'entrée » ; « Refusing oversized input is not an optimisation, it is a cost control » | démontrée : 8 001 refusé avant appel, 8 000 accepté | test_refuse_une_entree_trop_grande_avant_de_depenser_quoi_que_ce_soit |
| 70 | N3 commentaire | « A model charges by the token » | non testable ici ; précision : le plafond compte des caractères (Python) ou des unités UTF-16 (JS), pas des jetons (#80) | — |
| 71 | N3 docstring | « analyser une réponse qui n'est que probablement du JSON valide » | démontrée : `null`, objet, chaîne vide, JSON tronqué → `MaskingUnavailable` ; une réponse inutilisable est retentée (3 appels payés) | test_une_reponse_json_qui_n_est_pas_une_liste_vide_tronquee_leve_l_erreur_nommee, test_une_reponse_inutilisable_est_retentee_aussi_et_chaque_essai_est_un_appel |
| 72 | N3 docstring | « C'est l'option vers laquelle on se tourne d'abord » ; « le modèle lui-même n'est pas testable » | non testable : constat d'usage ; méta | — |
| 73 | N3 commentaire | « Replace the longest matches first, so a substring never eats its parent » | démontrée | test_la_plus_longue_correspondance_est_remplacee_d_abord |
| 74 | N3 commentaire js | « Temperature zero, because a masking decision that changes between two identical calls cannot be reviewed » | démontrée pour l'envoi de `temperature: 0` ; que cela rende le modèle reproductible : non testable | test_envoie_le_message_entier_dans_l_invite_a_temperature_zero |
| 75 | N3 risks | `data_egress: third-party` | démontrée : le message part en entier, après les consignes | test_envoie_le_message_entier_dans_l_invite_a_temperature_zero |
| 76 | N3 docstring py | « `client` is injected so this function can be tested without a network call. In production it defaults to a real provider client » | démontrée pour l'injection ; DÉFAUT pour le client par défaut (#77) | test_le_client_est_injecte_pour_tester_sans_reseau |
| 77 | N3 client par défaut | `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)` | DÉFAUT : la méthode `complete` n'existe pas sur le client du kit `openai` | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 78 | N3 risks / cost / latency / regulatory | `deterministic: false`, `testability: hard`, `vendor_lock: provider`, `élevé`, `~1 s`, les trois lignes réglementaires | non testable : comportement et tarif du fournisseur, juridique | — |
| 79 | N3 production | message vide ; message au plafond avec 100 trouvailles ; injection d'invite ; `attempts=0` | démontrée : `""` rendu mais un appel payé quand même ; < 1 s ; le message reste après les consignes, une seule fois ; `MaskingUnavailable` sans appel | test_production_… (quatre tests) |
| 80 | N3 production, encodage | 4 001 emojis | démontrée en Python (accepté) ; DÉFAUT en JavaScript (refusé : 8 002 unités UTF-16) | test_production_le_plafond_compte_des_caracteres_et_pas_des_jetons (py) / 'DÉFAUT : le plafond compte des unités UTF-16' (js) |
| 81 | N3 production | texte signalé absent tel quel du message | DÉFAUT | test_defaut_un_texte_signale_absent_du_message_ne_le_rend_pas_en_clair |
| 82 | N3 production, malveillante | `kind` hors liste | DÉFAUT | test_defaut_une_etiquette_hors_liste_est_refusee |
| 83 | scenario | « le motif d'une adresse électronique n'a pas changé depuis vingt ans, et celui d'un numéro français non plus » | non testable : fait historique à sourcer (RFC 5322 date de 2008, le plan de numérotation français à dix chiffres de 1996) | — |
| 84 | scenario | « On voit régulièrement un appel de modèle généraliste sur chaque message entrant » | non testable : constat d'usage | — |
| 85 | verdict_rationale | « N0 suffit dans l'immense majorité des intégrations » ; « Montez à N1 le jour où vous constatez des contournements délibérés » ; « vous échangeriez un test unitaire contre un jeu d'entraînement » | non testable : jugement. « le coût marginal est nul, rien ne sort, le résultat se teste unitairement » : démontrée par #9, #24 | — |

## Non testable, et pourquoi

- **#5, #40, #84** : observations d'exploitation ou d'usage.
- **#9 (partie)** « vous ne le retrouverez jamais dans un profil » : appréciation ; la mesure (0,005 ms) est au relevé.
- **#23** : comportement humain.
- **#25, #59, #78** : coût, empreinte, régulation, comportement du fournisseur : déclaratif ou juridique.
- **#51** « quelques centaines de messages étiquetés » : le jeu du test en compte 16 ; le volume suffisant en production dépend du trafic réel.
- **#65, #72, #74 (partie)** : ce que fait le modèle (prose, reproductibilité à température zéro). Le double écrit ce qu'on lui dit ; aucune affirmation sur le modèle n'est démontrable ici.
- **#70** « un modèle facture au jeton » : tarif du fournisseur.
- **#83** : fait historique ; à sourcer ou retirer. Ce que je sais sans pouvoir le prouver par un test : la syntaxe d'adresse de la RFC 5322 (2008) reprend la RFC 2822 (2001) et la RFC 822 (1982) ; le plan à dix chiffres date du 18 octobre 1996. « Vingt ans » est vrai mais sous-estimé.
- **#85** : jugement de recommandation.

## Infirmé, et ce que le code fait réellement

- **#12 — N0 docstring : « les liants invisibles qu'il laisse derrière lui deviennent une espace ».** `UNUSUAL_SPACES` contient U+00A0, U+2007, U+2009, U+200A, U+202F et U+2060. Le liant sans chasse U+200D, que NFKC laisse aussi, n'y est pas : `normalise("06‍12")` rend `"06‍12"` et `mask("06‍12‍34‍56‍78")` rend l'entrée intacte. Le pluriel « les liants » est faux : un seul l'est.
- **#14 — N0 docstring : « chaque motif tolère les séparateurs que les gens tapent réellement ».** Le motif tolère exactement un caractère parmi espace, point, tiret, ou rien. « 06/12/34/56/78 » et « 06 12  34 56 78 » (deux espaces) passent en clair. Le commentaire du code, lui, est exact (#15) ; c'est la docstring qui promet plus.
- **#16 — N0 commentaire : « then up to thirty alphanumerics ».** Le motif est `(?: ?[A-Z0-9]){10,28}` : 10 à 28 après la clé, donc 14 à 32 caractères au total. Un IBAN peut en compter 34 (registre SWIFT : 33 pour la Russie). `RU0304452522540817810538091310419`, somme de contrôle valide, passe en clair ; `LC55HEMM000100010012001200023015` (28 après la clé) est masqué.
- **#47 — N1 docstring Python de `shape` : « un classifieur entraîné sur le texte brut mémorise les numéros d'entraînement ».** Sur le jeu du test, le même pipeline (`TfidfVectorizer` char_wb 2-4 + `LogisticRegression`) entraîné sur le texte brut signale « reach me at 07 98 76 54 32 », absent du jeu, avec un score de 0,572. La mise en forme élève la marge (0,667) mais n'est pas ce qui sépare mémoriser de généraliser : les n-grammes de caractères généralisent déjà un peu.
- **#55 — N1 docstring JS : « tient en quarante lignes ».** `n1.js` compte 55 lignes de code hors commentaires et lignes vides. La partie hachage, entraînement et décision (`features`, `train`, `isHidingContactDetails`) en compte 34 ; avec `shape`, `isDigitsInDisguise` et les constantes, 55. La charte des extraits plafonne un extrait à 40 lignes de code utile.
- **#60 — N2 unavailable_reason : « des motifs aussi structurés qu'un numéro ou une adresse, que N1 traite déjà ».** `shape` découpe sur `[^\W_]+` et jette la ponctuation : `shape("write to jean.dupont@example.com") == shape("write to jean dupont example com") == "write to jean dupont example com"`. N1 ne voit pas `@` et ne peut pas reconnaître une adresse électronique, quel que soit le jeu d'entraînement. Il ne traite que les numéros.
- **#67 — N3 breaking_point : « L'extrait lève une erreur » au lieu de renvoyer le message intact.** Vrai pour la prose et pour une réponse qui n'est pas une liste. Faux pour une liste mal formée :
  - `[{"value": "06 12 34 56 78", "type": "phone"}]` (mauvaises clés) : Python et JavaScript rendent `"call 06 12 34 56 78"`, en clair, sans erreur ;
  - `["06 12 34 56 78"]` et `[1, 2]` : JavaScript rend le message en clair (la déstructuration donne `undefined`) ; Python lève `AttributeError: 'str' object has no attribute 'get'`, qui n'est pas `MaskingUnavailable` ;
  - `[null]` : JavaScript lève `TypeError: Cannot destructure property 'text'`.
  C'est exactement le comportement dangereux que la fiche dit éviter.

## Défauts de production

- **#28 — N0, temps quadratique.** `[\w.+-]+@` : à chaque position de départ, le moteur parcourt toute la suite de caractères de mot avant d'échouer faute de `@`. Mesuré en Python : 0,24 s pour 10 000 « a », 0,78 s pour 20 000, 3,1 s pour 40 000 ; en JavaScript : 68 ms, 194 ms, 800 ms. Un jeton long collé dans un fil (clé, empreinte, suite de caractères sans espace) suffit. Test : 30 000 caractères en moins de 0,2 s.
- **#29 — N0, message sans coordonnée réécrit.** `mask("Merci… à bientôt ! La pièce fait 20 m², ﬁn du devis.")` rend `"Merci... à bientôt ! La pièce fait 20 m2, fin du devis."` : NFKC s'applique à tout le message, pas seulement aux numéros. Les points de suspension, les exposants (« m² » → « m2 », « 10³ » → « 103 »), les ligatures, les espaces insécables de la typographie française disparaissent de tout message qui passe par le filtre. Dans l'essai, `diff: true` surligne ces changements comme s'ils étaient des masquages.
- **#30 — N0, caractères de largeur nulle.** U+200B (espace sans chasse) et U+00AD (trait d'union conditionnel) ne sont ni repliés par NFKC ni dans `UNUSUAL_SPACES` : un numéro qui en contient, par copier-coller ou par intention, passe en clair.
- **#31 — N0, IBAN en minuscules.** `[A-Z]` sans drapeau d'insensibilité à la casse : « fr76 3000 6000 0112 3456 7890 189 » passe en clair.
- **#32 — N0, « +33 (0)6 12 34 56 78 ».** Forme courante des signatures : passe en clair (les parenthèses ne sont pas des séparateurs admis).
- **#33 — N0 JavaScript seulement, adresse accentuée.** `\w` sans drapeau `u` ne couvre que l'ASCII : `mask("écris à josé@exemple.fr")` rend l'entrée intacte ; `mask("marie.hélène@exemple.fr")` rend `"marie.hélè[email]"`, qui laisse lire le nom. Python masque les trois formes (`\w` Unicode). Les deux langages divergent sur un cas très fréquent en français.
- **#62 — N1 JavaScript seulement, chiffres pleine largeur.** `/\d/` sans drapeau `u` ne reconnaît pas « ０６ » : `shape("call me on ０６ １２")` rend `"call me on ０６ １２"` en JS et `"call me on DD DD"` en Python ; le message est signalé en Python (0,65), pas en JS (0,11).
- **#63 — N1, NFD.** Ni `shape` Python ni JS ne normalisent : « zéro » décomposé (`zéro`) est coupé en « ze » et « ro » par `[^\W_]+` / `[\p{L}\p{N}]+`, qui excluent la marque combinante, et n'est plus reconnu comme chiffre en lettres. N0 normalise, N1 non.
- **#64 — N1 JavaScript seulement, jeu vide.** `train([], [])` rend des poids nuls et un biais nul ; `isHidingContactDetails(model, "bonjour")` vaut `true` (sigmoïde 0,5 ≥ seuil 0,5) : un modèle mal chargé bloque tout sans erreur. Python lève `ValueError` (scikit-learn : « empty vocabulary »).
- **#77 — N3, client par défaut.** Python construit `OpenAI()` et JavaScript `new OpenAI()`, puis appellent `client.complete(prompt=…, temperature=0)`. Cette méthode n'existe pas sur le client du kit `openai` (vérification de l'orchestrateur, versions 3.14.0 et 7.15.0) ; la surface réelle est `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`, et le paramètre `model`, obligatoire, n'est jamais fourni. Pire : l'`AttributeError` (Python) ou le `TypeError: client.complete is not a function` (JS) est attrapé par `except Exception` / `catch`, retenté trois fois, et sort en `MaskingUnavailable` : en production, le défaut de code se présente comme une panne du fournisseur. Le test passe un double à la forme du vrai kit.
- **#80 — N3 JavaScript seulement, plafond en unités UTF-16.** `message.length` compte les unités UTF-16 : 4 001 emojis font 8 002 et sont refusés en JS, acceptés en Python (4 001 caractères). Aucun des deux ne compte des jetons, alors que le commentaire justifie le plafond par la facturation au jeton.
- **#81 — N3, texte signalé absent du message.** `message.replace(text, …)` ne vérifie pas que `text` figure dans le message. Si le modèle rend « 0612345678 » pour « 06 12 34 56 78 », ou une forme NFC pour un message en NFD, rien n'est remplacé et le message sort en clair, sans erreur.
- **#82 — N3, `kind` non contrôlé.** L'invite restreint `kind` à quatre valeurs, le code n'en vérifie aucune : `[{"text": "06 12 34 56 78", "kind": "<script>"}]` produit `"call [<script>]"`. Un modèle manipulé par le message peut écrire ce qu'il veut dans le texte publié.

## Précisions pour le rédacteur (démontré, mais à resserrer)

- **#39** « rien ne survit à la mise en forme » : les jetons cyrilliques survivent, comme mots en minuscules. Ce qui ne survit pas, c'est un chiffre.
- **#43** : le numéro seul pèse plus que le numéro précédé de « call me on » ; la phrase de la docstring laisse croire que les mots d'appel sont un signal fort, ils ne le sont que face à des mots neutres.
- **Scores N1 autour de 0,5 en Python.** Sur ce jeu, tous les scores Python sont entre 0,37 et 0,70 : chaque décision tient à quelques centièmes (« appelle-moi au zéro six douze trente-quatre » : 0,501 en Python, signalé ; 0,460 en JS, non signalé). Les deux langages n'entraînent pas le même modèle (TF-IDF + L-BFGS contre hachage + descente de gradient) et divergent sur les cas limites.
- **#79** : un message vide coûte un appel au fournisseur.

## Pour la charte

- **Double à la forme du vrai kit** : la charte l'exige, mais `_harness/` n'en fournit pas. J'en ai écrit un dans chaque test N3 (`RealShapedClient`, `realShapedClient`). Il servira à chaque fiche N3 : il a sa place dans `_harness/`.
- **`except Exception` autour de l'appel** : il transforme un défaut de code en « fournisseur indisponible ». La charte pourrait exiger que la boucle de réessai n'attrape que les erreurs du fournisseur et de décodage.
- **Réponse « d'un autre type »** : la charte cite la réponse mal formée, vide, tronquée ; elle devrait citer explicitement la liste JSON bien formée mais aux mauvaises clés, qui est le cas que les extraits laissent passer.
- **Divergence entre langages** : `\w` et `\d` sans drapeau `u` en JavaScript ne couvrent que l'ASCII, contrairement à Python. Tout extrait qui utilise ces classes sur du texte humain devrait être testé sur une lettre accentuée dans les deux langages ; la charte pourrait l'imposer dans « encodage inattendu ».
- **Lignes de code** : la charte des extraits plafonne à 40 lignes utiles ; aucune vérification automatique n'existe. Le test JS #55 compte les lignes hors commentaires ; un contrôle commun serait plus juste.

## Tour 2 — contre-épreuve

Après `0aee1ba` (corrections du rédacteur, tour 1). Tests : n0.py 31 → 42,
n0.js 31 → 42, n1.py 25 → 26, n1.js 24 → 27, n3.py 19 → 30, n3.js 19 → 30.
`node scripts/test-snippets.mjs mask-personal-data-in-chat` : vert, avec deux
marquages `DÉFAUT` par langage (T2-7, T2-20), signalés en tête.

Retirés : n1 py `test_un_classifieur_sur_texte_brut_memorise_les_numeros_d_entrainement`
(la phrase a disparu, remplacée par T2-10) ; n1 py/js
`…distingue_une_adresse_electronique_des_memes_mots` (remplacé par T2-11) ; n1 js
`INFIRMÉ : … forty lines` (remplacé par T2-12) ; n3 py/js
`…le_client_par_defaut_a_la_forme_du_vrai_kit` et les doubles locaux
`RealShapedClient` / `realShapedClient` (remplacés par T2-17, sur
`_harness/fake_sdk.py` / `fake-sdk.mjs`). Aucune autre assertion retirée.

### Lignes « À retester »

| # | Ligne | Désormais | Test |
|---|---|---|---|
| 4 | N0 point de rupture IBAN | démontrée (py, js) : « DE 86 3456 7890 1234 » a une clé valide et est masquée ; témoins : « DE 12 … » et « 86 3456 … » sans pays intacts, un vrai IBAN masqué ; sur les cent clés 00 à 99, seule 86 est masquée | test_point_de_rupture_une_reference_de_commande_est_masquee_comme_un_iban, test_point_de_rupture_sur_les_cent_cles_de_la_reference_une_seule_est_masquee |
| 57 | N1 `vendor_lock: library` (py) | démontrée : imports {re, sklearn, unicodedata} | test_n1_est_une_regression_logistique_de_bibliotheque |
| 47 | N1 docstring de `shape` (py) | phrase remplacée : voir T2-10 | — |
| 60 | N2 unavailable_reason | voir T2-11 | — |
| 55 | N1 docstring js | voir T2-12 | — |
| 77 | N3 client par défaut | démontrée (py, js) : voir T2-17 à T2-19 | — |
| 12, 14, 16, 28–33, 62–64, 67, 80–82 | tests démarqués | renommés pour dire ce qu'ils prouvent (`production : …`, `point de rupture : …`) ; assertions resserrées là où elles toléraient les deux issues (n3 texte absent, étiquette hors liste : `try/except … continue` remplacé par l'erreur exigée et le nombre d'essais ; n1 js jeu vide : `try/catch … return` remplacé par `assert.throws(RangeError)`) | voir T2-1 à T2-9, T2-13 à T2-16 |
| 91 | nouveaux cas N0 | démontrés (py, js) : T2-5 à T2-9 | — |
| 92 | n1 js : une seule étiquette, longueurs différentes | démontrée (py `ValueError`, js `RangeError`), témoin | test_production_un_jeu_d_une_seule_etiquette_ou_de_longueurs_differentes_est_refuse |
| 93 | n3 : content nul, texte vide, non-objet, `kind` hors liste, plafond en points de code | démontrés (py, js) : T2-14 à T2-16, T2-19 | — |
| 94 | Essai, cas 4 | phrase retirée ; le reste du `why` est démontré (#22) | test_l_essai_masque_ses_trois_premiers_cas_et_laisse_passer_le_numero_en_lettres |

### Phrases nouvelles ou modifiées, code modifié

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| T2-1 | N0 docstring (py, js, fr) | « the spaces of French typography, the zero-width characters and the soft hyphen become a plain space » ; commentaire « the soft hyphen, the zero-width space and joiners, the word joiner and the byte order mark » | démontrée (py, js) : U+00A0, U+2007, U+2009, U+200A, U+202F, U+200B, U+200C, U+200D, U+2060, U+00AD, U+FEFF | test_la_normalisation_replie_les_espaces_de_la_typographie_francaise, test_les_caracteres_sans_chasse_et_le_trait_d_union_conditionnel_deviennent_une_espace, test_production_un_caractere_de_largeur_nulle_ne_laisse_pas_passer_un_numero |
| T2-2 | N0 docstring | « The labels are then put into the message as it was written » | démontrée (py, js) : « … », « m² », « ﬁ », espaces fines et insécables gardés autour d'un numéro ; chiffres pleine largeur remplacés en entier ; « ﷺ » (dix-huit caractères après repli) ne décale pas l'étiquette ; js : un emoji hors plan de base avant le numéro non plus | test_les_etiquettes_sont_posees_dans_le_message_tel_qu_il_a_ete_ecrit |
| T2-3 | N0 docstring | « a message with nothing to mask comes back unchanged, apart from the composition of its accents (NFC), which changes nothing on screen » | démontrée (py, js) : message typographié intact ; message NFD rendu en NFC | test_un_message_sans_coordonnee_ressort_inchange_a_la_composition_des_accents_pres, test_production_un_message_sans_coordonnee_ressort_intact |
| T2-4 | N0 docstring + commentaire | « the phone pattern tolerates […] a space, a dot, a dash or a slash, one or two of them » ; « +33 (0)X XX XX XX XX » | démontrée (py, js) : barre, double espace, « . », « / », « +33  (0) 6.12… » masqués ; limite : trois séparateurs (« 06   12 », « 06 . 12 ») non masqués | test_masque_un_numero_avec_espace_point_tiret_barre_ou_sans_separateur, test_le_motif_de_telephone_tolere_un_ou_deux_separateurs_pas_trois, test_production_le_format_international_avec_zero_entre_parentheses_est_masque |
| T2-5 | N0 commentaire | « the account number in groups of four, spaced or not, in either case. The check digits decide, not the pattern » ; « an IBAN is only masked when its check digits add up » | démontrée (py, js) : IBAN russe (33) groupé ou collé ; 15 caractères (Norvège) et 34 masqués ; 14 caractères à clé juste non masqué ; minuscules et casse mixte (« gb82 west … ») masqués | test_un_iban_russe_de_trente_trois_caracteres_est_masque_groupe_ou_non, test_la_cle_decide_pas_le_motif_limites_de_longueur, test_production_un_iban_en_minuscules_est_masque |
| T2-6 | N0 docstring de `iban_prefix` / `ibanPrefix` | « cut at a space: the pattern may swallow the next word » | démontrée (py, js) : « BE68 … 7034 dans », « … abcd ok », « … abc » → l'IBAN seul est masqué, le mot reste | test_production_un_iban_suivi_d_un_mot_est_masque_et_le_mot_reste |
| T2-7 | N0 production (réparation #31) | motif insensible à la casse, clé vérifiée : « le 12 mars 2024 dans la salle » n'est pas masqué | démontrée pour les deux phrases citées ; **DÉFAUT (py, js)** : quand la clé tombe juste par coïncidence, une date ordinaire est masquée. « rendez-vous le 10 mars 2023 pour la signature » → « rendez-vous [iban] la signature ». Mesuré : 195 phrases « le J mars\|juin AAAA {dans, pour, avec, chez, vers, sans, tous} la salle » sur 13 454 (1,4 %). Le point de rupture parle d'une « référence de commande » : le lecteur n'y lit pas qu'une phrase en minuscules sur soixante-dix de ce type perd sa date | test_production_une_phrase_ordinaire_en_minuscules_n_est_pas_masquee ; DÉFAUT : test_defaut_une_date_en_minuscules_n_est_pas_masquee_comme_un_iban |
| T2-8 | N0 commentaire de EMAIL | « The lookbehind starts a match only at the beginning of a word: without it, a long run of letters with no @ takes quadratic time » | démontrée (py, js) : le même motif lu dans le code, regard arrière retiré, est plus de vingt fois plus lent sur 10 000 « a » et plus que double quand la longueur double ; avec le regard arrière, 300 000 « a » < 3 s (mesuré 0,18 s py, 61 ms js) ; une adresse précédée de 10 000 « a » reste masquée | test_sans_le_regard_arriere_une_longue_suite_de_lettres_prend_un_temps_quadratique, test_production_une_longue_suite_de_lettres_sans_arobase_se_traite_vite |
| T2-9 | N0 production (code modifié) | suites longues : 300 000 chiffres, 60 000 blocs de quatre, 100 000 « 06 », « a. » × 100 000 + « @ », 100 000 « ﷺ » ; séquence d'emoji à liant ; chiffres arabes-indiens | démontrée (py, js) : < 3 s chacune (observé ≤ 0,3 s) ; « 👨‍👩‍👧 » conservée ; « ٠٦ ١٢ … » non lu comme numéro, même sortie dans les deux langages | test_production_de_longues_suites_de_chiffres_de_blocs_ou_de_points_se_traitent_vite, test_production_une_sequence_d_emoji_a_liant_est_conservee, test_production_les_chiffres_arabes_indiens_ne_sont_pas_lus_comme_des_chiffres |
| T2-10 | N1 docstring de `shape` (py) | « Every hidden digit becomes the same symbol, whatever its spelling, so the classifier learns what a hidden number looks like rather than which digits it held » | démontrée (py, js) : « 06 12 … », « 07 98 … », « O6 I2 … », « o6 i2 3S … », pleine largeur donnent la même forme et exactement le même score ; témoin : une autre forme, un autre score | test_chaque_chiffre_cache_devient_le_meme_symbole_quelle_que_soit_son_ecriture |
| T2-11 | N2 unavailable_reason | « des motifs aussi structurés qu'un numéro, une adresse électronique ou un IBAN, que N0 masque déjà. Les numéros déguisés, que N0 laisse passer, sont le terrain de N1 » | démontrée (py, js) : N0 masque les trois ; deux numéros déguisés passent N0 et sont signalés par N1 ; constat : N1 ne voit pas une adresse (mise en forme sans `@`). « des poids à télécharger et à tenir à jour » : non testable, niveau sans code | test_n0_masque_numero_adresse_et_iban_n1_attrape_le_numero_deguise_que_n0_laisse_passer |
| T2-12 | N1 docstring js + fr | « hashing the character n-grams, training and deciding take three short functions » | démontrée pour « trois fonctions » : `features`, `train`, `isHidingContactDetails`, seules fonctions avec `isDigitsInDisguise` et `shape` (mise en forme) ; seule la décision lit les poids du modèle. « short » : non testable, appréciation (décision n° 10 : aucun test ne compte plus les lignes) | hacher les n-grammes, entraîner et décider tiennent en trois fonctions (js seul) |
| T2-13 | N1 breaking_point + commentaire de `shape` | « aucun chiffre ne survit à la mise en forme » ; « Compatibility folding first: full-width digits become digits, and a decomposed "zéro" becomes one word again » | démontrée (py, js) : aucun `D` pour cyrillique et romains ; pleine largeur → `DD`, « zéro » NFD = composé | tests de rupture, test_production_les_chiffres_pleine_largeur_sont_replies, test_production_un_chiffre_en_lettres_decompose_est_reconnu |
| T2-14 | N1 commentaire de `train` (js) | « An untrained model would score every message 0.5 and block them all » ; `RangeError` | démontrée (js) : poids nuls → tout message signalé au seuil 0,5, aucun juste au-dessus ; jeu vide, une étiquette, longueurs différentes refusés | un modèle non entraîné donnerait 0,5 à tout message et les bloquerait tous, production : un jeu d'entraînement vide est refusé |
| T2-15 | N3 breaking_point | « Une invite n'est qu'une demande : rien dans la requête n'oblige la réponse à suivre le format voulu » | démontrée pour la requête (py, js) : l'adaptateur n'envoie que `model`, `messages`, `temperature`, sans `response_format` ni schéma. Ce que le modèle répond : non testable | test_point_de_rupture_rien_dans_la_requete_n_impose_le_format |
| T2-16 | N3 breaking_point + docstring + code (`_is_usable` / `isUsable`) | « De la prose, une liste aux mauvaises clés, un texte qui ne figure pas dans le message, une étiquette hors de la liste […] L'extrait vérifie chaque élément, réessaie, puis lève une erreur » ; « check every item of it against the message » | démontrée (py, js) pour les quatre, chacune avec trois appels puis `MaskingUnavailable` ; un bon élément ne fait pas passer un mauvais ; texte vide, `null`, chaîne, nombre, liste, texte numérique refusés ; témoins : les quatre étiquettes demandées acceptées, un texte présent masqué, une mauvaise réponse puis une bonne masque au troisième essai | test_point_de_rupture_une_liste_aux_mauvaises_cles_leve_une_erreur_nommee, …_un_texte_qui_ne_figure_pas_dans_le_message_…, …_une_etiquette_hors_de_la_liste_…, …_un_seul_element_invalide_…, test_production_un_element_a_texte_vide_ou_qui_n_est_pas_un_objet_est_inutilisable, test_production_une_reponse_mal_formee_puis_bien_formee_masque_au_troisieme_essai |
| T2-17 | N3 `ProviderClient` / `providerClient` ; docstring « defaults to a real provider client » ; `MODEL` « an example id » | démontrée (py, js) avec le double du harnais (sans `complete`) : `chat.completions.create`, `model == "gpt-4.1-mini"`, un seul message `user` qui porte l'invite, `temperature: 0`, réponse lue dans `choices[0].message.content` ; le modèle passé est transmis. Sans client : py, `openai` remplacé dans `sys.modules` ; js, crochet de résolution qui remplace le paquet `openai` : le kit est construit et appelé | test_production_l_adaptateur_parle_au_kit_par_chat_completions_create, test_production_l_adaptateur_transmet_le_modele_choisi, test_production_sans_client_le_kit_openai_est_construit_et_appele |
| T2-18 | N3 commentaire | « Pass any object with a `complete(prompt=..., temperature=...)` method » | démontrée (py, js) : le double `FakeLLM` ne reçoit que `prompt` et `temperature` | test_le_client_est_injecte_pour_tester_sans_reseau |
| T2-19 | N3 code + commentaire | « a refusal carries no content: unusable, not empty » ; panne du kit ; plafond « counts characters (code points, as Python does), not tokens » ; « Refusing oversized input before the call » | démontrée (py, js) : `content` nul → trois appels puis `MaskingUnavailable` « no content » ; deux pannes du kit puis succès en trois appels, trois pannes → erreur nommée ; 8 000 emojis acceptés, 8 001 refusés sans appel ; sans client, un message trop long ne part pas. « The provider bills every token of the prompt » : non testable, tarif | test_production_un_content_nul_est_une_reponse_inutilisable_retentee_puis_levee, test_production_une_panne_du_kit_est_retentee_par_l_adaptateur, test_production_le_plafond_compte_des_caracteres_et_pas_des_jetons, test_production_sans_client_un_message_trop_long_ne_part_pas |
| T2-20 | N3 production (charte des tests, décision n° 12) | une réponse entièrement enveloppée dans une seule clôture ```` ```json ```` est décodée ; tout autre écart lève | **DÉFAUT (py, js)** : ```` ```json\n[…]\n``` ```` et ```` ```\n[…]\n``` ```` vont tels quels à `json.loads` / `JSON.parse`, échouent, sont retentés, et sortent en `MaskingUnavailable` après trois appels payés. Les autres écarts (texte avant, texte après, deux blocs, clôture non refermée) lèvent : démontrée | DÉFAUT : test_defaut_une_reponse_enveloppee_dans_une_seule_cloture_json_est_decodee ; test_production_une_cloture_entouree_de_texte_double_ou_non_refermee_leve |
| T2-21 | scenario, verdict_rationale, further_reading, sources | RFC 2822 (2001), dix chiffres (1996), UTS 39 | non testable : faits historiques et bibliographie | — |

### Constats sans marquage

- Le client par défaut est construit avant le contrôle de taille (py et js) :
  sans clé d'API, un message trop long lève l'erreur du kit au lieu de
  `ValueError` / `RangeError`. Aucun appel ne part (démontré, T2-19) ; aucune
  phrase ne dit l'ordre.
- Le motif d'IBAN accepte jusqu'à 35 caractères compacts (un IBAN en compte au
  plus 34) : un 35 à clé juste est masqué. Aucune phrase ne fixe de maximum.
- « 06 12 34 56 78 90 » rend « [phone] 90 » : le regard avant `(?!\d)` ne voit
  pas les chiffres après un séparateur. Inchangé depuis le tour 1, non annoncé,
  sans effet de fuite.
