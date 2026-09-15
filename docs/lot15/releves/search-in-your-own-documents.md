# search-in-your-own-documents — relevé du testeur

> **Contre-épreuve (tour 2) — deux défauts restent marqués, introduits par les
> réparations** (détail en fin de relevé) :
> - **N3 (py, js)** : `_decode` décode une réponse suivie de texte après la
>   clôture ```` ``` ```` et une clôture jamais refermée ; la charte (décision
>   12) veut que tout écart autre qu'une clôture unique lève.
>   `DÉFAUT : du texte après la clôture, ou une clôture non refermée, est décodé`.
> - **N2 (js seul)** : un vecteur refusé par la validation reste écrit dans la
>   `Map` gardée pour l'encodeur (`known.set` avant la vérification) ; la page
>   n'est plus jamais ré-encodée et chaque recherche qui la contient lève
>   `EncodingFailed`. Python correct.
>   `DÉFAUT : un vecteur refusé empoisonne le cache d'un encodeur déjà servi`.

Passe 1 du lot 15. Tests : `content/snippets/search-in-your-own-documents/n{0,1,2,3}.test.{py,js}`.
Avant : 80 tests. Après : 233 (n0.py 29, n0.js 34, n1.py 28, n1.js 28, n2.py 28,
n2.js 28, n3.py 29, n3.js 30). Les tests d'origine sont renommés en français,
assertions gardées. L'essai interactif (niveau N0) est testé dans `n0.test.js`,
huit tests.

`node scripts/test-snippets.mjs search-in-your-own-documents` : vert, avec les
marquages ci-dessous.

Deux outils de test à connaître pour la relecture :

- `n0.test.py` affirme les scores rendus par la vraie table FTS5 ; `n0.test.js`
  affirme les mêmes nombres. C'est ce qui démontre que le fichier JavaScript
  reproduit FTS5.
- Les clients et modèles par défaut (N2, N3) sont éprouvés en remplaçant le
  paquet importé : `sys.modules` en Python, un crochet `module.register` en
  JavaScript (propre au processus du fichier de test). Le code par défaut est
  donc réellement exécuté, contre un module à la surface du paquet publié.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le lecteur demande la chose, le document la nomme autrement, et l'index n'a rien à faire correspondre » | démontrée (py, js), témoin : les mots du document trouvent | test_point_de_rupture_une_recherche_par_le_sens |
