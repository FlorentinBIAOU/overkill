# show-similar-articles — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures` et `check-french` verts.
`test-snippets show-similar-articles` rouge sur trois tests que la correction
rend faux et que le rédacteur n'a pas le droit de toucher (voir « À retester »).
Aucune assertion n'a été modifiée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario fr/en (#17) | « il ne change que lorsqu'un article est publié ou que ses étiquettes changent » | N1 et N2 lisent le texte : réécrire un corps change la table | « il ne change que lorsque le fonds change : un article publié, réécrit, ou dont les étiquettes changent » |
| scenario fr/en (#16) | « Les trois niveaux de cette fiche rendent la même table » | Même forme (tuples / paires), contenus différents | « rendent une table de même forme » |
| scenario fr/en (arbitrage du lot 14) | latences sans unité | L'entrée naturelle est le fonds entier, par lot | « C'est une table à construire hors ligne, pour tout le fonds d'un coup […] ; les latences annoncées sont celles d'un article, pas celle de la table entière » |
| N0 breaking_point fr/en (#4) | « Un fonds mal étiqueté ne produit aucune similarité » | Test : qu'un quatrième article ne porte pas « article », et les trois autres deviennent voisins à 1,0 | « aucune similarité juste » ; ajout : « À un article près, l'échec change de sens : qu'un quatrième article ne porte pas « article », et les trois autres deviennent voisins parfaits, à 1,0, sans rien avoir en commun qu'une étiquette générique. » |
| N0 escalate_when fr/en (#5) | « contient des lignes vides, parce que vos étiquettes sont soit sur tous les articles, soit sur un seul » | Une étiquette presque universelle ne vide rien, elle remplit de 1,0 | « contient des lignes vides, ou des voisins à 1,0 qui ne partagent qu'une étiquette générique : vos étiquettes sont sur tous les articles ou presque, ou sur un seul » |
| N1 breaking_point fr/en (#21) | « qui ne partage avec l'article anglais que de la grammaire » | Jetons communs `and, day, is, of, the, will` ; sans « for a day », 0,192, toujours devant le jumeau à 0 | « qui ne partage avec l'article anglais que des mots de liaison et le mot anglais pour « jour », obtient un score strictement supérieur ; sans ce mot, elle passe encore devant » |
| N1 docstring py/js + `doc.fr.yaml` (#24, #25) | « a word appearing in every article weighs almost nothing, which is the idea of N0 applied to vocabulary » ; « Nobody has to maintain anything » | IDF lissé : un mot présent partout pèse 1 (le minimum), pas zéro ; sans liste de mots vides, l'affûtage reçoit l'annonce du site | « the rarer a word across the corpus, the more it weighs. Unlike a tag on every article at N0, a word in every article still weighs something, which is why the stop list below is part of the job, one per language » |
| N1 docstring py/js + `doc.fr.yaml` (#28) | « it returns the same neighbour table as N0 » | Même forme seulement | « a neighbour table of the same shape as N0 » |
| N1 docstring de `build_neighbour_table` py/js (#25, #27) | « Without one the ranking still works, because a word in every article is downweighted anyway » | Test : affûtage → annonce du site à 0,054 | « Without one, the words every article shares still count: on the test corpus, the knife-sharpening article gets the site announcement as a neighbour. » |
| N1 docstring js + `doc.fr.yaml` (#30) | « The weighting below is the standard smoothed one, so this ranks a corpus exactly as the Python version does » | Même motif de jetons et même lissage que scikit-learn par défaut (documentation : `token_pattern='(?u)\b\w\w+\b'`, `smooth_idf=True`) ; les fonds de test concordent au millième, rien ne démontre « exactly » en général | « The tokens and the weighting below are scikit-learn's defaults, so this ranks a corpus as the Python version does. » |
| N1 commentaire js (#32) | « A one-letter token carries no subject, and dropping it costs nothing » | « Programming in C » / « Pointers in C » : cosinus 0 ; motif identique à celui de scikit-learn | « Runs of two or more letters, digits or underscores, as scikit-learn's default token pattern. A one-letter word, such as the C of "Programming in C", is dropped with the rest. » |
| N1 commentaire js (#33) | « so a term present everywhere still has a defined weight instead of a division by zero » | df ≥ 1 pour tout terme vu : aucune division par zéro ici | « Smoothed, as scikit-learn does by default: as if one extra document held every term once. A term present everywhere weighs 1, the least possible. » |
| N2 breaking_point fr/en (#49, #50, #51) | « Un article reçoit un vecteur, quelle que soit sa longueur : un texte qui aborde huit sujets les porte chacun au huitième » ; « la dilution, elle, est celle des vrais encodeurs » | `sentence_bert_config.json` : `max_seq_length: 128` ; sbert.net : « Longer texts will be truncated to the first `model.max_seq_length` tokens » ; `tokenizer_config.json` du dépôt Xenova : `model_max_length: 512`, et le pipeline Transformers.js tokenise avec `truncation: true`. « Au huitième » : 0,289 avec le double, pas 0,125. Rien ne source le comportement des vrais encodeurs | « Un article reçoit un seul vecteur, qui mêle tout ce qu'il contient. […] rallongé de son propre sujet, il garde sa place. Ces vecteurs sont ceux du double local : ce que le vrai modèle rend sur ces articles n'est pas mesuré ici. Et le modèle nommé ne lit que le début d'un long article, 128 jetons en Python et 512 en JavaScript : ce qui dépasse ne dilue pas le vecteur, il n'y entre pas. » |
| N2 docstring py/js + `doc.fr.yaml` (#53) | « An encoder maps each article to a vector where meaning, not spelling, decides the distance, so the French and the English piece on sourdough can land together » | Sentence Transformers, *Multilingual models* : modèles entraînés pour qu'une phrase et sa traduction tombent au même endroit, exemple sur `paraphrase-multilingual-MiniLM-L12-v2` ; le double rend 0 pour le jumeau | « The encoder named below is a multilingual one, trained so that a sentence and its translation land close together: that is what could bring the French and the English piece on sourdough together, which the test's local double does not do. It reads only the start of a long article (128 tokens in Python, 512 in JavaScript) and truncates the rest. » |
| N2 docstring py/js + `doc.fr.yaml` (#54, #55, #56) | « a few hundred megabytes of weights, a process to keep warm, and a vector index once the corpus outgrows a list » | Mégaoctets interdits par la charte ; le code charge le modèle à chaque construction et ne tient rien chaud ; index vectoriel : conseil non sourcé | « What changes is what the build now runs: a model whose weights are downloaded once, then loaded each time the table is built. » |
| N2 commentaire py/js (#57) | « Encoding article by article wastes most of the machine » | Performance non mesurée | « One batched call, over the whole corpus, every time the table is built. » |
| verdict_rationale fr/en (#66, #67, #55) | « N1 est le niveau qui ne dépend de personne » ; « la table se vide au lieu de se dégrader » ; « échanger une bibliothèque contre un service à tenir chaud » | Liste de mots vides à entretenir ; table pleine de 1,0 à une étiquette près ; aucun service chaud dans le code | « N1 ne dépend ni de l'étiquetage ni d'un modèle » ; « la table se vide ou se remplit de voisins parfaits que rien ne rapproche » ; « sous peine d'ajouter à chaque construction de la table un modèle à charger » |
| Essai, note fr/en (#42) | « Un zéro […] c'est l'absence de tout mot commun » | « un » et « de » sont communs et le score vaut 0,00 : ce sont des mots vides | « c'est l'absence de tout mot commun, mots vides mis à part » |
| Essai, cas 2 en (#44) | libellé « Words from the body, not the title », question « Letting cucumbers ferment in a jar » | « cucumbers » est dans le titre de « Pickled cucumbers in brine » | Question anglaise : « Garlic and dill before letting them ferment » : aucun mot du titre, « Pickled cucumbers in brine » seul dans le bloc (0,18) ; le libellé devient vrai |
| further_reading | « TfidfVectorizer, et la formule d'idf lissée employée par l'extrait » | La page documente le paramètre `smooth_idf` (« as if an extra document was seen containing every term in the collection exactly once »), pas la formule | « TfidfVectorizer, et le lissage de l'idf employé par l'extrait » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N2 breaking_point fr/en (#50) | « un texte qui aborde huit sujets les porte chacun au huitième » | Image chiffrée fausse avec le double (0,289), non testable pour un vrai modèle |
| N2 breaking_point fr/en (#51) | « Le double local du test amplifie l'écart ; la dilution, elle, est celle des vrais encodeurs » | Comportement d'un vrai modèle, non sourcé ; remplacé par ce que le test mesure et par la troncature documentée |
| N2 docstring (#54, #56) | « a few hundred megabytes of weights » ; « a vector index once the corpus outgrows a list » | Taille en mégaoctets interdite ; conseil non sourcé |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#14) | étiquettes NFC et NFD distinctes | `tag_set` / `tagSet` : chaque étiquette en NFC, une fois |
| n0.py / n0.js (#15) | étiquettes en chaîne lues lettre à lettre | `TypeError` si `tags` est une chaîne |
| n1.py (#31) | fonds sans aucun mot retenu : `ValueError: empty vocabulary` | le `ValueError` de `fit_transform` rend des lignes vides, comme en JavaScript |
| n1.py / n1.js (#39) | corps ou titre absent indexé comme « None » / « null » | colonne nulle lue comme vide ; même traitement dans `article_text` de N2 par cohérence |
| n1.py / n1.js (#40) | le même article en NFD ne se reconnaît pas | `article_text` / `articleText` normalise en NFC |
| n2.py / n2.js (#59) | vecteurs NaN : table vide ; dimensions incohérentes : voisins à 1,0 | `EncodingFailed` si une taille diffère ou si une valeur n'est pas un nombre fini ; `unit` en JavaScript convertit en nombres (une chaîne devient NaN, donc refusée) |
| n2.js (cohérence du lot) | import de `@xenova/transformers`, ancien nom | `@huggingface/transformers`, comme l'exemple de la carte `Xenova/paraphrase-multilingual-MiniLM-L12-v2` ; `extract(batch, { pooling: 'mean' })` puis `.tolist()` conforme à la documentation Transformers.js |

Marquages retirés (assertions inchangées) : n0 — 2 `DÉFAUT` py, 2 js ; n1 — 3
`DÉFAUT` py, 2 js ; n2 — 1 `INFIRMÉ` py, 1 js.

Lignes utiles (ni vides, ni commentaires, ni docstrings) : n0.py 32, n0.js 40,
n1.py 33, n1.js 46, n2.py 37, n2.js 44.

## Sources consultées

- scikit-learn, `TfidfVectorizer` : `token_pattern='(?u)\b\w\w+\b'` et `smooth_idf=True` par défaut ; « Smooth idf weights by adding one to document frequencies, as if an extra document was seen containing every term in the collection exactly once ».
- Hugging Face, `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : `sentence_bert_config.json` (`"max_seq_length": 128`), carte (384 dimensions, moyenne des jetons, français parmi les langues).
- Sentence Transformers, *Computing Embeddings* : « Longer texts will be truncated to the first `model.max_seq_length` tokens ».
- Sentence Transformers, *Multilingual Models* : entraînement qui aligne une phrase et sa traduction ; exemple « Hello World » / « Hallo Welt » / « Hola mundo » avec ce modèle.
- Hugging Face, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` : `tokenizer_config.json` (`"model_max_length": 512`), fichiers ONNX, exemple `import { pipeline } from '@huggingface/transformers'`.
- Transformers.js, `packages/transformers/src/pipelines/feature-extraction.js` (branche main) : le pipeline `feature-extraction` appelle le tokeniseur avec `padding: true, truncation: true` ; context7 (`/huggingface/transformers.js`) : `extractor(texts, { pooling: "mean" })` puis `.tolist()`.
- *Introduction to Information Retrieval*, pages 6.2 (tf-idf) et 6.3.1 (produit scalaire) ; sbert.net : pages existantes (HTTP 200).

## À retester

- **Rouges, à reprendre** :
  - `n0.test.py` `test_l_extrait_n_importe_que_la_bibliotheque_standard` : l'extrait importe désormais aussi `unicodedata` (bibliothèque standard) ; l'ensemble attendu devient `{"math", "unicodedata", "collections"}`.
  - `n1.test.js` « INFIRMÉ : le libellé anglais dit « Words from the body, not the title » » : la question anglaise est « Garlic and dill before letting them ferment », bloc `[['Pickled cucumbers in brine', '0.18']]` ; à retourner en démonstration (aucun jeton du titre).
  - `n2.test.js` « le modèle par défaut a la surface de @xenova/transformers » : l'extrait importe `@huggingface/transformers` ; le crochet doit intercepter ce nom.
- **Toujours marqués, et toujours vrais comme constats de code** (la fiche a été corrigée, pas le code) : n0 `INFIRMÉ` « une étiquette presque universelle laisse des lignes vides » (py/js) ; n1 `INFIRMÉ` « grammaire » (py/js), « un mot présent partout ne pèse presque rien » (py/js), « sans liste de mots vides, le classement tient encore » (py/js), « la table ne change qu'à la publication ou au réétiquetage » (py/js), « écarter les jetons d'une lettre ne coûte rien » (py/js), « sans lissage, un terme présent partout diviserait par zéro » (py/js) ; n1.js `INFIRMÉ` note de l'essai « l'absence de tout mot commun » ; n2 `INFIRMÉ` « le modèle reste chargé entre deux constructions » (py/js). Chacun est à retourner en démonstration de la phrase nouvelle, ou à retirer.
- **Noms des tests démarqués** : préfixe retiré, suite du nom décrivant encore le défaut (« une étiquette NFD ne rencontre pas la même en NFC », « des étiquettes en chaîne sont lues lettre à lettre », « un corps absent devient le mot « null » », « le même article en NFD ne se reconnaît pas », `test_defaut_…`, `test_infirme_…`) ; `n1.test.js` « production : un fonds sans aucun mot retenu rend des lignes vides (le Python …) » : le Python ne lève plus.
- N0 : `TypeError` pour une chaîne en Python (le test accepte aussi `ValueError`).
- N1 : titre à `None`/`null` ; fonds de seuls mots vides (`stop_words` couvrant tout) → lignes vides en Python.
- N2 : vecteur contenant une chaîne ou `Infinity` → `EncodingFailed` ; corps `None`/`null` lu comme vide dans `article_text`.
- Essai : note fr/en (« mots vides mis à part ») et cas 2 anglais.

## Pour l'orchestrateur

- n1.js (46) et n2.js (44) dépassent les quarante lignes utiles ; n1.js écrit TF-IDF à la main.
- Les latences `<1 ms`, `~10 ms`, `~100 ms` sont désormais annoncées « par article » dans le scénario, conformément à l'arbitrage ; aucune n'est mesurée dans le dépôt, et le coût d'une construction de table croît avec le carré du nombre d'articles aux trois niveaux (toutes les paires sont comparées).
- `escalate_when` de N2 (« on découpe les articles en passages et on indexe les passages ») reste un conseil ; il est cohérent avec la troncature désormais sourcée, mais n'est pas démontré.
