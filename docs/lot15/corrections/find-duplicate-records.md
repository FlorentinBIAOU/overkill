# find-duplicate-records — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` et
`test-snippets find-duplicate-records` verts. Aucune assertion n'a été touchée.
Reste marqué `INFIRMÉ` (et échoue toujours tel qu'écrit) : « le niveau ne
compare jamais toutes les paires » (py/js), voir « À retester ».

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#9) | « the only rung here that stays fast when the file grows, because it never compares every pair » | Test : 300 fiches d'un même bloc, 44 850 paires comparées | « It compares only the records that share a blocking key: every pair inside a group, none across groups. » |
| N0 docstring py/js + `doc.fr.yaml` (#8) | « turns that into a few thousand » | Chiffre qui dépend entièrement du fichier, sans source | « leaves the pairs of each group: few when the groups are small, all of them when every record lands in the same group » |
| N1 commentaire js (#25) | « Walking the shorter vector » | La boucle parcourait toujours `vectors[i]` | Le code parcourt désormais le plus court des deux vecteurs ; le commentaire est devenu vrai |
| N1 commentaire py (#24) | « A neighbour index, not a full similarity matrix: the matrix is the thing that stops fitting in memory first » | Non mesuré, non sourcé | « Every neighbour within the radius, for every record. » + la raison de la tolérance (voir Code réparé) |
| N2 docstring py/js + `doc.fr.yaml` (#33, #37) | « "Société Nationale des Chemins de Fer" and "SNCF" can land close together, because the model was trained on text where they occur in the same places » ; « a few hundred megabytes of weights » ; « a vector index once the file no longer fits in a list » | Comportement du modèle non sourcé ; taille en mégaoctets interdite par la charte ; carte du modèle : vecteurs de dimension 384 par **moyenne des jetons** (`pooling_mode_mean_tokens`) | « A sentence encoder maps each record to a dense vector, the mean of the vectors of its tokens, and records are compared on those vectors rather than on shared letters. » ; « weights to download and load, and a process to keep warm » |
| N2 breaking_point (#31, #32) | « le jeton qui distingue deux lignes pèse peu dans un vecteur construit sur tout ce qu’elles ont en commun » ; « Dans le test, « Câble HDMI 2 m » est plus proche… » ; « le rapprochement de deux lignes presque identiques, lui, est ce que font aussi les vrais encodeurs » | La moyenne des jetons est documentée (carte du modèle) ; les vecteurs du test sont écrits par le double ; rien ne source ce que font « les vrais encodeurs » | « le vecteur est la moyenne de ceux de tous ses jetons, et le jeton qui distingue deux lignes n’y compte que pour sa part. Si « Câble HDMI 2 m » tombe plus près […], comme avec les vecteurs du test, l’extrait rapproche au seuil par défaut les deux câbles différents et rate le vrai doublon. Ces vecteurs sont ceux d’un double local : ce que le vrai modèle rend sur ces lignes n’est pas mesuré ici. » |
| verdict_rationale (#41) | « c’est ce qui le laisse tenir quand le fichier grossit : les deux autres comparent, dans le pire des cas, toutes les paires » | N0 compare aussi toutes les paires d'un même groupe (test) ; N1 et N2 comparent toutes les paires, pas seulement « dans le pire des cas » (N1 JS et N2 bouclent sur toutes, N1 Python cherche dans un rayon autour de chaque fiche) | « …tant que la clé garde les groupes petits : N1 et N2 comparent toutes les paires du fichier, N0 celles de chaque groupe » |
| Essai, commentaire d'en-tête | « L'extrait ne compare jamais toutes les paires : il groupe d'abord, et c'est ce qui le garde rapide quand le fichier grossit » | Même raison que #9 | « L'extrait groupe d'abord, et ne compare que les paires d'un même groupe. » |
| Essai, cas 2 (#47) | « Trois Dupont à la même adresse », sans mention d'échec | « Jean Dupont » et « Jeanne Dupont » sortent en doublon à 0,92 (distance 2 sur 25 caractères) | Cas marqué `fails: true`, why : « Jean et Jeanne Dupont sortent en doublon à 0,92 : pour la distance d’édition, deux lettres de plus sur vingt-cinq caractères ne pèsent presque rien. Le score ne sait pas qu’un prénom a changé. » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| scenario (#44) | « et presque aucune n’a quoi que ce soit en commun » | Description d'un fichier quelconque, sans source ni mesure |
| N1 docstring py/js + `doc.fr.yaml` | « A neighbour index earns its place well before the file gets large » | Non mesuré ; la version JavaScript n'a pas d'index. Remplacé par « no key means every pair of the file is scored » |
| N1 docstring js + `doc.fr.yaml` (#26) | « which is why it fits in one screen » | Non testable ; reste « written here with no dependency » |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py (#14) ; n0.js, n1, n2 par cohérence | nom `None` : `AttributeError` en Python ; « null » lu comme un mot en JavaScript | `normalise` accepte l'absence (`text or ""` / `text ?? ''`) ; `record_text` ignore les cellules `None` en Python, comme `Array.join` le fait déjà en JavaScript |
| n0, n1, n2 py/js (#15) | « Du​pont » coupé en deux mots, clé « pon: » | Les caractères de format (catégorie Unicode Cf : espaces de largeur nulle, marque d'ordre des octets) sont supprimés avant la ponctuation ; même normalisation dans les trois niveaux (le test N2 le vérifie) |
| n0.py / n0.js (constat #9) | `record_text` recalculé à chaque comparaison | Calculé une fois par fiche avant les boucles |
| n1.py (#29) | fiches sans lettre ni chiffre : `ValueError: empty vocabulary` | Moins de deux fiches non vides : liste vide avant `TfidfVectorizer`, comme en JavaScript |
| n1.js, n2.py, n2.js ; n1.py par cohérence (#30, #40) | deux fiches identiques : cosinus 0,9999999999999999, absentes au seuil 1,0 | Tolérance de 1e-9 sur le seuil (rayon `1 - threshold + 1e-9` en Python N1) ; le score affiché reste arrondi au millième |
| n1.js (#25) | « Walking the shorter vector » faux | Parcours du plus court des deux vecteurs |
| n2.py / n2.js (#35) | vecteurs de dimensions différentes ou non finis : score faux ou paire perdue en silence | `EncodingFailed` si les dimensions diffèrent ou si une valeur n'est pas un nombre fini |
| n2.js (#36) | import de `@xenova/transformers`, ancien nom | `@huggingface/transformers`, comme l'exemple de la carte `Xenova/paraphrase-multilingual-MiniLM-L12-v2` ; appel `extract(batch, { pooling: 'mean' })` puis `.tolist()` conforme à la documentation Transformers.js (context7) |

Marquages retirés (assertions inchangées) : n0 — 2 `DÉFAUT` py, 1 js ; n1 — 1
`DÉFAUT` py, 1 js ; n2 — 1 `DÉFAUT` py, 2 js.

Lignes utiles : n0.py 36, n0.js 48, n1.py 22, n1.js 53, n2.py 37, n2.js 42.

## Sources consultées

- Splink, *Blocking rules* : « The number of pairs of records to compare grows using the formula n(n-1)/2 », et le blocage comme sous-ensemble de comparaisons — conforme au libellé de `further_reading`.
- scikit-learn, `TfidfVectorizer` : « Option 'char_wb' creates character n-grams only from text inside word boundaries; n-grams at the edges of words are padded with space » — conforme au libellé et à la docstring N1.
- Hugging Face, carte `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : 384 dimensions, `pooling_mode_mean_tokens`, Apache 2.0, 50 langues (le commentaire « A multilingual model » tient).
- Hugging Face, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` : dépôt existant, exemple `import { pipeline } from '@huggingface/transformers'`, tâche `feature-extraction`.
- Transformers.js (context7) : `extractor(texts, { pooling: "mean", normalize: true })` puis `.tolist()`.
- Sentence Transformers, `SentenceTransformer.encode` : tableau NumPy par défaut, `normalize_embeddings` à `False` par défaut (l'extrait normalise lui-même).
- Wikipedia *Record linkage*, sbert.net : pages existantes, conformes aux libellés.

## À retester

- **n0 `INFIRMÉ` « ne compare jamais toutes les paires » (py/js)** : la docstring dit désormais « every pair inside a group » ; retourner le test en démonstration (300 fiches d'un bloc → 44 850 paires au seuil zéro).
- **Noms des tests démarqués** : préfixe retiré, suite du nom décrivant encore le défaut (« …change la clé », « …ne sortent pas au seuil un », « …ne lèvent pas », `test_defaut_…`) ; commentaires « Python lève ici (voir son test DÉFAUT) » dans `n0.test.js` et `n1.test.js` devenus faux.
- **N2 JS, encodeur par défaut** : tester l'adaptateur avec un double à la forme du pipeline Transformers.js (`extract(batch, { pooling: 'mean' })` rendant un objet à méthode `tolist()`), et le code source importe `@huggingface/transformers`.
- n0/n1/n2 : nom `undefined` ou absent en JavaScript, cellule `None` au milieu d'une fiche en Python (ignorée, pas « None ») ; U+FEFF et U+200D dans un nom ; paire identique au seuil 1,0 en Python N1 et N2 ; score à 0,8499999 contre seuil 0,85 (la tolérance de 1e-9 ne doit pas l'admettre).
- n1 : parcours du vecteur le plus court, même résultat quel que soit l'ordre des fiches ; fichier d'une fiche non vide et de fiches vides → liste vide (py/js).
- n2 : vecteur contenant `Infinity`, une chaîne, `null` → `EncodingFailed` (py/js).
- Essai : cas 2 marqué `fails: true`, why présent dans les deux langues.

## Pour l'orchestrateur

- n0.js (48) et n1.js (53) dépassent les quarante lignes utiles (n1.js écrit TF-IDF à la main, déjà au-dessus avant ce tour).
- La latence `~10 ms` de N1 et `~100 ms` de N2 n'ont ni source ni mesure dans le dépôt ; la version JavaScript de N1, quadratique, prend de l'ordre de huit secondes pour 3 000 fiches d'après le relevé. Une latence déclarée « par fichier » ou « par paire » serait à préciser dans la charte.
