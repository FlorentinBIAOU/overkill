# add-autocomplete-to-a-search-bar — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/add-autocomplete-to-a-search-bar/n{0,1}.test.{py,js}`.
Avant : 32 tests (8 par fichier). Après : 92 tests (n0.py 24, n0.js 28, n1.py 20,
n1.js 20). Les 32 tests d'origine sont renommés en français, assertions gardées ;
les quatre tests de l'essai vivent dans `n0.test.js`, l'essai n'existant qu'en
JavaScript.

`node scripts/test-snippets.mjs add-autocomplete-to-a-search-bar` : vert, avec
les marquages ci-dessous.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le préfixe « echarpe » remonte « écharpe en laine », le préfixe « rcharpe » ne remonte rien, et la bonne orthographe est pourtant dans l'index » | démontrée (py, js), avec témoin | test_point_de_rupture_rcharpe_ne_remonte_rien_quand_echarpe_remonte_echarpe_en_laine |
| 2 | N0 breaking_point | « L'arbre ne descend que les caractères qu'on lui donne » (faute sur le premier caractère) | démontrée (py, js) sur « chauss » / « vhauss » | test_point_de_rupture_une_faute_sur_le_premier_caractere_quitte_l_arbre_des_la_premiere_touche |
| 3 | N0 breaking_point, « là et seulement là » | la faute sur le premier caractère est le point où ça casse | INFIRMÉE en partie : une espace insécable, une espace de largeur nulle, une marque d'ordre des octets ou une espace en tête de saisie rendent aussi la bonne orthographe inatteignable, sans faute de frappe (voir 24, 25) | test_defaut_un_caractere_invisible_dans_la_saisie_vide_la_liste, test_defaut_une_espace_en_tete_de_saisie_vide_la_liste |
| 4 | N0 name | « Arbre de préfixes, trié par fréquence de recherche » | démontrée (py, js) | test_les_termes_les_plus_cherches_sous_un_prefixe_sont_proposes, test_l_ordre_suit_le_compte_d_usage_et_la_limite_est_respectee |
| 5 | N0 docstring | « l'arbre est indexé sur une orthographe normalisée, accents repliés et casse abandonnée, tandis que chaque feuille conserve l'orthographe d'origine. Qui tape « ec » trouve « écharpe » » | démontrée (py, js) | test_accents_et_casse_sont_ignores |
| 6 | N0 docstring | « l'ordre est un tri ordinaire sur le compte d'usage » | démontrée (py, js), indépendant de l'ordre d'insertion | test_l_ordre_ne_depend_que_du_compte_pas_de_l_ordre_d_insertion |
| 7 | N0 docstring | « dix candidats sous un préfixe est le cas courant, et trier dix éléments à chaque frappe ne coûte rien » | non testable : chiffre d'usage non mesurable dans l'extrait. Remarque factuelle : `suggest` parcourt et trie **tout** le sous-arbre avant de couper à `limit` ; sur le préfixe vide ou d'une lettre, c'est l'index entier (100 000 termes : quelques dixièmes de seconde en Python, borne large tenue) | — |
| 8 | N0 docstring (py) | « Standard library only » ; (js) « No dependency » | démontrée (py : seul `unicodedata` importé ; js : aucun import) | test_l_extrait_n_importe_que_la_bibliotheque_standard / l'extrait n'importe rien |
| 9 | N0 docstring | « l'index entier est un emboîtement de dictionnaires qui tient dans la mémoire du processus » | non testable : « tient » dépend de la taille de l'index ; la structure est vérifiable à la lecture | — |
| 10 | N0 docstring de build | « Terms sharing a normalised spelling are kept side by side at the same leaf » | démontrée (py, js) | test_deux_orthographes_du_meme_terme_survivent_toutes_les_deux |
| 11 | N0 docstring de suggest | « An empty prefix returns the most searched terms overall » | démontrée (py, js) | test_un_prefixe_vide_propose_les_termes_les_plus_cherches_de_tout_l_index |
| 12 | N0 docstring de suggest | « An unknown prefix returns nothing » | démontrée (py, js) | test_un_prefixe_inconnu_ne_rend_rien |
| 13 | N0 commentaire de normalise | « Fold case and strip accents » | démontrée (py, js) ; mais les deux langages ne replient pas la casse pareil (voir 26) | test_la_normalisation_replie_les_accents_sans_toucher_aux_lettres |
| 14 | N0 commentaire de END | « A character can never collide with it » | py : INFIRMÉE, `END = "\0"` est un caractère ; js : démontrée (Symbol) | test_infirme_un_caractere_nul_dans_un_terme_ne_se_confond_pas_avec_la_marque_de_fin |
| 15 | N0 risks.deterministic | `true` | démontrée (py, js) ; nuance sur les égalités de compte en 27 | test_deux_executions_sur_la_meme_entree_rendent_la_meme_liste |
| 16 | N0 risks.data_egress / regulatory | « none » ; « l'index tient dans le processus […] et la frappe ne le quitte pas » | démontrée : aucun import réseau, tests sous garde réseau | test_l_extrait_n_importe_que_la_bibliotheque_standard |
| 17 | N0 risks.testability | `unit` | démontrée : l'extrait se teste en unitaire sans double | (toute la suite n0) |
| 18 | N0 escalate_when | « Votre journal de clics montre que le terme choisi n'est pas celui du haut de la liste » | non testable : condition d'exploitation, pas un comportement du code | — |
| 19 | N0 production | index vide | démontrée : `[]` | test_production_un_index_vide_ne_propose_rien |
| 20 | N0 production | 100 000 termes, préfixe vide et d'une lettre | démontrée : termine dans la borne large | test_production_cent_mille_termes_se_construisent_et_se_parcourent_dans_une_borne_large |
| 21 | N0 production | un terme très long dans le journal | DÉFAUT : `_collect` / `collect` est récursif ; `suggest(arbre, "")` lève `RecursionError` en Python dès un terme de 1 000 caractères, `RangeError: Maximum call stack size exceeded` en JavaScript (instable entre 4 000 et 8 000, systématique à 20 000). Un seul terme long plante la barre vide pour tous les utilisateurs. Le test utilise 100 000 caractères pour être stable dans les deux langages | test_defaut_un_terme_de_100000_caracteres_dans_le_journal_fait_planter_la_barre_vide |
| 22 | N0 production | accents décomposés (NFD) dans la saisie ou dans l'index | démontrée (py, js) | test_production_une_saisie_en_accents_decomposes_retrouve_le_terme_compose |
| 23 | N0 production | casse mixte, emoji | démontrée (py, js) | test_production_casse_mixte_et_emoji_sont_retrouves |
| 24 | N0 production | espace insécable, espace de largeur nulle, BOM dans la saisie | DÉFAUT (py, js) : liste vide, le terme reste inatteignable | test_defaut_un_caractere_invisible_dans_la_saisie_vide_la_liste |
| 25 | N0 production | espace en tête de saisie (« ␣cha ») | DÉFAUT (py, js) : liste vide | test_defaut_une_espace_en_tete_de_saisie_vide_la_liste |
| 26 | N0 production | « strasse » contre « Straße » | py : démontrée (`casefold` donne « strasse ») ; js : DÉFAUT, `toLowerCase` garde « ß », rien n'est proposé. Les deux extraits ne rendent pas la même chose pour la même frappe | test_production_strasse_retrouve_strasse_avec_eszett_dans_les_deux_langages / DÉFAUT : « strasse » ne retrouve pas « Straße » en JavaScript |
| 27 | N0 production | à compte égal, ordre de départage | js : démontrée, `localeCompare` rend « écharpe » avant « zèbre » ; py : DÉFAUT, départage par point de code, « zèbre » avant « écharpe » | test_defaut_a_compte_egal_l_ordre_est_alphabetique / production : à compte égal, l'ordre est alphabétique |
| 28 | N0 production | limite à 0, à 1, égale et supérieure au nombre de candidats ; préfixe plus long que tout terme | démontrée (py, js) | test_production_limite_a_zero_a_un_et_au_nombre_exact_de_candidats, test_production_un_prefixe_plus_long_que_tout_terme_ne_rend_rien |
| 29 | N1 breaking_point | « « écharpe en laine » a un clic à son actif sous le préfixe « echa », et « rcharpe » ne lui donne toujours rien à classer » | démontrée (py, js), en chaînant N0 puis N1, avec témoin sous « echa » | test_point_de_rupture_echarpe_en_laine_a_un_clic_sous_echa_et_rcharpe_ne_lui_donne_rien_a_classer |
| 30 | N1 breaking_point | « Ce niveau réordonne une liste, il ne l'allonge pas » | démontrée (py, js) : 50 clics sous « rcharpe » n'ajoutent pas le terme absent des candidats. Le test d'origine (`rerank(model, "rcharpe", []) == []`) ne démontrait rien seul : une liste vide donne une liste vide pour tout classement. Complété | test_point_de_rupture_ce_niveau_reordonne_une_liste_il_ne_l_allonge_pas |
| 31 | N1 name | « Réordonnancement par comptage des clics passés » | démontrée (py, js) | test_un_terme_clique_passe_devant_un_terme_plus_cherche |
| 32 | N1 docstring de learn | « One click teaches something about every prefix of what was typed » | démontrée (py, js) | test_un_clic_renseigne_tous_les_prefixes_de_ce_qui_a_ete_frappe |
| 33 | N1 docstring de _evidence | « Backing off matters » (repli sur le plus long préfixe vu) | démontrée (py, js) | test_un_prefixe_jamais_frappe_se_replie_sur_un_prefixe_plus_court |
| 34 | N1 docstring de _evidence | « The longer the matching prefix, the more specific the evidence, hence the weight » | démontrée (py, js) : sans le poids, le test tomberait | test_plus_le_prefixe_commun_est_long_plus_le_clic_pese |
| 35 | N1 docstring de rerank | « A term nobody ever clicked keeps that order » ; « safe to ship on a log that is still thin » | démontrée (py, js) | test_les_termes_que_personne_n_a_cliques_gardent_leur_ordre_d_arrivee, test_un_journal_vide_ne_change_rien |
| 36 | N1 commentaire de normalise | « Same folding as the prefix tree, so both rungs agree » | démontrée dans chaque langage (N0 et N1 identiques) ; entre langages, voir 26 | test_accents_et_casse_sont_ignores_comme_dans_l_arbre_de_prefixes |
| 37 | N1 docstring | « Il s'entraîne en une passe sur le journal et se relit par une lecture de dictionnaire » | non testable par exécution : propriété de structure, vraie à la lecture (une boucle sur le journal ; `rerank` fait des lectures de dictionnaire, mais jusqu'à `len(préfixe)+1` par candidat, voir 43) | — |
| 38 | N1 docstring js | « a suggestion budget of a few milliseconds per keystroke » | non testable : chiffre de latence ; aucun chiffre ne peut être publié par un test. La version Python dit « a keystroke » : les deux docstrings diffèrent | — |
| 39 | N1 commentaire js de key | « a tab never occurs inside a prefix » | INFIRMÉE (js) : la saisie « a⇥b » cliquée sur « c » fabrique la clé de la saisie « a » cliquée sur « b⇥c », qui passe devant sans aucun clic. py : démontrée, clés en tuples | INFIRMÉ : le commentaire dit « a tab never occurs inside a prefix »… / test_production_une_tabulation_dans_la_saisie_ne_cree_pas_de_clic_fantome |
| 40 | N1 risks.regulatory | « rien dans l'approche ne la filtre avant de la compter » | démontrée (py, js) : une adresse électronique frappée est stockée telle quelle dans le modèle | test_la_requete_est_comptee_telle_quelle_sans_filtre |
| 41 | N1 risks.deterministic | `true` | démontrée (py, js) : même classement quel que soit l'ordre du journal | test_deux_apprentissages_du_meme_journal_rendent_le_meme_classement |
| 42 | N1 production | journal vide, candidats vides, préfixe vide | démontrée | test_production_journal_vide_candidats_vides_prefixe_vide |
| 43 | N1 production | 100 000 clics, 1 000 candidats ; requête collée de 10 000 caractères | démontrée : termine dans la borne large. Constat : `rerank` est quadratique en longueur de préfixe (tranche puis lecture à chaque longueur) ; en JavaScript, 10 candidats non cliqués sous un préfixe de 10 000 caractères prennent de l'ordre d'une demi-seconde sur la machine de test | test_production_cent_mille_clics_et_mille_candidats_dans_une_borne_large, test_production_une_requete_collee_de_10000_caracteres_termine_dans_une_borne_large |
| 44 | N1 production | mémoire du modèle sur une requête longue | DÉFAUT (py, js) : une clé par préfixe, chacune copie du préfixe ; une seule requête de 10 000 caractères laisse 50 005 000 caractères de clés (py), 50 025 002 (js). Rien ne borne la longueur comptée | test_defaut_une_requete_collee_de_10000_caracteres_laisse_cinquante_millions_de_caracteres_de_cles |
| 45 | N1 production | accents décomposés dans le journal | démontrée (py, js) | test_production_une_saisie_en_accents_decomposes_retrouve_les_clics_du_terme_compose |
| 46 | N1 production | limite à 0, égale, supérieure | démontrée (py, js) | test_production_limite_a_zero_et_au_nombre_exact_de_candidats |
| 47 | N1 escalate_when | « Il n'y a pas de niveau au-dessus. […] la tolérance à la faute de frappe, se corrige dans la récupération et non dans le classement » | démontrée pour la moitié observable (le classement ne récupère pas, 30) ; le conseil de conception est non testable | test_point_de_rupture_ce_niveau_reordonne_une_liste_il_ne_l_allonge_pas |
| 48 | verdict_rationale | « les deux niveaux échouent sur la même faute de frappe : le test de N1 le démontre » | démontrée (py, js), désormais par chaînage N0 → N1 | test_point_de_rupture_echarpe_en_laine_a_un_clic_sous_echa_et_rcharpe_ne_lui_donne_rien_a_classer |
| 49 | verdict_rationale | « Vous n'y perdez pas de latence, le réordonnancement étant une lecture de dictionnaire » | non testable : affirmation de latence. Nuance factuelle en 43 : le coût croît avec le carré de la longueur du préfixe | — |
| 50 | verdict_rationale | « vous prenez en charge un journal de comportement à conserver » | non testable : conséquence d'exploitation | — |
| 51 | scenario | « Ce qu'il y a à proposer est pourtant un ensemble fermé » ; « un aller-retour réseau l'a dépassé avant même que le modèle ait commencé à répondre » | non testable : description du problème et latence réseau, hors du code | — |
| 52 | N2 unavailable_reason | « Un modèle auto-hébergé demande un service permanent […] un aller-retour à chaque touche » | non testable : pas de code N2 | — |
| 53 | N3 unavailable_reason | « Un appel réseau par caractère frappé. La latence dépasse à elle seule l'intervalle entre deux touches » | non testable : pas de code N3, chiffre de latence | — |
| 54 | essai, cas « Deux lettres frappées » et note | « Le nombre de recherches est ce que l'arbre trie : c'est lui qui décide de l'ordre, et rien d'autre » | démontrée (fr, en) | essai : « cr » propose les termes du journal triés par nombre de recherches |
| 55 | essai, cas « La barre encore vide » | les termes les plus cherchés | démontrée | essai : la barre vide propose les cinq termes les plus cherchés |
| 56 | essai, cas « Cherché sans accent » | « creme » remonte « crème fraîche » | démontrée (fr, en) | essai : « creme » sans accent remonte « crème fraîche » |
| 57 | essai, cas « La touche d'à côté », why | « l'arbre quitte la branche au premier caractère : il n'a plus rien à descendre, donc rien à proposer » | démontrée (fr, en), cas marqué `fails: true` | essai : « vreme », la touche d'à côté, ne propose rien… |
| 58 | essai, why | « Le v est collé au c sur le clavier » | non testable par le code ; vrai sur AZERTY et QWERTY | — |

