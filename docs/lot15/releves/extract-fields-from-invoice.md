# extract-fields-from-invoice — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/extract-fields-from-invoice/n{0,1,2,3}.test.{py,js}`.
Avant : 62 tests. Après : 159 (n0.py 18, n0.js 18, n1.py 17, n1.js 17, n2.py 21,
n2.js 28, n3.py 20, n3.js 20). Les tests d'origine sont renommés en français,
assertions gardées. L'essai figé (niveau N2) est testé dans `n2.test.js`, sept
tests.

`node scripts/test-snippets.mjs extract-fields-from-invoice` : vert, avec les
marquages ci-dessous.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Il écrit « N° » là où le premier écrivait « Facture n° », date en toutes lettres, et appelle le montant dû « NET A PAYER » : les trois champs tombent » | démontrée (py, js) sur la facture Nord, témoin : Lambert lue entièrement | test_point_de_rupture_le_fournisseur_suivant_fait_tomber_les_trois_champs |
| 2 | N0 breaking_point | « Deux tombent à vide, et cela se voit » | démontrée (py, js) : numéro et date à `None` | test_point_de_rupture_deux_champs_tombent_a_vide_et_cela_se_voit |
| 3 | N0 breaking_point | « le total revient bien formé et faux, parce que « Sous-total » contient « total » » | démontrée (py, js) : 77,00 ; témoin : « Sous-total » renommé, plus rien. Précision : la ligne d'en-tête de colonne « … Prix Total » est rencontrée avant et écartée faute de valeur | test_point_de_rupture_le_total_revient_bien_forme_et_faux_… |
| 4 | N0 name | « Ancrage sur les libellés, puis expressions régulières » | démontrée (py, js) | test_lit_la_facture_pour_laquelle_il_a_ete_ecrit, test_lit_des_libelles_en_capitales_et_un_montant_groupe |
| 5 | N0 docstring | « Les libellés sont rangés du plus précis au moins précis, parce que « Total TTC » et « Total HT » ne diffèrent que d'un mot et que le mauvais donne un nombre plausible » | démontrée (py, js) : avec « total » seul, 69,00 (HT) | test_les_libelles_sont_ranges_du_plus_precis_au_moins_precis_… |
| 6 | N0 docstring de find_after_label | « A label that appears on a line holding no value is skipped rather than accepted, because a column heading is a label too » | démontrée (py, js) | test_un_libelle_sans_valeur_sur_sa_ligne_est_ignore |
| 7 | N0 commentaire AMOUNT | « Requiring exactly three digits per group is what keeps the pattern from swallowing a quantity and a unit price as one number » | INFIRMÉE (py, js) : « 2 380,50 » (quantité 2, prix 380,50) est lu comme un seul montant, 2 380,50. La règle ne protège que lorsque le prix a moins de trois chiffres avant la virgule | test_infirme_une_quantite_et_un_prix_unitaire_ne_sont_jamais_lus_… |
| 8 | N0 parse_amount | « A comma means French spelling: the dots left are thousands separators » | démontrée (py, js) sur « 1.234,56 », « 82,80 », « 92.40 » ; voir 13 pour « 1,234.56 » | test_parse_amount_lit_les_deux_graphies |
| 9 | N0 docstring | « Aucun modèle, aucun jeu d'entraînement, aucun service » ; risks `none`, `true`, `unit` | démontrée (py : seul `re` ; js : aucun import) | test_l_extrait_n_importe_que_re |
| 10 | N0 docstring | « Deux heures de travail, et vous lisez toutes les factures du fournisseur » | non testable : durée de travail sans mesure | — |
| 11 | N0 escalate_when | « Une facture arrive d'un fournisseur que vous n'aviez pas prévu » | non testable : condition d'exploitation ; le constat est 1 | — |
| 12 | N0 production | document vide, blanc ; 9 Mo ; motif pathologique ; espaces insécable et fine dans le montant ; montants 0,00 / 999,99 / 1 000,00 / 1 234 567,89 / « 12,5 » | démontrée (py, js) | test_production_document_vide_ou_blanc, …_neuf_megaoctets_…, …_motif_concu_…, …_espace_insecable_et_espace_fine_dans_le_montant, …_valeurs_aux_limites_du_montant |
| 13 | N0 production | « TOTAL TTC : 1,234.56 USD » | DÉFAUT (py, js) : lu 1,23 sans erreur (l'expression s'arrête à « 1,23 ») | test_defaut_un_montant_a_l_anglaise_est_lu_sans_erreur_et_faux |
| 14 | N0 production | « Total\u00a0TTC » (espace insécable dans le libellé) | DÉFAUT (py, js) : le libellé précis n'est plus trouvé, « total » seul prend « Total HT » : 69,00 bien formé et faux | test_defaut_une_espace_insecable_dans_total_ttc_rend_le_total_ht |
| 15 | N0 production | avoir « Total TTC -82,80 € » | DÉFAUT (py, js) : 82,80, le signe est perdu | test_defaut_le_total_negatif_d_un_avoir_perd_son_signe |
| 16 | N1 breaking_point | « L'indemnité forfaitaire de recouvrement […] le classifieur la retient » | démontrée (py, js) : 40,00 ; témoin : sans la ligne, 360,00 | test_point_de_rupture_l_indemnite_forfaitaire_de_recouvrement_est_retenue_comme_montant_du |
| 17 | N1 breaking_point | « C'est un montant, seul sur sa ligne, en bas et à droite » | démontrée (py, js) sur les traits | test_point_de_rupture_l_indemnite_a_les_traits_d_un_total_… |
| 18 | N1 breaking_point | « au regard des traits, elle ressemble davantage à un total que le total lui-même » | non testable comme comparaison des traits eux-mêmes ; la conséquence est 16 | — |
| 19 | N1 breaking_point | « Rien dans le jeu d'entraînement ne disait le contraire » (et le test d'origine : « The fix is […] more labelled invoices ») | INFIRMÉE (py, js) : entraîné sur cette facture même, indemnité étiquetée « other » et total étiqueté, le classifieur rend encore 40,00. Ce n'est pas l'absence d'exemple : les traits ne séparent pas les deux lignes | test_infirme_annoter_la_facture_a_indemnite_suffit_a_corriger_la_lecture |
| 20 | N1 name / docstring | « Traits de position et de mise en forme » ; « Ces traits survivent à un changement de fournisseur » | démontrée (py, js) : Nord, jamais vu, lu entièrement ; renommer le libellé ne change rien | test_lit_un_fournisseur_jamais_vu_a_l_entrainement, test_renommer_le_libelle_ne_change_rien |
| 21 | N1 commentaire | « Where the line sits and what it looks like. Never what it says » | démontrée (py, js) : deux lignes de même forme, mots différents, mêmes traits | test_les_traits_ne_lisent_jamais_ce_que_dit_la_ligne, test_les_traits_lisent_la_position_et_la_forme |
| 22 | N1 docstring de extract_fields | « a line the model likes but that holds no value is not an answer » | démontrée (py, js) avec un modèle posé à la main | test_une_ligne_preferee_qui_ne_porte_aucune_valeur_n_est_pas_une_reponse |
| 23 | N1 docstring | « L'entraînement tient en quelques dizaines de lignes étiquetées, le modèle pèse quelques kilooctets, et rien ne se télécharge » (py) ; « la régression logistique est assez courte pour être lue plutôt qu'importée » (js) | démontrée : 21 lignes étiquetées (le bas de « quelques dizaines »), modèle Python sérialisé sous 10 Ko (environ 1,3 Ko), imports `re` et `sklearn` ; js sans import | test_l_entrainement_tient_en_quelques_dizaines_de_lignes_et_le_modele_en_quelques_kilooctets |
| 24 | N1 commentaire js de trainOne | « three lines out of thirty carry a field, and an unweighted fit answers "other" to everything and is right nine times in ten » | non testable sans modifier l'extrait (l'ajustement non pondéré n'existe pas dans le code). Constat : le jeu des tests a 6 lignes étiquetées sur 21, pas 3 sur 30 | — |
| 25 | N1 risks.deterministic / data_egress | `true` ; `none` | démontrée (py, js) | test_deux_entrainements_rendent_les_memes_lectures |
| 26 | N1 risks.testability, regulatory, escalate_when | `statistical` ; « Le jeu d'entraînement contient des factures réelles » ; « plus de mises en page différentes que vous ne pouvez en annoter » | non testable : qualification, usage, condition d'exploitation | — |
| 27 | N1 production | vide, blanc, une seule ligne, 10 000 lignes, espaces insécables dans montant et date | démontrée (py, js) | test_production_document_vide_ou_blanc, …_une_seule_ligne, …_dix_mille_lignes_…, …_espaces_insecables_… |
| 28 | N1 production | « 3 Avril 2024 », « 1 fevrier 2024 » | DÉFAUT (py, js) : `DATE` n'accepte les mois qu'en minuscules accentuées, aucune date | test_defaut_une_date_en_lettres_avec_majuscule_ou_sans_accent_n_est_pas_lue |
| 29 | N2 breaking_point | « le champ revient avec un nombre, un bon score, et aucun drapeau de relecture » | démontrée (py, js) pour la plomberie : une ligne notée 0,96 revient `{value: 120, score: 0.96, review: false}` ; témoin : notée 0,5, relecture | test_point_de_rupture_une_ligne_d_acompte_bien_notee_… |
| 30 | N2 breaking_point | « Sur une facture portant un acompte, mise en page que l'affinage n'a jamais vue, le modèle désigne la ligne de l'acompte comme montant dû et lui donne un score haut » ; « l'erreur score au-dessus de la bonne réponse » | non testable : comportement du modèle. Au sens de la charte, la phrase attribue au modèle ce que le double écrit (0,96 et 0,41 sont posés par le test) : elle est à reformuler comme scénario, pas comme constat | — |
| 31 | N2 breaking_point | « Relever le seuil n'y change rien » | démontrée pour la valeur lue (toujours 120,00 de 0,8 à 0,99). INFIRMÉE (py, js) pour le drapeau : au seuil 0,97, le champ part en relecture ; relever le seuil au-dessus du score de l'erreur la rattrape, au prix de tous les champs notés plus bas | test_point_de_rupture_relever_le_seuil_ne_change_pas_la_valeur_lue, test_infirme_relever_le_seuil_ne_change_rien_au_drapeau_de_relecture |
| 32 | N2 name / verdict | « avec seuil de relecture » ; « un score par champ, donc une file de relecture » | démontrée (py, js) | test_lit_les_trois_champs, test_verdict_un_score_par_champ_donc_une_file_de_relecture |
| 33 | N2 docstrings et commentaires | « The whole page in one pass » ; « A doubtful field is not thrown away: it goes to a human with the score » ; « A number the caller can act on » ; réponse de longueur fausse levée ; « a failed pass is retried, not swallowed » | démontrée (py, js) : une passe, lignes dans l'ordre ; relecture avec valeur et score ; score non numérique, booléen, nul, hors [0, 1], NaN → 0 ; réponse trop courte ou trop longue → `ExtractionUnavailable` ; deux passes au plus | test_envoie_toute_la_page_…, test_un_score_douteux_…, test_un_score_qui_n_est_pas_un_nombre_…, test_une_reponse_trop_courte_ou_trop_longue_…, test_une_passe_tombee_…, test_abandonne_apres_le_dernier_essai_… |
| 34 | N2 commentaire MAX_LINES | « One pass reads one page. Beyond that the model would truncate in silence » | démontrée pour le refus (120 passe, 121 refusé sans passe). Le « au-delà le modèle tronquerait » est non testable ici ; à vérifier : LayoutLMv3 est limité en jetons (512 positions), pas en lignes, et 120 lignes de facture dépassent vraisemblablement cette limite. Le plafond ne protège donc pas de la troncature qu'il annonce | test_refuse_un_document_trop_long_avant_que_le_modele_tourne |
| 35 | N2 docstring de boxes_for | « A box per line, on the thousandth-of-a-page grid » ; indentation et hauteur | démontrée (py, js) | test_les_boites_sont_sur_la_grille_des_milliemes_de_page |
| 36 | N2 seuil | seuil par défaut 0,75, égalité | démontrée (py, js) : un score égal au seuil ne part pas en relecture | test_le_seuil_par_defaut_est_0_75_… |
| 37 | N2 docstring de extract_fields | « In production it defaults to the real model above » | DÉFAUT (py, js) : `LayoutModel` appelle `pipeline("token-classification", model=…)` avec `{"words": lignes, "boxes": boîtes}` et lit `entity_group` ligne par ligne. Documentation vérifiée (transformers, Python ; @huggingface/transformers, JavaScript, via context7) : ce pipeline prend du texte (chaîne ou liste de chaînes) et rend un objet par jeton (`entity`, `score`, `index`, `word`) ; `entity_group` n'apparaît qu'avec `aggregation_strategy` ; LayoutLMv3 s'emploie avec son processeur et l'image de la page (`processor(image, words, boxes=…)`). L'appel du code n'existe pas sous cette forme ; contre un double à la forme du vrai pipeline, l'erreur est avalée par la boucle de réessai et ressort en `ExtractionUnavailable`. L'existence du point de contrôle `Xenova/layoutlmv3-base` n'a pas été vérifiée | test_defaut_le_modele_par_defaut_a_la_forme_du_vrai_pipeline |
| 38 | N2 commentaire | « A base encoder is a starting point, not an extractor: this rung assumes the checkpoint was fine-tuned » | démontrée pour le constat : le point de contrôle nommé est la base (`microsoft/layoutlmv3-base`, `Xenova/layoutlmv3-base`), pas un modèle affiné ; le code tel quel ne peut donc rien étiqueter en `invoice_number`/`date`/`total` | test_le_point_de_controle_nomme_est_la_base_non_affinee |
| 39 | N2 docstring / risks / regulatory | « Les poids restent sur votre machine, et c'est pourquoi une facture n'en sort jamais » ; `own-infra` ; licence du point de contrôle | non testable : le chargement réel n'est pas exécuté ; juridique | — |
| 40 | N2 escalate_when | « Vos factures arrivent en image, sans couche de texte exploitable » | non testable : condition d'exploitation | — |
| 41 | N2 production | document vide (aucune passe, tout en relecture), 120 lignes de 5 000 caractères, espaces insécables, lignes nulles dans la réponse | démontrée (py, js) | test_production_… |
| 42 | N3 breaking_point | « Le modèle renvoie un objet parfaitement valide dont le montant n'apparaît nulle part sur la facture, et le code ne peut pas s'en apercevoir » | démontrée (py, js), témoin : total textuel refusé | test_point_de_rupture_un_objet_valide_dont_le_montant_n_apparait_nulle_part_passe |
| 43 | N3 breaking_point | « Toutes les vérifications portent sur la forme de la réponse, aucune sur sa véracité » | démontrée pour « aucune sur sa véracité » ; mais la forme elle-même n'est vérifiée que pour `total` (voir 49) | test_point_de_rupture_toutes_les_verifications_portent_sur_la_forme |
| 44 | N3 docstring | « le modèle […] voit la colonne dans laquelle se trouve un montant, ce que le texte extrait a déjà perdu » | non testable : capacité du modèle. La plomberie envoie bien l'image en URL de données | test_envoie_le_texte_et_la_page_a_temperature_zero |
| 45 | N3 docstring / commentaires | « réessayer après un échec » ; « analyser une réponse qui n'est que probablement du JSON » ; « Models like to wrap JSON in a code fence […] stripping it is cheaper than another call » ; « A total nobody can compute with is worse than no total » ; « Use null » ; température 0 ; image bornée (« it is a cost control ») | démontrée (py, js) : trois appels au plus ; clôture ```json et ``` retirées en un appel ; prose, non-objet, total textuel, booléen, liste → `ExtractionUnavailable` ; champ absent → null ; 4 000 000 octets passent, 4 000 001 refusés sans appel. Constat : « ```JSON » en capitales n'est pas retiré et lève | test_accepte_la_cloture_…, test_une_panne_…, test_de_la_prose_…, test_un_total_…, test_une_reponse_qui_n_est_pas_un_objet_…, test_refuse_une_image_trop_lourde_…, test_production_cloture_de_code_en_majuscules_leve |
| 46 | N3 docstring | « borner la taille de ce qu'il envoie » | INFIRMÉE (py, js) : seule l'image est bornée ; un texte d'un million de caractères part tel quel | test_infirme_la_taille_de_tout_ce_qui_part_est_bornee_texte_compris |
| 47 | N3 docstring de extract_fields | « In production it defaults to a real provider client » | DÉFAUT (py, js) : `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, image_url=…, temperature=0)`, méthode absente du kit publié (`openai` 3.14.0 py, 7.15.0 js, vérifié par l'orchestrateur) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, l'image en partie de contenu `image_url`, réponse dans `choices[0].message.content`. L'erreur est avalée par la boucle de réessai | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 48 | N3 risks / regulatory | `third-party` ; « Transfert de factures à un sous-traitant » | démontrée (py, js) : texte et image partent ; le reste (`false`, `hard`, localisation, conservation) non testable | test_la_facture_et_son_image_partent_chez_le_fournisseur |
| 49 | N3 production | `invoice_number` entier, `date` en liste | DÉFAUT (py, js) : passent tels quels, seule la forme du total est vérifiée | test_defaut_un_numero_ou_une_date_d_un_autre_type_leve |
| 50 | N3 production | texte vide et image vide | DÉFAUT (py, js) : un appel payé | test_defaut_une_facture_vide_ne_coute_aucun_appel |
| 51 | N3 production, malveillante | le texte dicte un total au modèle | démontrée : si le modèle obéit, le total dicté passe (c'est le point de rupture 42) | test_production_une_injection_dans_le_texte_dicte_un_total_qui_passe |
| 52 | N3 production | NFD, espaces insécables ; totaux 0, négatif, 10^12 | démontrée (py, js) | test_production_accents_…, test_production_totaux_aux_limites |
| 53 | verdict_rationale | « N0 tient pour un fournisseur et tombe au suivant, N1 prend pour le montant dû une mention légale […], et N3 rend une réponse dont la forme se vérifie mais pas la véracité » | démontrée par 1, 16 (test_verdict_n1_prend_pour_le_montant_du_…) et 42 | test_verdict_n1_prend_pour_le_montant_du_une_mention_legale_de_bas_de_page |
| 54 | verdict_rationale | « c'est le seul niveau qui la lise sans qu'on la lui décrive » ; « ce niveau ne vous met pas à l'abri d'une erreur sûre d'elle » ; « Si vous recevez de trois fournisseurs qui ne changent jamais de gabarit, N0 reste la réponse » | non testable : comportement du modèle réel (non exécuté, et le code par défaut ne tourne pas, 37) et conseil | — |
| 55 | scenario | « le PDF a déjà rendu son texte et […] trois champs suffisent » ; « chaque fournisseur range sa page à sa façon » | non testable : description du besoin | — |
| 56 | essai, cas 1 à 5 | fournitures lues sans relecture ; seuil 0,99 → trois relectures ; en-tête désigné → rien lu, relecture ; une passe tombe → « 2 passes » ; 121 lignes → refus avant la première passe | démontrée (fr ; fr et en pour le cas 1) | essai : … (six tests) |
| 57 | essai, note | « rien n'a quitté la machine : les poids sont en local » | non testable : le double tourne en local, pas le modèle | — |
| 58 | essai, cas 6 | « le code rend 120,00, l'acompte déjà versé, avec un score de 0,96 et aucun drapeau de relecture » | démontrée ; cas marqué `fails: true` | essai : la facture à acompte rend 120,00 sans drapeau… |
| 59 | essai, cas 6, why | « Le montant dû est de 360,00 » | INFIRMÉE : la facture de l'essai porte « Acompte versé 120,00 » puis « Solde à régler 240,00 » (en : « Balance to pay 240.00 ») ; le montant dû est 240,00, 360,00 est le total TTC. Le même flou se retrouve dans le point de rupture N2 (« la bonne réponse ») et dans le test d'origine (`!= 360.00`) | INFIRMÉ : l'essai dit « Le montant dû est de 360,00 »… |
| 60 | essai, cas 6, why | « Relever le seuil n'y change rien, l'erreur score au-dessus de la bonne réponse » ; « cette mise en page ne figurait pas dans son affinage, et il s'est trompé avec assurance » | INFIRMÉE pour le seuil (31) ; non testable pour le modèle (30) | — |

## Non testable, et pourquoi

- 10 : durée de travail.
- 11, 26, 40 : conditions d'exploitation, qualification, usage.
- 18 : comparaison qualitative des traits ; sa conséquence est testée.
- 24 : l'ajustement non pondéré n'existe pas dans le code, et les proportions
  citées ne sont pas celles du jeu des tests.
- 30, 44, 54, 57, 60 (en partie) : comportement du modèle, écrit par le double
  dans les tests. La charte le dit : une affirmation qui attribue au modèle ce
  que le double écrit est fausse ; 30 et 60 sont à reformuler.
- 34 (en partie), 39 : chargement réel non exécuté ; la limite de 512 jetons de
  LayoutLMv3 est à vérifier par le rédacteur.

## Infirmé, et ce que le code fait réellement

- **7** : `AMOUNT` avale « 2 380,50 » (quantité puis prix à trois chiffres).
- **19** : annoter la facture à indemnité ne corrige pas N1 : même entraîné sur
  elle, il rend 40,00. Le remède « plus de factures annotées » est faux pour ce
  cas ; il faudrait un autre trait.
- **31, 60** : relever le seuil au-dessus du score de l'erreur l'envoie en
  relecture ; ce qu'il ne change pas, c'est la valeur lue.
- **46** : le texte envoyé à N3 n'est pas borné.
- **59** : sur la facture à acompte, le montant dû est 240,00, pas 360,00.

## Défauts de production

- **13, 14, 15 (N0)** : montant à l'anglaise lu 1,23 ; espace insécable dans
  « Total TTC » qui fait retomber sur le HT ; signe d'un avoir perdu.
- **28 (N1)** : date en lettres avec majuscule ou sans accent ignorée.
- **37 (N2)** : modèle par défaut appelé avec une surface qui n'existe pas, sur
  un point de contrôle non affiné.
- **47, 49, 50 (N3)** : client par défaut incompatible avec le kit ; numéro et
  date non vérifiés ; appel payé sur facture vide.

## Pour la charte

- Les boucles de réessai `except Exception` de N2 et N3 transforment une erreur
  de programmation (méthode absente, mauvais argument) en « service
  indisponible » après plusieurs tentatives. La charte pourrait exiger un test
  qui montre qu'une `AttributeError` / `TypeError` n'est pas retentée.
- Quand un point de rupture N2 ou N3 se démontre avec un double, la charte
  pourrait imposer que la fiche le dise au conditionnel ou comme scénario ; la
  version actuelle (« le modèle désigne… ») se lit comme un constat.
- Les données d'exemple des fiches méritent la même relecture que le code :
  l'essai et le test N2 tiennent 360,00 pour le montant dû d'une facture qui
  affiche « Solde à régler 240,00 ».
