# extract-dates-from-text — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/extract-dates-from-text/n{0,1,3}.test.{py,js}`.
Avant : 48 tests. Après : 147 (n0.py 26, n0.js 31, n1.py 22, n1.js 22, n3.py 23,
n3.js 23). Les tests d'origine sont renommés en français, assertions gardées,
sauf le point de rupture N1 d'origine (voir 23). Les quatre tests de l'essai
vivent dans `n0.test.js`.

`node scripts/test-snippets.mjs extract-dates-from-text` : vert, avec les
marquages ci-dessous. Le test DÉFAUT de complexité en Python dure une dizaine de
secondes (voir 17).

Jeu d'entraînement N1 : les seize phrases des tests d'origine (8 jour-mois,
8 mois-jour), inchangées.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « jeudi prochain », « dans quinze jours », « à partir de demain » : il n'y a pas de chiffres à faire correspondre, donc il ne se trouve rien du tout » | démontrée (py, js), témoin : « jeudi 14/03/2024 » est lu | test_point_de_rupture_jeudi_prochain_dans_quinze_jours_et_a_partir_de_demain_ne_rendent_rien |
| 2 | N0 breaking_point | « L'échec est silencieux, une liste vide et non une erreur » | démontrée (py, js) | test_point_de_rupture_l_echec_est_silencieux_une_liste_vide_et_non_une_erreur |
| 3 | N0 breaking_point | « il n'y a pas de chiffres » (cause avancée) | démontrée, et plus large : « dans 15 jours », avec chiffres, ne rend rien non plus | test_point_de_rupture_une_date_relative_avec_des_chiffres_ne_rend_rien_non_plus |
| 4 | N0 breaking_point | « un outil de planification bâti sur ce niveau ne voit jamais la moitié de ce que les gens écrivent » | non testable : « la moitié » est une proportion sans source ni mesure. À sourcer ou à retirer | — |
| 5 | N0 breaking_point, « là et seulement là » | les dates relatives sont ce qui casse | INFIRMÉE en partie : d'autres dates écrites passent en silence, sans être relatives — « March 3, 2024 », « 1ER MARS 2024 », un mois en NFD (voir 20, 21, 22) ; et à l'inverse des nombres qui ne sont pas des dates sont lus comme des dates (voir 13) | tests DÉFAUT 13, 20, 21, 22 |
| 6 | N0 name | « Une expression régulière par format, puis validation calendaire » | démontrée (py, js) | test_lit_les_trois_formats_dans_une_phrase |
| 7 | N0 commentaire MONTHS / _fold | « Month names in French and English » ; « so that "février" and "fevrier" reach the same entry » | démontrée (py, js) en NFC ; voir 22 pour NFD | test_lit_les_mois_en_lettres_avec_et_sans_accents_en_francais_et_en_anglais |
| 8 | N0 commentaire _full_year | « Two-digit years on the usual pivot: 69 reads as 2069, 70 as 1970 » | démontrée (py, js). Constat hors fiche : une année écrite sur quatre chiffres mais inférieure à 100 (« 01/01/0024 ») passe aussi par le pivot et devient 2024 | test_les_annees_sur_deux_chiffres_suivent_le_pivot_69_2069_70_1970 |
| 9 | N0 docstring / scenario | « 31/02/2024 lui correspond parfaitement, et 29/02/2023 aussi » ; « 31/02/2024 a toutes les apparences d'une date sans en être une » | démontrée (py : `NUMERIC.fullmatch` ; js : l'expression n'est pas exportée, démontré par le 28/02 lu et le 31/02 refusé) | test_l_expression_reguliere_accepte_31_02_2024_et_29_02_2023_le_calendrier_les_refuse |
| 10 | N0 docstring / verdict | « la règle du siècle qui fait de 1900 une année commune » ; « 31/02/2024 et 29/02/1900 sont écartés » | démontrée (py, js) | test_annees_bissextiles_regle_du_siecle_comprise |
| 11 | N0 docstring js | « `new Date(2024, 1, 31)` does not fail, it quietly rolls over to 2 March. The only honest check is to build the date and read its parts back » | démontrée (js) | new Date(2024, 1, 31) glisse au 2 mars, et l'extrait refuse le 31/02/2024 |
| 12 | N0 docstring / scenario | « 03/04/2024 […] l'appelant le tranche une fois » ; « 03/04/2024 en désigne deux » ; commentaire « ISO order, whatever the local habit is » | démontrée (py, js) | test_jour_ou_mois_d_abord_c_est_l_appelant_qui_tranche, test_l_ordre_iso_ne_depend_pas_de_la_convention |
| 13 | N0 commentaire NUMERIC | « Years are two or four digits, never three: that is what keeps "1.2.3" out » | démontrée au sens littéral (« 1.2.3 » et « 1.2.345 » rejetés). Mais la raison est mal dite : « 1.2.3 » a une année sur un chiffre. Et DÉFAUT (py, js) : l'année sur deux chiffres fait lire « version 2.1.24 » comme le 2 janvier 2024 et « 10.1.1.24 » comme le 1er janvier 2024 | test_les_nombres_ordinaires_restent_intacts, test_defaut_un_numero_de_version_a_deux_chiffres_de_fin_est_lu_comme_une_date |
| 14 | N0 commentaire de chevauchement | « A match that overlaps an accepted one is a second reading of the same characters, not a second date » | démontrée (py, js) | test_un_passage_qui_chevauche_une_date_retenue_n_est_pas_une_seconde_date |
| 15 | N0 docstring | « Deterministic, standard library only » / « no dependency » ; « the whole of it fits on a screen » | démontrée pour le déterminisme et les imports ; « tient sur un écran » non testable | test_l_extrait_est_deterministe_et_n_importe_que_la_bibliotheque_standard |
| 16 | N0 escalate_when | « La convention unique que vous passez à l'extrait est alors fausse pour une partie du fichier, et elle rend des dates plausibles » | démontrée (py, js) : la facture américaine du 04/05/2024 ressort au 4 mai | test_escalate_when_une_convention_unique_rend_des_dates_plausibles_mais_fausses_sur_un_corpus_mixte |
| 17 | N0 production | 15 000 dates dans un texte | py : DÉFAUT, le test de chevauchement compare chaque passage à toutes les dates déjà retenues (quadratique) : environ 9 s sur la machine de test pour 15 000 dates, 16 s pour 20 000 ; js : sous la borne de 3 s (même algorithme quadratique, moteur plus rapide) | test_defaut_quinze_mille_dates_depassent_une_borne_large / production : quinze mille dates tiennent dans une borne large |
| 18 | N0 production | chaîne vide, texte blanc ; motif pathologique pour l'expression régulière | démontrée (py, js) | test_production_chaine_vide_et_texte_sans_chiffre, test_production_un_motif_pathologique_termine_dans_une_borne_large |
| 19 | N0 production | espace insécable, espace fine insécable, BOM, largeur nulle ; « 3 AVRIL 2024 » | démontrée (py, js) | test_production_espaces_insecables_bom_et_largeur_nulle_autour_de_la_date, test_production_casse_mixte_dans_le_nom_du_mois |
| 20 | N0 production | « LE 1ER MARS 2024 » | DÉFAUT (py, js) : `(?:er)?` est sensible à la casse, rien n'est trouvé | test_defaut_1er_en_capitales_n_est_pas_lu |
| 21 | N0 production | « Payment due March 3, 2024. » | DÉFAUT (py, js) : la forme anglaise ordinaire d'un mois en lettres n'est pas reconnue, en silence, alors que l'extrait annonce les mois anglais | test_defaut_la_forme_anglaise_mois_jour_annee_n_est_pas_lue |
| 22 | N0 production | « 1er février 2024 » (NFD) | DÉFAUT (py, js) : l'accent combinant n'est pas une lettre pour l'expression, le mot est coupé avant que `_fold` / `fold` ne replie l'accent | test_defaut_un_mois_en_accents_decomposes_n_est_pas_lu |
| 23 | N0 production | chiffres pleine chasse « １２/０３/２０２４ » | py : démontrée (`\d` Unicode) ; js : DÉFAUT, `\d` ASCII, rien n'est lu. Les deux extraits divergent | test_production_des_chiffres_pleine_chasse_sont_lus_dans_les_deux_langages / DÉFAUT : des chiffres pleine chasse ne sont pas lus en JavaScript |
| 24 | N0 production | 31/12/9999, jour 00, mois 13, 31/01, 32/01 | démontrée (py, js) | test_production_valeurs_aux_limites_du_calendrier |
| 25 | verdict_rationale | « Ce que ce niveau ne sait pas faire, il ne le fait pas à moitié, il rend une liste vide » | INFIRMÉE (py, js) : sur un document mois-jour lu en jour-mois, N0 rend une date plausible et fausse, ce qu'escalate_when dit lui-même (16). Même constat pour les numéros de version (13) | test_infirme_ce_que_n0_ne_sait_pas_faire_il_rend_une_liste_vide |
| 26 | verdict_rationale | « écartés par une ligne, et le résultat se teste unitairement » | démontrée pour « se teste unitairement » ; « une ligne » est vrai du seul appel `date(...)` en Python, la fonction complète fait quatre lignes en Python et trois en JavaScript : non testable comme tel | — |
| 27 | N1 breaking_point | « Sur « 03/04/2024 » seul, sans une phrase autour à lire, il tranche quand même » | démontrée (py, js) : 4 mars avec le jeu des tests ; témoin : 3 avril entouré de prose française. Le test d'origine (« l'une des deux dates ») ne démontrait rien : il passait quel que soit le sens choisi. Remplacé par l'assertion exacte | test_point_de_rupture_sur_03_04_2024_seul_le_classifieur_tranche_quand_meme |
| 28 | N1 breaking_point | « dans le sens vers lequel penchait le jeu d'entraînement » | démontrée (py, js) : jeu déséquilibré vers jour-mois → 3 avril, vers mois-jour → 4 mars. Nuance : le jeu d'origine est équilibré (8/8), il penche quand même vers mois-jour (py : P = 0,51 contre 0,49) | test_point_de_rupture_sans_contexte_il_tranche_dans_le_sens_ou_penche_le_jeu_d_entrainement |
| 29 | N1 breaking_point | « rend sa supposition avec exactement la forme d'un fait : rien dans la sortie ne dit à l'appelant laquelle des deux il tient » | démontrée (py, js) : même forme de sortie que pour une date tranchée par la règle | test_point_de_rupture_la_supposition_a_exactement_la_forme_d_un_fait |
| 30 | N1 breaking_point | « « 3 avril 2024 », « 12.03.24 » et « 2024-03-12 », que N0 trouvait, ne ressortent plus » | démontrée (py, js), témoin : N0 les trouve | test_point_de_rupture_3_avril_2024_12_03_24_et_2024_03_12_trouves_par_n0_ne_ressortent_plus |
| 31 | N1 breaking_point | « Les dates relatives, elles, restent invisibles » | démontrée (py, js) | test_point_de_rupture_les_dates_relatives_restent_invisibles |
| 32 | N1 name / docstring | « Candidats trouvés par règle, puis classifieur de contexte » ; « La convention n'est pas dans les chiffres, elle est dans la prose autour » | démontrée (py, js) | test_lit_les_memes_chiffres_de_deux_facons_dans_deux_documents |
| 33 | N1 docstring | « ce qui est faux dès l'instant où ce document cite un fournisseur étranger » (N0) ; N1 lit chaque date selon son contexte | démontrée (py, js) : un même document, deux 03/04/2024, N1 rend 3 avril puis 4 mars, N0 deux fois 3 avril | test_un_document_qui_cite_un_fournisseur_etranger_est_lu_date_par_date |
| 34 | N1 docstring | « ne couvre que la forme tout en chiffres à année sur quatre positions, la seule que l'ambiguïté touche » | INFIRMÉE (py, js) : « 03/04/24 » est aussi ambigu (N0 le lit 3 avril ou 4 mars selon la convention), et N1 ne le voit pas | test_infirme_la_forme_a_annee_sur_quatre_positions_est_la_seule_que_l_ambiguite_touche |
| 35 | N1 docstring | « les règles tranchent encore tous les cas qu'elles peuvent trancher seules » ; commentaires « the second field cannot be a month » / « the first field can only be a day » | démontrée (py, js) avec un modèle qui lève s'il est consulté | test_les_regles_tranchent_seules_ce_qu_elles_peuvent_trancher |
| 36 | N1 docstring de context | « with every digit removed. Removing the digits is what stops the classifier memorising the dates » ; WINDOW « characters of context kept on each side » | démontrée pour la suppression des chiffres et la fenêtre de 40 caractères ; l'effet sur l'apprentissage est non testable ici | test_le_contexte_garde_les_mots_et_retire_les_chiffres, test_le_contexte_s_arrete_a_quarante_caracteres_de_chaque_cote |
| 37 | N1 _to_date | « Real calendar validation, kept from N0 » | démontrée (py, js), 1900 compris | test_la_verification_calendaire_de_n0_est_gardee |
| 38 | N1 docstring | « quelques centaines de phrases étiquetées y suffisent » ; « Le modèle est assez petit pour être gardé à côté du code » | non testable : volume sans mesure. Constat : les tests tiennent avec seize phrases, ce qui ne dit rien de la tenue sur un vrai corpus | — |
| 39 | N1 docstring js | « La régression logistique sur des comptes de mots est écrite ici en entier plutôt que tirée d'une bibliothèque » | démontrée (js : aucun import). La version Python tire scikit-learn (TF-IDF sur uni- et bigrammes) : les deux extraits ne font pas le même calcul, mais rendent les mêmes lectures sur tous les cas testés | l'extrait n'importe rien / test_l_extrait_n_importe_que_scikit_learn_et_la_bibliotheque_standard |
| 40 | N1 risks.deterministic / data_egress | `true` ; `none` | démontrée (py, js) | test_deux_entrainements_sur_le_meme_jeu_rendent_les_memes_lectures |
| 41 | N1 risks.testability | `statistical` | non testable : qualification | — |
| 42 | N1 regulatory | « Le corpus d'entraînement est fait de phrases tirées de documents réels » | non testable : usage | — |
| 43 | N1 escalate_when | « Vos textes portent des dates qu'aucune règle ne peut trouver » | démontrée pour le constat (31) ; le conseil est non testable | — |
| 44 | N1 production | texte vide | démontrée | test_production_texte_vide |
| 45 | N1 production | une phrase d'entraînement sans candidat (« Facture du 12.03.24 ») | py : DÉFAUT, `train` lève `AttributeError: 'NoneType' object has no attribute 'span'`, sans dire quelle phrase ; js : démontrée, entraîne sur un contexte vide | test_defaut_une_phrase_d_entrainement_sans_date_candidate_fait_planter_l_entrainement / production : une phrase d'entraînement sans date candidate ne fait pas planter l'entraînement |
| 46 | N1 production | 5 000 dates ambiguës | démontrée : borne large tenue. Constat : en Python, `predict_proba` est appelé une fois par candidat (de l'ordre d'une seconde et demie pour 5 000 sur la machine de test) | test_production_cinq_mille_dates_ambigues_dans_une_borne_large |
| 47 | N1 production | NFD, capitales, espace insécable, BOM | démontrée (py, js) | test_production_accents_decomposes_et_capitales_autour_de_la_date, test_production_espace_insecable_et_bom_autour_de_la_date |
| 48 | N1 production | 13/12, 12/13, 12/12, 00/00 | démontrée (py, js) | test_production_valeurs_aux_limites_des_regles |
| 49 | verdict_rationale | « sa règle ne reconnaît plus que la forme tout en chiffres et qu'il faut garder N0 à côté pour les mois écrits en lettres » | démontrée (py, js) | test_verdict_il_faut_garder_n0_a_cote_pour_les_mois_ecrits_en_lettres |
| 50 | N3 breaking_point | « Le modèle rend « 2024-02-31 » en JSON impeccable, et à côté une date qu'il a fabriquée. La vérification calendaire de N0 doit rester, et elle écarte le jour impossible ; la date inventée passe » | démontrée (py, js) | test_point_de_rupture_2024_02_31_en_json_impeccable_est_ecarte_et_la_date_inventee_passe |
| 51 | N3 breaking_point | « rien dans la réponse ne la signale » | démontrée (py, js) : même un passage absent du document (« 15 mars ») passe | test_point_de_rupture_rien_dans_la_reponse_ne_signale_une_date_absente_du_document |
| 52 | N3 breaking_point | « il peut aussi répondre en prose : l'extrait lève alors une erreur, plutôt que de rendre une liste vide qui affirmerait qu'il n'y avait pas de date » | démontrée pour la prose (py, js), témoin : `[]` rend `[]`. Mais DÉFAUT (py, js) : une liste JSON dont les éléments n'ont pas la forme demandée (clé `day`, date « 12/03/2024 », date avec heure) rend une liste vide silencieuse, exactement ce que la phrase dit éviter | test_point_de_rupture_une_reponse_en_prose_leve_plutot_que_rendre_une_liste_vide, test_defaut_une_liste_d_elements_mal_formes_leve_plutot_que_rendre_une_liste_vide |
| 53 | N3 name | « Extraction structurée par appel à un modèle généraliste » | démontrée (py, js) | test_decode_ce_que_le_modele_annonce |
| 54 | N3 docstring | « la seule de cette fiche qui lise « jeudi prochain » » | non testable : capacité du modèle. La plomberie rend ce que le modèle résout (testé) | test_une_date_relative_resolue_par_le_modele_est_rendue |
| 55 | N3 docstring | « passer une date de référence, parce que le modèle n'a aucune idée du jour qu'il est » ; « Temperature zero » | démontrée (py, js) : jour de référence, consigne JSON et ISO, température 0 ; par défaut, le jour courant | test_envoie_le_texte_le_jour_de_reference_et_la_consigne_a_temperature_zero, test_sans_jour_de_reference_c_est_le_jour_courant_qui_part |
| 56 | N3 production (js) | jour de référence d'un appelant hors UTC | DÉFAUT (js) : `today.toISOString()` convertit en UTC. À Paris le 13 mars 2024 à 0 h 30, l'extrait envoie « today, which is 2024-03-12 », et « demain » sera résolu un jour trop tôt. Exécuté dans un processus fils avec `TZ=Europe/Paris`. Pas de jumeau Python : `today` y est une `date`, sans heure | DÉFAUT : le jour de référence envoyé est le jour UTC, pas le jour de l'appelant |
| 57 | N3 docstring | « brider la taille de l'entrée » ; « it is a cost control » | démontrée (py, js) : 8 000 passe, 8 001 refusé sans appel | test_refuse_une_entree_trop_grande_…, test_production_exactement_8000_… |
| 58 | N3 docstring | « réessayer en cas d'échec » ; « analyser une réponse qui n'est que probablement du JSON valide » | démontrée (py, js) : 3 appels, pas un de plus ; balises Markdown, JSON tronqué, vide, objet, `null` → `ExtractionUnavailable` après 3 appels | test_une_panne_…, test_production_une_reponse_qui_n_est_pas_une_liste_leve_apres_trois_essais |
| 59 | N3 docstring | « vérifier le calendrier lui-même, parce qu'un modèle répondra 2024-02-31 » | démontrée (py, js), 29/02/2024 gardé, 29/02/2023, 29/02/1900 et mois 13 écartés | test_production_valeurs_aux_limites_du_calendrier_dans_la_reponse |
| 60 | N3 docstring de extract_dates | « In production it defaults to a real provider client » | DÉFAUT (py, js) : `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)`, méthode absente du kit publié (`openai` 3.14.0 py, 7.15.0 js, vérifié par l'orchestrateur) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`. Aucun `model` n'est passé. Contre un double à la forme du vrai client, l'erreur est avalée par `except Exception` et ressort en `ExtractionUnavailable` après trois appels | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 61 | N3 risks.data_egress / regulatory | `third-party` ; « c'est le document entier qui part, pas les seules dates » | démontrée (py, js) : 8 000 caractères avec nom et IBAN partent tels quels | test_le_document_entier_part_pas_les_seules_dates |
| 62 | N3 risks.deterministic / testability ; regulatory juridique | `false`, `hard` ; localisation, sous-traitance | non testable : modèle et juridique | — |
| 63 | N3 production | texte vide ou blanc | DÉFAUT (py, js) : un appel payé | test_defaut_un_texte_vide_ne_coute_aucun_appel |
| 64 | N3 production | 5 000 emoji | py : démontrée ; js : DÉFAUT, `text.length` compte 10 000 unités UTF-16, refusé | test_production_cinq_mille_emoji_… / DÉFAUT : cinq mille emoji comptent pour dix mille caractères |
| 65 | N3 production | éléments `null`, chaîne, nombre dans la liste | démontrée (py, js) : écartés sans exception | test_production_des_elements_nuls_ou_d_un_autre_type_sont_ecartes_sans_exception |
| 66 | N3 production | `text` nul ou absent | js : démontrée (chaîne vide) ; py : DÉFAUT pour `null` : `item.get("text", "")` rend `None`, pas une chaîne | test_defaut_un_passage_nul_ou_absent_devient_une_chaine_vide / production : un passage nul ou absent devient une chaîne vide |
| 67 | N3 production, malveillante | le document dicte une date au modèle | démontrée : si le modèle obéit, la date dictée (2099-01-01) passe. C'est le point de rupture 50 ; une vérification que `text` figure dans le document en attraperait une partie | test_production_une_injection_dans_le_document_fait_passer_la_date_qu_elle_dicte |
| 68 | N3 production | NFD, espace insécable, largeur nulle ; `attempts=0` | démontrée (py, js) | test_production_accents_decomposes_…, test_production_zero_essai_leve_sans_appel |
| 69 | verdict_rationale | « à N3 seulement si les échéances de vos textes s'écrivent en relation avec aujourd'hui, en sachant que vous échangerez un test unitaire contre une réponse à relire » | non testable : conseil | — |
| 70 | scenario | « Les dates y sont pourtant écrites dans trois ou quatre formats connus » | non testable : constat d'usage sans source | — |
| 71 | scenario | « la première se tranche avec un calendrier, la seconde avec une convention que le document ne dit pas toujours » | démontrée par 9, 10 et 12 | — |
| 72 | N2 unavailable_reason | « n'apporte rien de plus que N1 sur du texte de gestion » | non testable : pas de code N2, aucune mesure | — |
| 73 | essai, cas 1 | trois formats, trois dates | démontrée (fr, en) | essai : trois formats dans une phrase de compte rendu, trois dates retenues |
| 74 | essai, cas 2 | la date que le calendrier n'a pas est écartée | démontrée (fr, en) | essai : la date que le calendrier n'a pas est écartée, le 1er mars reste |
| 75 | essai, cas 3 et note | « La même écriture pour deux jours différents » ; « La convention jour-mois est un choix de l'appelant » | démontrée | essai : la même écriture donne deux jours différents selon la convention |
| 76 | essai, cas 4, why | « Rien n'est trouvé : il n'y a aucun chiffre à faire correspondre. Et l'échec est silencieux — une liste vide, pas une erreur » | démontrée (fr, en), cas marqué `fails: true` | essai : les échéances relatives ne rendent rien, sans erreur, et le cas est marqué en échec |

## Non testable, et pourquoi

- 4 : « la moitié de ce que les gens écrivent » est un chiffre sans source.
- 15 (en partie), 26 (en partie), 38 : volumes de code ou de données sans mesure
  publiable.
- 41, 62 : qualifications de risque ou juridique.
- 42, 43 (conseil), 69, 70 : usage et conseil.
- 36 (en partie), 54 : effet sur l'apprentissage ou capacité du modèle.
- 72 : niveau sans code.

## Infirmé, et ce que le code fait réellement

- **5** : les dates relatives ne sont pas le seul endroit où N0 casse en silence :
  « March 3, 2024 », « LE 1ER MARS 2024 », un mois en accents décomposés ne
  rendent rien ; et « version 2.1.24 » rend une date.
- **25** : N0 ne « rend une liste vide » que sur ce qu'il ne voit pas. Ce qu'il
  lit mal (convention, numéro de version), il le rend comme une date plausible.
- **34** : l'ambiguïté jour-mois touche aussi les années sur deux chiffres ; N1
  ne les voit pas.

## Défauts de production

- **13** : numéros de version et fins d'adresse IP lus comme des dates.
- **17 (Python)** : filtrage des chevauchements quadratique.
- **20, 21, 22** : « 1ER » en capitales, forme anglaise mois-jour, mois en NFD.
- **23 (JavaScript)** : chiffres pleine chasse ignorés, Python les lit.
- **45 (Python)** : `train` plante sans message utile sur une phrase sans candidat.
- **52** : liste d'éléments mal formés rendue comme « aucune date ».
- **56 (JavaScript)** : jour de référence converti en UTC.
- **60** : client par défaut N3 incompatible avec le kit publié.
- **63** : appel payé sur texte vide.
- **64 (JavaScript)** : plafond compté en unités UTF-16.
- **66 (Python)** : `text` nul rendu `None`.

## Pour la charte

- Un défaut qui dépend du fuseau horaire ne se voit pas sur une machine réglée
  en UTC. La charte pourrait demander, pour tout extrait qui manipule un jour
  « courant », un test exécuté sous un fuseau non UTC (processus fils avec `TZ`,
  sans toucher à l'environnement du test).
- La borne de temps « dix fois ce que vous observez » ne suffit pas à trancher
  un algorithme quadratique qui tient dans un langage et pas dans l'autre (17).
  J'ai posé une borne de 3 s sur 15 000 dates, taille d'un export réaliste, et
  consigné les deux mesures.
- Le point de rupture « là et seulement là » gagnerait à être accompagné d'une
  liste de faux positifs obligatoires pour toute extraction par expression
  régulière : numéros de version, adresses IP, références.
