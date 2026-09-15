# search-in-your-own-documents — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures` et `check-french` verts.
`test-snippets search-in-your-own-documents` rouge sur cinq tests que la
correction rend faux et que le rédacteur n'a pas le droit de toucher (voir « À
retester »). Aucune assertion n'a été modifiée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario fr/en (#16, #17) | « SQLite a FTS5, PostgreSQL a tsvector, MySQL a FULLTEXT : l'index inversé et le classement BM25 sont là, mis à jour dans la même transaction que le document et sauvegardés avec lui » | Documentation PostgreSQL : `ts_rank` classe à la fréquence, `ts_rank_cd` à la densité de couverture, BM25 absent. La transaction n'est démontrée que pour SQLite | « SQLite a FTS5 et son classement BM25, PostgreSQL a tsvector et ses fonctions de classement, MySQL a FULLTEXT : l'index inversé et un classement sont déjà là. » La transaction reste dans le verdict, qui parle de la table FTS5 |
| scenario fr/en (#18) | « vos journaux de recherche le disent » | Mécanisme de #1 à #3 : une requête sans résultat | « vos journaux de recherche, avec leurs requêtes sans résultat, le disent » |
| N0 `tokenise` py + docstring js + `doc.fr.yaml` (#9, #10) | « The same folding as the tokenizer declared above » ; JS « the same tokenizer (lower case, accents folded) » | NFKD repliait ligatures, pleine chasse, exposants, que `unicode61` garde. Comparaison sur la vraie table FTS5 (fts5vocab) de 1 473 caractères latins, grecs, cyrilliques, ligatures et pleine chasse : 305 écarts avec NFKD, 106 avec NFD, 32 en ne retirant les marques que des lettres latines (SQLite 3.46.1). La documentation FTS5 dit que `remove_diacritics` retire les diacritiques « from Latin script characters » | Le code replie comme la table : NFD, marques retirées après une lettre latine seulement, recomposition NFC. Docstring : « accents come off Latin letters only, and a ligature such as "ﬁ" or a full-width letter is kept as it is » ; JS « accents off Latin letters ». Les 32 écarts restants sont des lettres rares (ſ, µ, ǡ, ǽ…) |
| N0 docstring js + `doc.fr.yaml` (#11) | « Node 22 does ship `node:sqlite`, but it needs --experimental-sqlite » | Notes de version 22.13.0 : « unflag sqlite module » ; issue nodejs/node#56951, ouverte : le SQLite de Node n'a pas FTS5. Le dépôt vise `>=22.12` | « Node 22 ships `node:sqlite` (behind --experimental-sqlite before 22.13.0), but its bundled SQLite has no FTS5 module » |
| N0 docstring py/js + `doc.fr.yaml` | « already does this, and does it well » | Rien ne soutient « well » ; PostgreSQL et MySQL n'ont pas BM25 | « already has an index and a ranking » |
| N0 `build_index` docstring py (#15) | « filled by a trigger or a nightly job » | Contredit « même transaction » du verdict. Documentation FTS5 : table à contenu externe tenue à jour « with triggers » | « the FTS5 table is the documents table itself, or an external-content table kept in step by triggers: either way it changes in the transaction that changes the document » |
| N0 regulatory fr/en (#14) | « un index de recherche les ignore par défaut » | Non sourcé en général ; vrai de l'extrait, qui cherche dans tout le fonds | « l'extrait cherche dans tout le fonds et n'en connaît aucun » |
| N0 breaking_point en | « asking for “vacances” returns nothing » | Le français et le test citent la phrase entière | « “combien de vacances puis-je poser” returns nothing » |
| Essai, why en (#29) | Question « how much holiday can I book » ; « The implicit AND finishes the job » | Aucun des mots de cette question n'est dans le règlement anglais : le ET n'y était pour rien | La question anglaise devient « how many days of holiday can I take » : « days » et « of » sont dans l'index, « how, many, holiday, can, take » non. Le why, inchangé, dit désormais vrai dans les deux langues |
| Essai, note fr/en (#25) | « Le score dit à quel point les mots cherchés sont rares » | Un mot présent dans la moitié des pages ou plus s'affiche 0,00 (plancher de l'IDF de FTS5) | « Le score monte quand les mots cherchés sont rares dans le règlement ; un mot présent dans la moitié des pages ou plus n'y ajoute rien, et un mot du titre compte dix fois un mot du corps. » |
| N1 breaking_point fr/en (#31, #33) | « et désormais « congé » au singulier ne trouve rien non plus » ; « rien dans ces quarante lignes » | N0 ne trouve pas « congé » non plus ; 44 lignes utiles en Python, 47 en JavaScript | « et « congé » au singulier ne trouve rien non plus […] — pas plus qu'à N0 : rien dans ce code ne connaît la morphologie du français » |
| N1 docstring py/js + `doc.fr.yaml` (#33, #34) | « the forty lines below are what the database does » | Aux poids de N0, « congés » vaut 2,3173 ici et 1,5938 dans FTS5 : autre règle, autre IDF, autre longueur, autre poids du titre | « the code below is a BM25 you can read […]. It does not reproduce FTS5 to the decimal: the matching rule, the idf, the length and the title weight all differ, and each is a line you can change. » |
| verdict_rationale fr/en (#34, #40) | « N1 n'est pas plus lent » ; « c'est le même algorithme avec les molettes sorties » ; « il se met à jour dans la même transaction » | Performance non mesurable ici ; même algorithme infirmé ; transaction démontrée pour la table FTS5 | « la table FTS5 se met à jour dans la même transaction que le document […] N1 coûte en plus un index à reconstruire hors de la base, et ne rend pas les scores de FTS5 : c'est un BM25 dont la règle d'appariement, l'IDF et les poids sont des lignes à vous » |
| N2 docstring py/js + `doc.fr.yaml` (#49) | « maps text to vectors where two ways of saying the same thing land close together » ; « vector search always answers, and is vague » | Carte du modèle : « maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for tasks like clustering or semantic search » ; « vague » non sourcé | « a self-hosted sentence encoder, built for semantic search, maps each text to a dense vector, and texts are compared on those vectors rather than on the words they share » ; « vector search ranks every document, always » |
| N2 docstring py/js + `doc.fr.yaml` (#50) | « Fusing the two rankings keeps the precision of the first » | Test : la tête du plein texte reste devant toute page qu'il n'a pas trouvée ; le 14e résultat sur 300 passe derrière une page sans aucun mot | « keeps the first keyword result ahead of any page the keywords did not find, and borrows the reach of the vectors; further down the list, each leg weighs as much as the other » |
| N2 commentaire py/js (#56) | « because a handbook is rarely written in English » | Non sourcé ; la carte liste le français parmi 50 langues | « its card lists French among its languages, and the handbook in the tests is French » |
| N2 breaking_point fr/en (#47) | « sauf si vous posez un seuil et le tenez » | Test : la tête d'une question hors sujet a le même score fusionné (1/61) que celle d'une question à laquelle le manuel répond | « le score fusionné ne permet pas de poser un seuil : la page de tête a le même score pour cette question que pour une question à laquelle le manuel répond. Un seuil devrait porter sur le cosinus, que l'extrait ne rend pas. » |
| N3 docstring py/js + `doc.fr.yaml` (#67) | « The model has never read your handbook. Asked without it, it answers from memory, confidently, about your company » | Comportement du modèle, non sourcé | « The model only knows of your handbook what the prompt carries. » |
| N3 docstring py/js + `doc.fr.yaml` | « no amount of prompting turns it into a check that can » | Le contrôle compare des identifiants (code) | « it compares identifiers, and never reads the sentence » |
| N3 commentaire py/js (#71) | « Temperature zero: two identical questions must give one answer » | Documentation OpenAI, *Advanced usage* : « Chat Completions are non-deterministic by default » ; la graine ne rend les sorties que « (mostly) deterministic » | « Temperature zero narrows the sampling. It does not make the call deterministic: the provider documents chat completions as non-deterministic by default, and the entry says so. » |
| N3 breaking_point fr/en (#63, #66) | « le modèle cite le passage… et écrit une phrase » | La phrase est écrite par le double | « la réponse du double cite le passage qu'on a bel et bien envoyé, et porte une phrase que ce passage contredit » |
| further_reading | `https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf` | Quatre redirections avant le PDF | `https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf` (article consulté : RRF, k = 60) |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N2 breaking_point fr/en (#48) | « Ce qui est en aval — une réponse N3, un « vouliez-vous dire » — la prendra pour le meilleur document existant » | Comportement d'un composant absent, non testable ; remplacé par le constat démontré sur le score (ci-dessus) |
| N2 docstring py/js + `doc.fr.yaml` (#51, #54) | « a few hundred megabytes of weights » ; « a vector index as soon as they stop fitting in a list » | Taille en mégaoctets interdite par la charte (470 Mo en Python, 118 Mo quantifiés par défaut en JavaScript d'après le relevé) ; conseil de déploiement non sourcé. Reste « weights to download and load » |
| N3 breaking_point fr/en (#65) | « la source affichée à côté est précisément ce qui rend la phrase crédible » | Perception du lecteur, non testable. Reste ce que le test montre : le résultat ne porte que l'identifiant |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#9, #10) | repli NFKD différent de `unicode61` : « ﬁchier » introuvable en Python, trouvé en JavaScript | NFD, marques retirées des seules lettres latines, NFC ; même règle dans les deux langages |
| n0.py / n0.js (#23) | « l'accord » : le jeton « l » exigé par le ET implicite vide les résultats | `query_terms` / `queryTerms` : un jeton d'une lettre (élision, possessif anglais « manager's ») est écarté de la requête, sauf s'il n'y a rien d'autre ; longueur comptée en points de code en JavaScript. L'essai affiche les mots absents avec la même fonction |
| n0.py / n0.js, n1.py / n1.js (#24, #44) | limite négative : SQLite rend tout, les tranches retirent le dernier résultat | `ValueError` / `RangeError` avant toute recherche |
| n1.py (#43) | titre ou corps `None` : `AttributeError` | `document.get(field) or ""` |
| n2.py / n2.js (#52) | modèle rechargé à chaque recherche | `default_encoder` sous `functools.cache` ; en JavaScript une promesse gardée au niveau du module, oubliée si le chargement échoue |
| n2.py / n2.js (#53) | fonds entier ré-encodé à chaque requête | vecteurs unitaires gardés par encodeur (`WeakKeyDictionary` / `WeakMap`), par texte de document : seuls les textes nouveaux ou modifiés partent avec la requête ; le cache ne garde que les textes de la dernière recherche |
| n2.py / n2.js (#58) | vecteurs NaN ou de tailles différentes : classement rendu sans erreur | `EncodingFailed` si une taille diffère de celle de la requête ou si une valeur n'est pas un nombre fini (une valeur non numérique devient NaN en JavaScript, lève à la conversion en Python) |
| n2.js (#36 du lot, cohérence) | import de `@xenova/transformers`, ancien nom | `@huggingface/transformers`, comme l'exemple de la carte `Xenova/paraphrase-multilingual-MiniLM-L12-v2` ; appel `extract(batch, { pooling: 'mean' })` puis `.tolist()` conforme à la documentation Transformers.js |
| n3.py / n3.js (#72) | client par défaut `OpenAI()` sans méthode `complete` | adaptateur imposé `ProviderClient` / `providerClient` ; `message.content` à `null` (refus) est une réponse inutilisable, jamais passée à `json.loads` / `JSON.parse` |
| n3.py / n3.js (#69) | réponse en clôture ```json non décodée | `_decode` / `decode` retire la clôture avant de décoder |
| n3.py / n3.js (#75) | « Je ne sais pas. » refusé en `AnswerNotGrounded` | comparaison en minuscules, ponctuation finale et espaces retirés ; la réponse rendue est `NO_ANSWER` |
| n3.py / n3.js (#76) | identifiants entiers : toute citation refusée | comparaison sur la forme texte des identifiants envoyés ; les sources rendues sont les identifiants d'origine (entiers restent entiers) |
| n3.py / n3.js (#77) | `sources` chaîne, nombre, null ; `answer` null : `TypeError` ou erreur trompeuse | la forme est vérifiée dans la boucle d'appel (`answer` chaîne, `sources` liste de chaînes ou d'entiers) : sinon réponse inutilisable, retentée, puis `AnswerUnavailable` |
| n3.py / n3.js (#78) | question vide payée ; question non bornée | question blanche : `NO_ANSWER` sans appel, comme un fonds sans passage ; plus de `MAX_QUESTION` (1 000) caractères : `ValueError` / `RangeError` avant l'appel, et avant la création du client |
| n3.js (#79) | coupe en unités UTF-16 : demi-paire de substitution dans la consigne | coupe en points de code (`head`), comme Python |

Marquages retirés (assertions inchangées) : n0 — 3 py (1 `INFIRMÉ`, 2 `DÉFAUT`),
3 js (1 `INFIRMÉ`, 2 `DÉFAUT`) ; n1 — 2 `DÉFAUT` py, 1 js ; n2 — 2 py (1
`INFIRMÉ`, 1 `DÉFAUT`), 2 js ; n3 — 7 `DÉFAUT` py, 8 js.

Lignes utiles (ni vides, ni commentaires, ni docstrings) : n0.py 39, n0.js 54,
n1.py 44, n1.js 47, n2.py 49, n2.js 63, n3.py 74 (60 sans l'adaptateur), n3.js 88
(72 sans l'adaptateur).

## Sources consultées

- SQLite, *FTS5* (https://www.sqlite.org/fts5.html) : bm25() « The better the match, the numerically smaller the value returned », k1 = 1,2 et b = 0,75 ; `remove_diacritics` : « diacritics are removed from Latin script characters », « if this option is set to "2", then diacritics are correctly removed from all Latin characters » ; ET implicite entre phrases séparées par des espaces ; tables à contenu externe tenues à jour « with triggers ».
- SQLite 3.46.1 local, table `fts5vocab` : comparaison caractère par caractère du découpage de la table et de `tokenise` (chiffres ci-dessus).
- PostgreSQL, *Controlling Text Search*, « Ranking Search Results » : `ts_rank` « based on the frequency of their matching lexemes », `ts_rank_cd` « cover density ranking », BM25 non mentionné.
- MySQL 8.4, *Natural Language Full-Text Searches* : page existante (`IN NATURAL LANGUAGE MODE`).
- Node.js, notes de version v22.13.0 : « unflag sqlite module » (#55890) ; issue nodejs/node#56951 (ouverte) : « This extension comes by default with SQLite. However, it doesn't in Node SQLite. »
- Hugging Face, carte `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : « maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for tasks like clustering or semantic search », moyenne des jetons, français parmi les langues, Apache 2.0.
- Hugging Face, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` : `import { pipeline } from '@huggingface/transformers'`, tâche `feature-extraction`.
- Transformers.js (context7, `/huggingface/transformers.js`) : `extractor(texts, { pooling: "mean", normalize: true })` puis `.tolist()`.
- OpenAI, *Advanced usage* (https://developers.openai.com/api/docs/guides/advanced-usage) : « Chat Completions are non-deterministic by default », « (mostly) deterministic outputs » avec `seed`.
- Robertson et Zaragoza, *The Probabilistic Relevance Framework: BM25 and Beyond* : PDF existant, titre conforme.
- Cormack, Clarke et Büttcher, *Reciprocal Rank Fusion outperforms Condorcet…* : PDF lu, formule 1/(k + r) « where k = 60 was fixed during a pilot investigation ».

## À retester

- **Rouges, à reprendre** :
  - `n0.test.js` « essai : la question dans les mots du lecteur ne trouve rien, et le dit » : la question anglaise est désormais « how many days of holiday can I take » ; le détail attendu devient « No page contains: how, many, holiday, can, take. » (le « i » d'une lettre n'est plus cherché, et l'essai n'affiche que les mots cherchés).
  - `n0.test.js` « INFIRMÉ : le why anglais dit « The implicit AND finishes the job » » : avec la nouvelle question, la règle OU de N1 trouve des pages (« days », « of ») ; à retourner en démonstration, comme le test français « en français, le ET implicite finit bien le travail ».
  - `n2.test.js` « le modèle par défaut a la surface de @xenova/transformers » : l'extrait importe `@huggingface/transformers` ; le crochet de résolution doit intercepter ce nom.
  - `n3.test.py` / `n3.test.js` « le client par défaut échoue en service indisponible sans appel » : décrit l'ancien défaut, désormais faux ; à retirer (le test « le client par défaut a la forme du vrai kit », démarqué, le remplace).
- **Resté marqué, à reprendre** : `DÉFAUT : le modèle par défaut est rechargé à chaque recherche` (py et js). Le code charge une fois par processus, mais un test précédent a déjà chargé l'encodeur : le compte du test suivant vaut 0, pas 1. Python : appeler `n2.default_encoder.cache_clear()` au début du test ; JavaScript : pas de remise à zéro exposée, faire les deux appels dans un processus neuf ou compter depuis le premier chargement du fichier.
- **Toujours marqués `INFIRMÉ` et toujours vrais comme constats de code** (la fiche a été corrigée, pas le code) : n1 « désormais « congé » » (py/js), « quarante lignes » (py/js), « aux mêmes poids, N1 rendrait les scores de la base » (py/js) : à retourner en démonstrations des nouvelles phrases.
- **Noms des tests démarqués** : préfixe retiré, suite du nom décrivant encore le défaut (« …la ligature « ﬁ » est repliée ici et pas dans la table », « une élision dans la requête vide les résultats », « une limite négative n'est pas refusée », « …est refusé comme non ancré », « un identifiant entier fait refuser… », « …est coupé en deux », `test_defaut_…`, `test_infirme_…`) ; commentaires devenus faux dans `n0.test.js` (« ce fichier le trouve »), `n3.test.js` (« La coupe compte en unités UTF-16 », « TypeError ; à null : lu comme [] »).
- **Adaptateur N3 avec les doubles à la forme du vrai kit** : `_harness/fake_sdk.py` et `fake-sdk.mjs` — `ProviderClient(sdk=FakeSDK(content=...))` / `providerClient(new FakeSDK({ content }))` : requête `chat.completions.create` avec `model`, `messages=[{role: user, content: prompt}]`, `temperature=0` ; `content` à `None`/`null` → `AnswerUnavailable` après les tentatives, jamais un résultat.
- n0 : le repli suit `unicode61` sur un échantillon (ligature, pleine chasse, exposant, grec et cyrillique accentués gardés, lettres latines à deux diacritiques repliées) en Python contre la table, et les mêmes jetons en JavaScript ; « manager's » trouve « manager » ; requête d'une seule lettre (« a ») encore cherchée ; lettre astrale seule (« 𝐀 ») traitée pareil dans les deux langages.
- n1 : limite négative → `RangeError` en JavaScript (le test py accepte `ValueError`).
- n2 : un document modifié est ré-encodé, et lui seul ; deux documents au même texte ne partent qu'une fois ; valeur non numérique (chaîne) dans un vecteur → `EncodingFailed` ; en JavaScript, un chargement du modèle qui échoue est retenté à l'appel suivant.
- n3 : clôture sans saut de ligne, clôture non fermée ; « JE NE SAIS PAS ! » ; source booléenne → `AnswerUnavailable` ; question de 1 000 caractères acceptée, 1 001 refusée, sans appel ni création de client ; question blanche avec passages → `NO_ANSWER` sans appel ; identifiants entiers rendus entiers dans `sources`.

## Pour l'orchestrateur

- Lignes utiles au-dessus de quarante : n0.js 54, n1.py 44, n1.js 47, n2.py 49, n2.js 63, n3.py 60 et n3.js 72 hors adaptateur. N1 et N0 JavaScript écrivent BM25 à la main ; N2 et N3 ont grossi des réparations de production exigées par le relevé (cache de vecteurs, validation, décodage, types, bornes). Les ramener à quarante demanderait de retirer des défenses que les tests exigent : à trancher.
- Cache de N2 en Python : `WeakKeyDictionary` exige un encodeur hachable et référençable faiblement (vrai de `SentenceTransformer` et des doubles). Un encodeur injecté qui ne l'est pas lèverait `TypeError`.
- La latence `~10 ms` de N0 et N1, `~100 ms` de N2, `~1 s` de N3 est celle d'une requête (une question, une recherche), l'entrée naturelle de la fiche ; aucune n'est mesurée dans le dépôt.
- `rank` (de `ts_rank`) est hors du dictionnaire de `check-french` : la fiche française dit « ses fonctions de classement » plutôt que d'ajouter le terme au lexique.
