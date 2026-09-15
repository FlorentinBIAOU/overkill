# find-duplicate-records — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/find-duplicate-records/n{0,1,2}.test.{py,js}`.
Avant : 44 tests. Après : 114 (n0.py 22, n0.js 26, n1.py 18, n1.js 18, n2.py 15,
n2.js 15). Les tests d'origine sont renommés en français, assertions gardées. Les
quatre tests de l'essai vivent dans `n0.test.js`.

`node scripts/test-snippets.mjs find-duplicate-records` : vert, avec les
marquages ci-dessous.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Un chiffre faux dans le code postal suffit : le test montre les deux textes à 0,96, très au-dessus du seuil, et la paire absente du résultat » | démontrée (py, js) : clés différentes, similarité 0,957 arrondie à 0,96, résultat vide ; témoin : même code postal, la paire sort | test_point_de_rupture_un_chiffre_faux_dans_le_code_postal_les_textes_a_0_96_et_la_paire_absente |
| 2 | N0 breaking_point | « ne sont jamais comparées, quel que soit le seuil » | démontrée (py, js) aux seuils 0, 0,5, 0,85 | test_point_de_rupture_jamais_comparees_quel_que_soit_le_seuil |
| 3 | N0 breaking_point | « « Dupont Jean » […] est manqué deux fois : la clé sépare les deux fiches, et la distance d'édition ne les aurait pas rapprochées non plus » | démontrée (py, js) : clés « dup: » et « jea: », similarité 0,565 sous le seuil de 0,85 | test_point_de_rupture_dupont_jean_est_manque_deux_fois_la_cle_et_la_distance |
| 4 | N0 name | « Normalisation, clé de blocage, puis distance d'édition » | démontrée (py, js) | test_trouve_les_deux_paires_en_doublon_et_rien_d_autre |
| 5 | N0 docstring | « la normalisation retire […] la casse, les accents, la ponctuation, les espaces doubles » | démontrée (py, js) | test_la_normalisation_retire_casse_accents_ponctuation_et_espaces_doubles |
| 6 | N0 docstrings | « Levenshtein distance » ; « 1.0 for identical strings, 0.0 for strings sharing nothing » ; « Three letters of the family name and the postcode » ; « The threshold is yours to set » | démontrée (py, js) | test_la_distance_d_edition_…, test_la_similarite_…, test_la_cle_prend_…, test_le_seuil_est_a_vous |
| 7 | N0 docstring / scenario | « Comparer toutes les paires de dix mille fiches fait cinquante millions de comparaisons » ; N3 : « cinquante millions d'appels » | démontrée (arithmétique : 49 995 000) | test_dix_mille_fiches_font_cinquante_millions_de_paires |
| 8 | N0 docstring | « Les grouper d'abord […] ramène cela à quelques milliers » | non testable : dépend entièrement de la répartition des noms et des codes postaux du fichier ; chiffre sans source. Constat sur la machine de test : un fichier de 10 000 fiches à 20 codes postaux et 10 débuts de nom fait environ 250 000 comparaisons et prend une vingtaine de secondes en Python | — |
| 9 | N0 docstring | « le seul niveau ici qui reste rapide quand le fichier grossit, parce qu'il ne compare jamais toutes les paires » | INFIRMÉE (py, js) : quand les fiches partagent la clé (même code postal, même début de nom), il les compare toutes : 300 fiches, 44 850 paires au seuil zéro. La rapidité dépend de la clé, pas du niveau. Constat : `record_text` est recalculé à chaque comparaison | test_infirme_le_niveau_ne_compare_jamais_toutes_les_paires |
| 10 | N0 docstring | « Tout le prix du niveau est dans la clé que vous choisissez, et son angle mort aussi » | démontrée par 1 à 3 | — |
| 11 | N0 risks / regulatory | `true`, `none`, `unit` ; « l'extrait propose des paires et un score, il ne fusionne rien » | démontrée (py, js) : seul `unicodedata` en Python, aucun import en JavaScript ; les fiches ne sont pas modifiées | test_l_extrait_est_deterministe_…, test_il_propose_des_paires_et_un_score_il_ne_fusionne_rien |
| 12 | N0 escalate_when | « Vous retrouvez à la main des doublons dont le champ qui sert de clé diffère » | non testable : condition d'exploitation ; le constat est 1 à 3 | — |
| 13 | N0 production | fichier vide, fiche unique, nom vide, 10 000 fiches variées, NFD / insécable / casse, seuil exactement atteint, identiques au seuil 1 | démontrée (py, js). Constat : deux fiches sans nom au même code postal sortent comme doublons certains (1,0), assertion d'origine gardée | test_production_… |
| 14 | N0 production | nom `None` | py : DÉFAUT, `normalise(None)` lève `AttributeError` ; js : ne lève pas, lit « null » comme un mot | test_defaut_un_nom_nul_ne_fait_pas_lever / production : un nom nul ne fait pas lever |
| 15 | N0 production | caractère de largeur nulle dans le nom (« Du\u200bpont ») | DÉFAUT (py, js) : le mot est coupé, la clé devient « pon:75011 », la paire n'est jamais comparée | test_defaut_un_caractere_de_largeur_nulle_dans_le_nom_change_la_cle |
| 16 | N1 breaking_point | « « SNCF » et « Société Nationale des Chemins de Fer » […] ne partagent presque aucune tranche de lettres, tandis que « SNEF » […] obtient un meilleur score » | démontrée (py, js) : 0,151 contre 0,478 | test_point_de_rupture_snef_obtient_un_meilleur_score_… |
| 17 | N1 breaking_point | « baisser le seuil jusqu'à faire apparaître le vrai doublon fusionne d'abord les deux sociétés » | démontrée (py, js), témoin : entre les deux scores, seule la mauvaise paire sort | test_point_de_rupture_baisser_le_seuil_… |
| 18 | N1 breaking_point | « Les n-grammes de caractères mesurent l'orthographe, pas l'identité » | démontrée par 16 | — |
| 19 | N1 name / docstring | « TF-IDF sur n-grammes de caractères » ; « Ce niveau abandonne la clé » ; survit « à une faute de frappe, à un ordre des mots inversé et à un champ tronqué » | démontrée (py, js) : les deux paires que N0 ne compare pas sortent ; ordre inversé 1,0 ; « Dupond » et « Société Génér » au-dessus du seuil | test_trouve_les_paires_que_la_cle_de_n0_ne_compare_jamais, test_l_ordre_des_mots_…, test_une_faute_de_frappe_et_un_champ_tronque_… |
| 20 | N1 docstring (py) | « `char_wb` keeps n-grams inside word boundaries » ; (js) « Padding each word with spaces is what keeps "dupont" from borrowing an n-gram from the join » | démontrée (py sur l'analyseur ; js par le score d'ordre inversé) | test_les_n_grammes_restent_dans_les_mots |
| 21 | N1 commentaire js | « The inverse document frequency is what stops "paris" […] from making every pair look alike » | démontrée (js) : quatre Parisiens sans rapport restent sous 0,3 | l'IDF empêche une ville commune de rapprocher toutes les paires |
| 22 | N1 docstring / regulatory | « Rien ici n'est appris d'un corpus » ; « rien du fichier n'est appris ni conservé au-delà de l'exécution » | démontrée (py, js) : un appel sur un autre fichier ne change pas le résultat suivant | test_rien_n_est_appris_ni_conserve_d_un_appel_a_l_autre |
| 23 | N1 docstring / verdict | « sans clé, dans le pire des cas, toutes les paires » | démontrée (py, js) : 40 fiches, 780 paires | test_sans_cle_toutes_les_paires_sont_examinees |
| 24 | N1 commentaire py | « A neighbour index, not a full similarity matrix: the matrix is the thing that stops fitting in memory first » | non testable : mémoire non mesurée par un test | — |
| 25 | N1 commentaire js | « Walking the shorter vector: only the grams the two records share contribute anything » | non testable par exécution (le résultat est le même) ; à la lecture, faux : la boucle parcourt toujours `vectors[i]`, jamais le plus court des deux | — |
| 26 | N1 docstring js | « it fits in one screen with no dependency » ; risks `none`, `true` | démontrée pour l'absence d'import et le déterminisme ; « un écran » non testable | test_l_extrait_n_importe_… |
| 27 | N1 risks.testability / regulatory / escalate_when | `unit` ; « Traitement de données personnelles » ; « un sigle et sa forme développée » | démontrée pour escalate_when (16) ; le reste non testable | — |
| 28 | N1 production | vide, fiche unique, 2 000 fiches, NFD / insécable / largeur nulle, seuil zéro | démontrée (py, js). Constat : la version JavaScript est quadratique en pur JavaScript, de l'ordre de huit secondes pour 3 000 fiches sur la machine de test | test_production_… |
| 29 | N1 production | fiches sans aucune lettre | py : DÉFAUT, `TfidfVectorizer` lève `ValueError: empty vocabulary` ; js : liste vide | test_defaut_des_fiches_sans_aucune_lettre_ne_font_pas_lever / production : des fiches sans aucune lettre ne font pas lever |
| 30 | N1 production | deux fiches identiques au seuil 1,0 | py : démontrée ; js : DÉFAUT, le cosinus vaut 0,9999999999999999 et la paire ne sort pas | test_production_des_fiches_identiques_sortent_au_seuil_un / DÉFAUT : des fiches identiques ne sortent pas au seuil un |
| 31 | N2 breaking_point | « Dans le test, « Câble HDMI 2 m » est plus proche de « Câble HDMI 3 m » que de la même référence écrite « HDMI lead, 2 metres, black » ; au seuil par défaut, l'extrait rapproche les deux câbles différents et rate le vrai doublon » | démontrée (py, js) pour ce que fait l'extrait avec les vecteurs du double ; témoin : le fichier clients est lu | test_point_de_rupture_cable_hdmi_2_m_…, test_point_de_rupture_au_seuil_par_defaut_… |
| 32 | N2 breaking_point | « Le double local du test accentue l'écart ; le rapprochement de deux lignes presque identiques, lui, est ce que font aussi les vrais encodeurs » ; « le jeton qui distingue deux lignes pèse peu » | non testable : comportement d'un vrai encodeur. La fiche le dit honnêtement | — |
| 33 | N2 docstring | « deux fiches qui disent la même chose avec d'autres mots […] « Société Nationale des Chemins de Fer » et « SNCF » peuvent se retrouver proches » | non testable : comportement du modèle | — |
| 34 | N2 docstring / commentaires / docstring de test | « One batched call » ; « normalised the same way for every rung » ; « an encoder that fails or answers the wrong shape raises » ; fichier trop petit sans appel ; fiches vides | démontrée (py, js) pour l'appel unique, la normalisation commune aux trois niveaux, un lot tronqué ou trop long, un modèle qui lève, fichier de 0 ou 1 fiche sans appel, fiches vides à 0,0 | test_encode_tout_le_fichier_…, test_les_fiches_sont_normalisees_…, test_un_lot_tronque_ou_trop_long_…, test_un_modele_qui_ne_tourne_pas_leve, test_un_fichier_trop_petit_…, test_des_fiches_vides_… |
| 35 | N2 docstring de test | « the wrong shape raises rather than returning an empty result that reads like "no duplicates found" » | DÉFAUT (py, js) pour les vecteurs mal formés : dimensions différentes (Python tronque le produit scalaire et rend 1,0, JavaScript obtient NaN et perd la paire) ou NaN (paire perdue dans les deux) ne lèvent pas | test_defaut_des_vecteurs_de_mauvaise_forme_levent |
| 36 | N2 encodeur par défaut | `SentenceTransformer(MODEL_NAME).encode(texts)` (py) ; `pipeline('feature-extraction', MODEL_NAME)` puis `extract(batch, { pooling: 'mean' }).tolist()` (js) | non testable ici (bibliothèques non installées). Surface vérifiée dans la documentation (sentence-transformers ; transformers.js via context7, qui montre exactement `extractor(texts, { pooling: "mean" })` puis `.tolist()`) : les deux appels existent. Le paquet JavaScript importé est `@xenova/transformers`, ancien nom de `@huggingface/transformers` | test_l_encodeur_par_defaut_est_multilingue_… (vérifie le code source, pas l'appel) |
| 37 | N2 docstring / commentaire | « quelques centaines de mégaoctets de poids » ; « A multilingual model » | non testable ici ; à sourcer par le rédacteur sur la fiche du modèle (le nom indique bien un modèle multilingue) | — |
| 38 | N2 risks / regulatory / escalate_when | `own-infra`, `true`, `statistical` ; licence et provenance ; « une relecture humaine des paires que le score laisse en zone grise » | non testable : modèle réel, juridique, conseil | — |
| 39 | N2 production | 1 000 fiches ; NFD / insécable / casse normalisés avant l'appel | démontrée (py, js) | test_production_mille_fiches_…, test_production_accents_decomposes_… |
| 40 | N2 production | deux fiches identiques au seuil 1,0 | py : démontrée ; js : DÉFAUT, même arrondi flottant qu'en N1 | test_production_des_fiches_identiques_sortent_au_seuil_un / DÉFAUT : des fiches identiques ne sortent pas au seuil un |
| 41 | verdict_rationale | « N0 est le seul niveau qui décide à l'avance quelles paires méritent un regard […] : les deux autres comparent, dans le pire des cas, toutes les paires » | démontrée (py, js) pour N1 (23) et N2 (toutes les paires au seuil zéro) ; mais voir 9 : N0 aussi compare toutes les paires d'un même bloc | test_le_seuil_est_a_vous_et_toutes_les_paires_sont_comparees |
| 42 | verdict_rationale | « le test vous montre exactement ce que cela coûte » | démontrée par 1 à 3 | — |
| 43 | verdict_rationale | « Montez à N1 le jour où vos doublons se cachent précisément dans le champ dont la clé est faite » | démontrée pour le constat (N1 trouve les paires de 1 et 3, test 19) ; le conseil est non testable | — |
| 44 | scenario | « presque aucune n'a quoi que ce soit en commun » ; « il se fait avec une clé et une boucle » | non testable : description | — |
| 45 | N3 unavailable_reason | « l'appel ne répond qu'à la question facile, celle de juger une paire qu'on lui a déjà désignée » | non testable : pas de code N3 | — |
| 46 | essai, cas 1 | cinq fiches, deux saisies deux fois | démontrée (fr, en) : deux paires, quatre lignes surlignées | essai : cinq fiches clients, deux saisies deux fois, deux paires |
| 47 | essai, cas 2 | « Trois Dupont à la même adresse » | démontrée pour les 3 comparaisons. Constat : « Jean Dupont » et « Jeanne Dupont » sortent en doublon à 0,92, sans que le cas le dise ni soit marqué en échec ; un lecteur y verra un doublon juste | essai : trois Dupont à la même adresse sont tous comparés |
| 48 | essai, cas 3, why et note | « rien ne sort, quel que soit le seuil : aucune des trois paires ne partage la clé de blocage » ; « deux de ces fiches se ressemblent à 0,96 et n'ont jamais été mises côte à côte » | démontrée (fr, en), cas marqué `fails: true` | essai : un chiffre de travers et un nom à l'envers… |
| 49 | essai, note générale | « Deux fiches qui ne partagent pas trois lettres de nom de famille et le même code postal ne sont jamais comparées » | démontrée par 1 et 48 | — |

## Non testable, et pourquoi

- 8 : « quelques milliers » dépend du fichier ; chiffre sans source.
- 12, 27 (en partie), 38, 43 (conseil) : conditions d'exploitation, juridique.
- 24 : mémoire non mesurée.
- 25 : commentaire sur le parcours interne, sans effet observable ; faux à la
  lecture.
- 26 (« un écran »), 44 : description.
- 32, 33, 36, 37 : vrai encodeur non chargé dans les tests ; surfaces vérifiées
  dans la documentation.
- 45 : niveau sans code.

## Infirmé, et ce que le code fait réellement

- **9** : N0 « ne compare jamais toutes les paires » est faux dès que les fiches
  partagent la clé : il compare toutes les paires du bloc. Sa rapidité est une
  propriété de la clé et du fichier.
- **25** (non testable, faux à la lecture) : le code N1 JavaScript ne parcourt
  pas « le vecteur le plus court ».

## Défauts de production

- **14 (Python)** : nom `None` qui fait lever.
- **15** : caractère de largeur nulle qui change la clé de blocage.
- **29 (Python)** : fiches sans lettre qui font lever `TfidfVectorizer`.
- **30, 40 (JavaScript)** : deux fiches identiques absentes au seuil 1,0 par
  arrondi flottant, en N1 et en N2.
- **35** : vecteurs de mauvaise forme acceptés en N2, paire perdue ou score faux.

## Pour la charte

- Un seuil « à vous » doit se tester à ses deux bornes, 0 et 1, dans les deux
  langages : l'arrondi flottant du cosinus en JavaScript fait disparaître la
  paire parfaite au seuil 1.
- Une affirmation de complexité (« ne compare jamais toutes les paires ») se
  teste sur le pire cas qu'elle exclut, pas seulement sur un fichier bien
  réparti.
- Les cas d'un essai qui produisent un faux positif (47) devraient être marqués
  ou expliqués : la charte des essais ne dit rien d'un cas « qui marche » en
  rendant une erreur.
