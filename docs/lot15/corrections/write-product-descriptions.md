# write-product-descriptions — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets write-product-descriptions` **rouge** sur les seuls tests listés
dans « À retester » (5 en Python, 6 en JavaScript). Aucune assertion n'a été
touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| verdict_rationale (#15) | « le vingt-et-unième gabarit s’écrit à la main par quelqu’un qui en a déjà écrit vingt » | `BLOCKS` compte seize formulations (7, 3, 3, 3) | « la dix-septième formulation s’écrit à la main par quelqu’un qui en a déjà écrit seize » |
| verdict_rationale (#58) | « N2 écrit bien pour les gammes qu’il a vues […] il tombe sur le même défaut que N3 : il affirme ce que le dossier ne dit pas » | Qualité non sourcée. Dušek et al., *Evaluating the state-of-the-art of End-to-End NLG* : « vanilla seq2seq models often fail to correctly express a given meaning representation if they lack a strong semantic control mechanism applied during decoding » | « N2 réclame d’avoir déjà publié le catalogue […], et le challenge E2E a trouvé que les modèles de séquence à séquence sans contrôle sémantique rendent souvent mal les attributs qu’on leur donne : il réclame le même contrôle que N3 » |
| verdict_rationale (#43) | « une copie qui change à chaque appel » | Non testable ; kit `openai` 7.15.0 : « Higher values like 0.8 will make the output more random » | « une copie tirée à température non nulle » |
| N2 docstring py/js + `doc.fr.yaml` (#22) | « so that it writes in your voice rather than in the average voice of the web » ; « The prose is freer than a template's » ; « Handed a bag, it will sooner or later call it waterproof, because the sentences it learnt from ended that way, and nothing inside it distinguishes… » | Non sourcé ; la même étude trouve au contraire que des systèmes écrits à la main peuvent produire des sorties plus variées que les modèles seq2seq | « Around the model, everything on this rung is code you now own » ; « The E2E generation challenge found that sequence-to-sequence models without a semantic control often fail to express the attributes they are given correctly. » |
| N2 breaking_point (#22, #24, #25) | « rien, dans le modèle, ne sépare un attribut de ce produit d’un attribut qui va bien dans une phrase de cette forme » | Comportement de modèle non sourcé ; réparation de la négation et de l'accord | Phrase retirée ; « y compris quand le dossier dit « non étanche » ou que la copie écrit « étanches », mais seulement pour les termes que vous avez listés » |
| N3 breaking_point (#43) | « aucune consigne, aucune température ne retire ce risque, puisque rien dans le modèle ne sépare… » ; « deux appels sur le même produit ne rendent pas le même texte, et ce que vous avez relu hier n’est pas ce que le client lit aujourd’hui » | Non testable ; documentation du kit sur `temperature` | Première phrase retirée ; « l’extrait demande une température non nulle, que le kit du fournisseur décrit comme rendant la sortie plus aléatoire, et rien ne fait de la copie relue hier celle qu’un nouvel appel écrit aujourd’hui » |
| N3 docstring py/js + `doc.fr.yaml` (#51) | « precisely what a general-purpose model does better than anything below it, and no amount of template writing closes that gap » ; « two runs on the same product will not agree » | Non sourcé | « the template of rung N0 draws every sentence from a list written in advance, and its test counts the frames that repeat, while this rung asks for new prose on every call » ; « the SDK documents higher temperatures as making the output more random » |
| N3 commentaire py/js (#44) | « a model asked in English for French copy answers in French with an English cadence » | Non testable | « The instructions are written in the language of the shop, like the copy. » |
| N0 `_variant` py/js (#14) | « the same one for the same product » | Un nom en NFD tirait une autre formulation qu'en NFC | Le nom est composé (NFC) avant le tirage ; la docstring le dit |
| Essai, note et cas 6 (#54, #55) | « deux appels sur la même fiche ne rendent pas le même texte » ; « aucune liste de mots ne couvre les façons de dire la même chose » | Non testable | « le kit du fournisseur la décrit comme rendant la sortie plus aléatoire » ; seconde phrase retirée |
| further_reading | « Findings of the E2E NLG Challenge — ce que les systèmes évalués font des attributs » (W18-6539) ; « les pipelines de transformers, dont text2text-generation employé par l’extrait N2 » ; Structured Outputs sur platform.openai.com | Le résumé W18-6539 ne dit rien des attributs ; la version longue (arXiv 1901.07931) le dit ; l'extrait Python n'emploie plus de pipeline ; l'ancienne adresse OpenAI rend 403 | Lien vers arXiv 1901.07931 avec ce qu'elle trouve ; page *Generation* de transformers (5.17.0) ; Structured Outputs sur developers.openai.com (page consultée) |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N2 docstring (#22) | voir Corrigé | Comportement de modèle non sourcé |
| N3 breaking_point (#43) | « aucune consigne, aucune température ne retire ce risque » | Non testable |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0 py/js (#12) | attribut `None`/`null` écrit « None »/« null » | Une valeur nulle (et un élément nul d'une liste) est un attribut absent |
| n2.py (#39) | `pipeline("text2text-generation")` absent de transformers 5 | `AutoTokenizer` + `AutoModelForSeq2SeqLM.generate(..., max_new_tokens=90, num_beams=4)` + `decode(skip_special_tokens=True)` ; les réglages sont passés explicitement, donc indépendants de `task_specific_params`. Chemin exécuté contre `google/flan-t5-small` (transformers 5.17.0), le point de contrôle affiné étant fictif |
| n2.js | point de contrôle PyTorch non lisible par Transformers.js | Commentaire : « Transformers.js runs ONNX weights: convert the checkpoint first, with Optimum » (documentation Transformers.js) ; `pipeline('text2text-generation', …)` avec `{ max_new_tokens, num_beams }` exécuté contre `Xenova/flan-t5-small` (4.2.0), réponse `[{ generated_text }]` |
| n2 py/js (#24), n3 py/js | « non étanche » dans le dossier ancrait « étanche » | `_states`/`states` : un terme juste après « non », « pas », « sans », « ni », « aucun(e) » n'est pas affirmé, dans le dossier comme dans la copie |
| n2 py/js (#25), n3 py/js | « garantie à vie », « étanches » passaient | Chaque mot du terme admet les finales d'accord e, s, es ; limite écrite : accords irréguliers (« doux »/« douce ») non couverts |
| n2.js, n3.js (#34) | terme commençant par « œ » jamais trouvé | Frontières de mot Unicode (`\p{L}\p{N}_`, drapeau `u`), comme `\w` en Python |
| n2 py/js (#29) | « 1.2 kg » coupé en « … pèse 1. » | Une phrase finit sur « . ! ? » suivi de la fin du texte ou d'une espace et d'une majuscule ; limite écrite : « M. Dupont » coupe encore |
| n2.py (#36) | liste brute du pipeline publiée | Réponse non chaîne → réessai puis `DescriptionUnavailable` ; même contrôle en JS |
| n2.js, n3.js (#38, #47) | plafond en unités UTF-16 | Plafond en points de code |
| n3.js (#46) | description en liste publiée, collée par une virgule | La description doit être une chaîne |
| n3 py/js (#49) | client par défaut sans `complete` | Adaptateur commun `ProviderClient` / `providerClient` ; `content` non chaîne → erreur, réessai, jamais passé à `json.loads`/`JSON.parse` |
| n3 py/js (arbitrage de l'orchestrateur) | JSON entièrement entouré d'une clôture de code refusé | Une réponse enveloppée tout entière dans une seule clôture est décodée ; tout autre écart lève |
| n2, n3 py/js (#37, #50) | dossier vide : un appel, et une description d'un produit sans attribut ; « name: None » dans la source | Dossier vide refusé avant tout appel (`ValueError` / `RangeError`) ; valeurs nulles omises de la source |

Marquages retirés (assertions inchangées) : n0 — 1 `DÉFAUT` py, 1 js ; n2 — 4
`DÉFAUT` py, 4 js ; n3 — 2 `DÉFAUT` py, 4 js. Le `DÉFAUT` JS « un point décimal
est pris pour une fin de phrase » reste marqué : la copie est maintenant refusée
(fragment), et le test, sans `try`, échoue sur l'exception. `git diff --stat` :
seules les lignes de marquage et l'indentation des enveloppes ont bougé.

Lignes utiles : n0.py 78, n0.js 87 (les phrases du gabarit sont de la donnée),
n2.py 69, n2.js 83, n3.py 92 et n3.js 97 dont l'adaptateur (15 et 16). Le
contrôle d'ancrage (négation, accord, frontières Unicode) et la coupe de phrase
ajoutent chacun une dizaine de lignes dans les deux langages : ce sont les trous
que le relevé a montrés, et le contrôle est la raison d'être de N2 et N3.

## Sources consultées

- Dušek, Novikova, Rieser, *Evaluating the state-of-the-art of End-to-End Natural Language Generation: The E2E NLG Challenge* (arXiv 1901.07931), résumé : seq2seq « often fail to correctly express a given meaning representation » sans contrôle sémantique ; « can be outperformed by hand-engineered systems in terms of overall quality, as well as complexity, length and diversity of outputs ».
- *Findings of the E2E NLG Challenge* (W18-6539) : résumé consulté, ne dit rien des attributs (lien remplacé).
- arXiv 1706.09254 (*The E2E Dataset*) : lien existant, conforme.
- Kit `openai` 7.15.0, `completions.d.ts`, `temperature` : « Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic ».
- OpenAI, *Structured Outputs* (developers.openai.com) : page existante sur les réponses JSON.
- Hugging Face, *Generation* (transformers 5.17.0) : `GenerationMixin.generate`, `max_new_tokens`, `num_beams`.
- Transformers.js, documentation : conversion des modèles PyTorch en ONNX avec Optimum.
- Exécutions réelles (scratchpad) : `transformers` 5.17.0 + `google/flan-t5-small` par les classes Auto → « Aurore 500 is a backpack made of recycled canvas. » ; `@huggingface/transformers` 4.2.0, `text2text-generation` + `Xenova/flan-t5-small` avec `{ max_new_tokens: 90, num_beams: 4 }` → `[{ generated_text }]`.

## À retester

- **Adaptateur N3** : `ProviderClient(sdk=FakeSDK(...))` / `providerClient(new FakeSDK(...))` avec `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` (requête `{model: 'gpt-4.1-mini', messages: [{role: 'user', content}], temperature: 0.7}` par défaut, réponse lue dans `choices[0].message.content`, `content` `None`/`null` → `DescriptionUnavailable` après les essais). Les tests `DÉFAUT : le client par défaut a la forme du vrai kit` (py/js, toujours marqués) passent le double en `client` : à réécrire sur l'adaptateur.
- **N3 clôture de code** (py/js `une réponse d’une autre forme lève`) : « ```json … ``` » est décodé (arbitrage) ; tester aussi une clôture ouverte non fermée, deux blocs, du texte avant la clôture → erreur.
- **Dossier vide** (py `test_production_dossier_vide_zero_essai_et_attribut_nul`, `test_production_un_dossier_vide_part_quand_meme_chez_le_fournisseur`, js idem) : refusé sans appel ; un attribut nul n'apparaît plus dans la source (« name: None » attendu à tort).
- **N0 NFD** (py/js `le tirage donne le même texte…`, `production : encodage NFD…`) : le nom en NFD tire désormais la même formulation qu'en NFC.
- **N0 `INFIRMÉ vingt formulations`** (py/js, toujours marqués) : la fiche dit seize ; retourner en démonstration.
- **N2 point décimal** (js, toujours marqué) : la copie « … pèse 1.2 kg avec sa toile recy » est refusée comme fragment ; écrire le test avec `assert.rejects`, comme le test Python avec son `try`. Ajouter « M. Dupont » (limite écrite), une phrase suivie d'une minuscule, et « ! » final.
- **Négation et accord** (N2 et N3) : « pas étanche », « sans cuir pleine fleur », « non-étanche » (trait d'union), « aucune garantie à vie » ; copie qui nie (« n’est pas étanche ») non refusée ; « cuirs pleines fleurs » ; accord irrégulier non couvert (limite).
- **Réponse d'un autre type** (N2 JS) : `TypeError` retentée puis `DescriptionUnavailable` (le test JS actuel passe encore par le fragment).
- **Noms** : tests démarqués encore nommés d'après le défaut (« passe le contrôle », « l’ancre quand même », « n’est jamais trouvé », « le plafond compte des unités UTF-16 », « est publiée, collée par une virgule », « est écrit « null » », `test_defaut_…`) ; commentaires « Python la publie telle quelle (DÉFAUT…) » et « `\b` sans drapeau `u` » devenus faux.

## Pour l'orchestrateur

- La latence `~1 s` et le coût `modéré` de N2 portent sur un point de contrôle affiné qui n'existe pas dans le dépôt ; ils ne sont ni mesurés ni sourcés. `flan-t5-small` n'en est pas un substitut mesurable honnête. À trancher : garder la classe comme ordre de grandeur de conception, ou passer N2 en « non mesuré » si le schéma le permet.
- La même étude E2E trouve que des systèmes écrits à la main peuvent produire des sorties plus variées que les modèles seq2seq : cela ne touche pas le verdict N3 (modèle généraliste), mais le relecteur voudra peut-être que la fiche dise ce qui fonde la variété de N3 autrement que par la température.
- `requirements-snippets.txt` n'épingle ni `transformers` ni `torch`.