| 2 | N0 breaking_point | « « combien de vacances puis-je poser » ne renvoie rien alors que la page s'intitule « Congés payés » » | démontrée (py, js), témoin : « congés payés » → la page | test_point_de_rupture_vacances_ne_renvoie_rien_… |
| 3 | N0 breaking_point | « « congés responsable » ne renvoie rien non plus, parce qu'aucune page ne porte les deux mots » | démontrée (py, js), témoins : « congés » et « responsable » trouvent chacun ; aucune page ne porte les deux | test_point_de_rupture_conges_responsable_ne_renvoie_rien_… |
| 4 | N0 breaking_point | « le ET implicite de FTS5 aggrave le silence » | démontrée (py, js) : avec la règle OU de N1, les deux requêtes muettes ramènent trois pages | test_point_de_rupture_le_et_implicite_aggrave_le_silence |
| 5 | N0 name ; docstring py | « classé par BM25 » ; « bm25() returns a negative number, the best match being the most negative. Negate it » | démontrée (py) sur la table réelle ; js : scores positifs, meilleur en tête | test_le_score_est_celui_de_bm25_de_fts5_au_signe_pres |
| 6 | N0 docstring py | « MATCH takes a query language, not a string. A user typing a double quote, AND or NEAR must never be handed to it raw: quoting each token […] turns a syntax error into a search » | démontrée (py) : brut, `congés" paie`, `conges AND`, `conges OR` lèvent `OperationalError`, `title:conges` filtre la colonne ; via `search`, des mots ordinaires. js : même découpage, aucune exception | test_une_requete_brute_est_une_erreur_de_syntaxe_… / une requête pleine de syntaxe MATCH est cherchée |
| 7 | N0 commentaire | « An empty MATCH is a syntax error, not an empty result set » | démontrée (py) ; requête vide → `[]` (py, js) | test_un_match_vide_est_une_erreur_de_syntaxe_… |
| 8 | N0 commentaires | « Quoted terms […]: FTS5 requires all of them to appear » ; « A title match counts for more than a body match » ; poids (0, 10, 1) | démontrée (py, js) : un mot une fois au titre = le même dix fois au corps à longueur égale (0,6609 des deux côtés), témoin neuf fois : 0,6532 ; py : à poids égaux, l'ordre s'inverse | test_tous_les_termes_…, test_un_titre_l_emporte_…, test_un_mot_du_titre_compte_dix_fois_…, test_sans_les_poids_de_colonne_… |
| 9 | N0 docstring de tokenise (py) | « The same folding as the tokenizer declared above, so what we look up is spelled the way the index stored it » | INFIRMÉE (py) : `tokenise` passe par NFKD, `unicode61 remove_diacritics 2` non. Un document qui porte la ligature « ﬁchier » (texte tiré d'un PDF) est indexé « ﬁchier », la requête devient « fichier » : aucune requête ne le trouve. Même écart attendu pour les caractères de compatibilité (pleine chasse, exposants). Accents ordinaires, « œ », « ß » : concordants | test_infirme_le_repli_de_la_requete_est_celui_de_l_index |
| 10 | N0 docstring js | « the same tokenizer (lower case, accents folded), the same implicit AND between terms, the same BM25 with the same constants and column weights » | démontrée pour ET et BM25 : six requêtes sur deux fonds rendent au dix-millième les scores de la table FTS5. INFIRMÉE pour le découpage : le JS replie la ligature des deux côtés et trouve « ﬁchier » par « fichier », FTS5 ne le trouve pas | test_les_scores_de_fts5_que_le_fichier_javascript_doit_reproduire ; INFIRMÉ : … la ligature « ﬁ » … |
| 11 | N0 docstring js | « Node 22 does ship `node:sqlite`, but it needs --experimental-sqlite and the bundled build has no FTS5 module » | démontrée sur Node 22.12.0 (la version du dépôt) : sans drapeau `ERR_UNKNOWN_BUILTIN_MODULE`, avec drapeau `no such module: fts5`. À corriger au moins en précision : `node:sqlite` n'est plus derrière `--experimental-sqlite` depuis Node 22.13.0 (notes de version) ; les binaires officiels restent sans FTS5 (issue nodejs/node#56951). Le test tombera au passage à 22.13 | Node 22 n'a pas node:sqlite sans drapeau… (js) |
| 12 | N0 risks | `deterministic: true`, `data_egress: none`, `testability: unit` | démontrée (py : imports `sqlite3`, `unicodedata` ; js : aucun import) | test_deux_index_…, test_l_extrait_n_importe_que_sqlite3_et_unicodedata |
| 13 | N0 regulatory | « l'index est une table de la base que vous exploitez déjà, et suit ses sauvegardes et ses suppressions » | démontrée (py) : `DELETE` retire la page des résultats, la copie `backup` la garde. Sans objet en js (pas de base) | test_l_index_suit_les_suppressions_et_les_sauvegardes_de_la_base |
| 14 | N0 regulatory | « un index de recherche [ignore les droits d'accès] par défaut » | non testable : obligation de l'exploitant | — |
| 15 | verdict_rationale (N0) | « il se met à jour dans la même transaction que le document, se sauvegarde avec lui » | démontrée (py) quand la table FTS5 est la table des documents : insertion annulée, rien dans l'index. Incohérence à corriger : la docstring de `build_index` dit « filled by a trigger or a nightly job » ; un travail de nuit ne tient pas la même transaction | test_l_index_se_met_a_jour_dans_la_transaction_du_document |
| 16 | scenario | « SQLite a FTS5, PostgreSQL a tsvector, MySQL a FULLTEXT : l'index inversé et le classement BM25 sont là » | INFIRMÉE (source) pour PostgreSQL : `ts_rank` classe à la fréquence, `ts_rank_cd` à la densité de couverture (Clarke, Cormack, Tudhope 1999), aucune n'est BM25 (documentation PostgreSQL, « Ranking Search Results »). MySQL : la documentation dit « based on BM25 and TF-IDF » et donne une formule TF-IDF (`TF * IDF * IDF`). Vrai pour SQLite (test 5) | — |
| 17 | scenario | « mis à jour dans la même transaction que le document et sauvegardés avec lui » | démontrée pour SQLite (15) ; non testable ici pour PostgreSQL et MySQL | — |
| 18 | scenario | « combien de vos requêtes en ont besoin — et vos journaux de recherche le disent » | non testable : conseil d'exploitation | — |
| 19 | N0 latency, cost | « ~10 ms », `nul` | non testable : ordre de grandeur déclaré, la charte interdit d'en mesurer un | — |
| 20 | N0 escalate_when | « des requêtes sans aucun résultat alors que le document existe » | non testable : condition d'exploitation ; son mécanisme est 1 à 3 | — |
| 21 | N0 production | fonds vide, document vide, champ nul ; 10 000 pages ; page d'un million de mots ; requête de 20 000 mots ; 100 000 guillemets ; NFD (requête et document), espace insécable, BOM, emoji, casse mixte ; limites 0 et 1 | démontrée (py, js) | test_production_… |
| 22 | N0 production | espace de largeur nulle dans un mot | constat (py, js) : « con​gés » devient « con » + « ges », rien n'est trouvé. Même découpage que FTS5, donc pas marqué DÉFAUT | test_production_une_espace_de_largeur_nulle_… |
| 23 | N0 production | « l'accord » | DÉFAUT (py, js) : l'élision donne le jeton « l », que le ET implicite exige : rien, alors que « accord » trouve la page Télétravail | test_defaut_une_elision_dans_la_requete_vide_les_resultats |
| 24 | N0 production | limite négative | DÉFAUT (py, js) : pas refusée, et les deux langages divergent : SQLite lit `LIMIT -1` comme « sans limite » (3 pages pour « le »), le JS retire la dernière (2) | test_defaut_une_limite_negative_n_est_pas_refusee |
| 25 | essai, note | « Six pages indexées » ; « un mot du titre compte dix fois un mot du corps » ; « Le score dit à quel point les mots cherchés sont rares » | démontrée (8, et six pages). Constat pour la rareté : un mot présent dans la moitié des pages ou plus s'affiche « 0,00 » sur chaque ligne (plancher d'IDF de FTS5), ex. « paie » | essai : les pages de l'essai…, essai : un mot présent dans la moitié des pages… |
| 26 | essai, cas 1 à 3 | « Les mots du titre » ; « Un mot que deux pages emploient » ; « Deux mots, une seule page » | démontrée (fr, en) : 1 page, 2 pages titre en tête, 1 page | essai : les mots du titre…, essai : un mot que deux pages…, essai : deux mots, une seule page |
| 27 | essai, cas 4 | la question dans les mots du lecteur, `fails: true` ; « ce mot n'est nulle part dans l'index » | démontrée (fr, en) : « Aucune page ne contient : combien, vacances, puis, je, poser. » | essai : la question dans les mots du lecteur… |
| 28 | essai, cas 4, why fr | « Le ET implicite finit le travail : il aurait fallu que la même page porte tous les mots de la phrase » | démontrée : avec une règle OU, « de » ramène des pages | essai : en français, le ET implicite finit bien le travail |
| 29 | essai, cas 4, why en | « The implicit AND finishes the job: one single page would have had to carry every word of the sentence » | INFIRMÉE : aucun des six mots de « how much holiday can I book » n'est dans le règlement anglais ; une règle OU ne trouve rien non plus, le ET n'y est pour rien | INFIRMÉ : le why anglais dit « The implicit AND finishes the job »… |
| 30 | N1 breaking_point | « « vacances » ne trouve toujours rien, et désormais « congé » au singulier ne trouve rien non plus, là où le manuel écrit « congés » » | démontrée (py, js), témoin : « congés » trouve | test_point_de_rupture_le_decoupage_en_mots_devient_votre_probleme |
| 31 | N1 breaking_point | « désormais » (l'échec du singulier présenté comme nouveau à N1) | INFIRMÉE (py, js) : N0 (FTS5, sans désuffixation) ne trouve pas « congé » non plus ; c'est le même trou, pas un recul | test_infirme_le_singulier_trouvait_la_page_a_n0 |
| 32 | N1 breaking_point | « Désuffixation, élision, synonymes, mots vides — chacun devient une règle que vous écrivez » | démontrée (py, js) : « travail » ne trouve pas « travaillé », « vacances » rien, « le » cherché et noté ; élision : l'apostrophe coupe bien, mais le « l » restant est un terme rare qui pèse plus que « accord » (1,9377 contre 1,6844) | test_point_de_rupture_desuffixation_…, test_point_de_rupture_l_elision_laisse_un_mot_l_… |
| 33 | N1 breaking_point, docstring | « ces quarante lignes », « the forty lines below » | INFIRMÉE (py, js) : 42 lignes de code utile en Python, 46 en JavaScript (ni vides, ni commentaires, ni docstrings) | test_infirme_l_extrait_tient_en_quarante_lignes |
| 34 | N1 docstring ; verdict_rationale | « the forty lines below are what the database does » ; « c'est le même algorithme avec les molettes sorties » | INFIRMÉE (py, js) : aux poids de N0 (10, 1), « congés » vaut 2,3173 ici et 1,5938 dans FTS5. Trois écarts en plus de la règle OU : IDF `log(1 + …)` au lieu du `log` planché de FTS5 (« le » garde un poids positif), longueur comptée en jetons pondérés au lieu de jetons, poids du titre 3 au lieu de 10 | test_infirme_aux_memes_poids_n1_rend_les_scores_de_la_base |
| 35 | N1 docstring | « this one keeps any document carrying at least one term, where FTS5 demands all of them » | démontrée (py, js) | test_un_seul_terme_suffit_la_ou_n0_les_voulait_tous |
| 36 | N1 docstring | « k1 saturates repetition, b corrects for document length, and the field weights say how much a title is worth. Change one and the order changes » | démontrée (py, js) : 1, 2, 4, 8 occurrences → gains décroissants, sous le plafond idf × (k1 + 1) ; b = 0 inverse « jours » ; sans poids de titre, « télétravail » ne rend que la page Congés | test_k1_sature_la_repetition, test_la_normalisation_de_longueur_…, test_les_poids_de_champ_… |
| 37 | N1 docstring, commentaires | « `terms` says what each query word contributed » ; « The rarer the term, the more a match on it means » ; « a word typed twice is not twice as important » | démontrée (py, js) | test_le_score_est_la_somme_…, test_un_terme_rare_…, test_un_mot_tape_deux_fois_… |
| 38 | N1 regulatory | « L'index vit hors de la base et ne suit plus ses suppressions : un document retiré y reste jusqu'à la reconstruction suivante » | démontrée (py, js) | test_l_index_ne_suit_pas_les_suppressions_… |
| 39 | N1 risks | `deterministic: true`, `data_egress: none` | démontrée (py, js) | test_deux_index_…, test_l_extrait_n_importe_que_la_bibliotheque_standard |
| 40 | verdict_rationale (N1) | « N1 n'est pas plus lent » ; « prenez-le le jour où vous devez changer le tokenizer » | non testable : performance (interdite de mesure) et conseil | — |
| 41 | N1 escalate_when | « Vous vous mettez à écrire des règles de désuffixation » | non testable : condition d'exploitation | — |
| 42 | N1 production | fonds vide ; 10 000 pages et requête de 20 000 mots ; NFD, insécable, BOM, emoji, ligature, casse ; espace de largeur nulle (constat) ; limites 0 et 1, k1 = 0, b = 1 | démontrée (py, js) | test_production_… |
| 43 | N1 production | titre ou corps à `None` | DÉFAUT (py) : `AttributeError` à l'indexation (un NULL lu en base) ; le JS le traite comme vide, N0 Python l'accepte | test_defaut_un_champ_nul_fait_lever_l_indexation |
| 44 | N1 production | limite négative | DÉFAUT (py, js) : -1 retire en silence le dernier résultat | test_defaut_une_limite_negative_n_est_pas_refusee |
| 45 | N2 breaking_point | « Le cosinus est défini pour toute paire de textes : la jambe vectorielle a toujours une réponse, et « aucun résultat » n'existe plus » | démontrée (py, js) : quatre résultats même pour une requête vide, absurde ou un emoji | test_point_de_rupture_la_jambe_vectorielle_a_toujours_une_reponse, test_point_de_rupture_aucun_resultat_n_existe_plus_… |
| 46 | N2 breaking_point | « le plein texte répond honnêtement rien, la jambe vectorielle classe quand même les quatre pages, et la fusion en présente une en tête — celle des notes de frais, mais c'est le double local qui la désigne » | démontrée (py, js) : N0 réel rend `[]`, la fusion met `frais` en tête ; le même double à 8, 16, 32 dimensions désigne Congés, Télétravail, Matériel. La formulation est juste | test_point_de_rupture_c_est_le_double_qui_designe_la_page_en_tete |
| 47 | N2 breaking_point | « sauf si vous posez un seuil et le tenez » | démontrée, avec une précision : l'extrait n'a pas de seuil, et le score qu'il rend ne permet pas d'en poser un : la tête d'une question hors sujet a exactement le score de la tête d'une question à laquelle le fonds répond (1/61). Le seuil devrait porter sur le cosinus, que `hybrid_search` ne rend pas | test_point_de_rupture_aucun_seuil_ne_peut_se_poser_… |
| 48 | N2 breaking_point | « Ce qui est en aval […] la prendra pour le meilleur document existant » | non testable : comportement d'un composant absent | — |
| 49 | N2 docstring | « a self-hosted encoder maps text to vectors where two ways of saying the same thing land close together » ; « vector search […] is vague » | non testable : comportement du modèle | — |
| 50 | N2 docstring | « Fusing the two rankings keeps the precision of the first and borrows the reach of the second » | démontrée pour la portée (double à synonyme) et pour la tête : le premier du plein texte reste devant toute page qu'il n'a pas trouvée, même classé dernier par les vecteurs. Constat plus bas : sur 300 pages, le 14e résultat du plein texte classé dernier par les vecteurs passe derrière une page sans aucun mot de la requête ; le 13e reste devant. « Garde la précision » est à nuancer : chaque jambe pèse autant | test_la_jambe_vectorielle_trouve_…, test_la_tete_du_plein_texte_reste_devant_…, test_constat_plus_bas_dans_la_liste_… |
| 51 | N2 docstring | « a few hundred megabytes of weights » | démontrée (source) pour Python : `model.safetensors` 470 Mo sur le dépôt Hugging Face du modèle. Pour JavaScript, à préciser : `@xenova/transformers` charge par défaut la version quantifiée, `onnx/model_quantized.onnx`, 118 Mo | — |
| 52 | N2 docstring | « a process kept warm » | DÉFAUT (py, js) : sans encodeur injecté, chaque appel reconstruit `SentenceTransformer(MODEL_NAME)` / `pipeline(...)`, donc recharge les poids à chaque recherche | test_defaut_le_modele_par_defaut_est_recharge_a_chaque_recherche |
| 53 | N2 docstring | « vectors recomputed whenever a document changes » | DÉFAUT (py, js) : le fonds entier est ré-encodé à chaque requête, sans qu'aucun document ait changé | test_defaut_le_fonds_est_reencode_a_chaque_requete |
| 54 | N2 docstring | « a vector index as soon as they stop fitting in a list » | non testable : conseil de déploiement | — |
| 55 | N2 défaut réel | « In production » : `SentenceTransformer(MODEL_NAME).encode(liste)` (py) ; `pipeline('feature-extraction', MODEL_NAME)` puis `extract(batch, { pooling: 'mean' }).tolist()` (js) | démontrée : l'appel existe. Documentation vérifiée (sentence-transformers ; transformers.js via context7 : `extractor(texts, { pooling: 'mean', normalize: true })` puis `.tolist()`). Les deux points de contrôle existent sur Hugging Face. Contre un module à cette surface, le code par défaut rend le classement du double | test_le_modele_par_defaut_a_la_surface_de_sentence_transformers |
| 56 | N2 commentaire | « A multilingual model, because a handbook is rarely written in English » | démontrée pour le nom (`paraphrase-multilingual-MiniLM-L12-v2`) ; la couverture linguistique n'est pas exécutée | test_le_modele_nomme_est_multilingue |
| 57 | N2 commentaires | « One batched call: the query travels with the documents » ; « Ties are broken on the identifier, so two runs give the same order » ; « each list votes with 1/(k + rank). Nothing has to be rescaled […] k says how much being second is worth » ; unit : « Normalise once » | démontrée (py, js) : un appel ; vecteurs nuls → ordre des identifiants quel que soit l'ordre d'entrée ; chaque score = somme des 1/(60 + rang) ; vecteurs × 1000 → même résultat ; k = 0 → 2,0 ; `unit([3, 4])` = [0,6, 0,8], vecteur nul intact | test_le_fonds_et_la_requete_partent_…, test_les_egalites_…, test_chaque_liste_vote_…, test_rien_n_a_a_etre_remis_a_l_echelle, test_k_dit_…, test_unit_… |
| 58 | N2 EncodingFailed | « The encoder could not be run, or returned something unusable » | démontrée pour « could not be run » et pour un lot tronqué. INFIRMÉE (py, js) pour « unusable » : des vecteurs NaN ou de dimensions incohérentes (`zip` tronque en silence en Python) rendent un classement complet sans erreur | test_un_lot_tronque_…, test_un_modele_qui_ne_peut_pas_tourner_leve, test_infirme_des_vecteurs_inutilisables_levent |
| 59 | N2 risks | `deterministic: true` ; `own-infra` ; `statistical` ; regulatory (licence, vecteurs sensibles) | démontrée avec le double pour `deterministic` ; le reste non testable : modèle réel non exécuté, juridique | test_deux_executions_rendent_le_meme_classement |
| 60 | N2 escalate_when | « Vos lecteurs veulent une phrase de réponse » | non testable : condition d'exploitation | — |
| 61 | N2 production | fonds vide (aucun appel), limite 0, k = 0, 10 000 pages, requête NFD/insécable/emoji/BOM transmise telle quelle | démontrée (py, js) | test_un_fonds_vide_…, test_production_… |
| 62 | N2 production | identifiant du plein texte absent de `documents` | constat (py, js) : il ressort dans les résultats ; la fusion ne recoupe pas | test_production_un_identifiant_du_plein_texte_absent_… |
| 63 | N3 breaking_point | « le modèle cite le passage qu'on lui a bel et bien donné, et écrit une phrase que ce passage contredit : […] deux jours et demi par mois, […] trente jours ouvrés dès l'embauche. Tous les contrôles de l'extrait passent » | démontrée (py, js) | test_point_de_rupture_une_vraie_citation_sur_une_phrase_inventee |
| 64 | N3 breaking_point | « Le contrôle d'ancrage lit les citations, pas la réponse » | démontrée (py, js), témoins : même phrase avec source inventée ou sans source → `AnswerNotGrounded` ; avec une vraie source quelconque (« frais ») → passe | test_point_de_rupture_le_controle_lit_les_citations_pas_la_reponse |
| 65 | N3 breaking_point | « la source affichée à côté est précisément ce qui rend la phrase crédible ; il faut ouvrir le passage pour le savoir » | démontrée pour le second membre : le résultat ne porte que l'identifiant, pas le texte du passage. Le premier membre (crédibilité) est non testable | test_point_de_rupture_il_faut_ouvrir_le_passage_… |
| 66 | N3 point de rupture (au sens de la charte) | la réponse « trente jours » est écrite par le double | la fiche ne l'attribue pas au modèle réel comme un constat : « Dans le test, le modèle cite… » ; formulation acceptable | — |
| 67 | N3 docstring | « The model has never read your handbook. Asked without it, it answers from memory, confidently » ; « N0, N1 or N2 finds the passages » | non testable : comportement du modèle ; architecture | — |
| 68 | N3 docstring | « how many passages to send and how long each may be » ; « what the model is allowed to say when they do not answer » ; « what to do when it cites a passage nobody sent » ; « it catches an invented source » | démontrée (py, js) : 4 passages au plus, 1 500 caractères chacun, `max_passages` ; la consigne dit « answer exactly: je ne sais pas » et cette réponse passe sans source ; source inventée ou retrouvée mais non envoyée → refusée ; réponse sans source → refusée | test_quatre_passages_…, test_un_passage_tres_long_…, test_la_consigne_dit_…, test_une_citation_…, test_une_reponse_qui_ne_cite_rien_… |
| 69 | N3 docstring | « how to decode a reply that is only probably JSON » | DÉFAUT (py, js) : seul `json.loads`/`JSON.parse` ; une réponse en clôture ```json, forme courante, lève `AnswerUnavailable` après deux appels payés | test_defaut_une_reponse_en_cloture_de_code_n_est_pas_decodee |
| 70 | N3 commentaires | « no reason to pay for a call that can only invent » ; « any provider failure is retried » ; AnswerUnavailable « answered something unusable » | démontrée (py, js) : aucun appel sans passage ; deux appels exactement, pas un de plus ; prose, non-objet, réponse blanche → `AnswerUnavailable` | test_rien_de_retrouve_…, test_une_panne_est_retentee_…, test_de_la_prose_…, test_une_reponse_qui_n_est_pas_un_objet_…, test_une_reponse_vide_leve |
| 71 | N3 commentaire | « Temperature zero: two identical questions must give one answer » | démontrée pour l'envoi de `temperature=0` ; « must give one answer » non testable, et le kit ne le garantit pas (la fiche déclare d'ailleurs `deterministic: false`) | test_chaque_passage_retrouve_voyage_dans_la_consigne |
| 72 | N3 client par défaut | « defaults to a real provider client » | DÉFAUT (py, js) : `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)`, méthode absente du kit publié (`openai` 3.14.0 py, 7.15.0 js, vérifié par l'orchestrateur) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`. Exécuté contre un module à cette surface : aucune requête ne part, l'erreur est avalée par la boucle de réessai et ressort en `AnswerUnavailable` (« … has no attribute 'complete' ») | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit, test_le_client_par_defaut_echoue_en_service_indisponible_sans_appel |
| 73 | N3 regulatory | « Transfert à un sous-traitant de la question posée et du contenu des passages retrouvés » | démontrée (py, js) ; localisation, conservation, obligations : non testable | test_chaque_passage_retrouve_voyage_dans_la_consigne |
| 74 | N3 risks, escalate_when | `third-party`, `false`, `hard` ; « Il n'y a pas de niveau au-dessus » | non testable : qualification | — |
| 75 | N3 production | « Je ne sais pas. » (majuscule, point) | DÉFAUT (py, js) : refusé en `AnswerNotGrounded`, comme une réponse inventée | test_defaut_je_ne_sais_pas_avec_majuscule_et_point_… |
| 76 | N3 production | identifiants de passage entiers (clé primaire) | DÉFAUT (py, js) : les sources sont converties en chaînes, pas les identifiants envoyés ; toute citation juste est refusée | test_defaut_un_identifiant_entier_fait_refuser_une_citation_juste |
| 77 | N3 production | réponse d'un autre type | DÉFAUT : py, `sources` en chaîne découpé lettre à lettre (`AnswerNotGrounded` citant `['c', 'o', …]`), `sources` null ou nombre → `TypeError`, `answer` null → texte « None » ; js, `sources` chaîne ou nombre → `TypeError`, null → refusé en `AnswerNotGrounded` | test_defaut_une_reponse_d_un_autre_type_leve_une_erreur_nommee |
| 78 | N3 production | question vide ou blanche ; question d'un million de caractères | DÉFAUT (py, js) : un appel payé ; la question n'est pas bornée, seuls les passages le sont | test_defaut_une_question_vide_…, test_defaut_une_question_enorme_… |
| 79 | N3 production | emoji à la frontière des 1 500 caractères | démontrée (py : l'emoji reste entier). DÉFAUT (js) : la coupe compte en unités UTF-16 et laisse une demi-paire `\ud83d` dans la consigne | test_production_nfd_… (py), DÉFAUT : un emoji à la frontière de coupe est coupé en deux (js) |
| 80 | N3 production | 1 000 passages d'un mégaoctet ; NFD, insécable ; injection dans un passage qui forge « [accord-2019] » ; `je ne sais pas` exact avec source | démontrée (py, js) : consigne bornée ; texte transmis tel quel ; citer l'identifiant forgé est refusé, obéir en citant le vrai passage passe (c'est 63) ; constat : la réponse de repli peut citer une source | test_production_… |
| 81 | verdict_rationale | « Il a surtout la propriété qu'on attend d'une barre de recherche et que N2 abandonne : quand il n'a rien, il le dit » | démontrée par 1 et 45 sur la même question | test_point_de_rupture_la_jambe_vectorielle_a_toujours_une_reponse |
| 82 | verdict_rationale | « ne coûte aucun service à exploiter » | non testable : exploitation | — |

## Non testable, et pourquoi

- 14, 18, 20, 40, 41, 54, 60, 74, 82 : obligations, conseils, conditions
  d'exploitation, qualifications.
- 19, 40 (en partie) : performance ; la charte interdit d'en publier une mesure.
- 48, 49, 67, 71 (en partie) : comportement du modèle ou d'un composant absent.
  Le double écrit les réponses ; les points de rupture N2 et N3 le disent
  correctement (« c'est le double local qui la désigne », « Dans le test »).
- 59 (en partie), 65 (en partie) : modèle réel non exécuté ; perception du
  lecteur.

## Infirmé, et ce que le code fait réellement

- **9, 10** : le repli de `tokenise` (NFKD) n'est pas celui de `unicode61` : une
  ligature « ﬁ » rend un document introuvable par N0 Python, et trouvable par
  N0 JavaScript, qui ne reproduit donc pas FTS5 sur ce point.
- **11 (précision)** : `node:sqlite` est sans drapeau depuis Node 22.13.0 ; le
  constat « no FTS5 » tient pour les binaires officiels.
- **15 (incohérence)** : « même transaction » contre « a nightly job » dans la
  docstring de `build_index`.
- **16** : PostgreSQL n'a pas de BM25 (`ts_rank`, `ts_rank_cd`) ; MySQL documente
  un TF-IDF.
- **29** : l'essai anglais attribue le silence au ET implicite ; aucun mot de la
  question n'est dans l'index.
- **31** : « désormais » : N0 ne trouve pas « congé » non plus.
- **33** : 42 lignes (py), 46 (js), pas quarante.
- **34** : N1 n'est pas « ce que fait la base » : autre IDF, autre longueur,
  autres poids, autre règle.
- **51 (précision)** : 470 Mo en Python, 118 Mo par défaut en JavaScript.
- **58** : `EncodingFailed` ne couvre ni NaN ni dimensions incohérentes.

## Défauts de production

- **23 (N0)** : une élision dans la requête vide les résultats.
- **24, 44 (N0, N1)** : limite négative acceptée ; N0 diverge entre langages.
- **43 (N1 py)** : champ `None` → `AttributeError`.
- **52, 53 (N2)** : modèle rechargé et fonds ré-encodé à chaque recherche.
- **69 (N3)** : clôture de code non décodée, deux appels payés.
- **72 (N3)** : client par défaut incompatible avec le kit.
- **75, 76, 77 (N3)** : « Je ne sais pas. » refusé ; identifiants entiers
  refusés ; types inattendus en `TypeError` ou en erreur trompeuse.
- **78 (N3)** : question vide payée, question non bornée.
- **79 (N3 js)** : emoji coupé en deux à la frontière des 1 500 caractères.

## Pour la charte

- Quand un extrait JavaScript prétend reproduire un moteur que seul l'extrait
  Python exécute (ici FTS5), la charte pourrait exiger que les deux fichiers de
  test affirment les mêmes nombres, calculés par le moteur réel : c'est la seule
  preuve de l'équivalence, et elle a trouvé l'écart de la ligature.
- Le crochet `module.register` (JavaScript) et `sys.modules` (Python) permettent
  d'exécuter le chargement par défaut d'un N2 ou d'un N3 contre un module à la
  surface du paquet publié, sans double passé en paramètre. La charte pourrait
  le recommander : le test porte alors sur le code que le lecteur voit, et il
  attrape aussi les rechargements à chaque appel.
- Une affirmation qui dépend de la version de l'environnement (Node 22 et
  `node:sqlite`) mérite un test qui épingle la version : il tombera au bon
  moment.
- La charte pourrait nommer le cas « limite négative » parmi les valeurs aux
  limites : il fait diverger SQLite et les tranches JavaScript/Python.

## Tour 2 — contre-épreuve

Après `d621b6a` (corrections du rédacteur, tour 1). Tests : n0.py 31, n0.js 35,
n1.py 27, n1.js 27, n2.py 35, n2.js 34, n3.py 33, n3.js 34 (256 ; 233 avant).
`node scripts/test-snippets.mjs search-in-your-own-documents` vert, avec les
deux marquages `DÉFAUT` ci-dessous et eux seuls.

### Lignes « À retester » du rédacteur

| # | Ligne | Désormais | Test |
|---|---|---|---|
| 9, 10 | repli de `tokenise` = `unicode61` | démontrée (py, js) : douze mots (ligature, pleine chasse, exposant, grec et cyrillique accentués gardés ; latin à deux diacritiques, « résumé » repliés ; « œuvre », « straße » gardés) — jetons lus dans `fts5vocab` de la vraie table, identiques à `tokenise` en Python et en JavaScript. « ﬁchier » trouve la page, « fichier » non, dans les deux langages | test_le_repli_de_la_requete_est_celui_de_l_index_une_ligature_est_gardee / le repli de la requête est celui de l’index : une ligature est gardée |
| 11 | « Node 22 ships `node:sqlite` (behind --experimental-sqlite before 22.13.0), but its bundled SQLite has no FTS5 module » | démontrée sur 22.12.0 : sans drapeau `ERR_UNKNOWN_BUILTIN_MODULE`, avec drapeau `no such module: fts5`. Le test prend désormais les deux branches (avant/après 22.13) et ne tombera plus au changement de mineure | Node 22 livre node:sqlite, derrière un drapeau avant 22.13.0… |
| 15 | docstring de `build_index` : table des documents, ou table à contenu externe tenue par triggers, « either way it changes in the transaction that changes the document » | démontrée (py) pour les deux montages : insertion annulée, rien dans l'index. Sans objet en js | test_l_index_se_met_a_jour_dans_la_transaction_du_document, test_une_table_a_contenu_externe_tenue_par_triggers_change_dans_la_meme_transaction |
| 14 | regulatory : « l'extrait cherche dans tout le fonds et n'en connaît aucun » | démontrée (py) : un champ `acl` n'est ni stocké ni filtré ; la table n'a que `doc_id, title, body`. L'obligation reste non testable | test_l_extrait_cherche_dans_tout_le_fonds_et_ne_connait_aucun_droit_d_acces |
| 16, 17 | scenario : « SQLite a FTS5 et son classement BM25, PostgreSQL a tsvector et ses fonctions de classement, MySQL a FULLTEXT » | démontrée pour SQLite (5) ; PostgreSQL, MySQL : non testable ici (sources citées par le rédacteur) | — |
| 18 | scenario : « vos journaux de recherche, avec leurs requêtes sans résultat, le disent » | non testable : conseil d'exploitation ; le mécanisme (requête sans résultat) est 1 à 3 | — |
| 23 | élision : un jeton d'une lettre est écarté « unless the query holds nothing else » | démontrée (py, js) : « l'accord » trouve Télétravail (témoin py : la table interrogée avec « l » ne rend rien) ; « manager's » → `["manager"]` et trouve la page ; « a » seul est cherché et trouve ; « 𝐀 » (deux unités UTF-16) compte pour une lettre dans les deux langages | test_production_une_elision_dans_la_requete_ne_vide_plus_les_resultats, test_production_une_requete_d_une_seule_lettre_est_encore_cherchee |
| 24, 44 | limite négative | démontrée (py `ValueError`, js `RangeError`, message « limit must be zero or more ») pour N0 et N1 ; témoin py : `LIMIT -1` rend les trois pages | test_production_une_limite_negative_est_refusee |
| 25 | note de l'essai : « Le score monte quand les mots cherchés sont rares […] un mot présent dans la moitié des pages ou plus n'y ajoute rien » | démontrée : « paie » (3 pages sur 6) 0,00 partout ; témoin « responsable » (2 sur 6) 0,72 et 0,64 | essai : un mot présent dans la moitié des pages s’affiche à 0,00 partout |
| 27, 29 | essai anglais : « how many days of holiday can I take » ; why « The implicit AND finishes the job » | démontrée : détail « No page contains: how, many, holiday, can, take. » ; N0 rien, « days of » trouve, la règle OU de N1 ramène des pages | essai : la question dans les mots du lecteur…, essai : en anglais aussi, le ET implicite finit bien le travail |
| 31 | N1 breaking_point : « « congé » au singulier ne trouve rien non plus […] — pas plus qu'à N0 » | démontrée (py, js), témoin : le pluriel trouve aux deux niveaux | test_point_de_rupture_le_singulier_ne_trouve_rien_pas_plus_qu_a_n0 |
| 33 | « quarante lignes » | retiré de la fiche et des docstrings ; test retiré (py, js), conformément à la décision 10 | — |
| 34 | N1 docstring : « It does not reproduce FTS5 to the decimal: the matching rule, the idf, the length and the title weight all differ » ; verdict : « ne rend pas les scores de FTS5 » | démontrée (py, js), écart par écart : poids 3 contre 10 ; aux poids de N0, 2,3173 contre 1,5938 ; « le » garde un poids positif ici, 0 dans FTS5 ; longueur en occurrences pondérées ; OU contre ET | test_n1_ne_reproduit_pas_fts5_a_la_decimale_regle_idf_longueur_et_poids_different |
| 40 | verdict : « N1 coûte en plus un index à reconstruire hors de la base » | démontrée par 38 ; « prenez-le le jour où… » non testable | — |
| 43 | N1 champ `None` | démontrée (py, js) : indexé comme vide, `None` ne devient pas le mot « none » | test_production_un_champ_nul_est_indexe_comme_vide |
| 47 | N2 breaking_point : « le score fusionné ne permet pas de poser un seuil […] le cosinus, que l'extrait ne rend pas » | démontrée (py, js) : même score 1/61 ; les résultats n'ont que `id` et `score` | test_point_de_rupture_aucun_seuil_ne_peut_se_poser_sur_le_score_fusionne |
| 49 | N2 docstring : « a self-hosted sentence encoder, built for semantic search, maps each text to a dense vector » ; « vector search ranks every document, always » | premier membre non testable (modèle réel) ; second démontré par 45 | — |
| 50 | N2 docstring : « keeps the first keyword result ahead of any page the keywords did not find […] further down the list, each leg weighs as much as the other » | démontrée (py, js) ; l'ancien « constat » devient la démonstration du second membre | test_la_tete_du_plein_texte_reste_devant_…, test_plus_bas_dans_la_liste_chaque_jambe_pese_autant_que_l_autre |
| 52 | « Loaded once per process, then kept warm » | démontrée (py : `cache_clear` au début, un seul `SentenceTransformer` pour deux recherches ; js : un seul chargement réussi sur tout le fichier). Un chargement qui échoue est retenté à la recherche suivante (py : `functools.cache` ne retient pas l'exception ; js : « a failed load is tried again »). Constat (py, js) : l'échec du chargement sort tel quel (`OSError`, `Error`), pas en `EncodingFailed` | test_production_le_modele_par_defaut_est_charge_une_fois_par_processus, test_production_un_chargement_qui_echoue_est_retente_… |
| 53 | « a document is encoded again only once its text has changed » ; « the unit vector of each document text seen in the last search » | démontrée (py, js) : la seconde requête part seule ; un document modifié part seul, et le classement est celui d'un encodeur neuf ; deux documents au même texte partent une fois ; une page retirée puis remise est ré-encodée | test_production_le_fonds_n_est_pas_reencode_…, …un_document_modifie_…, …deux_documents_au_meme_texte_…, …le_cache_ne_garde_que_… |
| 53 bis | cache après un vecteur refusé | py : démontrée, rien n'est gardé, la recherche suivante ré-encode et répond. **js : DÉFAUT**, voir en tête | test_production_un_vecteur_refuse_n_empoisonne_pas_… / DÉFAUT : un vecteur refusé empoisonne… |
| 55 | N2 js : `@huggingface/transformers`, `pipeline('feature-extraction', MODEL_NAME)`, `extract(batch, { pooling: 'mean' })` puis `.tolist()` | démontrée contre un module à cette surface (crochet sur le nouveau nom ; options `{ pooling: 'mean' }` vérifiées). Surface vérifiée par le rédacteur (context7) : l'appel existe | le modèle par défaut a la surface de @huggingface/transformers |
| 56 | commentaire : « its card lists French among its languages » | nom du modèle démontré ; la carte : non testable ici | test_le_modele_nomme_est_multilingue |
| 58 | `EncodingFailed` pour des vecteurs inutilisables | démontrée (py, js) : NaN, infini, tailles différentes, valeur non numérique (« beaucoup ») | test_des_vecteurs_inutilisables_levent_encoding_failed |
| 63, 65 | N3 breaking_point : « la réponse du double cite le passage qu'on a bel et bien envoyé » ; « le résultat ne porte que l'identifiant du passage » | démontrée (py, js), formulation désormais exacte | test_point_de_rupture_une_vraie_citation_…, …il_faut_ouvrir_le_passage_… |
| 67 | « The model only knows of your handbook what the prompt carries » ; « it compares identifiers, and never reads the sentence » | premier membre non testable (modèle) ; second démontré par 64 | — |
| 69 | clôture ```json | démontrée (py, js) : clôture unique avec ou sans langue, blancs autour → décodée, un seul appel ; texte avant, deux blocs, clôture sur une ligne → `AnswerUnavailable`. **DÉFAUT (py, js)** : texte après la clôture et clôture non refermée décodés, voir en tête | test_production_une_reponse_enveloppee_…, test_production_un_autre_ecart_…, DÉFAUT : du texte après la clôture… |
| 71 | « Temperature zero narrows the sampling. It does not make the call deterministic » | `temperature=0` envoyé : démontré ; le reste non testable (fournisseur) | test_chaque_passage_retrouve_voyage_dans_la_consigne |
| 72 | adaptateur `ProviderClient` / `providerClient` | démontrée (py, js) avec `_harness/fake_sdk` : `chat.completions.create`, `model="gpt-4.1-mini"`, un message `user` qui porte la consigne, `temperature=0`, pas de `complete` ; `content` nul → `AnswerUnavailable` (« no text ») après deux requêtes ; panne du kit retentée une fois ; client par défaut (`OpenAI()` remplacé par le double du harnais) → réponse décodée. Le double local de `openai` à la main est remplacé par celui du harnais ; « échoue en service indisponible sans appel » retiré (py, js) | test_l_adaptateur_…, test_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 75 | « Je ne sais pas. » | démontrée (py, js) : « Je ne sais pas. », « JE NE SAIS PAS ! », blancs finaux → `NO_ANSWER` ; témoin : « Je ne sais pas, trente jours ? » sans source → `AnswerNotGrounded` | test_production_je_ne_sais_pas_avec_majuscule_et_ponctuation_… |
| 76 | identifiants entiers | démontrée (py, js) : source `1` ou `"1"` → `[1]` rendu entier ; `3` → `AnswerNotGrounded` | test_production_un_identifiant_entier_est_accepte_et_rendu_entier |
| 77 | types inattendus | démontrée (py, js) : `sources` chaîne, nulle, nombre, `[true]`, liste imbriquée (js : `1.5`), `answer` nul ou absent → `AnswerUnavailable` « not the object asked for », deux appels | test_production_une_reponse_d_un_autre_type_… |
| 78 | question vide ; question longue | démontrée (py, js) : "", blancs, insécable + saut de ligne → `NO_ANSWER` sans appel ; 1 000 caractères passent, 1 001 et 1 000 000 → `ValueError`/`RangeError` sans appel et sans construire `OpenAI()` ; mille emoji passent (points de code dans les deux langages) | test_production_une_question_vide_ou_blanche_…, test_production_une_question_trop_longue_… |
| 79 | js : emoji à la frontière de 1 500 | démontrée : l'emoji reste entier, le suivant est coupé, aucune demi-paire dans la consigne | production : un emoji à la frontière de coupe reste entier |

### Constats nouveaux, non marqués

- **N2 py** : le cache par encodeur est un `WeakKeyDictionary` ; un encodeur
  injecté non hachable (une `dataclass` ordinaire) fait lever `TypeError`
  avant tout encodage. `SentenceTransformer` et les doubles sont hachables.
  Test : `test_production_constat_un_encodeur_non_hachable_leve_type_error`. À
  trancher par l'orchestrateur (le rédacteur l'a signalé).
- **N2 py, js** : un chargement du modèle par défaut qui échoue sort en
  exception de la bibliothèque, pas en `EncodingFailed`.

### Toujours non testable

14 (obligation), 18, 19, 20, 40 (en partie), 41, 49 (en partie), 56 (carte),
60, 67 (en partie), 71 (en partie), 74, 82 : inchangés, mêmes raisons qu'au
tour 1.

### Défauts restants (marqués)

- **N3 py, js — clôture** : `_decode` fait `split("\n", 1)[-1].rsplit("```", 1)[0]`
  (py) ; `lastIndexOf('```')`, et le texte entier si aucune clôture finale
  (js). Sortie : ```` ```json\n{…}\n```\nVoilà, bonne journée. ```` → décodé,
  ```` ```json\n{…} ```` (non refermée) → décodé. Attendu (charte, décision
  12) : `AnswerUnavailable`.
- **N2 js — cache empoisonné** : `missing.forEach((text, i) => known.set(text, vectors[i]))`
  écrit dans la `Map` déjà gardée par `documentVectors` avant la vérification
  `usable`. Scénario : recherche 1 sur la page A ; recherche 2 sur A et B, le
  vecteur de B est NaN → `EncodingFailed` (juste) ; recherche 3 sur A et B →
  B n'est pas ré-encodée, `EncodingFailed` de nouveau, et ainsi de suite. Le
  Python construit un nouveau dictionnaire et répond à la recherche 3.