## Non testable, et pourquoi

- 7, 38, 49, 53 : chiffres ou comparaisons de latence. La charte interdit qu'un
  test publie un chiffre de performance ; seules des bornes larges sont posées.
- 9, 37 : propriétés de structure, vérifiables à la lecture, pas par un test qui
  tomberait si elles cessaient d'être vraies.
- 18, 47 (moitié), 50, 51 : conditions d'exploitation ou description du problème.
- 52, 53 : niveaux sans code.
- 58 : disposition du clavier.

## Infirmé, et ce que le code fait réellement

- **14 (Python)** : le commentaire « A character can never collide with it »
  est faux en Python : `END = "\0"`. `build([("a\0b", 1)])` puis
  `suggest(arbre, "a")` lève `TypeError: bad operand type for unary -: 'str'` ;
  `build([("a\0b", 1), ("a", 2)])` lève `AttributeError: 'dict' object has no
  attribute 'append'`. En JavaScript la marque est un `Symbol` et le
  commentaire est vrai.
- **39 (JavaScript)** : le commentaire « a tab never occurs inside a prefix »
  est faux : ce qui est frappé peut contenir une tabulation (collage). La clé
  `${prefix}\t${term}` est ambiguë : `learn([["a\tb", "c"]])` fait classer
  `"b\tc"` devant `"x"` sous le préfixe « a » sans aucun clic sur ce terme.
