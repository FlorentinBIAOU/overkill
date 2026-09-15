# route-support-tickets — relevé du testeur

Passe 1 du lot 15. Niveaux disponibles : N0, N1 (verdict), N2, N3. Tests dans `content/snippets/route-support-tickets/` :

| Fichier | Tests | Dont d'origine (renommés) | Marqués |
|---|---|---|---|
| n0.test.py / n0.test.js | 20 / 20 | 8 / 8 | 1 INFIRMÉ + 1 DÉFAUT, dans chaque langage |
| n1.test.py / n1.test.js | 18 / 22 | 6 / 6 | Py : 2 INFIRMÉ + 1 DÉFAUT ; JS : 3 INFIRMÉ + 3 DÉFAUT |
| n2.test.py / n2.test.js | 20 / 20 | 8 / 8 | 1 INFIRMÉ + 1 DÉFAUT, dans chaque langage |
| n3.test.py / n3.test.js | 29 / 29 | 8 / 8 | 1 DÉFAUT, dans chaque langage |

Ajoutés : 57 en Python, 61 en JavaScript. `node scripts/test-snippets.mjs route-support-tickets` : vert (le fichier `n1.test.js` prend une douzaine de secondes, à cause du DÉFAUT du rang 37 qu'il mesure).

Tests d'origine : tous conservés. Le point de rupture N1 d'origine n'assertait que « premier score < 0,5 » ; il ne vérifiait ni « presque à égalité » ni « aucun mot commun » (rang 23, infirmé). Le test N3 d'origine du point de rupture ne montrait pas que c'est la liste fermée qui arrête l'équipe inventée ; c'est ajouté (rang 60).

Doubles de la forme publiée : module `openai` factice (Python `sys.modules`, JS crochet `module.register`), module `sentence_transformers` factice (`SentenceTransformer(name).encode(list)`), module `@xenova/transformers` factice (`pipeline('feature-extraction', name)`, `extract(texts, { pooling })`, `.tolist()`).

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « Le colis n’est jamais arrivé et le prélèvement est passé quand même » déclenche facturation et livraison ; la priorité tranche pour facturation » | démontrée (`matches` voit les deux, `route` rend `billing`) ; témoin : un ticket de colis seul part chez livraison | test_point_de_rupture_un_ticket_qui_appartient_a_deux_equipes_perd_sa_moitie_colis |
| 2 | N0 breaking_point | « la moitié colis disparaît sans trace dans la file qui reçoit le ticket » | démontrée : `route` rend une chaîne, le nom d'une équipe, rien d'autre | idem |
| 3 | N0 breaking_point | « « je n’arrive plus à faire ce que je faisais avant » ne déclenche rien et part dans la file par défaut » | démontrée ; témoin : le même client qui écrit « connexion » est routé | test_point_de_rupture_un_ticket_qui_ne_declenche_aucune_equipe_part_dans_la_file_par_defaut |
| 4 | N0 name, docstring | « Règles par mots-clés, avec priorité explicite et file par défaut » ; « The order of RULES answers it once and in writing » ; « Whoever disagrees can reorder this tuple and nothing else » | démontrée : inverser `RULES` envoie le ticket double chez livraison | test_la_priorite_est_lordre_de_rules_et_rien_dautre |
| 5 | N0 docstring | « Deterministic, standard library only », « every decision can be explained » | démontrée (imports `re`, `unicodedata` ; aucun import en JS ; `matches` rend les mots déclencheurs) | test_deterministe_et_bibliotheque_standard_seule, test_matches_montre_ce_que_les_regles_ont_vu |
| 6 | N0 docstring | « Tickets mention several subjects, so two teams matching the same ticket is the normal case, not the exception » | non testable : proportion d'usage sans source | — |
| 7 | N0 docstring de _fold | « so "Prélèvement" matches "prelevement" » | démontrée (majuscules, NFD) | test_les_accents_et_la_casse_ne_coutent_rien |
| 8 | N0 commentaire | « "facture" then also matches "factures" » | démontrée | test_pluriels_et_formes_derivees_se_declenchent_encore |
| 9 | N0 commentaire | « "facture" then also matches […] "facturation" » | INFIRMÉE : « facturation » s'écrit f-a-c-t-u-r-a, le préfixe « facture » n'y est pas ; « Question sur la facturation » part en file par défaut | test_infirme_facture_declenche_aussi_facturation |
| 10 | N0 commentaire | « the price is that it would match a longer word starting the same way » | démontrée : « panneau solaire » → technique (« panne »), « devise » → facturation (« devis ») ; témoin : « antibug » ne déclenche rien | test_le_prix_de_la_frontiere_a_gauche_un_mot_plus_long_qui_commence_pareil |
| 11 | N0 docstring, commentaire | « a ticket that matches nothing has to go to a queue a human watches » ; « Naming it here […] stops a ticket from silently going nowhere » ; file nommée par l'appelant | démontrée | test_un_ticket_vide_part_dans_la_file_par_defaut, test_la_file_par_defaut_est_nommee_par_lappelant |
| 12 | N0 commentaire | « a billing problem has a legal clock on it, an outage blocks the customer's work, a parcel is the one that can wait a day » | non testable : justification métier | — |
| 13 | N0 risks | `deterministic`, `data_egress: none`, `testability: unit` ; regulatory « le ticket est traité là où il est déjà stocké » | démontrée (aucun fichier, aucun réseau) | idem rang 5 |
| 14 | N0 latency | « <1 ms » | démontrée (mille tickets sous une seconde) | test_router_un_ticket_prend_moins_dune_milliseconde |
| 15 | N0 escalate_when | « La file par défaut devient la file la plus remplie » | non testable : situation d'exploitation | — |
| 16 | N0 production | parité Python / JS sur douze tickets | démontrée | test_python_et_javascript_routent_de_meme |
| 17 | N0 production | ticket d'un mégaoctet, emoji, BOM, casse mixte | démontrée | test_production_* |
| 18 | N0 production | « mot de passe » avec une insécable ou deux espaces ; caractère de largeur nulle dans un mot-clé | démontrée : le mot-clé n'est plus reconnu, file par défaut (remarque 1) | test_production_un_mot_cle_de_plusieurs_mots_avec_une_espace_insecable_ne_se_declenche_pas, test_production_un_caractere_de_largeur_nulle_dans_un_mot_cle_le_cache |
| 19 | N0 production | écritures mélangées sans espace (« 我的colis », « Привет,colis ») | DÉFAUT : `\b` Unicode en Python, ASCII en JavaScript ; « 我的colis » part en file par défaut en Python, chez livraison en JS | test_defaut_un_ticket_a_ecritures_melangees_est_route_de_meme_dans_les_deux_langages |
| 20 | N0 production | ticket absent (`None` / `null`) | démontrée : `AttributeError` / `TypeError` | test_production_un_ticket_absent_leve |
| 21 | N1 breaking_point | « Le modèle connaît l’archive, et rien d’autre » | démontrée par les rangs 22–24 | — |
| 22 | N1 breaking_point | « les trois équipes ressortent presque à égalité, le seuil de confiance n’est pas atteint, et le ticket repart dans la file par défaut » | démontrée : Python 0,35 / 0,35 / 0,31 ; JS 0,38 / 0,34 / 0,29 (écart < 0,1) ; témoin : un ticket connu franchit le seuil | test_point_de_rupture_les_trois_equipes_ressortent_presque_a_egalite_et_le_seuil_nest_pas_atteint |
| 23 | N1 breaking_point, essai why | « « Votre entrepôt accepte-t-il les visites scolaires le mercredi » ne recoupe aucun mot des tickets déjà résolus » ; « Aucun mot de ce ticket ne figure dans l’archive » | INFIRMÉE : il partage « le » avec l'archive, présent dans le vocabulaire appris (Python et JS) | test_infirme_le_ticket_inconnu_ne_recoupe_aucun_mot_de_larchive |
| 24 | N1 breaking_point, essai why | « N1 n’a pas supprimé cette file, il l’a rétrécie » | démontrée : sur huit tickets, N0 en envoie cinq en file par défaut, N1 deux, tous deux parmi les cinq | test_point_de_rupture_n1_na_pas_supprime_la_file_par_defaut_il_la_retrecie |
| 25 | N1 docstring, verdict | « the vocabulary of the customers, not the vocabulary of the rule writer, decides » ; « elle route les formulations que la liste de mots-clés de N0 n’avait pas prévues » | démontrée : « La page reste blanche quand je valide le formulaire » → technique ; témoin : N0 l'envoie en file par défaut | test_attrape_un_ticket_qui_nemploie_aucun_mot_cle_de_n0 |
| 26 | N1 docstring | « What it keeps from N0, deliberately: a default team […] The confidence floor […] turns that shrug back into the default queue, instead of a wrong queue » | démontrée en Python ; en JavaScript, un haussement d'épaules franchit le plancher (rang 38) | test_le_plancher_est_a_vous_de_le_fixer |
| 27 | N1 docstring de train | « Word pairs as well as single words » | démontrée (« mot de », « de passe » dans le vocabulaire) | test_les_paires_de_mots_sont_apprises_avec_les_mots_seuls |
| 28 | N1 docstring de train | « Classes are weighted by their rarity: […] an unweighted model learns to answer the busiest team » | démontrée en Python : archive 35 / 7 / 2, « La livraison du colis est en retard » → livraison pondéré, facturation non pondéré. En JS, la pondération écarte facturation mais le ticket part chez technique (remarque 2) | test_une_archive_desequilibree_non_ponderee_repond_lequipe_la_plus_chargee ; JS : …ne répond pas l’équipe la plus chargée |
| 29 | N1 commentaire (py) | « C loosens the penalty: the default […] flattens the probabilities so far that no ticket ever clears a useful floor » | INFIRMÉE : avec C=1, « Le tableau de bord ne s'ouvre plus depuis la mise à jour » sort à 0,51 et franchit 0,5 ; deux des trois tickets du test tombent en dessous | test_infirme_avec_le_c_par_defaut_aucun_ticket_ne_franchit_le_plancher |
| 30 | N1 docstring de rank, verdict | « A support desk needs the runner-up » ; « l’équipe suivante figure dans la réponse, là où N0 la laissait tomber sans le dire » | démontrée pour `rank` (livraison puis facturation) ; `route` ne rend que l'équipe retenue (remarque 3) | test_rank_montre_lequipe_suivante |
| 31 | N1 docstring de route | « The floor is yours to set » | démontrée (score exact accepté, +10⁻⁹ refusé, 0 et 1) | test_le_plancher_est_a_vous_de_le_fixer |
| 32 | N1 docstring (py) | « The model is a table of weights small enough to keep in the repository, and retraining it is a step in the nightly export, not a project » | non testable : dépend de la taille de l'archive réelle (le vocabulaire en paires de mots croît avec elle) | — |
| 33 | N1 docstring (js) | « TF-IDF and a softmax regression are sixty lines » | INFIRMÉE : de `tokens` à `train`, 65 lignes de code hors commentaires et lignes vides | INFIRMÉ : TF-IDF et la régression softmax font soixante lignes (JS seul) |
| 34 | N1 docstring (js) | « retrained while you read this » | démontrée pour l'archive de 21 tickets (sous une seconde) ; DÉFAUT au-delà (rang 37) | réentraîné le temps de lire la phrase… (JS seul) |
| 35 | N1 risks | `deterministic: true` | démontrée | test_deterministe_le_meme_export_redonne_le_meme_modele |
| 36 | N1 latency | « <1 ms » | démontrée : mille routages sous une seconde en JS ; en Python, cent routages sous une seconde dans le test, 0,33 ms par ticket mesurés (remarque 4) | test_router_un_ticket_prend_moins_dune_milliseconde_une_fois_le_modele_entraine |
| 37 | N1 production (js) | archive de 630 tickets au vocabulaire varié (30 fois celle du test) | DÉFAUT : chaque ligne TF-IDF est dense (taille du vocabulaire) et chaque passe les parcourt toutes ; 210 tickets : 0,6 s ; 525 tickets : 6,3 s ; 630 tickets : bien au-delà de 2 s. scikit-learn (creux) entraîne les mêmes 630 tickets en 0,35 s | DÉFAUT : une archive de 630 tickets au vocabulaire varié s’entraîne vite ; Python : test_production_une_archive_de_630_tickets_au_vocabulaire_varie_sentraine_vite |
| 38 | N1 production | parité Python / JS | DÉFAUT : entraînés sur la même archive, les deux extraits ne routent pas les mêmes tickets. JS n'a aucune régularisation (300 passes) et sort bien plus sûr de lui : le ticket double → file par défaut en Python (0,45), livraison en JS (0,88) ; « Bonjour, depuis hier je n’arrive plus à faire ce que je faisais avant » → file par défaut en Python (0,34), livraison en JS (0,60) | test_defaut_python_et_javascript_routent_les_memes_tickets_vers_les_memes_files |
| 39 | N1 production | archive d'une seule équipe | Python : démontrée, `ValueError`. JS : DÉFAUT, tout ticket, même sans aucun mot connu, part chez cette équipe avec une confiance de 1 | test_production_une_archive_dune_seule_equipe_est_refusee ; DÉFAUT : une archive d’une seule équipe est refusée (JS) |
| 40 | N1 production | ticket vide, archive vide, ticket d'un mégaoctet avec emoji, BOM, insécables, NFD | démontrée (vide → file par défaut ; archive vide : `ValueError` en Python, `TypeError` obscure en JS à la première question) | test_production_* |
| 41 | essai N1 | verdicts des quatre cas en français, note « Modèle entraîné sur 21 tickets résolus, sept par équipe » | démontrée (facturation, technique, livraison devant facturation, file par défaut) | l’essai rend ce que ses cas annoncent (JS) |
| 42 | essai N1, why (en) | « the three teams come out nearly tied » | INFIRMÉE sur l'essai anglais : 48 %, 39 %, 13 % | INFIRMÉ : l’essai anglais, les trois équipes ressortent presque à égalité (JS) |
| 43 | N1 risks | `data_egress: own-infra`, `testability: statistical`, `vendor_lock: library` ; regulatory (corpus, registre) | non testable : déclarations ; `vendor_lock: library` vaut pour Python (scikit-learn), la version JS n'a aucune dépendance | — |
| 44 | N1 escalate_when | « Vos agents ressortent régulièrement de la file par défaut des tickets […] décrits avec des mots absents de l’archive » | non testable : situation d'exploitation | — |
| 45 | N2 breaking_point | « « Bonjour, merci de me confirmer que vous avez bien reçu mon dossier » […] part chez facturation avec un score élevé : l’archive contient un ticket de facturation écrit avec les mêmes formules de politesse » | démontrée : plus proche voisin = le ticket de facturation poli, similarité 0,617 | test_point_de_rupture_un_ticket_qui_ne_sadresse_a_personne_part_chez_facturation |
| 46 | N2 breaking_point | « le vote y voit une forte ressemblance » | démontrée avec réserve : le vote tranche 0,617 contre 0,606 (deux voisins de technique à 0,303), un écart de 0,011 | test_point_de_rupture_le_vote_tranche_de_justesse |
| 47 | N2 breaking_point | « ce dont l’archive est faite est la politique de routage » | démontrée : sans le ticket poli, le même message part chez technique ; témoin | test_point_de_rupture_temoin_sans_ce_ticket_dans_larchive_laccident_se_deplace |
| 48 | N2 breaking_point | « Un vrai encodeur déplace l’accident, il ne le supprime pas » | non testable : comportement d'un vrai encodeur | — |
| 49 | N2 docstring | « a customer who says "je n'arrive plus à entrer dans mon espace" lands next to the archived tickets about a lost password » | non testable avec le double ; le double le montre troisième, le test d'origine le dit | test_ce_que_le_double_ne_peut_pas_prouver |
| 50 | N2 docstring | « the neighbours are shown to the agent as the reason for the routing — which is more than N1's weights ever explain » | INFIRMÉE : `neighbours` rend (score, équipe), sans le ticket archivé ni son rang ; l'agent voit « billing, 0,62 », pas le ticket qui a décidé | test_infirme_les_voisins_montres_a_lagent_disent_quel_ticket_a_decide |
| 51 | N2 docstring, regulatory | « There is no training step here […] the index is the archive itself » ; « l’index, qui en est une copie » ; « encoded once, not once per query » | démontrée (copie indépendante de la liste d'origine ; un seul encodage de l'archive) | test_lindex_est_une_copie_de_larchive, test_larchive_est_encodee_une_fois_et_non_a_chaque_question |
| 52 | N2 docstring de route, commentaires | vote plutôt que meilleur voisin ; tri stable à égalité ; « Ties go to the team of the closest neighbour » ; plancher 0,25 | démontrée (vecteurs écrits dans le test, égalité exacte en composantes dyadiques, plancher au score exact et juste au-dessus) | tests correspondants |
| 53 | N2 load_encoder | « The real encoder: fetched once, then held in memory and run locally » ; `SentenceTransformer(name).encode(…)` ; JS `pipeline('feature-extraction', name)`, `extract(texts, { pooling: 'mean' }).tolist()` | démontrée contre des doubles à la forme publiée (les appels existent) ; chargé une fois par index | test_lencodeur_par_defaut_a_la_forme_de_sentence_transformers ; l’encodeur par défaut a la forme de transformers.js |
| 54 | N2 docstring | « a routing whose answers change the day you upgrade the model. The archive also has to be re-encoded then » | non testable pour le modèle ; DÉFAUT : rien ne vérifie que l'index vient du même encodeur (rang 57) | — |
| 55 | N2 risks | `latency: "~100 ms"`, `cost: faible`, `footprint: moderate`, `deterministic`, regulatory (index, effacement, licence du modèle) | non testable (déclarations) ; déterminisme de la plomberie démontré | test_deterministe |
| 56 | N2 production | ticket vide, archive vide, k = 0, k plus grand que l'archive, NFD/emoji/BOM transmis tels quels, archive de 900 tickets | démontrée | test_production_* |
| 57 | N2 production | index encodé par un autre modèle | DÉFAUT : aucune vérification de dimension. Encodeur plus large (768 contre 384) : produit scalaire tronqué, routage sur un score faux mais plausible (facturation, 0,38), dans les deux langages ; encodeur plus étroit en JS : NaN, tout part en file par défaut | test_defaut_un_index_encode_par_un_autre_modele_est_refuse |
| 58 | N2 escalate_when | « Des tickets arrivent dans une langue absente de l’archive » | non testable : comportement de l'encodeur | — |
| 59 | N3 breaking_point | « Interrogé sur trois équipes, il en renvoie une quatrième qui sonne juste et n’existe pas : « customer success », en JSON parfaitement formé […] La liste fermée l’attrape et le ticket part dans la file par défaut » | démontrée pour le code (JSON valide, file par défaut ; témoin : une équipe réelle passe). **INFIRMÉE pour l'attribution** : la réponse est écrite dans le double, aucun modèle ne l'a produite (charte des tests). Sans test possible | test_point_de_rupture_une_equipe_inventee_en_json_bien_forme_part_dans_la_file_par_defaut |
| 60 | N3 breaking_point | « retirez ce contrôle […] et le ticket est classé dans une équipe que personne n’a créée et que personne ne surveille » | démontrée : ajouter « customer success » à `TEAMS` suffit à l'y classer — c'est la liste, et elle seule, qui l'arrête | test_point_de_rupture_sans_la_liste_fermee_le_ticket_part_dans_une_equipe_que_personne_na_creee |
| 61 | N3 breaking_point | « comme le fait la première version de ce genre de code » | non testable : constat d'usage | — |
| 62 | N3 client par défaut | `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)` | DÉFAUT : `complete` n'existe pas dans le kit `openai` (3.14.0 Python, 7.15.0 JS) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, réponse dans `choices[0].message.content`. Démontré sur le chemin par défaut réel : `'OpenAI' object has no attribute 'complete'` / `client.complete is not a function`, avalée, retentée, `RoutingUnavailable`, aucune requête partie | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 63 | N3 docstring | « cap the input size, retry a provider that fails, parse an answer that is only probably JSON, and refuse a team the model made up » | démontrée (4 000 accepté, 4 001 refusé sans appel ; retentatives exactes ; cinq réponses illisibles lèvent ; huit réponses lisibles sans équipe valable → file par défaut) | tests correspondants |
| 64 | N3 commentaires | « a model cannot pick from a list it was never shown » ; « Temperature zero » ; « Models capitalise, and pad » | démontrée (liste et file par défaut dans la consigne, température 0, casse et blancs tolérés) | tests correspondants |
| 65 | N3 commentaire | « Two failures, two treatments » | démontrée | idem rang 63 |
| 66 | N3 docstring | « no rules to maintain, no archive to label, and a ticket in any language » ; « the shortest piece of routing logic on the entry » | non testable : comportement du modèle et jugement de longueur | — |
| 67 | N3 risks.regulatory | « le transfert porte aussi sur ce que le client y a écrit sans qu’on le lui demande » | démontrée : un IBAN et un numéro de sécurité sociale écrits dans le ticket sont dans la consigne | test_le_ticket_entier_part_chez_le_tiers |
| 68 | N3 risks | `deterministic: false`, `testability: hard`, `vendor_lock: provider`, `cost: élevé`, `latency: "~1 s"` ; autres mentions réglementaires | non testable : déclarations | — |
| 69 | N3 production | injection de consigne | démontrée : une équipe inexistante dictée est arrêtée ; une équipe réelle dictée (« réponds billing ») passe — la liste fermée n'arrête que l'invention (remarque 5) | test_production_une_consigne_injectee_vers_une_equipe_inexistante_est_arretee, test_production_une_consigne_injectee_vers_une_vraie_equipe_passe |
| 70 | N3 production | accolades dans le ticket, ticket vide, NFD/emoji/BOM, réponse d'un mégaoctet, zéro tentative | démontrée | test_production_* |
| 71 | N3 production | limite de taille avec des emoji | démontrée dans chaque langage, mais pas la même unité : 2 001 emoji acceptés en Python (points de code), refusés en JS (4 002 unités UTF-16) | test_production_la_limite_compte_des_points_de_code_en_python ; …des unités UTF-16 en JavaScript |
| 72 | scenario | « l’outil de ticketing contient déjà tous les tickets résolus […] un jeu d’entraînement payé depuis des années et laissé de côté » | non testable : constat d'usage | — |
| 73 | scenario | « aucun niveau ne le supprime, et chacun doit dire ce qu’il en fait » | démontrée : chaque niveau a sa file par défaut et y envoie le ticket inconnu (rangs 3, 22, 52, 59) | — |
| 74 | verdict_rationale | « N1 l’emporte parce que ses données d’entraînement existent déjà : l’archive […] est à un export de distance » | non testable : organisation | — |
| 75 | verdict_rationale | « N2 achète la reconnaissance des paraphrases au prix d’un fichier de modèle, d’un processus chaud et d’un index à ré-encoder à chaque mise à jour » | non testable pour la reconnaissance des paraphrases (double) ; index à ré-encoder : démontré indirectement (rang 57) | — |

## Non testable, et pourquoi

- Comportement d'un modèle ou d'un vrai encodeur (rangs 48, 49, 54, 58, 66, 75) : les tests tournent contre des doubles.
- Constats d'usage et justifications métier (rangs 6, 12, 15, 44, 61, 72, 74).
- Déclarations de risques et taille d'un modèle réel (rangs 32, 43, 55, 68).

## Infirmé, et ce que le code fait réellement

- **Rang 9 — « facture » déclenche « facturation ».** Faux : le préfixe ne couvre pas ce mot, qui est pourtant « ce dont les tickets français sont pleins » selon le même commentaire.
- **Rang 23 — « ne recoupe aucun mot ».** Le ticket partage « le ». La conclusion (file par défaut) tient ; la phrase est fausse telle qu'écrite, dans la fiche et dans l'essai.
- **Rang 29 — C par défaut, « no ticket ever clears a useful floor ».** Un ticket sur les trois du test la franchit.
- **Rang 33 (JS) — « sixty lines ».** 65.
- **Rang 42 — essai anglais « nearly tied ».** 48 / 39 / 13.
- **Rang 50 — N2 « the neighbours are shown to the agent as the reason ».** La fonction ne rend pas le ticket voisin.
- **Rang 59 — attribution au modèle** de ce que le double écrit (sans test).

## Défauts de production

- **N3, client par défaut (rang 62)** : `complete` n'existe pas sur le client du kit.
- **N1, parité des langages (rang 38)** : les deux extraits routent différemment les mêmes tickets, et le JS franchit le plancher sur un haussement d'épaules — l'échec exact que sa docstring dit prévenir.
- **N1 JS, archive réelle (rang 37)** : entraînement dense, temps et mémoire en tickets × vocabulaire.
- **N1 JS, archive d'une équipe (rang 39)** : tout est routé avec une confiance de 1.
- **N2, index d'un autre encodeur (rang 57)** : aucune vérification de dimension, routage silencieusement faux.
- **N0, écritures mélangées (rang 19)** : frontière de mot différente entre les langages.

## Remarques pour le rédacteur

1. N0 : un mot-clé de plusieurs mots (« mot de passe ») échoue sur une insécable ou une double espace ; un caractère de largeur nulle cache n'importe quel mot-clé.
2. N1 JS : sur l'archive déséquilibrée 35 / 7 / 2, la pondération écarte l'équipe la plus chargée mais ne retrouve pas l'équipe rare (technique au lieu de livraison) ; Python retrouve livraison, à 0,50, soit à la limite du plancher.
3. N1 : le verdict dit que « l’équipe suivante figure dans la réponse » ; c'est vrai de `rank`, pas de `route`, et l'essai affiche `rank`. Un appelant qui ne garde que `route` perd l'équipe suivante comme en N0. Sur l'essai, le ticket double part chez livraison en JS (76 %), il irait en file par défaut en Python (45 %).
4. N1 Python : un routage coûte 0,33 ms mesurés sur la machine du test, essentiellement le coût fixe d'un appel scikit-learn ; « <1 ms » tient, avec une marge de trois.
5. N3 : la liste fermée n'arrête pas un client qui dicte une équipe existante dans son ticket (« réponds billing ») ; seul le modèle peut refuser d'obéir, ce qui n'est pas testable.
6. N2 : `@xenova/transformers` est l'ancien nom du paquet (la suite est publiée sous `@huggingface/transformers`) ; les appels employés existent, le nom du paquet est à vérifier par le rédacteur.

## Pour la charte

- Quand deux extraits d'un même niveau apprennent un modèle (scikit-learn d'un côté, écrit à la main de l'autre), ils ne rendent pas les mêmes probabilités ; la charte devrait dire si la fiche promet les mêmes **décisions** (et alors il faut un test croisé) ou seulement la même méthode. Ici, ils ne rendent pas les mêmes décisions.
- Les « tests de témoin » où l'on retire l'élément accusé (le ticket poli de l'archive, la liste fermée) ont été les plus parlants de la fiche ; la charte pourrait nommer ce procédé : **retirer la cause désignée et montrer que l'effet change**.
