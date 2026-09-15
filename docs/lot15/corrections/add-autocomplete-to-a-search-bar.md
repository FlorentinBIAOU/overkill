# add-autocomplete-to-a-search-bar — corrections du rédacteur (tour 1)

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 commentaire de `END` (py) | « A character can never collide with it » avec `END = "\0"` (relevé 14) | un terme contenant NUL faisait lever `build` ou `suggest` | `END = object()`, « It is not a string, so no character can collide with it » ; le test marqué passe |
| N1 commentaire de `key` (js) | « a tab never occurs inside a prefix » (relevé 39) | `learn([["a\tb", "c"]])` créait un clic fantôme | `normalise` change toute tabulation en espace, le commentaire le dit : « A tab never occurs inside a normalised prefix, since normalise turns it into a space » ; le test marqué passe |
| N0 breaking_point, « là et seulement là » | la faute sur le premier caractère est le point de rupture (relevé 3) | une espace insécable, une espace de largeur nulle, une BOM ou une espace en tête vidaient aussi la liste | code réparé (voir plus bas) : ces saisies retrouvent désormais le terme, la phrase est redevenue vraie sans changer |
| N0 docstring d'en-tête (py, js, fr) | « ten candidates under a prefix is a common case, and sorting ten items at every keystroke costs nothing worth optimising » (relevé 7) | `suggest` triait **tout** le sous-arbre à chaque frappe. Mesuré sur la machine de travail avec un index aléatoire de 100 000 termes : le préfixe vide coûtait plusieurs dixièmes de seconde par appel dans les deux langages, 10 000 termes plusieurs dizaines de millisecondes ; incompatible avec `latency: "<1 ms"` pour la barre vide, que la fiche met en avant | le classement est calculé une fois par nœud et gardé ; l'en-tête dit ce choix et son prix en mémoire (« at most one reference per term for each node a keystroke has reached ») |
| N1 docstring d'en-tête (py, js, fr) | « read back with a dictionary lookup, which is what a suggestion budget of a keystroke allows » (py) / « of a few milliseconds per keystroke » (js) (relevés 37, 38) | `rerank` fait jusqu'à `len(préfixe)+1` lectures par candidat ; le budget chiffré n'est ni mesuré ni sourcé, et les deux langages divergeaient | « read back with dictionary lookups, at most one per prefix length for each candidate, on a query whose counted length is capped », identique dans les deux langages |
| verdict_rationale (fr, en) | « Vous n'y perdez pas de latence, le réordonnancement étant une lecture de dictionnaire » (relevé 49) | affirmation de latence non mesurable par un test ; le nombre de lectures dépend de la longueur du préfixe | « Le réordonnancement ne fait que lire des compteurs en mémoire, sans appel » |
| N2 unavailable_reason (fr, en) | « Une suggestion doit tenir entre deux frappes. […] un aller-retour à chaque touche » (relevé 52) | aucune source pour un budget de latence | la phrase de budget est retirée ; « un appel à chaque touche » garde l'argument structurel |
| N3 unavailable_reason (fr, en) | « La latence dépasse à elle seule l'intervalle entre deux touches » (relevé 53) | aucune source trouvée qui chiffre à la fois l'intervalle entre deux touches et le temps de réponse d'une API de modèle | « Un appel réseau par caractère frappé, pour proposer des termes que l'index contient déjà. La facture se multiplie… » |
| further_reading, libellé Unicode | « la décomposition employée par les deux niveaux » | les extraits emploient désormais NFKD ; TR15 définit NFKD et cite NBSP → espace comme équivalence de compatibilité | « la décomposition de compatibilité (NFKD) employée par les deux niveaux » |
| essai, commentaire d'en-tête | « c'est l'argument du barreau », « elle tient dans l'intervalle entre deux touches » | vocabulaire imposé ; affirmation de latence non sourcée | « l'argument du niveau » ; ce qui se rejoue est la descente puis la lecture du classement gardé au nœud |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| scenario (fr, en) | « Le budget d'une suggestion, c'est l'intervalle entre deux touches, et un aller-retour réseau l'a dépassé avant même que le modèle ait commencé à répondre » (relevé 51) | non sourcé, et un aller-retour réseau seul ne dépasse pas nécessairement l'intervalle entre deux touches. Remplacé par un fait structurel : « Chaque frappe paie un appel réseau pour une liste que l'index du site contient déjà » |
| N1 docstring de `_evidence` / `evidence` | « hundreds of past queries » | quantité inventée ; « past queries that do » |
| N0 docstring d'en-tête | « Suggesting is not retrieving: ten candidates under a prefix is a common case » | chiffre d'usage sans source, et faux pour la barre vide |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| N0 py, js | récursion de `_collect` / `collect` : un terme de 1 000 caractères (py) faisait planter la barre vide (relevé 21) | parcours par pile explicite. En JS, `found.push(...value)` remplacé par une boucle, l'étalement passant chaque terme de la feuille en argument |
| N0, N1 py, js | espace insécable, largeur nulle, BOM, espace en tête vidaient la liste (relevés 24, 25) | `normalise` : NFKD (NBSP et espaces typographiques → espace), suppression des catégories M* et Cf, espaces et blancs ASCII ramenés à une espace, aucune en tête ni en queue |
| N0, N1 py, js | `casefold` (py) contre `toLowerCase` (js) : « strasse » ne trouvait pas « Straße » en JS (relevé 26) | même repli dans les deux langages : majuscule puis minuscule, et sigma final replié à la main (JavaScript le garde en fin de mot). Vérifié par un tirage de 5 000 chaînes mêlant ß, ẞ, İ, ı, ς, ligatures, chiffres romains, NBSP, U+3000, ZWJ, BOM, trait d'union conditionnel, emoji, U+0085, U+2028 : sorties identiques entre Python et JavaScript, pour N0 et N1 |
| N0 py, js | départage à compte égal par point de code en py, par `localeCompare` en js (relevé 27) | les deux trient sur `(−compte, orthographe normalisée, terme)`, comparaison de chaînes ordinaire, indépendante de la locale de l'environnement |
| N0 py, js | tri du sous-arbre entier à chaque frappe (constaté au relevé 7, non marqué) | classement mis en cache au nœud (`RANKED`) au premier appel ; un préfixe inconnu descend dans un nœud vide au lieu de rendre `None` |
| N1 py, js | mémoire quadratique en longueur de requête : 50 millions de caractères de clés pour une requête de 10 000 (relevé 44) ; lecture quadratique aussi (relevé 43) | `MAX_TYPED = 64` : seuls les 64 premiers caractères normalisés sont comptés et lus |

