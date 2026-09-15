# fuzzy-match-company-names — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets fuzzy-match-company-names` **rouge sur trois tests** qui fixent
un comportement que les réparations changent (voir « À retester ») :
`test_la_liste_des_formes_juridiques_est_francaise_et_etrangere` (py/js),
`test_production_une_lettre_sans_decomposition_est_perdue` (py/js),
`l'encodeur est injecté, et par défaut c'est le vrai` (js). Aucune assertion
n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| Essai, cas 4, `why` fr/en (#4) | « Sanofi, qui ne partage avec SNCF qu'une première lettre » | Relevé : s, n, f, trois lettres appariées par Jaro ; contredisait le `breaking_point` | « Sanofi, qui partage avec SNCF trois lettres sur quatre » / « which shares three of the four letters of SNCF » |
| Essai, cas 2, libellé fr/en (#7) | « Accents, esperluette, pluriel : rien de tout cela ne compte » | Scores 0,978 et 0,925 : au-dessus du seuil, pas indifférents | « Accents, esperluette, pluriel : tout reste au-dessus du seuil » / « all still above the cut » |
| N0 commentaire py/js (#20) | « never gives back more than a tenth of the score Jaro withheld » | `prefix * 0.1 * (1 - jaro)`, `prefix` ≤ 4 : jusqu'à quatre dixièmes | « gives back a tenth of the score Jaro withheld for each of them that both names share » |
| N0 docstring de `_jaro`/`jaro` py/js (#22) | « within half the length of the longer name » | `max(len) // 2 - 1` : la moitié moins un (définition standard, Wikipedia) | « less than half the length of the longer name away: at most that half, minus one » |
| N0 docstring py/js + `doc.fr.yaml` (#14) | « which is how company names actually vary: the head is the brand, the tail is a form, a city » | Constat empirique non sourcé ; la récompense du début commun est démontrée | « which suits names that differ at the tail: a form, a city, a scrap of punctuation after the same brand » |
| N2 breaking_point fr/en (#50) | « Des mots ordinaires partagés l'emportent sur l'identité. Dans le test, « Boulangerie du Vieux Port » […] passe devant « Le Vieux Moulin » » | L'ordre est produit par le double (sac de mots), pas par un encodeur ; charte des tests : attribuer au modèle ce que fait le double est faux | « Non mesuré. L'extrait est vérifié contre un double local, un sac de mots, et ce que montre ce double ne vaut que pour lui : […] Où casse l'encodeur réel, et ce qu'il gagne sur les sigles, rien dans cette fiche ne le mesure. » |
| N2 docstring py/js + `doc.fr.yaml` (#53) | « An encoder maps each name to a vector by meaning rather than by spelling » | Fiche du modèle : « maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for tasks like clustering or semantic search » | « The encoder maps each name to a vector built for semantic search, where closeness is meant to follow meaning rather than spelling. Whether it brings that pair together, nothing here measures. » |
| N2 docstring py/js + `doc.fr.yaml` (#54) | « a model file to ship and keep in sync, a warm process to hold it, and a score you cannot explain to the colleague […] the scores of the old version are not comparable » | Poids téléchargés et gardés en mémoire : ce que fait `load_encoder`/`buildIndex`. Réindexation : documentation LlamaIndex, « if you change your embedding model after indexing, you must re-index. Embeddings from different models are not interchangeable » | « model weights to download and keep, a process that holds them in memory, and a score that cannot be explained fragment by fragment, as N1's can. The register also has to be re-encoded whenever the model changes: vectors from two models are not interchangeable. » |
| N2 escalate_when (#62) | « Ce qui vient ensuite n'est pas un autre algorithme, c'est quelqu'un qui tranche » | Affirmation générale non sourcée | « Il n'y a pas de niveau au-dessus dans cette fiche : les paires que le score laisse en suspens vont à quelqu'un qui tranche. » |
| N3 unavailable_reason (#65) | « un appel par paire n'existe pas » ; « un modèle généraliste ne se fixe pas ainsi » | 10 000 × 9 999 / 2 = 49 995 000. OpenAI Cookbook, paramètre `seed` : « best effort », « Determinism is not guaranteed » | « cinquante millions de paires, donc cinquante millions d'appels » ; « le fournisseur pris en exemple ne garantit pas le déterminisme, même à graine fixée » |
| verdict_rationale (#67) | « chacune de ses affirmations est un test unitaire » | Faux (les lignes réglementaires ne se testent pas ; trois affirmations étaient infirmées) | « chacun de ses scores se vérifie par un test unitaire » |
| scenario (#69) | « Le réflexe est de soumettre chaque paire à un modèle généraliste » | Constat d'usage non sourcé | « On peut soumettre chaque paire à un modèle généraliste » ; la contrainte de rejouabilité est désormais sourcée (Cookbook) |
| N1 docstring JS (#43) | « la même arithmétique que celle de scikit-learn » | Faux hors du plan multilingue de base (découpe en UTF-16). Code réparé, phrase gardée : elle est vraie désormais | inchangée |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#17) | « short enough to read in one sitting » / « assez court pour se lire d'une traite » | Appréciation invérifiable |
| N0 commentaire py/js (#18) | « every real matching job carries a list like this one, and grows it » | Constat d'usage non sourcé |
| N2 docstring py/js + `doc.fr.yaml` (#53) | « which is the only way that pair can ever meet » | Absolu faux : une règle d'initiales ou une table de sigles rapproche aussi la paire |
| N3 unavailable_reason fr/en | « et il ne reste alors au modèle que la question facile » | Appréciation de ce que ferait le modèle, non sourcée |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#27) | noms sans lettre latine vidés par `[a-z0-9]` : « Газпром »/« Лукойл » et « 東京電力 »/« 日立製作所 » à 1,0 | Mots pris sur les lettres et chiffres de toute écriture : `[^\W_]+` en Python, `[\p{L}\p{N}]+` avec `u` en JavaScript. Les marques retirées sont désormais toutes celles de catégorie `M` dans les deux langages (`unicodedata.category`, `\p{M}`) au lieu de `combining` en Python seul. Scores : 0,4365 et 0,0, identiques py/js |
| n0.py / n0.js (#28) | « Nordic Spa »/« Nordic SA » à 1,0 | `spa` retiré de la liste des formes, avec un commentaire qui dit pourquoi. Score 0,92. Le S.p.A. italien écrit avec ses points se normalisait déjà en « s p a » et n'était pas retiré |
| n0.js (hors relevé) | `jaro` indexait en unités UTF-16 et `[...a].filter((_, i) => hitA[i])` décalait les indices dès qu'un caractère hors du plan de base était présent | `jaroWinkler` travaille sur des tableaux de points de code ; l'égalité stricte est testée sur les chaînes. `jaroWinkler('𠀀𠀁x', '𠀀𠀁y')` : 0,8222 dans les deux langages. `jaro` + `jaroWinkler` restent sous trente lignes |
| n1.js (#43) | n-grammes découpés en unités UTF-16 : 0,6069 au lieu de 0,4751 (scikit-learn) | `ngrams` découpe un tableau de points de code. Valeur épinglée Python atteinte |
| n2.js (consigne N2) | `@xenova/transformers` (ancien nom, v2) ; poids quantifiés chargés par défaut dans certains environnements, donc vecteurs différents de Python | `@huggingface/transformers`, `pipeline('feature-extraction', name, { dtype: 'fp32' })`. `model.onnx` (pleine précision) existe dans `Xenova/paraphrase-multilingual-MiniLM-L12-v2/onnx` |

Marquages retirés (assertions inchangées) : n0 — 2 `DÉFAUT` en Python, 2 en
JavaScript ; n1 — 1 `INFIRMÉ` en JavaScript.

Restent marqués, et à reprendre par le testeur : n0 `INFIRMÉ` essai « une
première lettre », « un dixième », « la moitié » (py/js) : ils testent la phrase
d'origine, qui a disparu, et restent donc en échec attendu.

Non réparé, décision : les formes pointées (« S.A.R.L. » → « s a r l », 0,938
contre le même nom sans forme) et les caractères de largeur nulle
(« Boulan​gerie », 0,956). Les deux restent au-dessus du seuil ; les réparer
change `normalise('Café-de-la-Gare, S.A.S') == 'cafe de la gare s a s'`, que le
test fixe. Aucune phrase de la fiche ne les promet. Deux noms faits seulement
d'emoji ou de ponctuation se normalisent toujours en chaîne vide et valent 1,0,
comme deux noms vides, ce que fixe `test_un_nom_vide_ne_rapproche_rien`.

Chiffres vérifiés sans changement : N0 `<1 ms` (mesuré par le testeur) ; N1
`~10 ms`, gardé pour une recherche dans un registre de dix mille noms (3 ms en
Python, 40 ms en JavaScript mesurés par le testeur : même ordre de grandeur) ;
N2 `~100 ms`, cohérent avec la boucle de `match` sur dix mille vecteurs hors
encodeur (185 ms en Python, 10 ms en JavaScript) ; coûts cohérents avec la
charte.

## Sources consultées

- Hugging Face, fiche de `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : « maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for tasks like clustering or semantic search ». https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- Hugging Face, arborescence `Xenova/paraphrase-multilingual-MiniLM-L12-v2/onnx` : `model.onnx`, `model_quantized.onnx`, `model_fp16.onnx`, etc.
- Transformers.js, « The pipeline API » : `import { pipeline } from "@huggingface/transformers"`, option `dtype: "fp32"` ; README (context7 `/huggingface/transformers.js`) : « 'fp32' (default for WebGPU) […] 'q8' (default for WASM) » ; `extractor(texts, { pooling: "mean" })` puis `.tolist()`. https://huggingface.co/docs/transformers.js/pipelines
- sbert.net : `model.encode(sentences)` rend un tableau de forme `[3, 384]`. https://www.sbert.net/
- LlamaIndex, Embeddings : « if you change your embedding model after indexing, you must re-index. Embeddings from different models are not interchangeable. » https://developers.llamaindex.ai/python/framework/module_guides/models/embeddings/
- OpenAI Cookbook, « Reproducible outputs with the seed parameter » : « best effort to sample deterministically », « Determinism is not guaranteed ». https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter
- `further_reading` : Insee « Catégories juridiques » (page existante, nomenclature Sirene avec SARL, SA, SAS) ; sbert.net ; Wikipedia Jaro-Winkler et scikit-learn `TfidfVectorizer` inchangés.

Les quatre premières sources hors `further_reading` sont ajoutées à `sources`.

## À retester

- **n0 `test_la_liste_des_formes_juridiques_est_francaise_et_etrangere` (py/js)** : exige `spa` dans la liste ; `spa` en est retiré (défaut #28). Garder l'affirmation « française et étrangère » avec `ltd`, `gmbh`, `llc`, `bv`, et ajouter que « Nordic Spa » garde « spa ».
- **n0 `test_production_une_lettre_sans_decomposition_est_perdue` (py/js)** : `normalise('Ørsted')` vaut désormais `'ørsted'` et `normalise('Großmann')` `'großmann'` (lettres gardées, non repliées) ; `similarity('Ørsted', 'Orsted')` vaut 0,8889, toujours au-dessus du seuil.
- **n0 `INFIRMÉ` « une première lettre », « un dixième », « la moitié » (py/js)** : les phrases ont été corrigées ; tester les nouvelles (essai « trois lettres sur quatre », un dixième par caractère commun jusqu'à quatre, fenêtre à la moitié moins un) et retirer ces trois tests.
- **Noms des tests démarqués** : « un nom sans lettre latine est vidé ; … obtiennent 1,0 », « « Nordic Spa » et « Nordic SA » obtiennent 1,0 », et le test n1 JS UTF-16 décrivent encore le défaut ; à renommer avec leurs jumeaux Python.
- **n2 JS `l'encodeur est injecté, et par défaut c'est le vrai`** : attend `/@xenova\/transformers/` ; le paquet est désormais `@huggingface/transformers`. Tester aussi que `dtype: 'fp32'` est passé (double de `pipeline`).
- n0 : nouveaux cas — noms grecs, arabes, chinois identiques à 1,0 et différents sous le seuil, valeurs identiques py/js ; `jaroWinkler('𠀀𠀁x', '𠀀𠀁y')` = 0,8222 dans les deux langages ; « Sa Nostra » ou toute forme homographe restante (`sa`, `ag`, `nv`) si le testeur la juge réaliste.
- n1 JS : « 🍞🥐 Boulangerie » contre le registre emoji, valeur épinglée de Python (0,763 selon le relevé).
- N2 breaking_point : ne plus présenter le test du double comme un point de rupture du niveau ; le nom du test peut rester « avec le double ».
- Essai : libellé du cas 2 et `why` du cas 4 modifiés.

## Pour l'orchestrateur

- `test-snippets fuzzy-match-company-names` reste rouge sur les trois tests ci-dessus jusqu'au passage du testeur.
- Le point de rupture de N2 est désormais « non mesuré » : c'est honnête, mais un niveau publié sans point de rupture démontré est une question pour le relecteur. Le verdict (N0) n'en dépend pas.
- Si `@huggingface/transformers` est ajouté un jour aux dépendances de test, la surface `pipeline(..., { dtype })` et `.tolist()` pourrait être vérifiée contre le vrai paquet sans modèle.