- **3** : le point de rupture n'est pas le seul. Sans aucune faute de frappe,
  un caractère invisible ou une espace en tête vident aussi la liste.

## Défauts de production

- **21** : récursion de `_collect` / `collect`. Python casse dès 1 000
  caractères dans un seul terme, JavaScript autour de quelques milliers. Le
  terme vient du journal de recherche : une requête collée suffit à faire lever
  `suggest` sur le préfixe vide pour tout le monde.
- **24, 25** : pas de nettoyage des espaces (tête, insécable, largeur nulle,
  BOM) avant la descente.
- **26** : `casefold` (Python) contre `toLowerCase` (JavaScript) : « ß » ne se
  replie qu'en Python. Les deux extraits affichés côte à côte ne répondent pas
  pareil.
- **27** : départage à compte égal par point de code en Python (« zèbre »
  avant « écharpe »), alphabétique selon la locale en JavaScript. Les deux
  langages divergent, et l'ordre Python est faux pour un lecteur français.
- **44** : mémoire du modèle N1 quadratique en longueur de requête, aucune
  borne sur la longueur comptée.

## Pour la charte

- La charte demande « le même nom, à la syntaxe près » pour les jumeaux. Quand
  un défaut n'existe que dans un langage (14, 26, 27, 39), le préfixe
  `INFIRMÉ` / `DÉFAUT` ne peut figurer que d'un côté. J'ai gardé le même sens de
  nom et mis le préfixe du seul côté qui échoue ; la charte devrait le dire.
- Une borne de récursion n'est pas la même dans les deux langages, et elle est
  instable en JavaScript (optimisation du moteur). La charte pourrait demander
  de choisir une taille qui fait tomber les deux de façon stable, et de
  consigner au relevé le seuil réel de chaque langage.
- L'outil d'écriture de fichiers de l'environnement décode les séquences
  `\uXXXX` : les caractères invisibles des tests ont été ré-échappés à la main
  pour rester lisibles. À signaler aux prochains testeurs.
