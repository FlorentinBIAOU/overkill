# generate-placeholder-images — relevé du testeur

Passe 1 du lot 15. Un seul niveau disponible (N0). Tests : `content/snippets/generate-placeholder-images/n0.test.py`
(28 tests, dont 1 `DÉFAUT`) et `n0.test.js` (29 tests, dont 1 `DÉFAUT`). Les 9 tests d'origine de chaque langage
sont conservés, renommés en français ; 19 tests ajoutés en Python, 20 en JavaScript.

`node scripts/test-snippets.mjs generate-placeholder-images` : vert.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « “red velvet sofa” ne tombe pas dans les rouges » | démontrée (teinte 323°, « magenta » selon la table de l'essai ; témoin : « blue velvet sofa » tombe à 1°, dans les rouges) | test_point_de_rupture_red_velvet_sofa_ne_tombe_pas_dans_les_rouges |
| 2 | N0 breaking_point | « sofa-1 et sofa-2 reçoivent des teintes éloignées alors qu’il s’agit du même canapé » | démontrée (178° et 226°, écart 48°) | test_point_de_rupture_sofa_1_et_sofa_2_recoivent_des_teintes_eloignees |
| 3 | N0 breaking_point | « la sortie n’est jamais que des rectangles pleins en deux couleurs » | démontrée sur 204 identifiants | test_point_de_rupture_la_sortie_nest_que_des_rectangles_pleins_en_deux_couleurs |
| 4 | N0 breaking_point | « le hachage décide de tout, le sens de l’identifiant de rien » | démontrée : « costarring » et « liquid » ont le même FNV-1a 32 bits et reçoivent le même dessin, au nom accessible près | test_point_de_rupture_le_hachage_decide_de_tout_deux_identifiants_en_collision_donnent_le_meme_dessin |
| 5 | N0 name | « SVG déterministe dérivé d’un hachage de l’identifiant » | démontrée (tests 4, 8, 11) | — |
| 6 | N0 docstring | « No file is written and no byte is downloaded: the function returns a string of markup » | démontrée (ouverture de fichier interdite pendant l'appel, garde réseau active, sortie `str`) | test_aucun_fichier_ecrit_et_aucune_dependance_externe |
| 7 | N0 docstring | « The same identifier always yields exactly the same image, on every machine, in every language, for ever » | démontrée pour « in every language » (2 009 identifiants × 8 tailles comparés entre Python et Node) et « for ever » dans la mesure où le balisage est épinglé ; « on every machine » : non testable au-delà de la machine du test | test_python_et_javascript_saccordent_au_caractere_pres, test_est_deterministe_et_depend_de_lidentifiant |
| 8 | N0 docstring | « lets the Python and the JavaScript version agree character for character » | démontrée (les 360 teintes couvertes, accents, NFD, BOM, largeur nulle, emoji, tailles 0 à 1001) | test_python_et_javascript_saccordent_au_caractere_pres |
| 9 | N0 docstring | « A placeholder that changed on each render would flicker in a grid and defeat every HTTP cache » | non testable : argument d'usage, pas un comportement du code | — |
| 10 | N0 docstring | « Hue, chroma and cell positions are computed without a single division that could round differently from one runtime to another » | démontrée par l'accord des deux langages ; à noter : le code contient des divisions (`//`, `Math.floor(a / b)`), toutes entières et exactes sous 2^53 — la phrase dit vrai, mais « without a single division » se lit vite comme « sans division » | test_python_et_javascript_saccordent_au_caractere_pres |
| 11 | N0 commentaire | « FNV-1a, the same constants as the rest of the catalogue, so that identifiers hash identically wherever they are hashed » | démontrée (vecteurs de référence `""`, `"a"`, `"foobar"` ; égalité avec `_harness`) | test_le_hachage_est_le_fnv_1a_32_bits_de_reference |
| 12 | N0 commentaire (py) | « Not the built-in hash: that one is salted per process » | démontrée (deux `PYTHONHASHSEED` donnent deux `hash()`) | test_le_hash_natif_de_python_change_dun_processus_a_lautre (Python seul) |
| 13 | N0 commentaire (js) | « a plain multiplication on numbers this large loses precision past 2^53 and would silently drift » | démontrée (la version naïve diverge sur « sku-4451 », témoin BigInt exact) | une multiplication ordinaire dériverait là où Math.imul reste exact (JavaScript seul) |
| 14 | N0 commentaire | « HSL to hexadecimal, in integers only » | démontrée : les 360 teintes, fond (45 %, 90 %) et encre (55 %, 42 %), à ±2 par canal d'une conversion flottante | test_le_fond_teinte_et_lencre_sont_la_conversion_hsl_des_pourcentages_annonces |
| 15 | N0 docstring | « The high bits of the hash choose the hue, the low ones switch cells on and off » | démontrée sur 300 identifiants (bits 16–31 pour la teinte, bits 0–14 pour les cases) | test_les_bits_hauts_choisissent_la_teinte_et_les_bits_bas_les_cases |
| 16 | N0 docstring | « Mirroring the left columns onto the right ones » (figure symétrique) | démontrée sur 300 identifiants. Le test d'origine n'assertait que sur la constante `GOLDEN_MUG` elle-même : il ne démontrait rien du code, conservé mais complété | test_la_figure_est_symetrique |
| 17 | N0 commentaire | « The identifier ends up inside an attribute, so it is markup until escaped » | démontrée (guillemets, `<`, `>`, `&`, injection `"/><script>`) | test_production_accents_et_caracteres_de_balisage_sont_echappes, test_production_une_injection_de_balisage_reste_dans_lattribut |
| 18 | N0 commentaire | « The ampersand goes first, or it would escape the escapes » | démontrée (`&lt;` en entrée ressort `&amp;lt;` et se relit à l'identique) | test_production_lesperluette_est_echappee_en_premier |
| 19 | N0 risks.deterministic | `true` | démontrée (rangs 7, 8) | test_est_deterministe_et_depend_de_lidentifiant |
| 20 | N0 risks.data_egress | `none` | démontrée (garde réseau des deux harnais, aucune URL hors espace de noms SVG) | test_aucun_fichier_ecrit_et_aucune_dependance_externe |
| 21 | N0 risks.testability | `unit` | démontrée (tout le fichier de test est unitaire) | — |
| 22 | N0 risks.regulatory | « l’image est calculée dans votre processus, rien n’est téléchargé et rien n’est transmis » | démontrée (rang 6) | test_aucun_fichier_ecrit_et_aucune_dependance_externe |
| 23 | N0 risks.regulatory | « L’identifiant reçu est recopié dans l’attribut aria-label du balisage servi » | démontrée | test_lidentifiant_est_recopie_dans_aria_label |
| 24 | N0 latency | « <1 ms » | démontrée : mille images de 240 px en moins d'une seconde (observé : environ 6 ms en Python pour les mille) | test_une_image_prend_moins_dune_milliseconde |
| 25 | N0 cost | `nul` | non testable : déclaration d'ordre de grandeur, aucun appel payant dans le code (rang 20) | — |
| 26 | N0 escalate_when | « Il n’y a pas de niveau au-dessus… aucune approche de cette fiche n’y répond » | non testable : jugement éditorial | — |
| 27 | scenario | « On voit des maquettes et des catalogues incomplets remplir leurs vignettes vides par un appel à un générateur d’images » | non testable : constat d'usage | — |
| 28 | scenario | « Une fonction de hachage satisfait ces trois exigences sans réseau et sans fichier écrit sur le disque », « deux rendus de la même page donnent la même image » | démontrée (rangs 6, 7 ; « se distinguer » : rang 2) | — |
| 29 | N1 unavailable_reason | « Il n’y a rien à apprendre… aucun jeu étiqueté possible » | non testable : raisonnement, aucun code N1 | — |
| 30 | N2 unavailable_reason | « une image dont on ne retrouve pas l’exacte réplique en changeant de version de bibliothèque ou de pilote » | non testable : aucun modèle de diffusion dans l'environnement ; à sourcer par le rédacteur | — |
| 31 | N3 unavailable_reason | « chaque vignette manquante devient un appel facturé », « rien ne garantit que le même identifiant redonnera la même image » | non testable : aucun code N3 ; à sourcer | — |
| 32 | verdict_rationale | « le même balisage attendu figure en toutes lettres dans le test Python et dans le test JavaScript, ce qui épingle les deux implémentations l’une à l’autre » | démontrée : chaque test relit la constante de l'autre fichier et la compare | test_le_balisage_attendu_est_exactement_celui_du_test_javascript |
| 33 | verdict_rationale | « Rien ne sort du processus, le coût marginal est nul, et le résultat se teste unitairement au caractère près » | démontrée (rangs 6, 32) ; « coût marginal nul » non testable | — |
| 34 | essai, why | « Le mot “rouge” est dans l’identifiant et l’image sort en vert » | démontrée : 159°, « vert » — **à 1° de la borne « turquoise » (160)** de la table de l'essai | test_lessai_un_identifiant_qui_dit_rouge_sort_en_vert |
| 35 | essai, why | « un bleu et un vert pour deux vues du même canapé » | démontrée (vue de face 234°, bleu ; vue de profil 113°, vert) | test_lessai_deux_vues_du_meme_canape_donnent_un_bleu_et_un_vert |
| 36 | essai, detail | « N rectangles pleins en 2 couleurs, et rien à télécharger » | démontrée sur les quatre cas (compte et SVG identiques à l'extrait) | l’essai : le détail compte des rectangles pleins en deux couleurs (JavaScript seul, l'essai n'existe qu'en JS) |
| 37 | essai, stable | « donnera cette image-là sur toutes les machines, aujourd’hui et dans dix ans » | démontrée dans la mesure du rang 7 ; « dans dix ans » non testable au-delà de l'épinglage | — |
| 38 | N0 production | identifiant vide | démontrée : image bien formée, `aria-label=""` | test_production_un_identifiant_vide_donne_une_image |
| 39 | N0 production | identifiant absent (`None`, `null`, `undefined`) | démontrée : `TypeError` dans les deux langages (voir remarque) | test_production_un_identifiant_absent_leve_une_typeerror |
| 40 | N0 production | identifiant d'un mégaoctet | démontrée : termine largement sous 5 s, aria-label intact | test_production_un_identifiant_dun_megaoctet_termine_vite |
| 41 | N0 production | NFC / NFD | démontrée : « café » composé et décomposé donnent deux images différentes (voir remarque) | test_production_nfc_et_nfd_du_meme_mot_donnent_deux_images_differentes |
| 42 | N0 production | insécable, largeur nulle, emoji, BOM, casse | démontrée : recopiés tels quels, SVG bien formé, casse distincte = image distincte | test_production_insecables_largeur_nulle_emoji_et_bom_sont_recopies_tels_quels |
| 43 | N0 production | caractère de contrôle dans l'identifiant | DÉFAUT : recopié tel quel dans `aria-label`, le SVG n'est plus du XML bien formé | test_defaut_un_caractere_de_controle_rend_le_svg_mal_forme |
| 44 | N0 production | tailles aux limites (0, 4, 5, 7, 64) | démontrée ; en dessous de 5 px les cases font 0 px (voir remarque) | test_production_tailles_aux_limites |

## Non testable, et pourquoi

- Rangs 9, 26, 27, 29 : jugements d'usage ou raisonnements éditoriaux, sans comportement de code associé.
- Rangs 30, 31 : portent sur des niveaux sans code (diffusion auto-hébergée, API d'image facturée). Rien à exécuter ; le rédacteur doit les sourcer ou les formuler comme raisonnement.
- Rang 25 (`cost: nul`) : déclaration d'ordre de grandeur ; seule l'absence d'appel externe est vérifiable, et elle l'est.
- « on every machine », « for ever », « dans dix ans » (rangs 7, 37) : un test ne voit qu'une machine et un instant ; ce qui est démontré est l'accord Python / Node et l'épinglage du balisage exact.

## Infirmé, et ce que le code fait réellement

Aucune affirmation infirmée.

Deux démonstrations tiennent de justesse, à signaler au rédacteur :

- « red velvet sofa » sort à 323°, que la table de l'essai nomme « magenta » ; la borne des rouges y est à 330°, soit 7° plus loin. La fiche n'emploie pas la table de l'essai pour dire « les rouges » : le test d'origine prenait une fenêtre de ±30° autour de 0°. Les deux lectures sont vraies aujourd'hui. Pour un exemple sans ambiguïté, « blue velvet sofa » tombe à 1°, en plein rouge.
- « canapé en velours rouge » sort à 159°, « vert » à un degré de « turquoise ». Le why est vrai, mais un lecteur qui regarde la vignette (encre `hsl(159, 55 %, 42 %)`) peut y voir un vert-bleu.

## Défauts de production

- **Caractère de contrôle** (rang 43) : U+0000–U+0008, U+000B, U+000C, U+000E–U+001F ne sont pas filtrés par l'échappement. Une tabulation verticale collée depuis un tableur suffit : `ElementTree` refuse le SVG, et un navigateur qui reçoit le fichier en `image/svg+xml` ne l'affiche pas. En balisage incorporé dans du HTML, le parseur HTML tolère. Le commentaire « it is markup until escaped » laisse croire que l'échappement suffit.

Remarques qui ne sont pas des défauts (tranché : comportement annoncé par le type ou sans conséquence réaliste) :

- `None` / `null` lèvent `TypeError`. Le commentaire du test d'origine dit « A missing reference is exactly when a placeholder is needed » ; en production, une référence manquante arrive souvent comme `null`, pas comme chaîne vide. La signature typée `str` couvre le cas, mais la fiche pourrait le dire.
- NFC et NFD du même texte donnent deux images : le hachage porte sur les points de code. Identifiants tirés d'un système de fichiers macOS (NFD) et d'une base (NFC) : deux remplaçants pour le même objet.
- Taille inférieure à 5 : les cases font 0 px, seule la couleur de fond reste ; taille 0 : SVG vide bien formé. Aucune validation de `size` (une taille négative produit `width="-240"`).

## Pour la charte

- Un commentaire propre à un seul langage (le sel du `hash` Python, `Math.imul` en JavaScript) ne peut pas avoir de jumeau de même nom : j'ai testé chacun dans son seul langage. La règle « un test Python et son jumeau JavaScript portent le même nom » mériterait cette exception écrite.
- L'essai n'existe qu'en JavaScript : ses affirmations chiffrées sont testées en JavaScript en important le module de l'essai, et en Python en recopiant la table des familles de teintes. La charte pourrait dire lequel des deux est attendu.
- L'accord entre les deux langages se démontre bien mieux en lançant l'autre interpréteur depuis le test (sous-processus local, pas de réseau) qu'avec une seule constante recopiée. La charte pourrait le recommander pour toute fiche qui affirme cet accord.
