# summarise-a-long-document — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures` (sur cette fiche) et
`check-french` verts. `test-snippets summarise-a-long-document` : 13 tests
rouges, tous listés dans « À retester ». Aucune assertion n'a été touchée.
Restent marqués, et échouent toujours tels qu'écrits : les `INFIRMÉ` de N1
(py/js) et les `DÉFAUT` de N2 sur le rechargement et `transformers` 5 (voir
« À retester »).

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario fr/en (#62) | « et personne ne le relit contre la source » ; « C’est l’une des rares fiches de ce catalogue où… » ; « un résumé dont aucun test ne peut établir qu’il est vrai » | Constat d’usage et comparaison au catalogue non sourcés ; la portée « aucun test » dépasse ce que les tests de la fiche montrent | « et le résumé revient en trois phrases nettes. Ici, les niveaux qui font le travail demandé sont aussi les plus chers » (vrai d’après `cost` des quatre niveaux) ; « un résumé dont aucun test de l’extrait ne peut établir qu’il est vrai » |
| N0 escalate_when | « parce que dans vos documents c’est la phrase de conclusion qui compte » | N1 ne peut pas apprendre qu’une dernière phrase compte (#24) : escalader vers N1 ne réglerait pas ce cas | « Vous vous surprenez à retoucher à la main le bonus d’ouverture d’un type de document à l’autre, et vous avez sous la main des documents dont on peut cocher les bonnes phrases. » |
| N0/N1 commentaire `SENTENCE_END` | « A sentence ends at a full stop, question or exclamation mark followed by whitespace » | Le découpage ajoute les sauts de ligne (Code réparé) | « …or at a line break, so a transcript or a list without final punctuation is still cut into lines. Abbreviations will fool this, and so will prose hard-wrapped at a fixed width, which has to be unwrapped first » (limite écrite) |
| N1 docstring py/js + `doc.fr.yaml` (#24, #28) | « a few dozen documents […] decide it instead: if, in your corpus, the wrap-up at the end matters more than the opening, the model will find that out and N0 never will » | INFIRMÉ (test) : position codée 1/(rang+1) ; le modèle apprend le mot-signal ; N0 garde déjà la conclusion de l’audit ; « quelques dizaines » non sourcé | « documents whose summary sentences someone has ticked off set the weights of five features instead, and the model learns nothing those five cannot express. Position is coded as 1 / (rank + 1): the model can learn that early sentences count for more or for less, never that the last one counts. A closing sentence gains only through what it carries, a figure or a cue word such as `overall`. » |
| N1 docstring js + `doc.fr.yaml` (#27) | « because on five features it is a dozen lines » | `train` : 28 lignes (test) | « so the snippet needs nothing but Node » |
| N1 docstring de `train` py (#28) | « Ticking sentences in a few dozen documents is an afternoon of work […] Nothing here needs a GPU or a corpus » | Volume et effort non sourcés | « The ticked sentences are the entire training set. Nothing here needs a GPU. » |
| N2 docstring py/js + `doc.fr.yaml` (#39) | « this one produces a sentence that was not in the document, which is the only way to state a conclusion drawn from two passages ten pages apart » ; « the pieces summarised again » | Ce que le modèle écrit n’est pas testable ; la seconde passe est désormais itérée | « this one produces sentences that were not in the document » ; « and the notes summarised again, in as many passes as it takes to fit one window » |
| N2 breaking_point fr/en (#35) | « la seconde passe résume les notes que le modèle a écrites » | Passes itérées (Code réparé) ; le test d’origine reste vrai pour un document de trois morceaux | « les passes suivantes résument les notes que le modèle a écrites, et plus jamais le document » |
| N2 commentaire `CHUNK_CHARACTERS` (#36) | 3 000 caractères, « Beyond its window the model truncates without saying so » | Mesuré avec le tokenizer de `sshleifer/distilbart-cnn-12-6` (`transformers` 5.17.0) : 3 000 caractères de français = 1 091 jetons, d’allemand 1 067, d’anglais 586 ; 2 000 de français = 727 ; `model_max_length` 1 024 | 2 000 caractères ; « characters are not tokens: with this model's tokenizer, 3,000 characters of French prose come to 1,091 tokens, 2,000 to 727. A piece that still overflows, code or a table, is refused by the model below, not truncated. » |
| N2 `MODEL_NAME` + further_reading (#43) | Python `facebook/bart-large-cnn`, JavaScript `Xenova/distilbart-cnn-12-6` ; libellé « facebook/bart-large-cnn — la fiche du modèle utilisé au niveau N2 » | Deux modèles différents selon le langage. Carte Xenova : « converted from sshleifer/distilbart-cnn-12-6 » ; carte sshleifer : distillé de bart-large-cnn, Apache 2.0 | Python `sshleifer/distilbart-cnn-12-6`, JS sa conversion ONNX ; lien et libellé « sshleifer/distilbart-cnn-12-6 — la fiche du modèle chargé au niveau N2, distillé de bart-large-cnn » |
| N3 docstring py/js + `doc.fr.yaml` (#54) | « an answer that follows an instruction […] without anyone fine-tuning anything » ; « The model will write a fluent, plausible sentence the document never supported » | Comportement du modèle non testable, non sourcé pour les modèles actuels | « an output shape set in the prompt […] instead of trained into the weights. Whether the answer respects that shape is checked below, not assumed. » ; « Nothing below can tell a fluent sentence the document never supported from a good one. » |
| N3 commentaire température (#54) | « two identical documents that summarise differently cannot be reviewed, and cannot be cached either » | Kit `openai` 3.14.0 : `temperature` « lower values like 0.2 will make it more focused and deterministic » | « the low end of the range, which the provider documents as more focused and deterministic. It does not promise that two identical calls agree. » |
| N3 latency | `~1 s` | Artificial Analysis, gpt-4.1-mini : 76 à 112 jetons par seconde en sortie selon la mesure ; un résumé et ses points clés font plus de cent jetons, lus après un document pouvant atteindre 40 000 caractères | `>1 s` (la décision porte sur un document entier, entrée naturelle de la fiche) |
| N3 regulatory fr/en | « Un document interne porte souvent des données personnelles de tiers collectées pour un autre usage » | « souvent » non sourcé | « Les données personnelles de tiers et les secrets d’affaires que le document contient partent avec lui » |
| verdict_rationale (#64) | « un réaffinage chaque fois que vous changez de format de sortie » ; « deux exécutions ne se ressemblent que tant que le fournisseur garde le même modèle » | Réaffinage non sourcé ; « tant que » laisse croire qu’un même modèle rend le même résumé : le kit dit de `seed` « Determinism is not guaranteed » | « sans vous coûter un service d’inférence à exploiter ni une découpe en plusieurs passes, et dont la forme de sortie se demande dans l’invite au lieu d’être celle qu’a apprise le modèle » ; « deux appels sur le même document ne sont pas garantis de rendre le même résumé » |
| Essai, cas 4 (#60) | « 3 appels facturés : les deux premiers ont échoué » | La facturation d’un appel en échec dépend du fournisseur | « 3 appels envoyés : les deux premiers ont échoué, le troisième a répondu. » (fr/en) |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N3 docstring py/js + `doc.fr.yaml` | « This is the option people reach for first » | Non sourcé |
| N2 docstring | « which is the only way to state a conclusion drawn from two passages ten pages apart » | Ce qu’un modèle écrit n’est pas testable ici (#39) |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0, n1 py/js (#16) | document NFD : mots accentués coupés | `words()` compose en NFC avant d’extraire les mots ; les phrases rendues restent celles de la source, octet pour octet |
| n0, n1, n2 py/js (#17, #31) | document sans ponctuation finale : une seule phrase, rendue entière | Un saut de ligne termine aussi une phrase ; limite écrite : la prose coupée à largeur fixe doit être recollée avant |
| n0, n1 py/js (#18, #31) | nombre de phrases négatif accepté | `ValueError` / `RangeError` ; zéro rend toujours `""` |
| n2 py/js (#36) | seconde passe non découpée, tronquée en silence | `pack` regroupe les notes à la taille de la fenêtre ; passes répétées jusqu’à une seule note ; `SummaryUnavailable` si une passe ne réduit pas le nombre de morceaux (modèle qui recopie : vérifié, quatre appels puis levée) |
| n2 py/js (#36) | morceau trop long pour la fenêtre tronqué en silence (3 000 caractères de français dépassent 1 024 jetons) | `CHUNK_CHARACTERS` à 2 000 ; l’adaptateur local compte les jetons et lève au-delà de `model_max_length` au lieu de tronquer |
| n2.py (#43) | `pipeline("summarization")` absent de `transformers` 5 | `AutoTokenizer` + `AutoModelForSeq2SeqLM.generate(**inputs, **config.task_specific_params["summarization"])`, décodage `skip_special_tokens=True`. Vérifié dans `transformers` 5.17.0 : `summarization` absent de `SUPPORTED_TASKS`, classes Auto présentes ; `GenerationConfig.from_model_config` ne reprend plus `max_length`, `num_beams`… du `config.json` (tous à `None`), d’où le passage explicite des réglages publiés avec le point de contrôle (`max_length` 142, `min_length` 56, `num_beams` 4, `length_penalty` 2, `no_repeat_ngram_size` 3), comme le faisait le pipeline (`pipelines/base.py`) |
| n2.js (#43) | `@xenova/transformers`, ancien nom ; option `truncation` passée à `generate` | `@huggingface/transformers` (4.2.0 lu : `SummarizationPipeline`, sortie `[{ summary_text }]`, `tokenizer.encode(text)` rend un tableau d’identifiants, `model_max_length` lu dans `tokenizer_config.json`, 1 024 pour ce modèle) |
| n2 py/js (#42) | modèle par défaut rechargé à chaque document | Python : `functools.cache` sur `default_model()` ; JS : promesse gardée au niveau du module, oubliée si le chargement échoue. Le modèle n’est plus chargé pour un document vide ou refusé |
| n3 py/js (#53) | client par défaut sans `complete` | Adaptateur commun, construit après les refus d’entrée |
| n3 py/js | `message.content` nul passé à `json.loads`/`JSON.parse` | refus explicite (« the model returned no text »), redemandé |
| n3 py/js (#51) | clôture ```json non décodée | clôture retirée avant décodage |
| n3 py/js (#52) | points clés non chaînes convertis | refusés : « key points that are not a list of strings » |
| n3 py/js (#56) | nombre de phrases nul ou négatif : un appel payé | `ValueError` / `RangeError` avant tout appel (JS : `!(maxSentences >= 1)`, qui refuse aussi `NaN`) |
| n3.js (#50) | plafond en unités UTF-16, divergent du Python | compté en points de code |
| n3.py | `RecursionError` d’un JSON très imbriqué hors du réessai | converti en `ValueError`, donc redemandé puis `SummaryUnavailable` |

Marquages retirés (assertions inchangées) : n0 — 3 `DÉFAUT` py, 3 js ; n1 — 2
`DÉFAUT` py, 2 js ; n2 — 1 `DÉFAUT` py, 1 js ; n3 — 4 `DÉFAUT` py, 4 js.

Lignes utiles (avant → après) : n0.py 38 → 43, n0.js 44 → 48, n1.py 46 → 51,
n1.js 73 → 77, n2.py 51 → 64, n2.js 60 → 78, n3.py 43 → 64 (50 hors
adaptateur), n3.js 47 → 69 (52 hors adaptateur).

Dépassements, justifiés : tous les extraits dépassaient déjà les quarante
lignes avant ce tour. La hausse vient des réparations exigées : `words()` et
la garde du nombre de phrases (N0, N1) ; `pack`, la boucle de passes, le
cache du modèle et le comptage des jetons (N2) — ce sont précisément les
défauts « tronqué en silence » et « rechargé à chaque document » ; le refus du
contenu nul, la clôture, les points clés typés et la garde du nombre de
phrases (N3). n1.js écrit la régression logistique à la main. Réduire
reviendrait à retirer une des réparations.

## Sources consultées

- Kit `transformers` 5.17.0, installé dans le bac à sable sans PyTorch : `SUPPORTED_TASKS` sans `summarization` ; `AutoModelForSeq2SeqLM`, `AutoTokenizer` importables ; `GenerationConfig.from_model_config` sur la configuration du modèle ; `pipelines/base.py` applique `task_specific_params[task]`. Tokenizer téléchargé (`RobertaTokenizer`, `model_max_length` 1024) et comptes de jetons mesurés.
- Hugging Face, `sshleifer/distilbart-cnn-12-6` : carte (distillé de bart-large-cnn, 306 M paramètres, Apache 2.0) et `config.json` (`max_position_embeddings` 1024, `task_specific_params.summarization`).
- Hugging Face, `Xenova/distilbart-cnn-12-6` : « converted from sshleifer/distilbart-cnn-12-6 », exemple avec `@huggingface/transformers` ; `tokenizer_config.json` : `model_max_length` 1024.
- Paquet npm `@huggingface/transformers` 4.2.0 (source lue) : `src/pipelines/summarization.js`, `text2text-generation.js` (troncature et `task_specific_params` appliqués par le pipeline), `tokenization_utils.js` (`encode`, `model_max_length`).
- Kit `openai` 3.14.0 : `temperature` (« more focused and deterministic »), `seed` (« Determinism is not guaranteed »), `ChatCompletionMessage.content: Optional[str]`.
- Maynez et al., ACL 2020 : page existante, les modèles étudiés « are highly prone to hallucinate content that is unfaithful to the input document » ; libellé conforme.
- Fabbri et al., *SummEval* (arXiv 2007.12626) : page existante, titre et auteurs conformes.
- scikit-learn, `LogisticRegression` : page existante (consultée pour la fiche précédente), libellé conforme.
- Artificial Analysis, gpt-4.1-mini (via recherche) : 76 à 112 jetons par seconde en sortie. Tarifs OpenAI : 0,40 $ / 1,60 $ le million de jetons ; un document de 40 000 caractères, environ 10 000 jetons, coûte de l’ordre de 4 000 $ par million d’appels : `cost: élevé` tient.
- Mesure locale de N0, une décision sur un document de 47 000 caractères : 5 ms en Python, 2,5 ms en JavaScript ; `~10 ms` tient.

## À retester

- **Adaptateur N3** : tester `ProviderClient` / `providerClient` avec `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` (`chat.completions.create`, `choices[0].message.content`) : requête (`model`, message utilisateur = l’invite, `temperature: 0`), contenu `None`/`null` → `SummaryUnavailable` après trois appels (vérifié à la main).
- **n3 `le client par défaut échoue en service indisponible sans appel` (py/js), rouge** : décrit l’ancien défaut.
- **n3.js `production : constat, le plafond compte en unités UTF-16`, rouge** : compté en points de code désormais.
- **n3.js `essai : le fournisseur échoue deux fois, trois appels`, rouge** : la note dit « envoyés », plus « facturés ».
- **n0.py `test_l_extrait_n_importe_que_re` et n1.py `test_l_entrainement_tient_sur_quatre_documents_sans_rien_d_autre`, rouges** : `unicodedata` s’ajoute aux imports ; la docstring citée dans le second ne dit plus « or a corpus ».
- **n2 `la découpe se fait aux frontières de phrase…` et `production : limite de la découpe au caractère près` (py/js), rouges** : `CHUNK_CHARACTERS` vaut 2 000 ; reprendre la limite exacte à 2 000.
- **n2.py `test_le_modele_nomme_est_bart_large_cnn`, rouge** : `sshleifer/distilbart-cnn-12-6` des deux côtés (conversion ONNX en JS).
- **n2 `le modèle par défaut a la surface de transformers` (py/js), rouges, et `DÉFAUT : … rechargé à chaque document` (py/js) et `DÉFAUT : transformers 5 n'a plus de pipeline summarization` (py), encore marqués** : leurs doubles imitent `pipeline(...)` et `@xenova/transformers`. À refaire avec un double à la forme de `transformers` 5 (`AutoTokenizer.from_pretrained` rendant un appelable qui rend `{"input_ids": tenseur à .shape[1]}` avec `model_max_length` et `decode`, `AutoModelForSeq2SeqLM.from_pretrained` avec `config.task_specific_params["summarization"]` et `generate(**inputs, **réglages)`) et de `@huggingface/transformers` (`pipeline('summarization', nom)` rendant un appelable à propriété `tokenizer` avec `encode` et `model_max_length`) ; vérifier un seul chargement pour deux documents, aucun chargement pour un document vide ou trop long, un morceau de plus de 1 024 jetons refusé sans appel à `generate`, les réglages publiés passés à `generate`, un chargement échoué retenté au document suivant (JS).
- **n1 `INFIRMÉ : le modèle découvre que la conclusion compte, et N0 jamais` (py/js) et n1.js `INFIRMÉ : … « is a dozen lines »`** : affirmations retirées ; retourner en démonstrations de la nouvelle docstring (position 1/(rang+1), conclusion sans mot-signal hors du résumé) ou retirer.
- n0/n1 : sauts de ligne `\r\n` et lignes vides ; un document NFD rend ses phrases telles quelles (NFD) ; nombre de phrases `0` → `""`.
- n2 : passes répétées sur un document de 200 000 caractères (tous les appels ≤ 2 000, trois passes ou plus) ; modèle qui recopie son entrée → `SummaryUnavailable` ; note unique plus longue que la fenêtre passée entière ; transcription sans ponctuation découpée par lignes.
- n3 : clôture ``` sans langage ; points clés `[1]`, `[null]`, `[{}]` refusés ; `maxSentences` `NaN` (js) refusé ; `"[[[[…"` très imbriqué → `SummaryUnavailable` (py).
- **Noms des tests démarqués** : suites de noms décrivant encore le défaut (« un document NFD coupe ses mots accentués », `test_defaut_…`).

## Pour l'orchestrateur

- Le paquet `transformers` 5 ne reprend plus les réglages de génération rangés dans `config.json` des anciens points de contrôle : tout extrait N2 qui passe de `pipeline(...)` à `model.generate(...)` (par exemple `translate-interface-strings`) génère alors avec les réglages par défaut. Ici, les réglages sont passés depuis `task_specific_params`. À signaler aux autres rédacteurs.
- Mesure « caractères contre jetons » : 3 000 caractères de français font 1 091 jetons pour un tokenizer BART ; toute fiche qui borne une fenêtre en caractères mérite la même vérification.
- J’ai installé `transformers` 5.17.0 dans `scratchpad/sdk/v` (bac à sable de vérification) pour lire la bibliothèque ; aucun fichier du dépôt n’en dépend.
