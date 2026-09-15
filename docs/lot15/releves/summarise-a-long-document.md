# summarise-a-long-document — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/summarise-a-long-document/n{0,1,2,3}.test.{py,js}`.
Avant : 78 tests. Après : 170 (n0.py 24, n0.js 22, n1.py 18, n1.js 18, n2.py 21,
n2.js 21, n3.py 20, n3.js 26). Les tests d'origine sont renommés en français,
assertions gardées. L'essai figé (niveau N3) est testé dans `n3.test.js`, sept
tests.

`node scripts/test-snippets.mjs summarise-a-long-document` : vert, avec les
marquages ci-dessous.

Les chargements par défaut de N2 (`transformers`, `@xenova/transformers`) et de
N3 (`openai`) sont exécutés contre un module à la surface du paquet publié
(`sys.modules` en Python, crochet `module.register` en JavaScript).

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « une phrase dit que l'usine de Rouen fournit toutes les cellules de la ligne de Lyon ; dix phrases plus loin, une autre dit que Rouen ferme fin mars » | démontrée (py, js) : phrases 0 et 10 sur 11 | test_point_de_rupture_deux_passages_eloignes_de_dix_phrases |
| 2 | N0 breaking_point | « La seconde est courte, tardive, et ses propres termes — fermer, fin mars — ne reparaissent nulle part ailleurs, tandis que la digression sur l'entrepôt occupe tout le vocabulaire du document » | démontrée (py, js) : « close », « end », « march » absents ailleurs ; « warehouse » est le mot le plus fréquent. Précision : dix mots, la deuxième plus courte (« Deliveries leave… » en a neuf) | test_point_de_rupture_la_seconde_est_courte_… |
| 3 | N0 breaking_point | « elle est la moins bien notée des onze » | démontrée (py, js) : 0,1136, scores identiques au bit près dans les deux langages | test_point_de_rupture_elle_est_la_moins_bien_notee_des_onze |
| 4 | N0 breaking_point | « et tombe la première, y compris quand on demande huit phrases sur onze » | démontrée (py, js) : absente de 1 à 10 phrases, présente à 11 ; témoin : écrite avec « warehouse » au lieu de « plant », elle entre à huit | test_point_de_rupture_elle_tombe_la_premiere_… |
| 5 | N0 breaking_point | « aucune phrase n'énonce ce qu'elles impliquent ensemble, donc aucune sélection, si large soit-elle, ne peut le rendre » | démontrée (py, js) | test_point_de_rupture_aucune_selection_… |
| 6 | N0 name, docstring | « Résumé extractif : densité des termes et bonus de position » ; « every sentence of the summary appears verbatim in the source, because this code never writes a word » | démontrée (py, js), toutes largeurs | test_chaque_phrase_du_resume_vient_du_document |
| 7 | N0 docstring | « Dividing by the length of the sentence measures density rather than volume, which stops a long sentence from winning by size » | démontrée (py, js) : une phrase de mots de liaison reste dehors ; une phrase répétée deux fois dans une seule a exactement la même densité | test_une_longue_phrase_ne_gagne_pas_par_sa_taille |
| 8 | N0 docstring ; commentaire LEAD_BONUS | « A small bonus that decays with the rank of the sentence » ; « Large enough to break a tie between two equally dense sentences, too small to win on its own » | démontrée (py, js) : trois phrases identiques classées par rang, écart 0,15 − 0,05 ; une ouverture « It is what it is. » n'entre pas | test_le_bonus_d_ouverture_decroit_… |
| 9 | N0 docstring de summarise | « Return the best sentences, in the order the document puts them » | démontrée (py, js) : [0, 1, 3, 4, 8] rendu dans cet ordre, alors que l'ordre des scores est [0, 1, 4, 8, 3] | test_garde_l_ordre_du_document_… |
| 10 | N0 commentaire | « Sorting is stable, so two identical scores keep their document order » | non testable en pratique : le bonus de position rend deux scores exactement égaux quasi impossibles | — |
| 11 | N0 commentaires | « Abbreviations will fool this » ; « `[^\W_]` is `\w` without the underscore, so accented words survive and punctuation does not » ; js : « The Python counterpart writes the same class » ; « scale so the most frequent one weighs one » | démontrée (py, js) : « Dr. » coupe la phrase ; même découpage de mots dans les deux langages sur un échantillon accentué ; « warehouse » pèse 1 | test_les_abreviations_…, test_les_mots_accentues_…, test_le_mot_le_plus_frequent_pese_un |
| 12 | N0 commentaire de score_sentences | « `sum`, which since Python 3.12 compensates rounding error on floats […] is not the answer JavaScript gives, and the two versions of this snippet have to rank sentences identically » | démontrée : `sum([0.1] * 10)` vaut 1.0, la boucle 0.9999999999999999 (Python 3.13) ; les scores de FACTORY sont identiques au bit près en JS | test_la_boucle_simple_et_sum_…, test_point_de_rupture_elle_est_la_moins_bien_notee_… |
| 13 | N0 risks ; scenario ; verdict_rationale | `none`, `true`, `unit` ; « une méthode qui ne reformule pas ne sait que citer » ; « N0, qui ne peut rien inventer parce qu'il ne sait que citer » | démontrée (py : seul `re` ; js : aucun import) | test_l_extrait_n_importe_que_re, test_verdict_n0_ne_peut_rien_inventer_… |
| 14 | N0 escalate_when ; latency | « retoucher à la main le poids donné à l'ouverture » ; « ~10 ms » | non testable | — |
| 15 | N0 production | vide, une phrase, plus de phrases qu'il n'en existe, zéro phrase, 1,7 Mo, insécable / emoji / casse | démontrée (py, js) | test_production_… |
| 16 | N0 production | document NFD | DÉFAUT (py, js) : « réunion » devient « re » + « union », « été » devient « e » + « te » ; les scores changent | test_defaut_un_document_nfd_coupe_ses_mots_accentues |
| 17 | N0 production | document sans ponctuation finale (transcription, liste) | DÉFAUT (py, js) : une seule phrase, rendue en entier (24 499 caractères sur 24 500) | test_defaut_un_document_sans_ponctuation_finale_… |
| 18 | N0 production | nombre de phrases négatif | DÉFAUT (py, js) : -1 rend tout sauf la moins bien notée | test_defaut_un_nombre_de_phrases_negatif_… |
| 19 | N1 breaking_point | « une phrase placée tôt, portant un chiffre, ouverte par « Overall » et reprenant les mots de la première ligne est retenue alors qu'elle annonce une commande de porte-blocs » | démontrée (py, js) : traits (0,5 ; chiffre ; mot-signal ; reprise 0,375), retenue dans les deux premières | test_point_de_rupture_la_phrase_leurre_… |
| 20 | N1 breaking_point | « la vraie trouvaille de l'audit […] n'a aucun de ces signes et reste dehors » | démontrée (py, js). Précision : elle est troisième sur six, sa position vaut 1/3 ; chiffre, mot-signal et reprise sont à zéro | test_point_de_rupture_la_vraie_trouvaille_… |
| 21 | N1 breaking_point | « étiqueter davantage n'y change rien, puisque le sens n'est jamais montré au modèle » | démontrée (py, js) pour l'étiquetage le plus favorable : ce document ajouté cinq fois, leurre coché 0 et trouvaille cochée 1, le leurre reste retenu | test_point_de_rupture_etiqueter_davantage_n_y_change_rien |
| 22 | N1 breaking_point | « sur le document à deux bouts il retrouve bien les deux prémisses, et n'énonce toujours pas la conclusion » | démontrée (py, js) ; témoin : N0 perd la seconde | test_point_de_rupture_il_retrouve_les_deux_premisses_… |
| 23 | N1 name ; docstring de sentence_features | « Notation supervisée des phrases sur cinq traits de surface » ; « where the sentence sits, how long it is, whether it carries a figure, whether it announces a conclusion, and how much of the opening it repeats » ; « the feature saturates » | démontrée (py, js) : cinq traits, saturation à 25 mots | test_cinq_traits_…, test_le_trait_de_longueur_sature_… |
| 24 | N1 docstring | « if, in your corpus, the wrap-up at the end matters more than the opening, the model will find that out and N0 never will » | INFIRMÉE (py, js) : le trait de position vaut 1/(rang+1) et ne peut pas désigner « la dernière » ; ce que le modèle apprend du jeu, c'est le mot-signal (poids 1,25) : la même conclusion sans « Overall » sort du résumé. Et N0 garde déjà cette conclusion sur l'audit : le test d'origine « keeps the wrap-up a fixed lead bonus would drop » n'exécutait pas N0 et ne démontrait pas son nom | test_infirme_le_modele_decouvre_que_la_conclusion_compte_et_n0_jamais |
| 25 | N1 docstring | « the weights are learnt instead of guessed » ; « The features are deliberately surface-level » | démontrée (py) : poids scikit-learn [0,496 ; 0,134 ; 1,281 ; 1,246 ; 1,061], biais −0,944 | test_les_poids_sont_appris_scikit_learn |
| 26 | N1 docstring js | « the objective minimised below is the same one, so both rank a document's sentences alike » ; « The objective is strictly convex, so enough steps land on the one optimum » | démontrée (js) : poids à moins de 2e-3 de ceux de scikit-learn, stables de 4 000 à 20 000 époques ; mêmes résumés sur tous les documents des tests | la descente de gradient atterrit sur l'optimum de scikit-learn |
| 27 | N1 docstring js | « on five features it is a dozen lines » | INFIRMÉE (js) : `train` compte 28 lignes de code (la boucle de descente seule, 13) | INFIRMÉ : la régression logistique « is a dozen lines »… |
| 28 | N1 docstring de train | « a few dozen documents […] an afternoon of work » ; « Nothing here needs a GPU or a corpus » | démontrée pour le second (quatre documents, 24 phrases, `re`, `numpy`, scikit-learn) ; le premier non testable | test_l_entrainement_tient_sur_quatre_documents_… |
| 29 | N1 risks ; regulatory ; escalate_when | `true`, `none`, `statistical` ; corpus d'entraînement ; « aucune phrase du document ne l'énonce » | démontrée pour `deterministic` ; le reste non testable | test_deux_entrainements_… |
| 30 | N1 production | vide, une phrase, zéro phrase, 5 000 phrases | démontrée (py, js) | test_production_… |
| 31 | N1 production | sans ponctuation finale ; nombre négatif | DÉFAUT (py, js), comme 17 et 18 | test_defaut_… |
| 32 | N2 breaking_point | « à qui il fait rendre tour à tour deux résumés du même document : « la ligne de Lyon s'arrêtera quand Rouen fermera fin mars », qui en découle, et « la ligne de Lyon déménagera à Rouen en avril », qui n'y figure nulle part. La fonction rend les deux à l'identique, sans un avertissement » | démontrée (py, js) ; aucun avertissement émis (py) | test_point_de_rupture_la_fonction_rend_le_resume_… |
| 33 | N2 breaking_point | « la seule chose qu'elle sache vérifier d'une réponse est qu'elle n'est pas vide » | démontrée (py, js) : « x », de l'allemand, 60 000 caractères, « {} » passent ; témoin : des espaces lèvent | test_point_de_rupture_la_seule_verification_… |
| 34 | N2 breaking_point | « Ce que le test établit, c'est donc ce que cette plomberie laisse passer, et non ce qu'un vrai modèle écrirait » | conforme à la charte ; rien à tester | — |
| 35 | N2 breaking_point | « dès qu'un document dépasse la fenêtre du modèle, la seconde passe résume les notes que le modèle a écrites, et plus jamais le document » | démontrée (py, js) : le dernier appel ne contient que les notes ; témoin : un document court part en un appel, sur lui-même | test_point_de_rupture_la_seconde_passe_… |
| 36 | N2 production | seconde passe d'un document de 200 000 caractères | DÉFAUT (py, js) : la seconde passe n'est pas découpée ; 67 notes de la taille d'une sortie de bart-large-cnn (`max_length` 142 jetons, environ 600 caractères) partent d'un bloc, environ 40 000 caractères, au-delà de la fenêtre de 1 024 positions que CHUNK_CHARACTERS devait respecter. Le commentaire de CHUNK_CHARACTERS dit que le modèle tronque alors « without saying so » : la seconde passe ne lit que les premières notes, exactement le « summary that is silently half a document » que la docstring dit pire que rien | test_defaut_la_seconde_passe_depasse_la_fenetre |
| 37 | N2 docstring | « it has to be cut at sentence boundaries, summarised piece by piece, and the pieces summarised again » ; chunk : « A sentence longer than the window on its own is passed whole » | démontrée (py, js) : morceaux ≤ 3 000, finissant par un point, sans perte ; limite exacte à 3 000 caractères | test_la_decoupe_…, test_production_limite_de_la_decoupe_…, test_une_phrase_plus_longue_… |
| 38 | N2 docstring | « Every one of those calls can fail or come back empty, and a summary that is silently half a document is worse than no summary at all » | démontrée (py, js) : une passe vide au milieu fait lever, aucun appel après | test_une_passe_tombee_au_milieu_… |
| 39 | N2 docstring | « this one produces a sentence that was not in the document, which is the only way to state a conclusion drawn from two passages ten pages apart » | non testable : modèle | — |
| 40 | N2 commentaire MAX_CHARACTERS | « a document nobody meant to send is still better refused than churned through in silence » | démontrée (py, js) : 200 000 passe, 200 001 refusé sans appel | test_refuse_un_document_trop_long_… |
| 41 | N2 commentaires de _generate ; attempts | « An empty answer is a failure, not a summary » ; réessai | démontrée (py, js) : espaces et `null` lèvent ; réessais comptés ; zéro essai lève sans appel ; une réponse d'un autre type est une panne | test_une_reponse_vide_ou_nulle_…, test_une_panne_…, test_production_zero_essai_…, test_production_une_reponse_d_un_autre_type_… |
| 42 | N2 LocalSummariser | « Loaded once and kept for the life of the process: it is the loading that is slow, not the summarising » | DÉFAUT (py, js) : `summarise` construit un `LocalSummariser` neuf à chaque appel sans modèle injecté ; deux documents, deux chargements | test_defaut_le_modele_par_defaut_est_recharge_a_chaque_document |
| 43 | N2 défaut réel | `pipeline("summarization", model=…)` puis `(text, truncation=True)[0]["summary_text"]` ; js `pipeline('summarization', nom)` puis `[{ summary_text }]` | démontrée : surface de `transformers` et de transformers.js (documentation), points de contrôle `facebook/bart-large-cnn` et `Xenova/distilbart-cnn-12-6` existants, tâche `summarization`, 1 024 positions. Constat : les deux langages ne chargent pas le même modèle (bart-large-cnn en Python, distilbart en JavaScript), alors que la lecture complémentaire présente bart-large-cnn comme « le modèle utilisé au niveau N2 » | test_le_modele_par_defaut_a_la_surface_de_transformers, test_le_modele_nomme_… |
| 44 | N2 risks, regulatory, escalate_when, cost, latency | `own-infra`, `true`, `hard` ; licence ; « il faudrait réaffiner le modèle » ; `modéré`, « >1 s » | non testable : modèle réel non exécuté, juridique, ordres de grandeur | — |
| 45 | N2 production | vide, une phrase, NFD / emoji transmis tels quels | démontrée (py, js). Constat : la découpe écrase les sauts de paragraphe en une espace | test_production_… |
| 46 | N3 breaking_point | « L'instruction « n'utilise que ce que dit le document » est une demande, pas une contrainte » | démontrée (py, js) : la phrase est dans l'invite, et l'invention passe | test_point_de_rupture_la_consigne_… |
| 47 | N3 breaking_point | « du JSON valide, de la bonne forme, de la bonne longueur, fluide, qui annonce un gain sur le temps de traitement des tickets et une seconde phase approuvée par le conseil : ni le conseil ni ce gain ne figurent dans le document » | démontrée (py, js) | test_point_de_rupture_un_json_valide_… |
| 48 | N3 breaking_point | « Tous les contrôles de l'extrait passent, parce qu'ils portent tous sur la forme » | démontrée (py, js), témoin : la même invention en prose lève. Constat : « de la bonne longueur » n'est pas un contrôle, un résumé de dix phrases passe là où trois sont demandées | test_point_de_rupture_tous_les_controles_… |
| 49 | N3 breaking_point | « Ce qui est démontré là, c'est que rien dans l'extrait n'arrête une invention, non qu'un fournisseur en produise une » | conforme à la charte | — |
| 50 | N3 docstring | « Cap the input, because the provider charges by the token » ; « Retry, because the call goes over a network » ; « Refuse an answer of the wrong shape rather than passing half of one » ; résumé vide sans appel | démontrée (py, js) : 40 000 passe, 40 001 refusé ; trois appels au plus ; prose, liste, `null`, chaîne, résumé absent, blanc ou numérique, points clés en chaîne ou nuls → `SummaryUnavailable` ; document vide sans appel. Constat : le plafond compte des caractères (points de code en Python, unités UTF-16 en JS) et non des jetons | test_refuse_…, test_une_panne_…, test_un_json_valide_de_la_mauvaise_forme_leve, test_un_document_vide_…, test_production_constat_le_plafond_… |
| 51 | N3 docstring | « Parse an answer that is only probably the JSON you asked for » | DÉFAUT (py, js) : clôture ```json non décodée, trois appels puis `SummaryUnavailable` | test_defaut_une_reponse_en_cloture_de_code_… |
| 52 | N3 production | points clés qui ne sont pas des chaînes | DÉFAUT (py, js) : convertis au lieu d'être refusés, « {'a': 2} » en Python, « [object Object] » en JavaScript | test_defaut_des_points_cles_qui_ne_sont_pas_des_chaines_… |
| 53 | N3 client par défaut | « In production it defaults to a real provider client » | DÉFAUT (py, js) : `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)`, méthode absente du kit publié (`openai` 3.14.0 py, 7.15.0 js, vérifié par l'orchestrateur) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`. Exécuté contre un module à cette surface : aucune requête ne part, `SummaryUnavailable` (« … 'complete' ») | test_defaut_le_client_par_defaut_…, test_le_client_par_defaut_echoue_… |
| 54 | N3 docstring ; commentaire | « no weights to host, no machine to keep warm, and an answer that follows an instruction » ; « Temperature zero: two identical documents that summarise differently cannot be reviewed, and cannot be cached either » | démontrée pour l'envoi de `temperature=0` et des deux formats demandés ; le reste non testable (modèle) | test_envoie_le_document_… |
| 55 | N3 risks, regulatory | `third-party`, `false`, `hard` ; transfert du document | démontrée pour le transfert (le document est dans l'invite) ; le reste non testable | test_envoie_le_document_… |
| 56 | N3 production | nombre de phrases nul ou négatif | DÉFAUT (py, js) : « at most 0 sentences » part et se paie | test_defaut_un_nombre_de_phrases_nul_ou_negatif_… |
| 57 | N3 production, malveillante | injection dans le document | démontrée (py, js) : transmise telle quelle, l'invention passe | test_production_une_injection_… |
| 58 | essai, note et en-tête | « La réponse du modèle est simulée par le double local qui sert aux tests » ; « Les six cas » | démontrée | essai : six cas… |
| 59 | essai, cas 1 à 5 | rapport de trois phrases (1 appel, 235 / 214 caractères) ; document vide (aucun appel) ; 40 001 caractères (refusé avant le premier appel) ; deux échecs (3 appels) ; prose (réponse rejetée, 3 appels) | démontrée (fr, en) | essai : … |
| 60 | essai, cas 4 et 5 | « 3 appels facturés : les deux premiers ont échoué » ; « 3 appels envoyés et facturés » | non testable : qu'un appel en échec soit facturé dépend du fournisseur ; les nombres d'appels sont démontrés | essai : le fournisseur échoue deux fois… |
| 61 | essai, cas 6 et why | « Le code rend ce résumé sans broncher : il vérifie la forme de la réponse, jamais sa vérité » ; shown : « qui ne parle d'aucun ticket perdu » | démontrée : rendu tel quel ; le rapport ne dit rien d'une perte. « Aucun test de cette fiche ne peut attraper une phrase fluide et fausse » non testable (portée générale) | essai : le modèle résume ce que le document ne dit pas… |
| 62 | scenario | « personne ne le relit contre la source » ; « les niveaux qui font le travail demandé sont aussi les plus chers » | non testable : constat d'usage, ordres de grandeur | — |
| 63 | verdict_rationale | « celui de cette fiche laisse passer un résumé impeccable qui invente un conseil d'administration » | démontrée (47) | — |
| 64 | verdict_rationale | « sans vous coûter un service d'inférence à exploiter, une découpe à surveiller et un réaffinage » ; « deux exécutions ne se ressemblent que tant que le fournisseur garde le même modèle » | non testable ; la découpe à surveiller est illustrée par 36 | — |

## Non testable, et pourquoi

- 10 : égalité de scores quasi impossible avec le bonus de position.
- 14, 28 (en partie), 29 (en partie), 44, 62, 64 : conditions d'exploitation,
  effort, ordres de grandeur, juridique.
- 39, 54 (en partie), 55 (en partie) : comportement d'un modèle.
- 60, 61 (en partie) : facturation d'un fournisseur ; portée générale.

## Infirmé, et ce que le code fait réellement

- **24** : N1 n'apprend pas qu'une conclusion finale compte, il apprend le mot
  « Overall » ; sa position est codée 1/(rang+1). N0 garde d'ailleurs la même
  conclusion.
- **27** : `train` fait 28 lignes, pas une douzaine.
- Précisions : 2 (la phrase de fermeture est la deuxième plus courte), 20 (la
  trouvaille a une position de 1/3), 43 (deux modèles différents selon le
  langage), 48 (la longueur n'est pas contrôlée).

## Défauts de production

- **16, 17, 18 (N0)** ; **31 (N1)** : NFD coupé ; document sans ponctuation
  finale rendu entier ; nombre de phrases négatif accepté.
- **36 (N2)** : seconde passe non découpée, tronquée en silence sur un long
  document.
- **42 (N2)** : modèle rechargé à chaque document.
- **51, 52, 53, 56 (N3)** : clôture de code ; points clés non-chaînes convertis ;
  client par défaut incompatible avec le kit ; nombre de phrases nul payé.

## Pour la charte

- Quand un test porte un nom qui compare deux niveaux (« a fixed lead bonus would
  drop »), la charte pourrait exiger qu'il exécute les deux : ici le nom
  affirmait ce que N0 ne faisait pas.
- Pour un traitement en plusieurs passes, la charte pourrait exiger un test où
  chaque appel au modèle respecte la même borne, passes suivantes comprises ; la
  première passe était bornée, la seconde non.
- Une affirmation « le modèle découvrira X » sur un modèle à traits doit être
  testée en retirant le trait qui corrèle avec X dans les données (ici le
  mot-signal) : c'est ce qui sépare ce que le modèle apprend de ce qu'on croit
  qu'il apprend.
