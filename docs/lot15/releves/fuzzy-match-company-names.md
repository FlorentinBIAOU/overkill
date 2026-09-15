# fuzzy-match-company-names — relevé du testeur

> **Contre-épreuve du tour 1 : deux marquages `DÉFAUT` restent, dans les deux langages.**
> 1. `test_defaut_une_forme_juridique_en_tete_de_nom_ne_fusionne_pas` — défaut #28
>    traité pour « spa » seulement : « Sa Nostra » / « Nostra » et « NV Energy » /
>    « Energy Ltd » valent toujours 1,0.
> 2. `test_defaut_deux_noms_qui_ne_different_que_par_une_voyelle_devanagari_ou_thai_ne_sont_pas_identiques`
>    — nouveau, issu de la réparation #27 : retirer toutes les marques de catégorie
>    `M` efface les voyelles du devanagari et du thaï ; « कमल उद्योग » / « कोमल उद्योग »
>    et « กินดี » / « กันดี » valent 1,0.
>
> Aucune correction du rédacteur n'est infirmée.

Passe 1 du lot 15. Tests : `content/snippets/fuzzy-match-company-names/n{0,1,2}.test.{py,js}`.
Un test nommé ci-dessous existe dans les deux langages, sauf mention « py seul » ou « js seul ».

`node scripts/test-snippets.mjs fuzzy-match-company-names` : vert. 48 tests
existaient, tous renommés en français, assertions gardées. Un seul ne démontrait
pas ce que son nom disait : `test_case_costs_nothing_because_the_encoder_folds_it`
(N2) attribuait à l'encodeur ce que fait le double (le sac de mots de `_harness`
met en minuscules) ; il devient `test_la_casse_est_repliee_par_le_double_pas_par_l_extrait`,
et un test ajouté montre que l'extrait transmet les noms tels quels. Les deux
assertions `<`/`>` du point de rupture N0 sont complétées par les scores exacts.
77 tests ajoutés (125 au total).