Lignes utiles après réparation : n0.py 36, n0.js 40, n1.py 29, n1.js 31.

## Sources consultées

- Unicode Standard Annex #15, https://www.unicode.org/reports/tr15/ : définit NFD et NFKD, cite NBSP → SPACE parmi les équivalences de compatibilité.
- Introduction to Information Retrieval, chapitre 3, https://nlp.stanford.edu/IR-book/html/htmledition/dictionaries-and-tolerant-retrieval-1.html : la correction orthographique des requêtes relève de la récupération tolérante, ce qui soutient l'`escalate_when` de N1.
- Elasticsearch, Suggesters, https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-suggesters : le suggesteur `completion` travaille par préfixe et accepte une option `fuzzy` pour les fautes de frappe.
- W3C ARIA APG, combobox, https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ : page existante, motif combobox avec liste de suggestions.

## À retester

- Les noms des tests démarqués ne disent plus ce qu'ils prouvent, et quelques commentaires sont périmés :
  - n0.test.py : `test_infirme_un_caractere_nul_…`, `test_defaut_un_terme_de_100000_caracteres_…_fait_planter_la_barre_vide`, `test_defaut_un_caractere_invisible_…_vide_la_liste`, `test_defaut_une_espace_en_tete_…_vide_la_liste`, `test_defaut_a_compte_egal_l_ordre_est_alphabetique` ;
  - n0.test.js : « un terme de 100 000 caractères dans le journal fait planter la barre vide » (et son commentaire « collect est récursif »), « « strasse » ne retrouve pas « Straße » en JavaScript, alors que Python le retrouve » (et son commentaire), « un caractère invisible dans la saisie vide la liste », « une espace en tête de saisie vide la liste », et le commentaire « Python départage par point de code… voir son test DÉFAUT » ;
  - n1.test.py : `test_defaut_une_requete_collee_de_10000_caracteres_laisse_cinquante_millions_…` ;
  - n1.test.js : « une requête collée de 10 000 caractères laisse cinquante millions de caractères de clés », « le commentaire dit « a tab never occurs inside a prefix », une tabulation dans la saisie crée un clic fantôme ».
- Nouveaux comportements à démontrer : le classement est calculé une seule fois par nœud (deux appels successifs, le second ne reparcourt pas le sous-arbre) et reste juste pour des limites différentes sur le même nœud ; une espace en queue de saisie est ignorée ; « ẞ », « ς » en fin de mot et une ligature « ﬁ » donnent la même normalisation dans les deux langages ; `MAX_TYPED` : une saisie de 65 caractères et une de 64 comptent la même clé la plus longue ; un tri à compte égal sur deux termes dont l'orthographe normalisée est identique départage sur le terme d'origine.
- Borne à redécouvrir si le testeur le juge utile : latence de la barre vide sur un index de 100 000 termes au premier appel puis aux suivants.

## Pour l'orchestrateur

- Écart résiduel connu entre les deux langages, non corrigé pour garder l'extrait court : Python découpe et compare par point de code, JavaScript par unité de code. Il ne se voit qu'avec des caractères hors du plan multilingue de base (emoji) : départage à compte égal contre un caractère entre U+E000 et U+FFFF, et coupure à `MAX_TYPED` au milieu d'un emoji en N1.
- `latency: "<1 ms"` est gardé pour N0 : il vaut pour chaque frappe une fois le nœud classé. Le premier appel sur la barre vide d'un gros index coûte le tri de l'index entier, une fois par processus.
