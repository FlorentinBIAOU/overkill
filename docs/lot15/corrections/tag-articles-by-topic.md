# tag-articles-by-topic — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures` et `check-french`
verts. `test-snippets tag-articles-by-topic` : 7 tests rouges (3 py, 4 js), tous
listés dans « À retester ». Aucune assertion n'a été touchée. Restent marqués,
et échouent toujours tels qu'écrits, les tests d'affirmations retirées ou
réécrites (N0 « lemmatisation », N1 « trois étiquettes » et « à distance », N2
« aucun seuil ») et le test du client par défaut N3, qui passe le kit à la
place du client (voir « À retester »).

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 name fr/en + docstring py/js + `doc.fr.yaml` (#5) | « correspondance de termes après lemmatisation » / « matched after simple lemmatisation » | INFIRMÉ (test) : « embauchons » ne rencontre pas « embaucher », « fiscaux » pas « fiscal » | « correspondance de termes après retrait des terminaisons » / « matched after stripping common endings » ; commentaire `SUFFIXES` : « not a lemmatiser: "embauchons" does not become "embaucher", "fiscaux" does not become "fiscal", and "poste" and "post" fold onto the same stem » (#13) |
| N0 commentaire `SUFFIXES` (#12) | « Endings stripped, longest first » | La liste n'est pas triée par longueur ; seules les terminaisons emboîtées sont essayées de la plus longue à la plus courte | « Endings stripped, longest of any two that overlap first » |
| N0 breaking_point fr/en (#3) | « La seule réparation est d’ajouter un terme après chaque article manqué, indéfiniment » | « indéfiniment » non testable ; démontré : le terme ajouté rattrape cet article, « chacun travaille depuis chez lui » repasse | « …après chaque article manqué, et l’article suivant, écrit autrement, repasse au travers » |
| N0 commentaire de tri (#19) | « ties in alphabetical order » | INFIRMÉ en Python (points de code) ; JS `localeCompare` dépend de la locale | Code réparé ; « then by name once lowercased and stripped of accents, the same order in both languages » |
| N1 docstring py/js + `doc.fr.yaml` (#36) | « an article can come back with three tags, or with none » | INFIRMÉ : trois thèmes recopiés ressortent sans étiquette (py 0,33/0,32/0,39) ; deux étiquettes démontrées (essai, cas 2) ; normalisation L2 | « an article can come back with two tags, or with none. The article's TF-IDF vector has length one, though: the more topics it covers, the less weight each gets. In the test, an article made of the training articles of three topics comes back with no tag at all. » (limite écrite) |
| N1 commentaire bigrammes py/js (#38) | « "à distance" says something that "distance" alone does not » | INFIRMÉ : jetons d'un caractère jetés (`(?u)\b\w\w+\b`, `{2,}`) | « Words of one character are dropped first, so "travailler à distance" gives the pair "travailler distance". » |
| N1 docstring js + `doc.fr.yaml` (#42) | « because TF-IDF and logistic regression fit on a page between them » | Non mesurable ; 67 lignes utiles | « with sparse vectors so that training grows with the words each article holds rather than with the whole vocabulary » (Code réparé) |
| N1 docstring py + `doc.fr.yaml` (#43) | « a few hundred articles someone has to tag by hand » | Non sourcé | « articles someone has to tag by hand » |
| N1 breaking_point fr/en + essai cas 4 `why` (#30, #55) | « Chaque thème ajouté à la taxonomie redemande une passe d’étiquetage à la main sur tout le fonds » | Dépend du fonds ; démontré (#37) : un article non étiqueté est un exemple négatif | « Un thème ajouté à la taxonomie n’existe pour le modèle qu’une fois des articles étiquetés avec lui, et les articles du fonds qui en parlent sans porter l’étiquette lui servent d’exemples contraires. » (essai : première moitié) |
| N2 breaking_point fr/en + docstring py/js + `doc.fr.yaml` (#45, #46, #47) | « il ne veut pas dire la même chose d’un thème à l’autre. Sur un article de quatre phrases de cybersécurité […] Aucun seuil ne sépare les deux » ; docstring « see the test for what that means » | Scénario mesuré sur un double (sac de mots haché), pas sur l'encodeur ; INFIRMÉ avec le double même (0,165 sépare) ; démontré : cosinus négatif, somme ≠ 1, un seul seuil | « Le score est un cosinus, pas une probabilité : il peut être négatif, les scores d’un même article ne somment pas à un, et un seul seuil sert tous les thèmes. Le test le montre sur des vecteurs écrits à la main. Choisir ce seuil d’après les erreurs qu’il fait demande des articles dont on connaît déjà les thèmes […] Ce que vaut un même cosinus d’un thème à l’autre avec le vrai encodeur, aucun test d’ici ne le mesure. » |
| N2 docstring de `build_labeller` (#60) | « and a bare keyword gives it very little to work with » | Comportement de l'encodeur non testable | « the encoder was trained on sentences, and a bare keyword gives it very little to work with » → « the model card describes an encoder of sentences and paragraphs » (carte : « maps sentences & paragraphs to a 384 dimensional dense vector space ») |
| N3 breaking_point fr/en (#70, #72) | « Le modèle peut répondre n’importe quoi » ; « L’extrait lève une erreur » | Comportement du modèle non testable ; INFIRMÉ pour une liste d'objets ou de nombres | « La réponse est du texte libre : l’extrait demande du JSON, il ne peut pas l’imposer […] L’extrait lève une erreur, pour de la prose comme pour une liste d’autre chose que des noms ou de noms dont aucun n’est dans la taxonomie » ; en : « plenty of articles » → « some articles » |
| N3 docstring py/js + `doc.fr.yaml` (#79) | « a model will happily invent a plausible topic » ; « because the model itself is not testable » ; « This is the option people reach for first » | Non sourcé | « nothing stops a model from answering a name that is not on the list » ; « because a test against a double says nothing of how the model tags » ; première phrase retirée |
| N3 commentaire température (py ajouté, js) | « because a taxonomy that changes between two identical calls is not a taxonomy » ; py : « two identical calls must file an article the same way twice » | Kit `openai` 3.14.0 : `temperature` « more focused and deterministic » ; `seed` : « Determinism is not guaranteed » | « the low end of the range, which the provider documents as more focused and deterministic. It does not promise that two identical calls agree. » |
| scenario fr/en (#89) | « Le fonds, lui, est déjà là : des années d’articles que la rédaction a étiquetés à la main, et dont personne ne se sert » | Constat d'usage non sourcé | « Or une rédaction qui étiquette ses articles depuis des années a déjà de quoi entraîner un classifieur : ses propres articles, étiquetés à la main. » |
| verdict_rationale (#42, #43, #92) | « N1 est le premier niveau qui voit des sujets plutôt que des mots » ; « le code, qui tient sur une page, mais quelques centaines d’articles » ; « un seuil qu’on ne peut plus calibrer » | N1 pèse des mots (TF-IDF) ; « une page » et le volume non mesurés ; le seuil se calibre, mais avec des articles étiquetés | « N1 est le premier niveau qui apprend quels mots vont avec un thème, au lieu de s’en tenir à ceux qu’on a listés » ; « Ce qu’il coûte n’est pas le code, mais des articles étiquetés à la main » ; « un seuil qu’on ne choisit qu’avec des articles déjà étiquetés » |
| further_reading, libellé IR Book | « le fondement de TF-IDF appliqué à la classification » | Page existante : classification en espace vectoriel (Rocchio, kNN) ; « le fondement » est un jugement | « la classification de documents représentés en vecteurs TF-IDF » |
| Essai, commentaire d'en-tête (#57) | « Ce barreau » ; « Un fonds français n'apprend rien de l'anglais » ; « deux articles en portent deux » ; « une centaine de millisecondes » | Vocabulaire ; le fonds compte trois articles à deux thèmes ; durée non mesurée | « Ce niveau […] ne pèse que les mots de ce fonds […] trois articles en portent deux […] s'entraînent au chargement de la page » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N3 docstring py/js + `doc.fr.yaml` | « This is the option people reach for first » | Non sourcé |
| N2 docstring `build_labeller` | « a bare keyword gives it very little to work with » | Comportement de l'encodeur non testable (#60) |
| N2 breaking_point | l'exemple de l'article de cybersécurité et « Aucun seuil ne sépare les deux » | Décrivait le double ; infirmé même avec lui (#45, #46) |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0 py/js (#18) | un terme contenu dans un autre compte deux fois (« crédit d’impôt » + « impôt ») ; deux termes au même radical aussi | termes dédupliqués par radical, cherchés du plus long au plus court, chaque terme trouvé retiré du texte avant les suivants |
| n0 py/js (#19) | ordre des ex æquo : points de code en Python, `localeCompare` (dépendant de la locale) en JS | même clé dans les deux : nom passé par `normalise`, puis nom brut |
| n0 py/js (#22) | `min_terms=0` (ou négatif) pose tous les thèmes | `ValueError` / `RangeError` (JS : `!(minTerms >= 1)`, refuse aussi `NaN`) |
| n0 py/js (#26) | U+00AD, U+200B coupent le mot | `normalise` retire les caractères de format (catégorie Cf) ; la marque d'ordre des octets, Cf aussi, reste traitée |
| n0 py/js (#27) | « oe » et « œ » ne se rencontrent pas | `œ` → `oe`, `æ` → `ae` avant NFD |
| n1.py (#50) | fonds à un seul thème : `score` lit P(absent) | colonnes de thèmes prises à la fin de `predict_proba` (vérifié : une colonne `binary` rend [absent, présent]) |
| n1.js (#51) | 300 articles de 500 mots : `RangeError` de `Math.hypot(...vector)`, et un coût dense epochs × articles × traits × thèmes | vecteurs creux (colonnes, valeurs) ; décroissance L2 portée par un facteur d'échelle, mathématiquement identique au pas d'origine, renormalisé sous 1e-9 ; norme calculée par boucle. Mesuré : 300 articles de 500 mots (146 133 traits), 600 époques, 1,85 s. Tous les scores des tests et de l'essai sont inchangés |
| n1.js (#52) | fonds vide, longueurs différentes : acceptés en silence | `RangeError` si les longueurs diffèrent ou si aucun thème n'est étiqueté |
| n1.js, n2.js | ex æquo triés par `localeCompare` | comparaison par unités de code, comme Python |
| n2 py/js (#68) | l'encodeur tronque à 128 jetons (Python) ou 512 (JS), la fin de l'article ne compte pas | l'article est découpé en passages de 400 caractères au plus, aux fins de phrase ou de ligne ; le score d'un thème est son meilleur cosinus sur les passages. Mesuré avec le tokenizer du modèle : 400 caractères de français = 110 jetons, d'anglais 87, d'allemand 101. Limite écrite : un texte que le tokenizer découpe plus finement peut encore déborder |
| n2 py/js (#69) | moins de vecteurs que de textes, largeurs différentes, NaN : score faux ou thème perdu | `ValueError` / `Error` sur le nombre, la largeur (y compris entre article et thèmes) et toute valeur non finie |
| n2.py | avec les passages, 1 000 thèmes × 230 passages en Python pur dépassaient la borne de 5 s | produit matriciel NumPy (`vectors @ known.T`) ; NumPy est déjà une dépendance de `sentence-transformers` et figure dans `requirements-snippets.txt` |
| n2.js (#62) | `@xenova/transformers`, ancien nom ; poids quantifiés possibles | `@huggingface/transformers`, `pipeline('feature-extraction', name, { dtype: 'fp32' })` : les poids pleine précision, ceux de Python |
| n3 py/js (#83) | client par défaut sans `complete` | adaptateur commun, construit après les refus d'entrée |
| n3 py/js | `message.content` nul passé à `json.loads`/`JSON.parse` | refus explicite, redemandé |
| n3 py/js (#72) | liste d'objets ou de nombres → `[]` | refusée (« not a list of names »), redemandée, puis `TaggingUnavailable` |
| n3 py/js (#86) | réponse dont aucun nom n'est dans la taxonomie → `[]` | refusée, redemandée, puis `TaggingUnavailable` ; une réponse vide `[]` reste légitime |
| n3 py/js (#85) | taxonomie NFD contre réponse NFC | clé commune : NFC, `strip`, `casefold` / `toLowerCase` |
| n3.js (#84) | plafond en unités UTF-16 | compté en points de code |
| n3 py/js (#87) | article vide ou taxonomie vide : un appel payé | `[]` sans appel |
| n3 py/js | clôture ```json non décodée | clôture retirée avant décodage, comme dans les autres N3 (voir « Pour l'orchestrateur ») |

Marquages retirés (assertions inchangées) : n0 — 2 `INFIRMÉ` et 3 `DÉFAUT` py,
1 `INFIRMÉ` et 3 `DÉFAUT` js ; n1 — 1 `DÉFAUT` py, 2 js ; n2 — 2 `DÉFAUT` py,
2 js ; n3 — 1 `INFIRMÉ` et 2 `DÉFAUT` py, 1 `INFIRMÉ` et 3 `DÉFAUT` js.

Lignes utiles (avant → après) : n0.py 22 → 31, n0.js 26 → 38, n1.py 21 → 22,
n1.js 67 → 76, n2.py 26 → 46, n2.js 37 → 65, n3.py 36 → 64 (50 hors
adaptateur), n3.js 43 → 68 (51 hors adaptateur).

Dépassements, justifiés : n1.js écrit TF-IDF et la régression logistique à la
main, déjà à 67 ; le passage aux vecteurs creux (+9) est ce qui lui fait
traiter le volume que la fiche annonce. n2 (+20 py, +28 js) : `passages` et la
validation des vecteurs réparent les deux défauts de production relevés
(troncature silencieuse, vecteurs de mauvaise forme). n3 (hors adaptateur, +14
py, +8 js) : refus explicites du contenu nul, des listes d'autre chose que des
noms, des réponses entièrement hors taxonomie, et les refus avant appel.
Réduire reviendrait à retirer une réparation.

## Sources consultées

- Hugging Face, `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : carte (« maps sentences & paragraphs to a 384 dimensional dense vector space », longueur maximale 128 jetons, moyenne des jetons) ; `sentence_bert_config.json`, `"max_seq_length": 128` ; tokenizer téléchargé et comptes de jetons mesurés (`transformers` 5.17.0, bac à sable).
- Hugging Face, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` : `tokenizer_config.json` `model_max_length` 512 ; fichiers `onnx/model.onnx` (pleine précision) et variantes quantifiées.
- Paquet npm `@huggingface/transformers` 4.2.0 (source lue) : `pipelines/feature-extraction.js` (`pooling: 'mean'`), `utils/dtypes.js` (option `dtype`, `fp32` par défaut hors wasm), `utils/tensor.js` (`tolist`).
- scikit-learn, *Multiclass and multioutput algorithms* : « OneVsRestClassifier also supports multilabel classification. To use this feature, feed the classifier an indicator matrix » ; libellé conforme. Comportement à un seul thème vérifié en exécutant `n1.train` (`y_type_` `binary`, deux colonnes).
- W3C, *SKOS Reference* : page existante, systèmes d'organisation des connaissances (thésaurus, taxonomies, schémas de classification) ; libellé conforme.
- *Introduction to Information Retrieval*, « Vector space classification » : page existante (Rocchio, kNN sur vecteurs de documents) ; libellé corrigé.
- sbert.net : documentation de Sentence Transformers, page existante ; libellé conforme pour Python.
- Kit `openai` 3.14.0 : `temperature`, `seed`, `ChatCompletionMessage.content: Optional[str]`.
- Mesures locales, une décision sur un article : N0 Python 0,59 ms pour 500 mots, 0,70 ms pour 600, 1,14 ms pour 1 000 (après réparation) ; `<1 ms` tient pour un article de presse ordinaire. N1 : relevé (0,5 ms py, 0,03 ms js). N2 `~100 ms`, N3 `~1 s` : non mesurables ici, classes conservées.

## À retester

- **Adaptateur N3** : tester `ProviderClient` / `providerClient` avec `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` (`chat.completions.create`, `choices[0].message.content`), contenu `None`/`null` → `TaggingUnavailable` après trois appels (vérifié à la main). **`test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit` (py) et `DÉFAUT : le client par défaut a la forme du vrai kit` (js), encore marqués** : ils passent le kit comme `client` ; il faut `client=ProviderClient(sdk=…)` / `await providerClient(sdk)`, ou appeler `tag` sans client avec le module `openai` remplacé.
- **n0 `production : valeurs aux limites de min_terms` (py/js), rouges** : « entretien d'embauche » absorbe « embauche », l'article compte trois termes et non quatre ; reprendre les bornes à 3/4.
- **n3 `point de rupture : une réponse JSON qui n'est pas une liste lève` (py/js), rouges** : la clôture ```json est désormais décodée ; retirer ce cas de la liste.
- **n3 `production : un article vide part quand même chez le fournisseur` (py/js), rouges** : aucun appel désormais ; vérifier aussi la taxonomie vide sans appel.
- **n2.js `l’encodeur est injecté, et par défaut c’est le vrai`, rouge** : le module attendu est `@huggingface/transformers`.
- **Marquages d'affirmations retirées, encore en place** : n0 `INFIRMÉ : « lemmatisation »` (py/js) — le nom ne le dit plus, retourner en démonstration de la limite écrite (« embauchons », « fiscaux » non repliés) ; n1 `INFIRMÉ : trois étiquettes` (py/js) — retourner en démonstration de la nouvelle docstring (aucune étiquette pour l'article à trois thèmes, deux pour le cas 2 de l'essai) ; n1 `INFIRMÉ : « à distance »` (py/js) — démontrer « travailler distance » ; n2 `INFIRMÉ : aucun seuil` (py/js) — le point de rupture ne le dit plus, et le test `point de rupture : avec le double, la fiscalité passe sous le seuil…` décrit un scénario retiré de la fiche.
- n0 : « crédit d'impôt » + « impôt » dans la même phrase comptent un terme, dans deux phrases distinctes deux ; « impôt » et « impôts » dans le vocabulaire comptent un ; U+00AD, U+200B ; « œ », « æ » ; ordre des ex æquo identique en py et js, y compris majuscules et accents ; `minTerms` `NaN` (js).
- n1 : fonds à un thème en Python (score égal à celui du fonds à quatre thèmes, à 0,05 près, déjà écrit) ; 300 articles de 500 mots en 600 époques sous une borne large (JS) ; scores inchangés à 1e-9 près par rapport à l'ancien calcul dense ; tri des ex æquo par unités de code (js).
- n2 : `passages` (limite exacte à 400, phrase plus longue gardée entière, sauts de ligne) ; score = maximum sur les passages ; un article vide ne sollicite pas l'encodeur ; largeur différente entre article et thèmes → erreur ; `loadEncoder` passe `{ dtype: 'fp32' }` à `pipeline` (double à la forme de Transformers.js) ; 1 000 thèmes et 100 Ko sous la borne (py, NumPy).
- n3 : clôture ``` sans langage ; `[1, 2]`, `[{"topic": …}]`, `["tax", "remote work"]` → trois appels puis `TaggingUnavailable` ; `["politique", "fiscalité"]` rend `["fiscalité"]` sans erreur ; « Fiscalité » en NFD, avec espaces et casse différente ; 12 000 emoji acceptés en JS.
- Essai : en-tête et `why` du cas 4 réécrits (fr/en).
- **Noms des tests démarqués** : plusieurs gardent le libellé du défaut ou de l'affirmation infirmée (« `minTerms` à zéro n’est pas refusé… », « le plafond compte des unités UTF-16 ; 12 000 emojis sont refusés », `test_defaut_…`).

## Pour l'orchestrateur

- **Clôture de code en N3** : sur `detect-spam-in-contact-form` et `summarise-a-long-document`, le testeur a marqué la clôture ```json non décodée comme `DÉFAUT` ; sur cette fiche, un autre testeur a écrit un test qui exige qu'elle lève. J'ai aligné les trois N3 sur le décodage. À trancher dans la charte des tests pour que les 175 fiches suivantes ne se contredisent pas.
- **Identifiant `lemmatise`** gardé dans `n0.py` / `n0.js` : le renommer casserait l'import de chaque fichier de test. Le nom affiché et les docstrings ne disent plus « lemmatisation ». À renommer avec le testeur si le relecteur l'exige.
- n2.py importe désormais NumPy (déjà dans `requirements-snippets.txt`) : sans lui, le découpage en passages rendait le calcul trop lent en Python pur.