Marquages : N0 — 3 `INFIRMÉ` et 2 `DÉFAUT` dans chaque langage ; N1 — 1 `INFIRMÉ` en JavaScript seulement ; N2 — aucun.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Le test compare « SNCF » à « Société Nationale des Chemins de fer Français » : la vraie paire passe sous le seuil » | démontrée : 0,545 < 0,85 ; témoin « Boulangerie Martin SARL » / « BOULANGERIE MARTIN » à 1 | test_point_de_rupture_un_sigle_passe_sous_le_seuil_et_sous_une_societe_sans_rapport |
| 2 | N0 breaking_point | « et — plus embarrassant — sous le score de « SNCF » contre « Sanofi » » ; « Aucun seuil ne retient la première en écartant la seconde » | démontrée : Sanofi 0,775 > 0,545 | idem |
| 3 | N0 breaking_point | « dont la graphie ne partage avec le sigle que trois lettres sur quatre » | démontrée : s, n, f ; Jaro les apparie toutes les trois | test_point_de_rupture_sanofi_partage_trois_lettres_sur_quatre_avec_le_sigle |
| 4 | Essai, cas 4 (why) | « sous le score de Sanofi, qui ne partage avec SNCF qu'une première lettre » / « shares nothing with SNCF but a first letter » | INFIRMÉE : trois lettres, et contredit #3 | test_l_essai_sanofi_ne_partage_avec_sncf_qu_une_premiere_lettre |
| 5 | Essai, cas 4 (why) | « La vraie paire passe sous le seuil » ; « Aucun seuil ne retient la première en écartant la seconde » | démontrée | test_l_essai_trois_premiers_cas |
| 6 | Essai, cas 4 (why) | « L'extrait compare des caractères ; il ne peut pas savoir que le sigle est fait des initiales » | non testable : explication | — |
| 7 | Essai, cas 1 à 3 | « La même maison sous trois statuts » (1,0 et 1,0) ; « Accents, esperluette, pluriel : rien de tout cela ne compte » ; « Deux boulangeries qui n'ont rien à voir, au-dessus du seuil » | démontrée ; précision sur « rien ne compte » plus bas | test_l_essai_trois_premiers_cas |
| 8 | N0 escalate_when | « vos deux sources n'écrivent pas les mots dans le même ordre : « Menuiserie Dubois » ici, « Dubois Menuiserie » là » | démontrée : 0,739 < 0,85 ; « Martin Dubois » / « Dubois Martin » : 0,487 | test_l_ordre_des_mots_coute_presque_tout_a_n0 |
| 9 | N0 escalate_when | « un nom contre un registre entier » | non testable : situation d'usage (N1 le démontre, #27) | — |
| 10 | N0 name + docstring | « Normalisation, retrait de la forme juridique, puis Jaro-Winkler » ; « la forme juridique est retirée plutôt que comparée […] laisser SARL et SAS les éloignerait » | démontrée : SARL/SAS → 1,0 ; sans retrait 0,974 | test_la_forme_juridique_est_retiree_plutot_que_comparee |
| 11 | N0 normalise | « Lowercase, strip accents and punctuation, drop the legal form » | démontrée | test_accents_casse_et_ponctuation_sont_ignores |
| 12 | scenario | « une forme juridique en fin de chaîne, un accent, un pluriel, une esperluette écrite en toutes lettres : une comparaison de chaînes » | démontrée : 1,0 ; 1,0 ; 0,954 ; 0,978 | test_une_esperluette_et_un_pluriel_restent_au_dessus_du_seuil |
| 13 | scenario, risks | « un rapprochement doit être rejouable » ; `deterministic: true` | démontrée (N0, N1, et tri stable N1/N2) | test_n0_est_deterministe_et_rejouable, test_n1_est_deterministe, test_les_egalites_reviennent_dans_l_ordre_du_registre |
| 14 | N0 docstring | « Jaro-Winkler […] récompense un début commun, et c'est bien ainsi que varient les noms : la tête est la marque, la queue est une forme, une ville » | démontrée pour la récompense et une ville en queue (0,957) ; « c'est ainsi que varient les noms » non testable (constat empirique) | test_jaro_winkler_recompense_un_debut_commun |
| 15 | N0 docstring py / js | « bibliothèque standard seule » / « sans dépendance » ; `vendor_lock: none` | démontrée | test_n0_n_emploie_que_la_bibliotheque_standard / 'n0 n'emploie aucune dépendance, et l'algorithme tient en trente lignes' |
| 16 | N0 docstring js | « l'algorithme tient en trente lignes » | démontrée : `jaro` + `jaroWinkler` = 30 lignes de code | idem (js seul) |
| 17 | N0 docstring | « assez court pour se lire d'une traite » | non testable : appréciation | — |
| 18 | N0 commentaire | « Legal forms, French and foreign. This is business knowledge […] every real matching job carries a list like this one, and grows it » | démontrée pour « française et étrangère » ; le reste non testable | test_la_liste_des_formes_juridiques_est_francaise_et_etrangere |
| 19 | N0 commentaire | « Winkler looks at the first four characters only » | démontrée | test_winkler_ne_regarde_que_les_quatre_premiers_caracteres |
| 20 | N0 commentaire | « and never gives back more than a tenth of the score Jaro withheld » | INFIRMÉE : jusqu'à quatre dixièmes | test_winkler_ne_rend_jamais_plus_d_un_dixieme_du_score_retenu |
| 21 | N0 commentaire | « A name made of nothing but a legal form keeps it. Emptying it would make it match every other emptied name perfectly » | démontrée : « SARL » reste « sarl », SARL/SAS 0,778 | test_un_nom_fait_seulement_d_une_forme_juridique_la_garde |
| 22 | N0 _jaro | « A character counts as found only if its twin sits within half the length of the longer name » | INFIRMÉE : la fenêtre est la moitié moins un | test_un_jumeau_a_la_moitie_de_la_longueur_est_trouve |
| 23 | N0 _jaro | « That window is what separates Jaro from a plain count of common letters » | démontrée : « abcdefgh »/« hgfedcba », 8 lettres communes, Jaro 0,5 | test_la_fenetre_separe_jaro_d_un_simple_compte_de_lettres |
| 24 | N0 test (existant) | deux boulangeries différentes au-dessus du seuil ; nom vide → 0, deux vides → 1 | démontrée | test_deux_societes_differentes_…, test_un_nom_vide_ne_rapproche_rien |
| 25 | N0 latency | `<1 ms` | démontrée (mesuré 0,016 ms py) | test_une_comparaison_prend_moins_d_une_milliseconde |
| 26 | N0 production | noms de 2 470 caractères ; BOM, espace insécable, NFD, emoji | démontrée : < 2 s (mesuré 0,12 s py, 0,14 s js à 10 000 caractères : quadratique mais borné pour des noms) ; 1,0 | test_production_des_noms_de_deux_mille_cinq_cents_caracteres_terminent, test_production_marque_d_ordre_espace_insecable_nfd_emoji |
| 27 | N0 production, encodage | noms sans lettre latine | DÉFAUT : « Газпром »/« Лукойл » et « 東京電力 »/« 日立製作所 » → 1,0 | test_defaut_deux_noms_non_latins_differents_ne_sont_pas_identiques |
| 28 | N0 production | forme juridique homographe d'un mot ordinaire | DÉFAUT : « Nordic Spa »/« Nordic SA » → 1,0 | test_defaut_une_forme_juridique_homographe_d_un_mot_ordinaire_ne_fusionne_pas |
| 29 | N0 production, encodage | « Ø », « ß » | démontrée : retirés et non repliés (« rsted », « gro mann »), score encore > 0,85 | test_production_une_lettre_sans_decomposition_est_perdue |
| 30 | N0 risks / cost / regulatory | `data_egress: none`, `testability: unit`, `nul`, `negligible`, les deux lignes | démontrée pour `none` et `unit` (garde réseau, suite unitaire) ; le reste non testable (déclaratif, juridique) | toute la suite |
| 31 | N1 breaking_point | « la raison sociale développée de la SNCF n'atteint même pas les trois premiers résultats de sa propre abréviation, doublée par deux entreprises sans rapport » | démontrée : 4ᵉ (0,0104) derrière SNCF (1), Menuiserie Dubois SA (0,0194), Boulangerie Martin SARL (0,0163) — doublée par des scores, pas par l'ordre du registre | test_point_de_rupture_le_sigle_n_atteint_pas_les_trois_premiers_double_par_deux_societes_sans_rapport |
| 32 | N1 breaking_point | « Pondérer les fragments rares répare l'ordre des mots et classe la bonne boulangerie devant l'autre » | démontrée | test_point_de_rupture_ponderer_repare_l_ordre_des_mots_et_classe_la_bonne_boulangerie |
| 33 | N1 name | « TF-IDF sur n-grammes de caractères, voisins par cosinus » | démontrée (#35 à #39) | — |
| 34 | N1 escalate_when | « deux désignations distinctes d'une même société — un sigle et sa forme développée, un nom commercial et une raison sociale » | démontrée pour le sigle (#31) ; « nom commercial et raison sociale » non testé (aucun exemple dans la fiche) | — |
| 35 | N1 docstring | « « boulangerie » figure dans la moitié du registre et n'apprend presque rien ; « quiquengrogne » y figure une fois et tranche la question » | démontrée sur un registre de six noms dont quatre boulangeries : idf « quiq » 2,25 > « boul » 1,34 ; « Quiquengrogne » trouve sa boulangerie à 0,80 | test_un_fragment_rare_pese_plus_qu_un_fragment_courant |
| 36 | N1 docstring | « N0 n'en a pas d'équivalent : Jaro-Winkler traite tous les caractères de la même façon » | démontrée : N0 met la boulangerie voisine à 0,897, N1 à 0,539 | test_jaro_winkler_traite_tous_les_caracteres_de_la_meme_facon |
| 37 | N1 docstring | « `char_wb` garde les n-grammes à l'intérieur des frontières de mots » / « un fragment n'enjambe jamais deux mots » | démontrée : aucun n-gramme du vocabulaire ne contient d'espace intérieure | test_les_fragments_ne_chevauchent_jamais_deux_mots |
| 38 | N1 docstring | « « Martin Dubois » et « Dubois Martin » se rencontrent donc […] au contraire de N0, où il coûte presque tout » | démontrée : classements identiques ; N0 0,487 | test_l_ordre_des_mots_ne_coute_rien_ici_au_contraire_de_n0 |
| 39 | N1 match py | « TfidfVectorizer returns rows of length one, so the cosine similarity is just the dot product » ; JS « lignes ramenées à la longueur un » | démontrée (normes à 1e-12, chaque nom contre lui-même à 1) | test_les_lignes_sont_de_longueur_un_donc_le_cosinus_est_un_produit_scalaire |
| 40 | N1 docstring py | « la recherche est un produit de matrices plutôt qu'une boucle sur toutes les paires : c'est ce qui rend un registre entier consultable » | démontrée : 10 000 noms, requête < 0,5 s (mesuré 3 ms py ; 40 ms js, qui boucle sur les noms) | test_une_recherche_dans_dix_mille_noms_est_un_produit_de_matrices / 'une recherche dans dix mille noms termine vite' |
| 41 | N1 commentaire | « A stable sort, so two names with the same score always come back in register order » | démontrée avec trois doublons exacts dans le registre | test_les_egalites_reviennent_dans_l_ordre_du_registre |
| 42 | N1 commentaire | « Two to four characters: long enough to be a syllable, short enough to survive a typo » | démontrée : « Boulangrie Martin » trouve la bonne à 0,819 | test_des_fragments_de_deux_a_quatre_caracteres_survivent_a_une_faute_de_frappe |
| 43 | N1 docstring js | « C'est la même arithmétique que celle de scikit-learn, écrite en entier » | démontrée à 1e-12 sur sept requêtes (accents, mots d'une lettre, « İ ») ; INFIRMÉE dès qu'un caractère hors du plan multilingue de base (emoji, lettres mathématiques) est dans le registre | 'la même arithmétique que scikit-learn : valeurs épinglées en Python', 'INFIRMÉ : « la même arithmétique que scikit-learn » …' (js) ; test_valeurs_epinglees_pour_le_jumeau_javascript (py) |
| 44 | N1 commentaire js | « A word shorter than the window is counted once, whole » | démontrée par l'égalité avec scikit-learn sur « A B » (0,105066545124) | idem |
| 45 | N1 test (existant) | bonne société en premier (0,883177974427) ; pluriel et inversion ; nom inventé classé | démontrée | test_trouve_…, test_un_pluriel_…, test_un_nom_que_personne_… |
| 46 | N1 risks | `deterministic: true`, `vendor_lock: library` | démontrée (py : numpy, sklearn ; js : aucune) | test_n1_est_deterministe, test_n1_s_appuie_sur_scikit_learn_et_numpy |
| 47 | N1 latency | `~10 ms` | non testable tel qu'écrit : la latence dépend de la taille du registre, que la fiche ne donne pas. Mesuré : 0,3 ms py / 0,1 ms js sur 7 noms ; 3 ms py / 40 ms js sur 10 000 noms | — |
| 48 | N1 regulatory / cost / footprint | les deux lignes, `négligeable`, `low` | non testable | — |
| 49 | N1 production | requête vide ; registre vide ; `top_k` 0 et > registre ; accent NFD ou absent ; requête de 95 Ko | démontrée : scores nuls ; py `ValueError`, js `[]` ; `[]` et registre entier ; bonne réponse en tête (0,887 et 0,884 au lieu de 1) ; < 2 s | test_production_… (cinq tests) |
| 50 | N2 breaking_point | « Des mots ordinaires partagés l'emportent sur l'identité. Dans le test, « Boulangerie du Vieux Port » […] passe devant « Le Vieux Moulin » […] et aucun seuil ne démêle les deux » | non testable pour l'encodeur réel ; démontré pour le double seulement (0,75 contre 0,577). Voir plus bas : la phrase présente comme limite du niveau ce que produit le double | test_point_de_rupture_avec_le_double_des_mots_ordinaires_partages_l_emportent_sur_l_identite |
| 51 | N2 breaking_point | « L'extrait est vérifié contre un double local, qui score à zéro la paire de sigles […] ce que l'encodeur réel y gagne, rien ici ne le mesure » | démontrée | test_point_de_rupture_le_double_score_a_zero_la_paire_de_sigles |
| 52 | N2 docstring | « N0 et N1 comparent tous deux des caractères, et tous deux manquent donc la paire » | démontrée | test_n0_et_n1_manquent_tous_deux_la_paire_de_sigles |
| 53 | N2 docstring | « Un encodeur projette chaque nom dans un vecteur selon le sens plutôt que selon l'orthographe, seule façon pour cette paire de se rencontrer un jour » | non testable : comportement du modèle ; « seule façon » est une affirmation absolue (une règle d'initiales ou une table de sigles la rencontre aussi) | — |
| 54 | N2 docstring | « un fichier de modèle à livrer […] un processus chaud […] un score que vous ne saurez pas expliquer […] réencodé à chaque montée de version […] les anciens scores ne sont pas comparables » | non testable : coût d'exploitation, modèle réel | — |
| 55 | N2 docstring | « aucune forme juridique n'est retirée et rien n'est mis en minuscules. L'encodeur est censé s'en charger lui-même » | démontrée : l'encodeur reçoit les noms tels quels ; ce qu'il en fait est non testable | test_aucune_forme_juridique_n_est_retiree_et_rien_n_est_mis_en_minuscules |
| 56 | N2 build_index | « `encoder` is injected so this can be tested without loading a model. Left alone, it is the real one above » | démontrée : sans encodeur, py lève `ModuleNotFoundError: sentence_transformers`, js `ERR_MODULE_NOT_FOUND @xenova/transformers` | test_l_encodeur_est_injecte_et_par_defaut_c_est_le_vrai |
| 57 | N2 load_encoder | « The real encoder: fetched once, then held in memory and run locally » ; appel par défaut | non testable ici (bibliothèque absente, réseau interdit). Surface vérifiée dans la documentation, voir plus bas : les appels existent | test_un_encodeur_a_la_forme_de_sentence_transformers_est_accepte (py), 'un encodeur qui rend des Float32Array …' (js) |
| 58 | N2 match / _unit | « nearest names by meaning, best first » ; « Cosine similarity is a dot product once both sides have length one » ; tri stable ; top_k | démontrée pour la plomberie (vecteurs unitaires, égalités dans l'ordre du registre avec doublons, plafond) | test_le_cosinus_…, test_les_egalites_…, test_top_k_… |
| 59 | N2 test (existant) | registre encodé une fois ; nom sans rien en commun à 0 | démontrée | test_le_registre_est_encode_une_fois_pas_a_chaque_requete, test_un_nom_qui_ne_partage_rien_marque_zero |
| 60 | N2 risks | `deterministic: true`, `data_egress: own-infra`, `testability: statistical`, `footprint: high` ; latency `~100 ms` ; cost `faible` ; les trois lignes réglementaires | non testable : modèle réel absent. Précision : `load_encoder` télécharge les poids depuis le Hub au premier appel | — |
| 61 | N2 production | registre vide ; requête vide ; 10 000 noms × 384 dimensions ; NFD, emoji, BOM, 100 000 caractères | démontrée : `[]` ; scores nuls ; < 2 s (mesuré 185 ms py, 10 ms js par requête, hors encodeur) ; pas d'erreur | test_production_… (trois tests) |
| 62 | N2 escalate_when | « Ce qui vient ensuite n'est pas un autre algorithme, c'est quelqu'un qui tranche » | non testable : organisation | — |
| 63 | N3 unavailable_reason | « sur dix mille noms, cela fait cinquante millions de paires » | démontrée par le calcul : 10 000 × 9 999 / 2 = 49 995 000 | — (arithmétique) |
| 64 | N3 unavailable_reason | « les extraits de cette fiche qui parcourent un registre fixent leur tri pour que deux exécutions rendent les mêmes paires » | démontrée (#41, #58) | test_les_egalites_reviennent_dans_l_ordre_du_registre (N1, N2) |
| 65 | N3 unavailable_reason | « un appel par paire n'existe pas » ; « un modèle généraliste ne se fixe pas ainsi » | non testable : comportement et tarif d'un fournisseur | — |
| 66 | verdict_rationale | « N0 ne coûte rien à exécuter, ne dépend de rien » | démontrée (#15, #25) | — |
| 67 | verdict_rationale | « chacune de ses affirmations est un test unitaire » | non testable : affirmation sur la fiche elle-même ; à ce jour fausse, trois affirmations de N0 sont infirmées (#4, #20, #22) | — |
| 68 | verdict_rationale | « N1 achète l'ordre des mots, la pondération des fragments rares et la recherche dans un registre entier ; son propre test dit ce qu'il n'achète pas […] toujours doublée par deux entreprises sans rapport » ; « Montez à N1 quand… » | démontrée pour les faits (#31, #35, #38, #40) ; le conseil non testable | — |
| 69 | scenario | « Le réflexe est de soumettre chaque paire à un modèle généraliste » | non testable : constat d'usage | — |

## Non testable, et pourquoi

- **#6, #9, #17, #62, #69** : explications, situations d'usage, appréciations.
- **#14 (partie), #18 (partie)** : constats empiriques sur la façon dont varient les noms et dont vivent les listes de formes.
- **#30, #48, #60** : coût, empreinte, régulation déclaratifs ; pour N2, le modèle réel n'est pas chargé.
- **#47** `~10 ms` : sans taille de registre, le chiffre ne se vérifie pas. Les mesures sont au tableau ; à 10 000 noms, JS est à 40 ms, Python à 3 ms.
- **#50, #53, #54, #57, #60** : ce que fait l'encodeur réel. Seul le double est exécuté.
- **#65** : fournisseur.
- **#67** : affirmation sur la fiche ; fausse aujourd'hui.

**N2, #50 — à reprendre.** La charte des tests dit : « Une affirmation qui attribue au modèle ce que le double écrit est fausse. » Le point de rupture de N2 présente « des mots ordinaires partagés l'emportent sur l'identité » comme la limite du niveau, et l'appuie sur « dans le test », où l'ordre Port > Moulin est produit par le double, un sac de mots qui compte les mots communs. Un vrai MiniLM multilingue produit peut-être le même ordre, peut-être non : rien ne le mesure. Le rédacteur doit soit présenter ce point de rupture comme non mesuré, soit le retirer.

**N2, surface des bibliothèques réelles (consigne « DÉFAUT N2 »).** Aucune ligne `DÉFAUT` : les appels existent.
- Python : `SentenceTransformer(name).encode(list_of_str)` rend un `numpy.ndarray` 2D ; `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` est un modèle publié à 384 dimensions. L'extrait lit ce tableau sans conversion (test avec un double qui rend du `float32` 2D).
- JavaScript : `pipeline('feature-extraction', name)` puis `extract(texts, { pooling: 'mean' })` et `.tolist()` existent dans Transformers.js (documentation consultée via context7, `/huggingface/transformers.js`). Deux précisions : le paquet `@xenova/transformers` est l'ancien nom (v2), la bibliothèque est publiée aujourd'hui sous `@huggingface/transformers` ; et Transformers.js charge par défaut les poids quantifiés, si bien que les vecteurs JS ne sont pas ceux de Python et que les scores des deux extraits divergeront.

## Infirmé, et ce que le code fait réellement

- **#4 — Essai, `why` du cas qui échoue : « Sanofi, qui ne partage avec SNCF qu'une première lettre » / « shares nothing with SNCF but a first letter ».** Sanofi contient s, n et f : trois des quatre lettres du sigle, et Jaro les apparie toutes les trois dans sa fenêtre (m = 3, Jaro 0,75, Jaro-Winkler 0,775). Le `breaking_point` de la fiche dit « trois lettres sur quatre » : l'essai contredit la fiche.
- **#20 — N0, commentaire : « never gives back more than a tenth of the score Jaro withheld ».** Le bonus vaut `prefix * 0.1 * (1 - jaro)` avec `prefix` jusqu'à 4 : jusqu'à quatre dixièmes. « martinxy »/« martinzw » : Jaro 0,8333, Jaro-Winkler 0,9, soit 0,4 du score retenu. Un dixième par caractère commun, quatre au plus.
- **#22 — N0, docstring de `_jaro` : « within half the length of the longer name ».** `window = max(len) // 2 - 1` : la moitié moins un, ce qui est la définition standard de Jaro. « abcdef »/« xxxaxx » : le « a » est à distance 3, la moitié de 6, et n'est pas trouvé (Jaro 0) ; à distance 2 il l'est (0,444). Le code est juste, la phrase est fausse de un.
- **#43 — N1, docstring JS : « la même arithmétique que celle de scikit-learn ».** Vrai à 1e-12 sur le plan multilingue de base. Faux au-delà : `padded.slice(i, i + n)` découpe en unités UTF-16, scikit-learn en points de code. Registre `["🍞🥐 Boulangerie Martin", "Boulangerie Dupont", "𝔄𝔅 Conseil"]`, requête « 𝔄𝔅 » : Python 0,475128643566, JavaScript 0,606912036982 ; requête « 🍞🥐 Boulangerie » : 0,763 contre 0,796.

## Défauts de production

- **#27 — N0, noms sans lettre latine.** `re.findall(r"[a-z0-9]+")` après NFKD ne garde que l'ASCII : un nom cyrillique, grec, arabe, chinois ou japonais devient la chaîne vide, et `jaro_winkler("", "")` vaut 1. `similarity("Газпром", "Лукойл") == 1.0`, `similarity("東京電力", "日立製作所") == 1.0` : deux sociétés différentes déclarées identiques, au-dessus de tout seuil. La garde « un nom fait seulement d'une forme juridique la garde » ne couvre pas ce cas.
- **#28 — N0, formes juridiques homographes.** `spa`, `sa`, `ag`, `nv`, `bv`, `inc`, `corp` sont aussi des mots de raisons sociales : « Nordic Spa » et « Nordic SA » normalisent tous deux en « nordic » et obtiennent 1,0. Il faudrait au moins ne retirer une forme qu'en fin de nom, ou refuser le score 1 quand le retrait a changé la chaîne.

## Précisions pour le rédacteur (démontré, mais à resserrer)

- **#7 « rien de tout cela ne compte »** : les trois variantes passent le seuil, mais ne sont pas indifférentes : 0,978 (esperluette) et 0,925 (esperluette + singulier). L'esperluette est retirée comme ponctuation, « et » est gardé : elles ne s'annulent pas.
- **#26** : Jaro est quadratique ; 10 000 caractères prennent 1,4 s en Python. Sans conséquence pour des noms, mais un champ « raison sociale » qui reçoit un paragraphe collé le paiera.
- **Formes pointées** : « S.A.R.L. » donne « s a r l », n'est pas retiré, et « Boulangerie Martin S.A.R.L. » contre « Boulangerie Martin » vaut 0,938 au lieu de 1,0. Forme très courante en France.
- **Caractères de largeur nulle** : « Boulan​gerie Martin » coupe le mot et tombe à 0,956.
- **#31** : la raison sociale est doublée par « Menuiserie Dubois SA » et « Boulangerie Martin SARL » à cause de n-grammes d'une ou deux lettres (« s », « sa », « f »), pour des scores de 0,02 : l'affirmation est vraie, mais l'écart est de l'ordre du bruit.
- **#40** : l'extrait JS ne fait pas de produit de matrices, il boucle sur les noms (40 ms à 10 000). La phrase n'est que dans la docstring Python, ce qui est cohérent, mais le rendu de la fiche montre les deux.

## Pour la charte

- **Essai contre fiche** : l'essai et la fiche ont dit deux choses différentes du même exemple (#4). La charte pourrait exiger que le `why` d'un essai reprenne mot pour mot le point de rupture, ou soit testé comme lui.
- **Double qui fait le travail de l'extrait** : `FakeEncoder` met en minuscules et découpe les mots ; un test N2 s'appuyait dessus pour conclure que « l'encodeur replie la casse ». La charte devrait dire qu'un test d'un niveau `stubbed` n'a pas le droit de conclure sur une propriété que le double fournit.
- **Unités UTF-16** : même remarque que pour la fiche précédente ; tout extrait JS qui découpe une chaîne par indices diverge de Python hors du plan de base. Un cas emoji devrait figurer dans « encodage inattendu » avec une valeur épinglée des deux côtés.

## Tour 1 — contre-épreuve

Tests repris après `ac02584`. `node scripts/test-snippets.mjs fuzzy-match-company-names` : vert.
Compte : n0 26 → 32 tests par langage ; n1 21 → 22 (py), 22 → 23 (js) ; n2 15 → 16 (py), 15 (js).

### « À retester », ligne par ligne

| # | Ligne du rédacteur | Statut désormais | Test |
|---|---|---|---|
| R1 | liste des formes sans `spa` ; « Nordic Spa » garde « spa » | démontrée : `ltd`, `gmbh`, `llc`, `bv` retirés ; `spa` absent ; `normalise("Nordic Spa") == "nordic spa"` ; 0,92 contre « Nordic SA » ; témoin « Nordic SA » / « Nordic » à 1,0 | test_la_liste_des_formes_juridiques_est_francaise_et_etrangere, test_spa_n_est_pas_une_forme_et_nordic_spa_ne_fusionne_pas_avec_nordic_sa |
| R2 | « Ø », « ß » gardés, non repliés ; Ørsted/Orsted 0,8889 | démontrée dans les deux langages | test_production_une_lettre_sans_decomposition_est_gardee_pas_repliee |
| R3 | essai « trois lettres sur quatre » | démontrée : texte fr/en de l'essai, et {s, n, f} | test_l_essai_sanofi_partage_avec_sncf_trois_lettres_sur_quatre |
| R3 | commentaire « a tenth of the score Jaro withheld for each of them that both names share » | démontrée : rendu exact de 0,1 × k pour k = 1 à 4 caractères communs en tête, plafonné à 0,4 pour 5 et 6 | test_winkler_rend_un_dixieme_du_score_retenu_par_caractere_commun_en_tete |
| R3 | docstring « less than half the length […] at most that half, minus one » | démontrée : « abcdef », jumeau à distance 2 trouvé (0,444), à distance 3 non (0) | test_la_fenetre_vaut_la_moitie_de_la_longueur_moins_un |
| R3 | retrait des trois tests `INFIRMÉ` | fait : remplacés par les trois tests ci-dessus | — |
| R4 | renommer les tests démarqués | fait : `production : deux noms non latins différents restent sous le seuil` (0,4365 et 0,0, py/js) ; le test « Nordic Spa » est fondu dans R1 ; n1 JS : `la même arithmétique que scikit-learn, hors du plan multilingue de base aussi` | — |
| R5 | n2 JS : `@huggingface/transformers`, `dtype: 'fp32'` | démontrée par un double du module (crochet de résolution `module.register`) : `pipeline('feature-extraction', 'Xenova/…', { dtype: 'fp32' })` appelé une fois, extracteur appelé avec `{ pooling: 'mean' }` pour le registre puis pour chaque requête, `.tolist()` lu. Le cas « module absent » n'est plus testé en JS (le crochet s'applique à tout le fichier) ; il reste en Python | l'encodeur est injecté, et par défaut c'est le vrai, chargé une fois en pleine précision |
| R6 | noms grecs, arabes, chinois ; `jaroWinkler('𠀀𠀁x', '𠀀𠀁y')` | démontrée, mêmes valeurs py/js : identiques à 1,0 ; différents 0,5556 (grec), 0,5881 (arabe), 0,7333 (chinois, sous le seuil) ; 0,8222 | test_production_grec_arabe_chinois_identiques_a_un_et_differents_sous_le_seuil, test_production_des_caracteres_hors_du_plan_de_base_comptent_pour_un |
| R6 | formes homographes restantes (« Sa Nostra ») | **DÉFAUT maintenu** : jugé réaliste. « Sa Nostra » (caisse d'épargne des Baléares) normalise en « nostra » ; « NV Energy » (distributeur d'électricité du Nevada) en « energy » : 1,0 contre « Nostra », « Energy Ltd ». Le retrait porte sur tout mot du nom, pas sur la fin | test_defaut_une_forme_juridique_en_tete_de_nom_ne_fusionne_pas |
| R7 | n1 JS « 🍞🥐 Boulangerie » | démontrée : 0,76304806389 dans les deux langages (arrondi à 12 décimales) | la même arithmétique que scikit-learn, hors du plan multilingue de base aussi / test_valeurs_epinglees_pour_le_jumeau_javascript |
| R8 | N2 breaking_point : ne plus présenter le test du double comme point de rupture | fait : `le double seul : une autre boulangerie passe devant le même nom sous sa forme courte` (0,75 contre 0,577) et `le double seul : la paire de sigles marque zéro` | — |
| R9 | essai, libellé cas 2 et `why` cas 4 | démontrée : « tout reste au-dessus du seuil » (≥ 0,85 pour les deux variantes) ; `why` voir R3 | test_l_essai_trois_premiers_cas, test_l_essai_sanofi_… |

### Phrases nouvelles ou modifiées

| Où | Phrase | Statut | Test |
|---|---|---|---|
| N0 docstring py/js + doc.fr | « which suits names that differ at the tail: a form, a city, a scrap of punctuation after the same brand » | démontrée : ville en queue 0,9565, « (ex-Dupuis) » en queue 0,9286 ; témoin : la ville en tête 0,7794, sous le seuil ; la forme, voir #10 | test_jaro_winkler_recompense_un_debut_commun |
| N0 commentaire py/js | « Letters and digits of every script: a Cyrillic or Japanese name is kept, not emptied » | démontrée (R4, R6) ; voir le défaut devanagari ci-dessous | test_production_deux_noms_non_latins_… |
| N0 commentaire js | « Code points, as Python counts them, not UTF-16 units » | démontrée (R6) | test_production_des_caracteres_hors_du_plan_de_base_comptent_pour_un |
| N0 docstring js | « the algorithm is thirty lines » | démontrée : `jaro` + `jaroWinkler` ≤ 30 lignes de code. Test gardé : c'est une phrase de la fiche, pas la limite des quarante lignes de la charte | n0 n'emploie aucune dépendance, et l'algorithme tient en trente lignes |
| N1 commentaire js | « Code points, as scikit-learn counts them: an emoji is one character » | démontrée (R7) | idem R7 |
| N2 docstring py/js + doc.fr | « The encoder maps each name to a vector built for semantic search, where closeness is meant to follow meaning […] Whether it brings that pair together, nothing here measures. » | non testable : propriété du modèle réel, absent | — |
| N2 docstring py/js + doc.fr | « model weights to download and keep, a process that holds them in memory » | démontrée pour la plomberie : l'encodeur par défaut est chargé une fois (`SentenceTransformer(MODEL_NAME)` en py, `pipeline(...)` en js, doublés), gardé dans l'index, et réutilisé par chaque requête | test_par_defaut_sentence_transformers_est_charge_une_fois_et_garde_pour_les_requetes ; l'encodeur est injecté, et par défaut c'est le vrai, chargé une fois en pleine précision |
| N2 docstring py/js + doc.fr | « a score that cannot be explained fragment by fragment, as N1's can » | démontrée pour N1 : le score « Boulangerie Dupont » → « Boulangerie Martin SARL » (0,467) est la somme de 33 contributions positives, une par fragment partagé, toutes tirées du mot « boulangerie » ; même somme en JS. Pour N2, non testable (encodeur réel) | test_le_score_s_explique_fragment_par_fragment (n1) |
| N2 docstring py/js + doc.fr | « vectors from two models are not interchangeable » | non testable : propriété des modèles réels (source : LlamaIndex) | — |
| N2 commentaire js | « Full precision, the weights Python loads: a quantised default would give other vectors » | démontrée pour l'option passée (`dtype: 'fp32'`) ; l'égalité des vecteurs py/js est non testable (modèle absent) | idem R5 |
| N2 breaking_point | « Non mesuré […] Où casse l'encodeur réel, et ce qu'il gagne sur les sigles, rien dans cette fiche ne le mesure » | non testable, par construction ; les deux faits sur le double sont démontrés (R8) | — |
| N2 escalate_when | « les paires que le score laisse en suspens vont à quelqu'un qui tranche » | non testable : organisation | — |
| N3 unavailable_reason | « cinquante millions de paires, donc cinquante millions d'appels » ; « le fournisseur pris en exemple ne garantit pas le déterminisme, même à graine fixée » | démontrée par le calcul (49 995 000) ; la seconde, non testable : fournisseur (source : OpenAI Cookbook) | — |
| verdict_rationale | « chacun de ses scores se vérifie par un test unitaire » | démontrée : chaque score de N0 cité par la fiche et l'essai a son test épinglé | suite n0 |
| scenario | « On peut soumettre chaque paire à un modèle généraliste » | non testable : possibilité d'usage | — |

### Code modifié : cas de production

- **n0 `normalise`, écritures non latines** : démontrés ci-dessus (cyrillique, grec, arabe, chinois, japonais).
- **DÉFAUT nouveau — voyelles effacées.** `unicodedata.category(c).startswith("M")` / `\p{M}` retire aussi les voyelles dépendantes (`Mc`, `Mn`) du devanagari, du bengali, du thaï, etc., qui ne sont pas des accents : « कमल उद्योग » (Kamal) et « कोमल उद्योग » (Komal) normalisent tous deux en « कमल उदयग » ; « กินดี » et « กันดี » en « กนด ». Deux sociétés différentes à 1,0, dans les deux langages. Piste : ne retirer que les marques qui suivent une lettre latine, grecque ou cyrillique, ou les seules marques `Mn` après NFD pour ces écritures.
- **Noms faits seulement d'emoji ou de ponctuation** : « 🍞 » et « 🚗 » valent 1,0 (chaîne vide des deux côtés). Décision du rédacteur, non marqué ; test qui fixe le comportement. Le commentaire du code qualifie ce cas de « worse than useless » pour les noms faits d'une forme : **au relecteur de trancher** si cette décision tient.
- **Formes pointées, largeur nulle** : décision du rédacteur, non marqué ; 0,9385 et 0,9561, au-dessus du seuil.
- **n0.js, points de code** : 0,8222 py/js ; noms de 2 470 caractères toujours < 2 s.
- **n1.js, points de code** : valeurs épinglées sur emoji et lettres mathématiques ; requête de 95 Ko < 2 s.
- **n2.js, chargement** : voir R5.

### Aucun marquage retiré sans test ; aucun ajouté hors des deux `DÉFAUT` signalés en tête.
