# translate-interface-strings — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets translate-interface-strings` **rouge** sur les seuls tests listés
dans « À retester » (15 en Python, 16 en JavaScript) : ils épinglent l'ancien
marqueur « ⟦N⟧ », l'ancien paquet `@xenova/transformers`, la correspondance
exacte sur une différence de casse, ou un contexte non plafonné. Aucune
assertion n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 `normalise` et docstring py/js + `doc.fr.yaml` (#10) | « Fold case, accents and spacing, which are not what makes a string new » ; une majuscule corrigée reste une correspondance exacte | `lookup("polish", {"Polish": "Polonais"})` rendait `exact` sans relecture | Exacte : « the same string, give or take its spacing, invisible format characters and Unicode composition » ; casse et accents donnent une approchée, relue, « because "Polish" and "polish" are not the same word » ; `normalise` : « Fold case, accents and spacing for the score. A match on this alone is reviewed. » |
| N0 docstring py/js + `doc.fr.yaml` (#6) | « a word is added, a capital is fixed » comme changements qui gardent la traduction | Conséquence de la réparation #10 | « a word added, a capital or an accent changed » : correspondance approchée, brouillon relu |
| N0, N2, N3 commentaire `PLACEHOLDER` (#13, #24) | « {count}, {}, %s, %d, %(count)s, and the numbered variant of %s that Android and iOS string files carry » | iOS porte `%@`, `%1$@`, `%ld`, non reconnus ; ICU et `{{count}}` non plus | « {{count}} (i18next), {count}, {}, the head of an ICU argument such as {count, plural, ...}, %s, %d, %(count)s, the numbered %1$s of Android, and the %@, %1$@ and %ld of iOS » — et le motif les reconnaît |
| N0 `latency` (#17) | `~10 ms` | Python : 60 ms par recherche dans la mémoire de 1 000 libellés du test (mesuré sur cette machine, 11 ms pour 100) ; JavaScript ~21 ms. Latence d'une décision = une recherche | `~100 ms` (le langage le plus lent fixe la classe ; un filtre par borne de longueur, essayé, ne descendait qu'à 50 ms et a été retiré) |
| N2 docstring py/js + `doc.fr.yaml` (#34, #35) | « A translation model sees `{count} items selected` as text, so it happily translates the word inside the braces, drops it, or repeats it » | Vrai modèle `Helsinki-NLP/opus-mt-en-fr` lancé (transformers 5.17.0, torch 2.14 CPU ; Transformers.js 4.2.0 avec `Xenova/opus-mt-en-fr`) : « {count} items selected » → « {compte} éléments sélectionnés » dans les deux ; « drops it, or repeats it » non observé | « run against opus-mt-en-fr, `{count} items selected` comes back as `{compte} éléments sélectionnés` » |
| N2 docstring (#36) + commentaire `MARK` | « hidden behind neutral markers » ; « Deliberately not a word » | « ⟦0⟧ items selected » → « Éléments sélectionnés » (py), « ,0, éléments sélectionnés » (js) : ⟦ ⟧ hors vocabulaire, marqueur perdu | Marqueur `[N]` ; commentaire : « Its pieces are in the model's vocabulary, so the model can write it back; a marker made of characters the vocabulary lacks is dropped. Check again if you change model. » |
| N2 breaking_point | « le modèle reçoit « ⟦0⟧ items selected » » ; « rien ne garantit que le marqueur revienne » ; « Le modèle lit la variable comme du texte » | Le modèle ne voit pas la variable ; le marqueur `[N]` revient sur 20 libellés sur 20 essayés en Python et 8 sur 8 en JS (hors suite) ; pluriel ICU lancé sur le vrai modèle : « one »/« other » → « un »/« autres » | Marqueur « [0] » ; les deux réponses fautives sont dites écrites par le double ; nouveau cas qui casse pour de bon : le message ICU, observé sur le vrai modèle, renvoyé en relecture |
| N1 unavailable_reason (#25) | « exige un corpus aligné […] hors de portée d’une petite équipe, pour un résultat en deçà de ce qu’un modèle neuronal déjà entraîné donne » | Moses, *Baseline* : « we need parallel data […] aligned at the sentence level » ; carte du modèle : jeu d'entraînement `opus`. La comparaison de qualité n'est pas sourcée | « s’entraîne sur un corpus de votre paire de langues aligné phrase à phrase, qu’il faut réunir avant la première traduction. Le modèle du niveau suivant arrive déjà entraîné, sur les corpus alignés du projet OPUS. » |
| N2 regulatory | « la licence de son auteur et celle de ses données d’entraînement, qui vous suivent en production » | Carte du modèle : `apache-2.0` ; rien sur les licences des données | « Licence du modèle à respecter : Apache 2.0 pour opus-mt-en-fr » |
| verdict_rationale (#70) | « tient dans un fichier que vous versionnez, ce qu’un point de terminaison qui évolue au calendrier de son fournisseur n’offre pas » | Le modèle est plusieurs fichiers (poids, tokeniseur, configuration) ; le reste est un jugement | « garde les chaînes chez vous, et ne change que lorsque vous changez ses poids » |
| N3 commentaire py/js (#56) | « Temperature zero: two identical strings must not come back translated two different ways » | Kit `openai` 7.15.0, `completions.d.ts` : « lower values […] more focused and deterministic » ; rien ne garantit la reproductibilité | « The lowest temperature: the SDK documents lower values as more focused and deterministic. » |
| N3 commentaire py/js (#55) | « Refusing it here is a cost control » (le contexte, 100 Ko, partait) | Test : le contexte n'était pas plafonné | Le contexte est plafonné comme la chaîne : « Refusing it here, and a context as long, is a cost control. » |
| Essai, cas 2, 3, 6 et commentaire (#47) | Réponses « ⟦0⟧ … » ; why : « Le modèle lit la variable comme du texte » ; « L’autre moitié du même défaut est la variable traduite, « {compte} » » | N2 ne montre jamais la variable au modèle | Réponses « [0] … » ; why : « Le marqueur « [0] » n’est pas revenu […] Cette réponse est écrite par le double local, pas obtenue du vrai modèle. » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#9) | « a variable moves. When that happens, last year's translation is still nearly right » | Test : une variable déplacée passe sous le seuil, rien ne remonte |
| N0 docstring py/js + `doc.fr.yaml` | « An interface string rarely changes deeply » ; « Handing back an approximation as a certainty is the one behaviour that would make this whole approach dishonest » | Constat non sourcé ; jugement remplacé par l'exemple « Polish » / « polish » que le code traite |
| N0 breaking_point (#2) | « Toute fonctionnalité nouvelle est une chaîne que personne n’a encore traduite » | Constat d'usage, non testable |
| N2 docstring py/js + `doc.fr.yaml` (#34) | « an output nobody can explain » ; « keep in sync and hold in a warm process » | Non sourcé ; remplacé par « one model per language pair: this one reads English and writes French » (carte du modèle) |
| N3 docstring py/js + `doc.fr.yaml` (#53) | « That is exactly the information a translation team asks for and rarely gets » | Non sourcé |
| Essai, cas 6, why (#48) | « Personne qui lit l’anglais ne le verrait » | Appréciation |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0 py/js (#10) | casse et accents repliés avant la décision « exacte » | `exact_key` / `exactKey` (NFC, caractères de format Cf retirés, espacement) décide de l'exacte ; `normalise` ne sert plus qu'au score |
| n0 py/js (#20) | U+FEFF : exacte en JS, approchée en Python | Les caractères Cf sont retirés dans les deux ; JS découpe aussi sur `\x1c-\x1f` et `\x85` comme `str.split()` ; Python retire les marques de catégorie M comme `\p{M}` en JS |
| n0 py/js (#23) | texte d'aide long : 2,4 s par recherche | `MAX_FUZZY_CHARACTERS = 500` : au-delà, exacte seulement (limite écrite dans la docstring ; la documentation de difflib donne un coût quadratique au pire) |
| n0, n2, n3 py/js (#13, #24) | `%@`, `%1$@`, `%ld`, ICU, `{{count}}` non reconnus | Motif étendu ; `{{count}}` est une variable à part entière ; la tête `{count, plural` d'un argument ICU aussi |
| n2, n3 py/js (#24) | message ICU traduit sans signalement | Toute source qui porte un argument ICU part en relecture (« ICU message: check its branches by hand ») ; le vrai modèle traduit les mots-clés des branches, le marqueur ne peut pas les protéger |
| n2 py/js (#30) | « ⟦N⟧ » hors vocabulaire : chaque variable perdue avec le vrai modèle | Marqueur `[N]`, vérifié sur le vrai modèle dans les deux langages |
| n2.py (#71) | `pipeline("translation")` absent de transformers 5 (`KeyError: Unknown task translation` constaté en 5.17.0) | `AutoTokenizer` + `AutoModelForSeq2SeqLM.generate` + `tokenizer.decode(..., skip_special_tokens=True)`, exécuté contre les vrais poids |
| n2.js (#40, consigne) | `@xenova/transformers`, ancien nom | `@huggingface/transformers` ; `pipeline('translation', …)` puis `[0].translation_text` exécuté (4.2.0) |
| n2 py/js (#45) | réponse d'un autre type : `AttributeError` / `TypeError` | Réponse non chaîne → réessai puis `TranslationUnavailable` |
| n2 py/js (#40) | source vide : les poids chargés avant de la rendre | Test de la source vide avant le chargement (le vrai modèle JS rend « , » pour une chaîne vide) |
| n3 py/js (#60) | client par défaut sans `complete` | Adaptateur commun `ProviderClient` / `providerClient` ; `content` non chaîne (refus) → réessai puis erreur nommée, jamais passé à `json.loads`/`JSON.parse` |
| n3 py/js (#61) | chaîne vide : trois appels puis erreur | Rendue telle quelle, sans appel ni client construit |
| n3.js (#64) | plafond en unités UTF-16 | Plafond en points de code, comme Python |
| n3 py/js (#55) | contexte non plafonné | Plafond de `MAX_CHARACTERS` sur le contexte aussi |

Marquages retirés (assertions inchangées) : n0 — 2 `INFIRMÉ` et 2 `DÉFAUT`
en Python, 2 `INFIRMÉ` et 2 `DÉFAUT` en JavaScript ; n2 — 2 `DÉFAUT` py, 2 js ;
n3 — 2 `DÉFAUT` py, 3 js. `git diff --stat` : seules les lignes de marquage (et
l'indentation des enveloppes JS) ont bougé.

Lignes utiles (hors docstrings et commentaires) : n0.py 41, n0.js 63, n2.py 53,
n2.js 53, n3.py 70 et n3.js 85, dont l'adaptateur (15 et 16). Dépassements
justifiés : n0.js porte l'algorithme de difflib (22 lignes) pour rendre le même
score qu'en Python ; n2 et n3 portent le motif des variables, le masquage, le
contrôle de sortie et les réessais, qui sont ce que la fiche démontre ; l'invite
de N3 occupe à elle seule 8 lignes. Les réduire retirerait ce que les tests
vérifient.

## Sources consultées

- Exécution réelle (scratchpad, hors dépôt) : `transformers` 5.17.0, `torch` 2.14.0+cpu, `sentencepiece` 0.2.2 ; `pipeline("translation")` → `KeyError: Unknown task translation` ; `MarianTokenizer`/`MarianMTModel` via les classes Auto : « ⟦0⟧ items selected » → « Éléments sélectionnés » ; « {count} items selected » → « {compte} éléments sélectionnés » ; `[N]`, `_N_`, `<N>`, `#N`, `XN` gardés sur 20 libellés sur 20 ; l'extrait n2.py corrigé : « {count, plural, one {# item} other {# items}} » → « {count, plural, un {# élément} autres {# éléments}} », relecture ; 52 à 253 ms par chaîne sur CPU (classe `~100 ms` de N2 cohérente).
- Exécution réelle : `@huggingface/transformers` 4.2.0, `pipeline('translation', 'Xenova/opus-mt-en-fr')` → `[{ translation_text }]` ; mêmes constats ; n2.js corrigé, mêmes sorties qu'en Python.
- Hugging Face, carte `Helsinki-NLP/opus-mt-en-fr` : licence apache-2.0, en → fr, jeu `opus`.
- Moses, *Baseline System* : « we need parallel data […] aligned at the sentence level » (lien ajouté en lecture complémentaire).
- ICU, *Formatting Messages* : arguments entre accolades, `plural` et `select` à sous-messages — conforme au libellé.
- OASIS XLIFF 2.1 : attribut `state` des segments, module *Translation Candidates* — conforme au libellé.
- Python, `difflib` : `ratio` = 2.0*M/T ; `autojunk` ; « quadratic time for the worst case ».
- Kit `openai` 7.15.0, `resources/chat/completions/completions.d.ts` : description de `temperature`.

## À retester

- **Adaptateur N3** : tester `ProviderClient(sdk=FakeSDK(...))` / `providerClient(new FakeSDK(...))` avec les doubles `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` (requête `{model: 'gpt-4.1-mini', messages: [{role: 'user', content}], temperature: 0}`, réponse lue dans `choices[0].message.content`, `content: None/null` → `TranslationUnavailable` après les essais). Le test `DÉFAUT : le client par défaut a la forme du vrai kit` (py, toujours marqué) passe le double en `client` directement : à réécrire sur l'adaptateur. Le test JS équivalent reste marqué, pour la même raison (`client.complete` absent du double passé en `client`) : à réécrire de même.
- **N2, marqueur `[N]`** (py/js) : tous les tests qui épinglent « ⟦0⟧ » — les trois points de rupture, variable déplacée, répétée, « cachées, remises et comptées », onze variables (`[1]` et `[10]`), plomberie déterministe, verdict N2/N3, `MARK.format(3) == "⟦3⟧"`, les deux tests JS de l'essai (note « Le modèle a reçu « [0] items selected » »). Le test démarqué « sur le vocabulaire du vrai modèle » garde son `ABSENT_FROM_VOCABULARY = "⟦⟧"` : le remplacer par un test que `[`, `]` et les chiffres sont des pièces du vocabulaire (vérifiable sur `vocab.json`).
- **N2 ICU** (py/js, toujours marqués `DÉFAUT`) : la première moitié passe ; la seconde (`{⟦0⟧} items`) échoue désormais par `TranslationUnavailable`, le double n'ayant pas la clé. Tester `{{count}}` masqué entier en `[0] items`, et l'avertissement ICU exact.
- **N2 défaut** : `translate("")` sans modèle ne charge plus rien (test « par défaut c’est le vrai », seconde moitié) ; en JS, l'import attendu est `@huggingface/transformers`. `load_translator` Python : classes Auto, plus de pipeline.
- **N0 casse** : « save   changes » et « SAVE CHANGES » donnent désormais une approchée à 1,0, relue (py/js) ; U+FEFF en tête donne une exacte dans les deux langages (test Python « divise les deux langages » à inverser) ; `exact_key` / `exactKey` sur NFC, U+200B, U+FEFF, U+00A0, `\x1c` ; `MAX_FUZZY_CHARACTERS` à 500 et 501 points de code, exacte au-delà toujours trouvée.
- **N0 latence** : `INFIRMÉ ~10 ms` (py, toujours marqué) : la fiche dit `~100 ms` ; convertir en démonstration (sous 316 ms, milieu logarithmique entre `~100 ms` et `~1 s`) ; le test JS de dix millisecondes teste une affirmation retirée.
- **N0 `INFIRMÉ` variable déplacée** (py/js, toujours marqués) : phrase retirée, test à supprimer.
- **N3** : contexte au-delà de `MAX_CHARACTERS` refusé sans appel (le test « le contexte n’est pas plafonné » est rouge) ; chaîne blanche «   » rendue sans appel ; 2 001 emojis refusés en JS ; avertissement ICU dans N3 ; les noms des tests démarqués décrivent encore le défaut (« une chaîne vide coûte trois appels puis lève », « le plafond compte des unités UTF-16… », « n’est ni listée ni vérifiée », « ne lève pas l’erreur nommée », « le marqueur ne revient jamais », « rend chaque recherche lente », « ne sont pas vérifiées/reconnues »).
- **Essai** : `INFIRMÉ` sur le why (js, toujours marqué) : phrase retirée, test à supprimer ; vérifier le nouveau why dans les deux langues.
- **Hors suite** : le comportement du vrai modèle cité dans la fiche (ICU, `{compte}`) a été établi à la main ; un test qui télécharge les poids n'a pas sa place dans la CI.

## Pour l'orchestrateur

- `requirements-snippets.txt` n'épingle ni `transformers` ni `torch`/`sentencepiece` ; n2.py suppose transformers ≥ 4 avec les classes Auto (vérifié en 5.17.0), et `MarianTokenizer` exige `sentencepiece`.
- Charte (proposition du testeur, confirmée ici par exécution) : tout marqueur ou séparateur glissé dans l'entrée d'un modèle N2 doit être vérifié contre le vocabulaire du modèle, ou mieux contre le modèle lui-même ; « ⟦N⟧ » était invisible pour lui.
- `check-french` lit `#` comme un commentaire YAML dans le frontmatter : un exemple ICU (`{# item}`) dans une valeur anglaise fait relire la fin de la ligne en français. Contourné en reformulant.
- La latence de N0 dépend de la taille de la mémoire (linéaire) ; la classe retenue vaut pour mille libellés.
