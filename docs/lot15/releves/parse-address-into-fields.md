# parse-address-into-fields — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/parse-address-into-fields/n{0,1,2,3}.test.{py,js}`.
Un test nommé ci-dessous existe dans les deux langages, sauf mention « py seul » ou « js seul ».

`node scripts/test-snippets.mjs parse-address-into-fields` : vert. 72 tests
existaient, tous renommés en français, assertions gardées. Une assertion ne
démontrait pas l'affirmation : le point de rupture N1 vérifiait
`british["city"] != "Bristol"`, vrai pour n'importe quelle sortie ; la fiche dit
« « 4TQ » pour toute ville », le test l'asserte désormais exactement. 89 tests
ajoutés (161 au total).

Marquages : N0 — 2 `INFIRMÉ` et 3 `DÉFAUT` en Python, 2 et 2 en JavaScript ;
N1 — 1 `INFIRMÉ` en Python, 2 `INFIRMÉ` et 1 `DÉFAUT` en JavaScript ; N2 — 3
`INFIRMÉ` et 1 `DÉFAUT` en Python, 3 et 2 en JavaScript ; N3 — 3 `DÉFAUT` en
Python, 4 en JavaScript.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « dans « 8 rue des Lilas Bâtiment C Appartement 12, 75011 Paris », le bâtiment et l'appartement finissent dans le nom de la rue » | démontrée (sortie exacte) ; témoin sans complément | test_point_de_rupture_un_complement_ecrit_apres_finit_dans_le_nom_de_la_rue |
| 2 | N0 breaking_point | « Écrit devant, le même complément fait pire : la ligne ne commence plus par un chiffre, le numéro revient vide » | démontrée | test_point_de_rupture_un_complement_ecrit_devant_vide_le_numero |
| 3 | N0 breaking_point | « et l'adresse entière passe en nom de rue » | INFIRMÉE : seule la ligne de voie y passe ; code postal et ville sont lus | test_un_complement_ecrit_devant_fait_passer_l_adresse_entiere_en_nom_de_rue |
| 4 | N0 breaking_point | « « Hauptstrasse 5, 10115 Berlin » laisse le numéro dans la rue » | démontrée (sortie exacte) | test_point_de_rupture_hors_de_france_le_numero_allemand_reste_dans_la_rue |
| 5 | N0 breaking_point | « « 42 Rowan Street, Bristol BS1 4TQ », sans suite de cinq chiffres, ressort sans code postal ni ville » | démontrée (sortie exacte) | test_point_de_rupture_une_adresse_britannique_ressort_sans_code_postal_ni_ville |
| 6 | N0 test (existant) | « Town first: everything after the postcode is taken for the town » | démontrée | test_point_de_rupture_la_ville_ecrite_d_abord_aspire_la_rue |
| 7 | N0 escalate_when | « Vos formulaires reçoivent des compléments […] et vous les retrouvez collés au nom de la rue » | démontrée pour le collage (#1) ; le reste est une observation d'exploitation | — |
| 8 | N0 name + docstring | « Ancrage sur le code postal » ; « Cinq chiffres d'affilée coupent une adresse française en deux » | démontrée ; quatre et six chiffres ne sont pas une ancre | test_cinq_chiffres_coupent_une_adresse_en_deux |
| 9 | N0 docstring | « Vouloir reconnaître la ville à son nom obligerait à embarquer une liste des communes » | non testable : choix de conception | — |
| 10 | N0 docstring | « les abréviations que les gens tapent vraiment — « av. », « bd », « imp. » — ressortent sous une seule orthographe canonique » | démontrée pour les trois | test_les_abreviations_tapees_ressortent_sous_une_seule_orthographe |
| 11 | N0 dictionnaire | « r » → « rue » (« the abbreviations people type ») | DÉFAUT : inatteignable après un numéro | test_defaut_l_abreviation_r_apres_un_numero_est_lue_comme_rue |
| 12 | N0 commentaire | « A house number, and the repetition index that may follow it: 8, 8 bis, 12B » | démontrée (bis, ter, B) | test_garde_l_indice_de_repetition_avec_le_numero |
| 13 | N0 commentaire | « Take the last postcode: a street name may carry a year » | INFIRMÉE : une année (quatre chiffres) n'est jamais un code postal ; la justification ne tient pas. « rue du 8 Mai 1945 » reste dans la rue quelle que soit la règle | test_une_annee_dans_le_nom_de_rue_peut_etre_prise_pour_un_code_postal, test_une_annee_dans_le_nom_de_rue_reste_dans_la_rue |
| 14 | N0 commentaire | « and a town never comes before its postcode in the French convention » | non testable : convention postale (le comportement quand elle n'est pas suivie est #6) | — |
| 15 | N0 normalise / fold | « Reduce commas, line breaks and exotic spaces to a single plain space » ; « Lowercase, drop the accents and the trailing dot » | démontrée | test_normalisation_et_repli |
| 16 | N0 parse | « Every field is a string, empty when the address does not carry it » | démontrée | test_chaque_champ_est_une_chaine_vide_quand_l_adresse_ne_le_porte_pas |
| 17 | N0 test (existant) | accents, casse, ponctuation ; mention Cedex gardée | démontrée | test_lit_accents_casse_et_ponctuation, test_garde_la_mention_cedex_avec_la_ville |
| 18 | N0 risks / latency | `deterministic`, `vendor_lock: none`, `data_egress: none`, `unit`, `<1 ms` | démontrée (mesuré 0,008 ms py) | test_n0_est_deterministe_…, test_une_adresse_se_decoupe_en_moins_d_une_milliseconde |
| 19 | N0 docstring | « assez court pour se lire d'une traite » ; cost, footprint, regulatory | non testable | — |
| 20 | N0 production | 3 000 caractères ; pleine largeur, espaces insécables, NFD | démontrée | test_production_… |
| 21 | N0 production, encodage | marque d'ordre des octets en tête | DÉFAUT en Python ; démontrée en JavaScript (`trim()` la retire) | test_defaut_une_marque_d_ordre_des_octets_ne_casse_pas_le_numero (py) / 'production : chiffres pleine largeur, espaces insécables, NFD, marque d'ordre' (js) |
| 22 | N0 production, limite | plage de numéros « 8-10 » | DÉFAUT | test_defaut_une_plage_de_numeros_ne_passe_pas_dans_la_rue |
| 23 | N1 breaking_point | « toutes les adresses de son jeu d'entraînement placent le numéro devant et cinq chiffres avant la ville » | démontrée sur les 18 adresses du jeu | test_point_de_rupture_toutes_les_adresses_du_jeu_placent_… |
| 24 | N1 breaking_point | « Sur « Hauptstrasse 5, 10115 Berlin », il rend une rue vide et un numéro qui vaut 5 » | démontrée (sortie exacte, « Hauptstrasse » en complément) ; témoin français | test_point_de_rupture_l_adresse_allemande_rend_une_rue_vide_et_un_numero_qui_vaut_5 |
| 25 | N1 breaking_point | « sur « 42 Rowan Street, Bristol BS1 4TQ », pas de code postal, et « 4TQ » pour toute ville — […] il étiquette quand même » | démontrée : chaque jeton reçoit une étiquette | test_point_de_rupture_l_adresse_britannique_rend_pas_de_code_postal_et_4tq_pour_ville |
| 26 | N1 escalate_when | « couvrir chaque nouveau pays demanderait sa propre campagne d'étiquetage » | non testable : coût | — |
| 27 | N1 name + docstring | « Chaque mot est étiqueté […] d'après ce à quoi il ressemble et d'après ce qui se trouve de part et d'autre » | démontrée (traits token, previous, next, forme) | test_chaque_mot_est_etiquete_d_apres_ce_a_quoi_il_ressemble_et_ce_qui_l_entoure |
| 28 | N1 docstring | « un complément au milieu de la ligne n'avale plus la voie » | démontrée sur l'exemple même du point de rupture de N0, que N0 avale | test_un_complement_au_milieu_de_la_ligne_n_avale_plus_la_voie |
| 29 | N1 features | « five digits followed by one capitalised word is a postcode and a town, wherever it sits in the line » | INFIRMÉE : « 75011 Paris, 8 rue des Lilas » rend `city: "Lilas"`, `complement: "Paris"`, `street: "rue des"` | test_cinq_chiffres_et_un_mot_capitalise_sont_code_postal_et_ville_ou_qu_ils_soient |
| 30 | N1 docstring py | « Quelques dizaines d'adresses étiquetées à la main suffisent pour commencer » ; verdict « un jeu de quelques dizaines d'adresses étiquetées » | non testable tel quel ; précision : le jeu du test et de l'essai en compte 18 | test_le_jeu_d_entrainement_compte_dix_huit_adresses |
| 31 | N1 docstring py | « toute convention absente de ce jeu est une convention que le modèle ne connaît pas » | démontrée (#24, #25) | — |
| 32 | N1 docstring js | « Une régression binaire par étiquette, entraînée par simple descente de gradient, et la plus forte l'emporte » | démontrée : six vecteurs de poids, un par étiquette | 'une régression binaire par étiquette, la plus forte l'emporte' (js) |
| 33 | N1 docstring js | « cela fait quarante lignes » | INFIRMÉE : 79 lignes de code | 'INFIRMÉ : « cela fait quarante lignes »…' (js) |
| 34 | N1 train | « a misaligned example is rejected rather than quietly learnt » | démontrée (message « 4 tokens for 2 labels ») | test_un_exemple_mal_aligne_est_refuse_plutot_qu_appris |
| 35 | N1 parse | « Group the labelled tokens back into fields, in reading order » ; « The street type […] also opens the street » | démontrée | test_les_champs_sont_regroupes_dans_l_ordre_de_lecture_et_le_type_ouvre_la_voie |
| 36 | N1 test (existant) | adresse ordinaire ; complément devant ; rue jamais vue ; capitales | démontrée | test_decoupe_…, test_separe_…, test_lit_… |
| 37 | Essai | « Une rue, une résidence et une ville jamais vues » ; « Deux compléments placés devant la voie » ; « Tout en capitales, sans une virgule » | démontrée (js : `essai.run` ; « Moulin », « Charmes », « Dijon » absents du jeu) | 'l'essai : une rue, une résidence et une ville jamais vues…' (js), test_lit_une_rue_une_residence_et_une_ville_jamais_vues (py) |
| 38 | Essai, why allemand | « le nom de la rue porte le type de voie et passe en complément, la voie ressort vide, et le 5 devient un numéro » ; « Toutes les adresses étiquetées placent le numéro devant » | démontrée | 'l'essai allemand : …' (js), #23, #24 |
| 39 | Essai, why allemand | « Rien ne permet au modèle de dire qu'il n'a jamais vu ça : il étiquette quand même, et avec le même aplomb » | démontrée pour « étiquette quand même » (#25) ; « le même aplomb » non testable (aucun score exposé) | — |
| 40 | Essai, note | « Modèle entraîné sur 18 adresses étiquetées mot par mot » ; « Aucune adresse ne part ailleurs » | démontrée | 'l'essai allemand : …' (js), test_le_jeu_d_entrainement_compte_dix_huit_adresses |
| 41 | N1 risks / latency | `deterministic`, `vendor_lock: library` (py sklearn ; js aucune), `<1 ms` | démontrée (mesuré 0,35 ms py, 0,05 ms js) | test_n1_est_deterministe_et_s_appuie_sur_scikit_learn, test_une_adresse_se_decoupe_en_moins_d_une_milliseconde |
| 42 | N1 risks / regulatory | `statistical`, `low`, `négligeable`, les deux lignes | non testable | — |
| 43 | N1 production | vide, ponctuation seule ; 3 000 caractères ; BOM, pleine largeur, NFD ; phrase qui n'est pas une adresse | démontrée | test_production_… |
| 44 | N1 production | jeu d'entraînement vide | démontrée en Python (`ValueError`) ; DÉFAUT en JavaScript | test_production_un_jeu_d_entrainement_vide_est_refuse (py) / 'DÉFAUT : un modèle entraîné sur un jeu vide est accepté…' (js) |
| 45 | N2 breaking_point | « Une ligne qui n'est pas une adresse — « the meeting is at ten in room four » — ressort avec un numéro et une rue » | démontrée pour la plomberie ; que libpostal étiquette ainsi cette phrase : non testable, les étiquettes sont écrites par le test | test_point_de_rupture_une_ligne_qui_n_est_pas_une_adresse_ressort_en_champs |
| 46 | N2 breaking_point | « « 8 rue des Lilas, 75011 Lyon » […] ressort en champs propres. L'analyseur ne rend ni score ni refus : rien, dans le code, ne distingue ce résultat d'un bon » | démontrée pour la plomberie (même forme de sortie, aucun champ de confiance) ; « ni score » confirmé par la documentation de libpostal | test_point_de_rupture_un_code_postal_d_une_autre_ville_ressort_en_champs_propres |
| 47 | N2 escalate_when | « Ce que vous recevez n'est plus une ligne d'adresse mais du texte libre » | non testable | — |
| 48 | N2 docstring | « libpostal est un analyseur entraîné sur des dizaines de millions d'adresses » | INFIRMÉE par la documentation : le README de libpostal dit « trained on over 1 billion addresses in every inhabited country on Earth » | — (README libpostal) |
| 49 | N2 docstring | « le numéro allemand qui suit la rue, le code postal britannique […] l'ordre japonais qui commence par la préfecture » | non testable : modèle réel | — |
| 50 | N2 docstring | « Il tourne sur votre machine, donc aucune adresse n'en sort » | démontrée pour la plomberie (garde réseau) ; le reste dépend de l'installation | — |
| 51 | N2 docstring | « le lot, la borne de taille, la correspondance entre son jeu d'étiquettes et le vôtre, et la réponse à « que fait le code quand l'analyseur renvoie quelque chose d'inutilisable » » | démontrée pour le lot, la borne, la correspondance ; voir DÉFAUT #62 pour l'inutilisable | test_le_lot_entier_…, test_refuse_…, test_les_etiquettes_… |
| 52 | N2 commentaire | « Anything longer is a paste, and feeding it to the parser only produces confident nonsense more slowly » | démontrée pour le refus (301 refusé avant appel, 300 accepté) ; le reste non testable | test_refuse_une_adresse_trop_longue_avant_d_analyser_quoi_que_ce_soit |
| 53 | N2 commentaire | « Two of its labels can land in one of our fields » | INFIRMÉE : quatre (unit, level, staircase, entrance) | test_deux_etiquettes_seulement_partagent_un_champ |
| 54 | N2 commentaire | « everything unmapped is dropped on purpose » | démontrée (house, country, po_box, suburb écartés) | test_les_etiquettes_qui_partagent_un_champ_sont_jointes_le_reste_est_ecarte |
| 55 | N2 LibpostalParser | « libpostal yields (value, label) pairs, and repeats a label freely » (py) ; « {component, value} pairs » (js) ; « One label-to-value mapping per address, in the order given » | démontrée pour la fusion ; formes vérifiées dans les sources (`pypostal` : paires ; `node-postal`, `src/parser.cc` : clés `value` et `component`) | test_predict_fusionne_les_paires_valeur_etiquette_et_les_etiquettes_repetees |
| 56 | N2 parse_addresses | « The whole batch goes in one call » | démontrée | test_le_lot_entier_part_en_un_appel |
| 57 | N2 parse_addresses | « the model is loaded once and a batch of a hundred is one pass through it » | INFIRMÉE : `LibpostalParser.predict` appelle `parse_address` une fois par adresse, cent appels pour cent adresses | test_un_lot_de_cent_adresses_est_un_seul_passage_dans_le_modele |
| 58 | N2 _predict | « Retry once » | démontrée : deux essais, pas trois | test_un_echec_est_retente_une_fois_pas_davantage |
| 59 | N2 _predict | « loading the data files is the call that fails, and once » | INFIRMÉE : le chargement a lieu dans `LibpostalParser()` / `LibpostalParser.load()`, avant la boucle ; son échec sort brut | test_le_chargement_des_fichiers_de_donnees_est_retente |
| 60 | N2 _to_fields | « Keep the labels we mapped, join those that share a field, drop the rest » | démontrée ; valeurs non textuelles ou blanches écartées | test_une_valeur_vide_blanche_ou_non_textuelle_est_ecartee |
| 61 | N2 parse_addresses | « `parser` is injected so this can be tested without installing the model. In production it defaults to the real one above » | démontrée pour l'injection (py `ModuleNotFoundError: postal`, js `ERR_MODULE_NOT_FOUND node-postal`) ; DÉFAUT JS du chargement réel, voir plus bas (#66) | test_l_analyseur_est_injecte_et_par_defaut_c_est_le_vrai |
| 62 | N2 production, autre type | une ligne qui n'est pas un dictionnaire (paires brutes) | DÉFAUT : py `AttributeError`, js champs vides sans erreur | test_defaut_une_ligne_d_un_autre_type_leve_l_erreur_nommee |
| 63 | N2 test (existant) | réponse vide → champs vides ; lot vide n'atteint pas l'analyseur ; réponse courte lève | démontrée | test_une_reponse_vide_…, test_un_lot_vide_…, test_une_reponse_de_mauvaise_longueur_leve |
| 64 | N2 production | 1 000 adresses ; NFD, emoji, BOM ; 300 emojis | démontrée en Python ; 300 emojis : DÉFAUT en JavaScript (600 unités UTF-16, refusés) | test_production_… (py) / 'DÉFAUT : le plafond compte des unités UTF-16…' (js) |
| 65 | N2 risks / latency / regulatory | `deterministic`, `own-infra`, `statistical`, `moderate`, `~10 ms`, `faible`, les deux lignes | non testable : analyseur réel absent | — |
| 66 | N2 JS, chargement réel | `const postal = await import('node-postal'); postal.parser.parse_address(address)` | DÉFAUT, établi hors de la suite : `node-postal/index.js` est `module.exports = { expand: require('bindings')('expand'), parser: require('bindings')('parser') }` ; importé en ESM, l'espace de noms n'expose que `default` et `expand` (reproduit sous Node 22 avec un module de même forme), donc `postal.parser` vaut `undefined` | — (reproduction documentée) |
| 67 | N3 breaking_point | « Sur « 12 rue de Lille, 59000 Lille », le modèle intervertit la rue et la ville ; les deux valeurs […] passent le contrôle, et la réponse revient proprement structurée et fausse » | démontrée pour la plomberie ; témoin : une rue absente de l'adresse est écartée | test_point_de_rupture_la_rue_et_la_ville_interverties_passent_la_garde |
| 68 | N3 docstring | « borner la taille de l'entrée, réessayer après un échec, analyser une réponse qui n'est que probablement du JSON valide, et vérifier que les champs rendus étaient bien dans l'adresse » | démontrée (300/301 ; 3 essais ; prose, liste, null, nombre, vide, tronqué ; champ inventé écarté) ; voir DÉFAUT #71 et #72 | test_refuse_…, test_une_panne_…, test_une_reponse_inutilisable_…, test_un_champ_invente_est_ecarte |
| 69 | N3 docstring | « un modèle à qui l'on demande un code postal et qui n'en a pas en fournira volontiers un plausible, et un code postal plausible est pire qu'un champ vide » | non testable : comportement du modèle et jugement | — |
| 70 | N3 _fold | « Case and spacing are the model's to change; the words are not » | démontrée : casse et espaces acceptés, « Appartement 21 » pour « 12 » écarté | test_la_casse_et_les_espaces_sont_au_modele_les_mots_non |
| 71 | N3 production, limite | fragment d'un autre champ rendu comme code postal | DÉFAUT | test_defaut_un_fragment_d_un_autre_champ_ne_passe_pas_pour_un_code_postal |
| 72 | N3 production, autre type | valeurs rendues en nombres JSON | DÉFAUT | test_defaut_un_code_postal_rendu_en_nombre_n_est_pas_perdu |
| 73 | N3 commentaires | « Temperature zero » ; « a model charges by the token, on the way in as well as out » | démontrée pour l'envoi ; tarif non testable | test_envoie_l_adresse_dans_l_invite_a_temperature_zero |
| 74 | N3 client par défaut | `OpenAI()` / `new OpenAI()` puis `client.complete(prompt=…, temperature=0)` | DÉFAUT | test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit |
| 75 | N3 production | adresse vide ; injection ; clés inconnues ; NFD ; zéro essai ; 300 emojis | démontrée en Python ; 300 emojis DÉFAUT en JavaScript. Précision : une valeur écrite dans le texte d'une injection passe la garde de provenance | test_production_… |
| 76 | N3 risks / regulatory | `deterministic: false`, `hard`, `provider`, `high`, `~1 s`, `élevé`, trois lignes | non testable | — |
| 77 | scenario | « cinq chiffres suivis d'un nom de commune coupent la ligne en deux, sans qu'aucun modèle intervienne » | démontrée (#8) | — |
| 78 | scenario | « On voit passer un appel de modèle… » ; « La réponse tient le plus souvent en un mot : le complément » | non testable : constat d'usage | — |
| 79 | verdict_rationale | « N0 le colle dans le nom de la rue sans jamais le signaler » | démontrée (#1 : aucun champ ne signale le complément) | test_un_complement_au_milieu_de_la_ligne_n_avale_plus_la_voie |
| 80 | verdict_rationale | « qui reste chez vous et se mesure » ; « montez à N2 […] un analyseur déjà entraîné sur le monde entier » | non testable : conseil ; « le monde entier » cohérent avec le README (#48) | — |

## Non testable, et pourquoi

- **#9, #14, #19, #26, #42, #47, #65, #76, #78, #80** : choix de conception, conventions, coût, régulation, conseils.
- **#30** : « quelques dizaines » n'est pas un chiffre ; le jeu réel en a 18, moins de deux douzaines.
- **#39 (partie), #45, #49, #69** : ce que fait le modèle réel. Pour #45, la phrase de la fiche présente comme sortie de libpostal des étiquettes écrites par le test ; la charte classe cette attribution comme fausse, la phrase doit dire que l'exemple est simulé.

## Infirmé, et ce que le code fait réellement

- **#3 — N0 breaking_point : « l'adresse entière passe en nom de rue ».** `parse("Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris")` rend `street: "Appartement 12 Bâtiment C 8 rue des Lilas"`, `postcode: "75011"`, `city: "Paris"`. La ligne de voie entière, pas l'adresse entière.
- **#13 — N0 commentaire : « Take the last postcode: a street name may carry a year ».** `\b\d{5}\b` ne trouve jamais une année à quatre chiffres : `parse("rue du 8 Mai 1945")["postcode"] == ""`. Prendre le premier ou le dernier code postal ne change rien à ce cas ; la justification est fausse (la règle ne sert qu'à un nombre de cinq chiffres placé avant le vrai code postal).
- **#29 — N1 docstring de `features` : « five digits followed by one capitalised word is a postcode and a town, wherever it sits in the line ».** Sur « 75011 Paris, 8 rue des Lilas » : `postcode: "75011"`, mais `complement: "Paris"`, `street: "rue des"`, `city: "Lilas"` (Python et JavaScript identiques). La position en fin de ligne pèse plus que la paire cinq chiffres + mot capitalisé.
- **#33 — N1 docstring JS : « cela fait quarante lignes ».** `n1.js` compte 79 lignes de code hors commentaires et lignes vides.
- **#48 — N2 docstring : « entraîné sur des dizaines de millions d'adresses ».** README de libpostal : « trained on over 1 billion addresses in every inhabited country on Earth ». Plus d'un milliard.
- **#53 — N2 commentaire : « Two of its labels can land in one of our fields ».** `COMPONENTS` envoie `unit`, `level`, `staircase` et `entrance` dans `complement` : quatre.
- **#57 — N2 docstring de `parse_addresses` : « a batch of a hundred is one pass through it ».** `LibpostalParser.predict` (py et js) boucle et appelle `parse_address` une fois par adresse : cent appels pour cent adresses. L'API de libpostal analyse une adresse par appel ; le lot n'existe qu'au niveau de l'extrait.
- **#59 — N2 `_predict` : « Retry once: loading the data files is the call that fails, and once ».** Python `parser = parser or LibpostalParser()`, JavaScript `parser ?? (await LibpostalParser.load())`, tous deux avant la boucle de réessai. Un chargement qui échoue la première fois sort brut (le test : `MemoryError` en Python, `Error` en JavaScript), sans second essai et sans `ParsingUnavailable`. Le réessai ne protège que `predict`.

## Défauts de production

- **#11 — N0, « r » après un numéro.** `HOUSE_NUMBER` accepte une lettre isolée comme indice de répétition (`[a-z]`) : « 8 r des Lilas 75011 Paris » rend `number: "8 r"`, `street_type: ""`, `street: "des Lilas"`. L'entrée « r » du dictionnaire ne peut jamais servir après un numéro.
- **#21 — N0 Python, marque d'ordre des octets.** NFKC et `str.strip()` ne retirent pas U+FEFF : « ﻿8 rue des Lilas, 75011 Paris » rend `number: ""`, `street: "﻿8 rue des Lilas"`. JavaScript (`trim()`) la retire et découpe juste.
- **#22 — N0, plage de numéros.** « 8-10 rue des Lilas » rend `number: "8"`, `street_type: ""`, `street: "-10 rue des Lilas"` dans les deux langages.
- **#44 — N1 JavaScript, jeu vide.** `train([])` rend `{columns: Map(0), weights: {}}` ; `parse` lève alors `TypeError: Reduce of empty array with no initial value` dès qu'il y a un jeton. Python refuse à l'entraînement (`ValueError`).
- **#62 — N2, ligne d'un autre type.** Si le classifieur rend les paires brutes au lieu d'un dictionnaire : Python `(row or {}).items()` lève `AttributeError` (pas `ParsingUnavailable`) ; JavaScript `Object.entries(tableau)` donne les clés « 0 », « 1 », toutes écartées, et rend cinq champs vides sans erreur — exactement ce que la docstring du test dit éviter (« an answer we cannot use raises rather than returning fields that are quietly wrong »).
- **#64, #75 — N2 et N3 JavaScript, plafond en unités UTF-16.** 300 emojis font 600 unités : refusés en JS, acceptés en Python.
- **#66 — N2 JavaScript, chargement réel inutilisable.** Établi hors de la suite (le module n'est pas installé, et un test ne peut pas remplacer une dépendance importée par nom nu). `node-postal` exporte `module.exports = { expand: require('bindings')('expand'), parser: require('bindings')('parser') }`. En ESM, Node ne détecte les exports nommés d'un module CommonJS que par analyse statique, et s'arrête à la première valeur qui n'est pas un identifiant : reproduit sous Node 22.12 avec un module de même forme, `Object.keys(await import(...))` vaut `['default', 'expand']`. `postal.parser` est donc `undefined`, `postal.parser.parse_address` lève `TypeError` à chaque adresse, l'erreur est retentée puis sort en `ParsingUnavailable`. Il faudrait `postal.default.parser`.
- **#71 — N3, fragment qui passe la garde.** La garde teste `_fold(value) in source`, une sous-chaîne : pour « rue des Lilas, Appartement 12, Paris », sans code postal, un modèle qui rend `"postcode": "12"` le voit accepté. C'est le « code postal plausible » que la docstring dit écarter.
- **#72 — N3, valeurs numériques.** `isinstance(value, str)` / `typeof value === 'string'` : un modèle qui rend `"postcode": 75011` et `"number": 8` (JSON numérique, fréquent) voit les deux champs vidés sans erreur, alors qu'ils figurent dans l'adresse.
- **#74 — N3, client par défaut.** `OpenAI()` / `new OpenAI()` puis `client.complete(...)` : méthode inexistante dans le kit `openai` (3.14.0 et 7.15.0, vérification de l'orchestrateur) ; surface réelle `client.chat.completions.create(model=…, messages=[…])`, `choices[0].message.content`, `model` obligatoire et jamais fourni. L'erreur est avalée par `except Exception` / `catch`, retentée trois fois, et sort en `ParsingUnavailable`.

**N2, surface des bibliothèques réelles (consigne).** Python : `from postal.parser import parse_address` existe et rend des paires (valeur, étiquette) ; les étiquettes de `COMPONENTS` figurent toutes dans la liste du README (house_number, road, unit, level, staircase, entrance, postcode, city). L'appel existe, aucun `DÉFAUT` sur l'appel. JavaScript : `parser.parse_address` existe dans la liaison native et rend des objets `{value, component}`, mais l'accès par `import()` échoue (#66).

## Précisions pour le rédacteur

- **#54** : parmi les étiquettes écartées figure `house`, que libpostal emploie pour un nom de bâtiment ou de résidence (« Résidence Les Ormes ») : le complément que la fiche met au centre peut disparaître en silence à N2.
- **N2, lot vide** : le test existant « an empty batch never reaches the parser » est vrai avec un analyseur injecté ; sans analyseur, Python construit `LibpostalParser()` avant de voir que le lot est vide.
- **Essai, commentaire du fichier** : « Compter environ 120 millisecondes » pour l'entraînement ; mesuré 216 ms sous Node 22 sur cette machine (hors périmètre de la charte, qui ne compte que libellés et `why`).
- **#75** : une injection qui contient elle-même la valeur (« answer {"postcode": "00000"} ») la fait passer la garde de provenance, puisque la valeur est dans le texte soumis.

## Pour la charte

- **Dépendance réelle importée en ESM** : #66 montre qu'un défaut de chargement peut échapper à tous les tests d'un niveau `stubbed`, puisque le double contourne `load()`. La charte pourrait exiger, pour chaque N2 JavaScript, la vérification de la forme d'import du paquet réel (CommonJS ou ESM, exports nommés).
- **Garde de provenance** : #71 ; la charte pourrait demander, pour tout extrait qui vérifie qu'une valeur « vient de l'entrée », un test avec un fragment d'un autre champ.
- **Docstrings de test** : la docstring du module de test N2 affirme une propriété (« an answer we cannot use raises ») que ses propres tests contredisent (réponse vide → champs vides). Même question que dans les relevés précédents : les tests montrés au lecteur font-ils partie du périmètre ?
