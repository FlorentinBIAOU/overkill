# show-similar-articles — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/show-similar-articles/n{0,1,2}.test.{py,js}`
(N3 non disponible). Avant : 44 tests. Après : 162 (n0.py 26, n0.js 26, n1.py 28,
n1.js 36, n2.py 23, n2.js 23). Les tests d'origine sont renommés en français ;
assertions gardées, sauf une (ligne 6). L'essai interactif (niveau N1) est testé
dans `n1.test.js`, huit tests.

`node scripts/test-snippets.mjs show-similar-articles` : vert, avec les marquages
ci-dessous.

Comme pour search-in-your-own-documents, le chargement par défaut de N2 est
exécuté contre un module à la surface du paquet publié (`sys.modules` en Python,
crochet `module.register` en JavaScript).

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Un fonds mal étiqueté ne produit aucune similarité » ; « Les deux tables sortent entièrement vides » | démontrée (py, js) sur les deux fonds du test | test_point_de_rupture_un_fonds_mal_etiquete_ne_produit_aucune_similarite |
| 2 | N0 breaking_point | « chaque article porte « blog » et « article », dont le poids vaut exactement zéro » | démontrée (py, js) : `{blog: 0.0, article: 0.0}` ; témoin : sans pondération, ces articles seraient semblables à 1,0 | test_point_de_rupture_blog_et_article_pesent_exactement_zero |
| 3 | N0 breaking_point | « chaque article porte une étiquette que lui seul porte » | démontrée (py, js) ; témoin : une étiquette partagée par deux articles fait apparaître la paire (0,12) | test_point_de_rupture_chaque_article_porte_une_etiquette_que_lui_seul_porte |
| 4 | N0 breaking_point | « l'échec est total plutôt que dégradé […] le bloc n'apparaît sur aucune page » | démontrée (py, js) pour les deux fonds du test ; témoin : cinq pages sur six ont un bloc sur le blog bien étiqueté. Précision indispensable : il faut l'universalité exacte. Qu'un quatrième article ne porte pas « article », et les trois articles génériques deviennent voisins à 1,0 les uns des autres : la table n'est pas vide, elle est pleine de fausses correspondances parfaites. « Mal étiqueté » échoue donc aussi en plein, pas seulement à vide | test_point_de_rupture_l_echec_est_total_…, test_point_de_rupture_un_seul_article_de_plus_… |
| 5 | N0 escalate_when | « La table que vous construisez contient des lignes vides, parce que vos étiquettes sont soit sur tous les articles, soit sur un seul » | INFIRMÉE (py, js) comme signal : une étiquette sur tous les articles sauf un ne vide aucune ligne, elle les remplit à 1,0 (voir 4). Le symptôme décrit ne se déclenche que dans le cas limite exact | test_infirme_une_etiquette_presque_universelle_laisse_des_lignes_vides |
| 6 | N0 docstring | « Counting shared tags is the obvious version, and it is the wrong one » | démontrée (py, js). Le test d'origine affirmait `{seo-checklist: 2, sourdough-troubles: 1}` écrit à la main, ce qui ne démontrait rien et était faux : les quatre autres articles partagent chacun deux étiquettes. Réécrit : un simple compte les met à égalité et donne la tête à css-grid (identifiant), la rareté la donne à sourdough-troubles | test_la_rarete_bat_le_compte_des_etiquettes_partagees |
| 7 | N0 docstring | « Weighting each tag by its rarity is the whole difference between a useful block and one that files the site announcement next to every article on the site » | démontrée (py, js) : à poids 1, site-news a une similarité positive avec chaque article ; pondéré, il n'apparaît dans aucun bloc | test_sans_la_rarete_l_annonce_du_site_se_range_… |
| 8 | N0 docstrings, commentaires | « log(corpus size / tag count) is exactly zero for a tag carried by every article » ; « Cosine between two tag sets » ; « An article carrying only universal tags has a null vector, and no neighbours » ; « Ties broken by identifier, so that two builds give the same page » | démontrée (py, js) ; égalités : même table quel que soit l'ordre d'entrée | test_une_etiquette_que_tous_portent_…, test_la_similarite_…, test_un_article_qui_ne_porte_que_…, test_les_egalites_… |
| 9 | N0 name, docstring, risks | « pondéré par la rareté » ; « Standard library, deterministic, and computed once for the whole corpus » ; `none`, `true`, `unit` | démontrée (py : `math`, `collections` ; js : aucun import) | test_la_table_entiere_…, test_l_extrait_n_importe_que_la_bibliotheque_standard, test_deux_constructions_… |
| 10 | N0 regulatory | « Aucun profilage du lecteur : la table de voisins est la même pour tout le monde » | démontrée : la fonction ne prend que le fonds, `k` et `minimum` | test_la_table_ne_depend_d_aucun_lecteur |
| 11 | N0 docstring de build | « Rendering the block on a page is then a lookup in this table, never a search » | non testable : usage | — |
| 12 | N0 latency, cost | « <1 ms », `nul` | non testable : ordre de grandeur déclaré | — |
| 13 | N0 production | fonds vide, un article, article sans étiquette, 1 000 articles, étiquette répétée, emoji / insécable / BOM, k = 0, score égal au minimum (écarté, strictement supérieur) | démontrée (py, js). Constat : « Sourdough » et « sourdough » sont deux étiquettes | test_production_… |
| 14 | N0 production | étiquettes NFC et NFD identiques à l'œil | DÉFAUT (py, js) : ne se rencontrent pas | test_defaut_une_etiquette_nfd_ne_rencontre_pas_la_meme_en_nfc |
| 15 | N0 production | `tags` en chaîne au lieu d'une liste | DÉFAUT (py, js) : découpée lettre à lettre ; « blog » et « gloss » voisins à 0,29 | test_defaut_des_etiquettes_en_chaine_sont_lues_lettre_a_lettre |
| 16 | scenario | « Les trois niveaux de cette fiche rendent la même table, un article vers ses voisins et leurs scores, et le code qui affiche le bloc ne change pas » | démontrée pour la forme (py : tuples `(str, float)` aux trois niveaux ; js : paires `[string, number]`). Constat : en JavaScript, N2 rend une promesse, N0 et N1 une valeur ; le code qui construit la table change donc, pas celui qui l'affiche. Les planchers par défaut diffèrent (0 ; 0,05 ; 0) | test_scenario_les_niveaux_rendent_la_meme_forme_de_table (n0), test_scenario_la_table_a_la_meme_forme_… (n2) |
| 17 | scenario | « il ne change que lorsqu'un article est publié ou que ses étiquettes changent » | démontrée pour N0. INFIRMÉE (py, js) pour N1 et N2, qui lisent le texte : réécrire le corps de l'annonce du site, sans publier ni réétiqueter, lui donne un voisin | test_infirme_la_table_ne_change_qu_a_la_publication_ou_au_reetiquetage (n1) |
| 18 | scenario | « On voit un appel de modèle au moment d'afficher la page » ; « c'est une table à construire une fois » | non testable : constat d'usage et conseil | — |
| 19 | N1 breaking_point | « TF-IDF compare des chaînes de caractères, pas des sens. […] leur cosinus vaut exactement zéro, pas une valeur basse » | démontrée (py, js) : 0,0, aucun jeton commun | test_point_de_rupture_le_meme_sujet_en_deux_langues_vaut_exactement_zero |
| 20 | N1 breaking_point | « une annonce de déménagement de bureau […] obtient un score strictement supérieur » | démontrée (py, js) : 0,199 ; elle entre même dans le bloc au plancher par défaut | test_point_de_rupture_l_annonce_de_demenagement_… |
| 21 | N1 breaking_point | « qui ne partage avec l'article anglais que de la grammaire » | INFIRMÉE (py, js) : jetons communs `and, day, is, of, the, will` ; « day » n'est pas de la grammaire (« for a day » / « twice a day »). Sans « for a day », le score reste 0,192 : la conclusion tient, l'exemple est à corriger | test_infirme_l_annonce_ne_partage_que_de_la_grammaire, test_point_de_rupture_la_grammaire_seule_suffit_… |
| 22 | N1 breaking_point | « Aucun seuil ne rattrape cela » | démontrée (py, js) : sur neuf planchers de -1 à 0,5, tout plancher qui garde le jumeau garde l'annonce, et aucun plancher positif ne garde le jumeau | test_point_de_rupture_aucun_seuil_ne_rattrape_cela |
| 23 | N1 name | « TF-IDF sur le texte, similarité cosinus, calculée hors ligne » | démontrée (py, js) : lignes normalisées, un article et sa copie valent 1,0 ; normes = 1 en js | test_les_lignes_normalisees_donnent_un_cosinus_… |
| 24 | N1 docstring (py, js) | « a word appearing in every article weighs almost nothing, which is the idea of N0 applied to vocabulary » | INFIRMÉE (py, js) : avec l'IDF lissé, un mot présent partout pèse 1 et le plus rare 1 + ln((n+1)/2) ; sur le fonds de sept articles, « the » vaut 1,0 contre 2,386. Trois articles qui ne partagent que « the » sont voisins à 0,583. N0 donne, lui, exactement zéro : ce n'est pas la même idée | test_infirme_un_mot_present_partout_ne_pese_presque_rien, test_constat_l_idf_… |
| 25 | N1 docstring | « Nobody has to maintain anything » ; docstring de build : « Without one [a stop list] the ranking still works » | INFIRMÉE (py, js) : sans liste, l'affûtage reçoit l'annonce du site pour voisin (0,054 > 0,05). Le verdict dit lui-même que la liste de mots vides par langue est le prix de N1 : les deux phrases se contredisent | test_infirme_sans_liste_de_mots_vides_le_classement_tient_encore |
| 26 | verdict_rationale | « Son prix est une liste de mots vides par langue, sans laquelle le test apparie l'article sur l'affûtage avec l'annonce du site » | démontrée (py, js) | test_sans_liste_de_mots_vides_l_affutage_est_apparie_… |
| 27 | N1 docstring de build | « `minimum` is that floor […]: below it, two articles share ordinary words and nothing else » | démontrée avec liste de mots vides sur le fonds du test ; contredite sans liste (25) | — |
| 28 | N1 docstring py | « it returns the same neighbour table as N0 » | démontrée pour la forme (16) ; le contenu diffère évidemment | — |
| 29 | N1 article_text | « The title counts twice » ; « repeating the title is the cheapest way to say so » | démontrée (py, js) : « rye/bread » et « bread/rye » (titre/corps) valent 0,8 et non 1,0 | test_le_titre_compte_deux_fois |
| 30 | N1 docstring js | « The weighting below is the standard smoothed one, so this ranks a corpus exactly as the Python version does » | démontrée (py, js) sur tous les fonds des tests : mêmes tables au millième. Divergence en production : 31 | tous les tests à nombres |
| 31 | N1 production | fonds où aucun mot ne survit (titres d'une lettre, corps vides) | DÉFAUT (py) : `ValueError: empty vocabulary` de scikit-learn ; le JS rend des lignes vides | test_defaut_un_fonds_sans_aucun_mot_retenu_leve |
| 32 | N1 commentaire js | « A one-letter token carries no subject, and dropping it costs nothing » | INFIRMÉE (py, js) : « Programming in C » et « Pointers in C » ont C pour sujet et un cosinus de 0 | test_infirme_ecarter_les_jetons_d_une_lettre_ne_coute_rien |
| 33 | N1 commentaire js | « Smoothed: […] so a term present everywhere still has a defined weight instead of a division by zero » | INFIRMÉE (py, js) : non lissé, idf = ln(n/df) + 1 vaut 1 pour un terme présent partout ; df ≥ 1 pour tout terme vu, il n'y a pas de division par zéro à éviter | test_infirme_sans_lissage_un_terme_present_partout_divise_par_zero |
| 34 | N1 commentaires | « Rows come out l2-normalised » ; « Both vectors are unit length » ; « Ties broken by identifier » | démontrée (py, js) | test_les_lignes_normalisees_…, test_les_egalites_… |
| 35 | N1 regulatory | « la pondération est recalculée sur votre seul corpus à chaque construction de la table » | démontrée (py, js) : ajouter un article fait passer kimchi/cornichons de 0,3 à 0,278 | test_la_ponderation_est_recalculee_… |
| 36 | N1 risks | `none`, `true`, `unit`, `library` | démontrée (py : seulement scikit-learn ; js : aucun import) | test_l_extrait_n_importe_que_scikit_learn, test_deux_constructions_… |
| 37 | N1 escalate_when | « Votre fonds dit la même chose avec deux vocabulaires » | non testable : condition d'exploitation ; son mécanisme est 19 | — |
| 38 | N1 production | fonds vide, un article, corps vide, insécable / emoji / BOM / casse, k = 0, score égal au minimum, 1 000 articles de 200 mots | démontrée (py, js) | test_production_… |
| 39 | N1 production | corps à `None` / `null` | DÉFAUT (py, js) : devient le mot « None » / « null » ; deux articles sans rapport voisins à 0,126 | test_defaut_un_corps_absent_devient_le_mot_none |
| 40 | N1 production | le même article en NFC et en NFD | DÉFAUT (py, js) : 0,083 ; chaque lettre accentuée décomposée coupe le mot | test_defaut_le_meme_article_en_nfd_ne_se_reconnait_pas |
| 41 | essai, note | « les articles au-dessus du plancher sont ceux qui s'afficheraient » | démontrée (cas 1 à 4) | essai : … |
| 42 | essai, note | « Un zéro n'est pas un score faible, c'est l'absence de tout mot commun » | INFIRMÉE : « Choisir un couteau de cuisine japonais » partage « un » et « de » avec « Entretenir un levain naturel » et vaut 0,00. Le zéro est l'absence de mot commun hors mots vides | INFIRMÉ : la note dit qu'un zéro est « l'absence de tout mot commun »… |
| 43 | essai, cas 1 | « Un titre proche d'un article du fonds » | démontrée (fr : Cuire un pain de seigle 0,58 ; en : Baking a dense rye loaf 0,67). Constat : l'article de l'autre langue entre aussi dans le bloc (0,09 et 0,08) par le seul mot « dense » | essai : un titre proche… |
| 44 | essai, cas 2 | « Des mots du corps, pas du titre » | démontrée en français (Kimchi en bocal 0,20, aucun mot du titre). INFIRMÉE en anglais : « Letting cucumbers ferment in a jar » trouve « Pickled cucumbers in brine », dont le titre contient « cucumbers » | essai : des mots du corps… ; INFIRMÉ : le libellé anglais… |
| 45 | essai, cas 3 | « Un sujet que le fonds ne traite pas » | démontrée (fr, en) : aucun article au-dessus du plancher | essai : un sujet que le fonds ne traite pas… |
| 46 | essai, cas 4 et why | « sa proximité vaut zéro » ; « l'annonce sur les travaux passe le plancher et s'afficherait sous l'article, parce qu'elle contient « une fois par jour » » ; en : « because it mentions a day » ; citations du fonds | démontrée (fr, en) : 0,00 pour le jumeau, 0,10 pour l'annonce ; les citations sont dans le fonds | essai : le même sujet dans l'autre langue…, essai : les citations du why… |
| 47 | N2 breaking_point | « Le test ajoute un paragraphe digressif à l'article sur le pain de seigle — le four, la planche, le pot de confiture, la poêle — et cela suffit à lui coûter sa place de premier voisin : l'article sur le levain se retrouve apparié à celui sur la poêle en fonte » | démontrée (py, js), témoin : avant l'ajout, le seigle est premier | test_point_de_rupture_le_paragraphe_digressif_… |
| 48 | N2 breaking_point | « et l'article rallongé perd au passage son propre meilleur voisin » | démontrée (py, js) : levain → kimchi | test_point_de_rupture_l_article_rallonge_perd_… |
| 49 | N2 breaking_point | « Un article reçoit un vecteur, quelle que soit sa longueur » | INFIRMÉE (source) pour les vrais encodeurs nommés : `paraphrase-multilingual-MiniLM-L12-v2` a `max_seq_length: 128` (sentence_bert_config.json), le pipeline transformers.js tronque à `model_max_length: 512`. Au-delà, le texte n'est pas dilué, il est coupé : un article long est représenté par son début. Témoin (double) : rallonger le seigle de son propre sujet ne lui coûte pas sa place | test_point_de_rupture_c_est_le_hors_sujet_qui_dilue_… |
| 50 | N2 breaking_point | « un texte qui aborde huit sujets les porte chacun au huitième » | non testable pour un vrai encodeur. Constat avec le double : un article de huit mots et l'un d'eux valent 0,289, pas 0,125 ; « au huitième » est une image, pas un chiffre | test_constat_avec_le_double_huit_sujets_… |
| 51 | N2 breaking_point | « Le double local du test amplifie l'écart ; la dilution, elle, est celle des vrais encodeurs » | non testable : modèle réel ; la fiche attribue correctement l'effet au double, mais voir 49 pour les textes longs | — |
| 52 | N2 docstring | « N1 compares words. Two articles […] in two languages, share no term and score exactly zero » | démontrée (19) | — |
| 53 | N2 docstring | « An encoder maps each article to a vector where meaning, not spelling, decides the distance, so the French and the English piece on sourdough can land together » | non testable : modèle. Constat : le double rend 0 pour le jumeau, comme N1 | test_constat_le_double_ne_comble_pas_le_trou_des_deux_langues |
| 54 | N2 docstring | « a few hundred megabytes of weights » | démontrée (source) pour Python : 470 Mo ; à préciser pour JavaScript : 118 Mo en version quantifiée par défaut | — |
| 55 | N2 docstring ; verdict_rationale | « a process to keep warm » ; « échanger une bibliothèque contre un service à tenir chaud » | INFIRMÉE (py, js) : le code charge le modèle dans la construction hors ligne et le lâche ; deux constructions, deux chargements ; rien ne sert à l'affichage. La table étant construite hors ligne, il n'y a pas de service à tenir chaud, seulement un travail par lot plus lourd | test_infirme_le_modele_reste_charge_entre_deux_constructions |
| 56 | N2 docstring | « a vector index once the corpus outgrows a list » | non testable : conseil. Constat : 300 articles en une seconde environ avec le double à 256 dimensions (comparaison de toutes les paires) | test_production_trois_cents_articles |
| 57 | N2 commentaire | « One batched call. Encoding article by article wastes most of the machine, and this runs over the whole corpus every time an article is published » | démontrée pour l'appel unique et le fonds entier ; « wastes most of the machine » non testable (performance) | test_le_fonds_est_encode_en_un_seul_appel_et_en_entier |
| 58 | N2 défaut réel | `SentenceTransformer(MODEL_NAME).encode(texts)` ; `pipeline('feature-extraction', MODEL_NAME)` puis `extract(batch, { pooling: 'mean' }).tolist()` | démontrée : surfaces vérifiées (sentence-transformers ; transformers.js via context7), points de contrôle existants ; contre un module à cette surface, le défaut rend la table attendue | test_le_modele_par_defaut_a_la_surface_de_sentence_transformers |
| 59 | N2 EncodingFailed | « The encoder could not be run, or returned something unusable » | démontrée pour la panne et le lot tronqué. INFIRMÉE (py, js) : des vecteurs NaN rendent une table entièrement vide (« aucun voisin », exactement ce que l'en-tête du test d'origine disait éviter) ; des dimensions incohérentes rendent des voisins à 1,0 | test_un_modele_qui_ne_peut_pas_tourner_leve, test_un_lot_tronque_…, test_infirme_des_vecteurs_inutilisables_levent |
| 60 | N2 article_text, unit, égalités | « One string per article » ; « Normalise once » ; « Ties broken by identifier » | démontrée (py, js) | test_une_chaine_par_article_…, test_unit_…, test_les_egalites_… |
| 61 | N2 commentaire | « A multilingual model » | démontrée pour le nom | test_le_modele_nomme_est_multilingue |
| 62 | N2 risks, regulatory | `deterministic: true` ; `own-infra` ; licence et provenance | démontrée avec le double pour `deterministic` ; le reste non testable | test_deux_constructions_rendent_la_meme_table |
| 63 | N2 escalate_when | « on découpe les articles en passages et on indexe les passages » | non testable : conseil | — |
| 64 | N2 production | fonds vide et d'un article (aucun appel), 300 articles, texte NFD / insécable / emoji / BOM transmis tel quel, k = 0, score égal au minimum | démontrée (py, js) | test_un_fonds_trop_petit_…, test_production_… |
| 65 | N3 unavailable_reason | « Recalculer une similarité par appel de modèle à chaque affichage […] est un gaspillage » ; « Le classement ne dépend ni du lecteur ni de l'instant » | non testable : niveau absent ; le second membre est démontré pour N0 à N2 (10) | — |
| 66 | verdict_rationale | « N0 […] le jour où l'étiquetage se relâche la table se vide au lieu de se dégrader » | démontrée pour l'universalité exacte (1) ; à nuancer (4) : un étiquetage presque universel remplit la table de 1,0 | — |
| 67 | verdict_rationale | « N1 est le niveau qui ne dépend de personne » ; « montez à N2 quand votre fonds dit la même chose en deux langues, pas avant » | non testable : jugement et conseil ; « ne dépend de personne » cohabite mal avec la liste de mots vides à entretenir (25) | — |

## Non testable, et pourquoi

- 11, 18, 37, 56 (en partie), 63, 65, 67 : usage, conseils, conditions
  d'exploitation, niveau absent.
- 12, 57 (en partie) : performance, que la charte interdit de publier.
- 50, 51, 53 : comportement d'un vrai encodeur ; le double apparie des mots.
- 62 (en partie) : juridique, modèle réel non exécuté.

## Infirmé, et ce que le code fait réellement

- **5** : l'escalade sur « lignes vides » ne se déclenche pas quand une étiquette
  est presque universelle ; la table se remplit de 1,0.
- **17** : N1 et N2 changent aussi quand le texte change.
- **21** : l'annonce partage « day » avec l'article anglais.
- **24** : un mot présent partout pèse 1 (IDF lissé), pas « presque rien ».
- **25** : sans liste de mots vides, le classement ne tient pas ; la liste est
  à entretenir par langue.
- **32** : écarter les jetons d'une lettre perd « C », « R », « D »…
- **33** : le lissage n'évite aucune division par zéro.
- **42, 44** : note de l'essai (zéro ≠ aucun mot commun, mots vides exceptés) ;
  libellé anglais du cas 2 (« cucumbers » est dans le titre).
- **49** : les encodeurs nommés tronquent (128 jetons en Python, 512 en
  JavaScript) : un vecteur « quelle que soit sa longueur » n'est pas vrai.
- **55** : aucun processus à tenir chaud dans ce code.
- **59** : NaN et dimensions incohérentes passent sans `EncodingFailed`.
- Test d'origine (6) : compte d'étiquettes écrit à la main et faux.

## Défauts de production

- **14 (N0)** : étiquettes NFC/NFD distinctes.
- **15 (N0)** : étiquettes en chaîne lues lettre à lettre.
- **31 (N1 py)** : `ValueError` sur un fonds sans vocabulaire ; le JS rend des
  lignes vides.
- **39 (N1)** : corps absent indexé comme « None » / « null ».
- **40 (N1)** : texte NFD mal reconnu.

## Pour la charte

- Un test d'origine peut affirmer une donnée écrite à la main au lieu de la
  calculer (ici un compte d'étiquettes, faux de surcroît). La charte pourrait
  interdire toute assertion sur une constante du test : chaque valeur comparée
  doit sortir du code ou des données.
- Pour un point de rupture qui repose sur un cas limite exact (une étiquette sur
  100 % des articles), la charte pourrait exiger le cas voisin (99 %) : c'est
  lui qu'on rencontre en production, et il se comporte à l'opposé.
- Pour les N2 à encodeur, la longueur maximale de séquence du point de contrôle
  nommé est un fait vérifiable qui borne toute affirmation sur les « longs »
  textes ; la charte pourrait demander de la citer.
