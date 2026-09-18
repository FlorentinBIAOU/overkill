# Diagnostic — la CI rouge sur main, `npm run check` vert en local

Établi le 18 septembre 2026, sur `96f77a9`. Ce document ne corrige rien : il
dit ce qui échoue, pourquoi, et ce que coûterait chaque manière d'en sortir.
Les décisions restent à prendre.

---

## En bref

- **Le test JavaScript qui échoue** est
  `search-in-your-own-documents/n0.test.js:125`, « Node 22 livre node:sqlite,
  derrière un drapeau avant 22.13.0, et sa version embarquée n'a pas FTS5 ».
  Il échoue à la ligne 141 : `CREATE VIRTUAL TABLE … USING fts5` **réussit** sur
  le coureur.
- **Deux causes différentes, aucune n'est un tirage non fixé :**
  - `search-in-your-own-documents` dépend de la **version de Node**. La CI
    installe `node-version: '22'`, c'est-à-dire la dernière 22 (22.23.2 sur les
    runs observés), et le SQLite qu'elle embarque a FTS5 depuis Node 22.16.0.
    La machine de travail est en 22.12.0, qui ne l'a pas. L'affirmation de la
    fiche est fausse pour toute Node 22 publiée depuis mai 2025.
  - `detect-spam-in-contact-form` dépend du **processeur**. Huit n-grammes de
    « cheap » ont une contribution **identique au bit près**, et le test en garde
    quatre sur huit avec un `np.argsort` non stable. numpy choisit son algorithme
    de tri selon le jeu d'instructions : en AVX2 (la machine de travail),
    « cheap » est dans les cinq premiers ; en AVX-512, il n'y est pas. L'échec
    est **intermittent** sur GitHub : même code, rouge sur certains runs et vert
    sur d'autres, selon la machine attribuée.
- **Le même genre d'hypothèse ailleurs** (détail en fin de document) :
  - **deux autres tests** ont déjà cassé sur le coureur pour un seuil de temps,
    et ont été desserrés ou retirés sans que la cause soit nommée ;
  - **dix tests de temps** échouent quand l'horloge compte dix fois plus vite,
    donc violent la règle T7 de la charte des tests, dont **un** échoue dès trois
    fois ;
  - **vingt tests** exigent qu'un paquet (`openai`, `transformers`…) soit
    **absent** de l'environnement ;
  - **un test** attrape un vrai bogue de Node 24.0 à 24.12, qui casserait la
    CI si elle passait à Node 24.
  - Côté calcul, en revanche, rien d'autre ne bouge : ni sous AVX-512, ni avec
    un autre noyau BLAS, ni avec une autre graine de hachage, ni en UTC.

---

## Pourquoi le journal ne nommait pas le test

Le journal complet (`gh run view 35311250574 --log`) ne le nomme pas non plus.
La troncature ne vient pas de GitHub, elle vient du dépôt :
`scripts/test-snippets.mjs:123` ne garde que les **dix-huit dernières lignes**
de la sortie d'une fiche en échec (`.slice(-18)`). Avec le rapporteur TAP de
`node --test`, ces lignes sont le récapitulatif final et le dernier test passé
(« ok 130 »). Le test en échec (« not ok 7 ») est plus haut, hors de la fenêtre.

Le test a été nommé en le reproduisant : Node 22.23.2 officiel, même garde
réseau, même commande que le script.

```
$ node-v22.23.2/bin/node --import ./content/snippets/_harness/no-network.mjs \
    --test content/snippets/search-in-your-own-documents/n*.test.js
not ok 7 - Node 22 livre node:sqlite, derrière un drapeau avant 22.13.0, et sa version embarquée n’a pas FTS5
  location: '…/search-in-your-own-documents/n0.test.js:125:1'
  error: 'Expected "actual" to be strictly unequal to: 0'
  …n0.test.js:141:10
# pass 129
# fail 1
```

La même troncature a masqué un troisième échec JavaScript, dans
`translate-interface-strings` (run 35242180477, voir l'inventaire).

---

## Test 1 — `search-in-your-own-documents`, n0.test.js:125

### Ce qui échoue

```js
const flagged = spawnSync(process.execPath, ['--experimental-sqlite', '-e',
  "…new DatabaseSync(':memory:').exec('CREATE VIRTUAL TABLE t USING fts5(a)')"]);
assert.notEqual(flagged.status, 0);                 // ligne 141 : échoue
assert.match(flagged.stderr, /no such module: fts5/);
```

Le test démontre la phrase de la docstring de `n0.js` et de `doc.fr.yaml:43` :
« Node 22 ships `node:sqlite` […], but its bundled SQLite has no FTS5 module, so
there is nothing to call from a plain `node` process ». Sur le coureur, la table
FTS5 se crée, le processus sort en 0, l'assertion tombe.

### Pourquoi

Le SQLite embarqué par Node a changé d'options de compilation. Relevé sur les
binaires officiels :

| Node | SQLite embarqué | FTS5 |
|---|---|---|
| 22.12.0 (machine de travail) | 3.47.0 | non |
| 22.13.0, 22.14.0 | 3.47.2 | non |
| 22.15.0 | 3.49.1 | non |
| **22.16.0** | 3.49.1 | **oui** |
| 22.18.0, 22.20.0 | 3.50.x | oui |
| 22.23.2 (coureur) | 3.51.3 | oui |
| 24.11.1, 24.21.0 | 3.50.4, 3.53.4 | oui |

22.15.0 et 22.16.0 embarquent le même SQLite 3.49.1 : c'est l'activation du
module à la compilation qui a changé, pas la version de SQLite.

`.github/workflows/ci.yml` demande `node-version: '22'`, que `setup-node` résout
vers la dernière 22 publiée. Le dépôt n'a ni `.nvmrc` ni version exacte ;
`package.json` déclare `engines: ">=22.12"`. La machine de travail est restée
en 22.12.0, **la seule famille de versions où le test passe**. Le test ne dépend
ni de l'architecture, ni de l'ordre de parcours, ni d'un tirage : il dépend de
la version de Node, et il la vérifie lui-même (`assert.equal(major, 22)`).

Ce n'est pas une régression de l'environnement. Le dernier run vert de main
(34936136729, 15 septembre, 06:15) tournait **déjà** sous Node 22.23.2. Le test
a été écrit plus tard le même jour (`43d717e`) et **n'a jamais passé en CI** :
il échoue dans chacun des dix runs relus qui ont atteint `test-snippets` depuis.

### Sur l'image `node:24`

Je n'ai pas pu reproduire le « passe dans une image node:24 avec npm ci ». Dans
l'image `node:24` présente sur la machine (Node 24.21.0), le même test échoue
deux fois : sur `assert.equal(major, 22)`, puis sur FTS5, présent là aussi.
Sans Python dans l'image, `test-snippets` s'arrête en code 1 avant la première
fiche. Il faudrait la commande exacte de cet essai pour savoir ce qui a été
exécuté.

### Options

**A. Épingler Node en CI sur 22.12.0** (et poser un `.nvmrc`).
Remet la CI au vert sans toucher à la fiche. En contrepartie :
- la CI tourne sur une version de décembre 2024, sans les correctifs de
  sécurité publiés depuis ;
- l'affirmation publiée reste fausse pour un lecteur sur une Node 22 à jour ;
- le passage à Node 24 est bloqué par construction (`major === 22`).
C'est cacher le constat, pas le corriger.

**B. Récrire la phrase et le test sur la vérité par version.**
Par exemple : « avant 22.16, le SQLite embarqué n'a pas FTS5 ; à partir de
22.16, il l'a ». Le test prend la forme de la branche `minor < 13` qui existe
déjà. En contrepartie :
- l'argument de la fiche tombe à partir de 22.16. « Rien à appeler depuis
  `node` » n'est plus vrai : le N0 JavaScript peut interroger une vraie table
  FTS5, comme le N0 Python ;
- la réimplémentation manuelle du BM25 dans `n0.js` devient un choix à
  justifier, plus une nécessité. C'est une décision éditoriale.

**C. Réécrire le N0 JavaScript sur `node:sqlite` et FTS5**, avec
`engines >= 22.16`.
Aligne les deux langages sur le même SQL et supprime l'écart de fond. En
contrepartie :
- c'est une réécriture de l'extrait et de ses tests ;
- l'essai interactif importe `n0.js` tel quel **dans le navigateur**
  (`content/tryouts/live/search-in-your-own-documents.js`), où `node:sqlite`
  n'existe pas : l'essai perdrait « exactement ce que la fiche affiche », ou
  devrait garder une réimplémentation à part ;
- `node:sqlite` est encore expérimental en 22 : il affiche un
  `ExperimentalWarning` ;
- les scores attendus (`0.7235`, `3.3722`…) sont à revérifier contre la vraie
  table.

**D. Retirer l'affirmation de la fiche, et donc le test.**
Le plus court. En contrepartie, la fiche ne dit plus pourquoi le N0
JavaScript n'utilise pas SQLite, alors qu'un lecteur se posera la question.

Quelle que soit l'option, le fait que la version de Node en CI ne soit pas
celle de la machine de travail reste à trancher à part (voir « Environnement »
plus bas).

---

## Test 2 — `detect-spam-in-contact-form`, n1.test.py:167

### Ce qui échoue

```python
contributions = row * classifier.coef_[0]
names = vectoriser.get_feature_names_out()
top = [names[i] for i in np.argsort(contributions)[::-1][:5]]
assert top[0] == "ran" and "cheap" in top          # ligne 167
```

### Pourquoi

Sur la phrase `VERDICT_SOLICITATION`, les dix plus fortes contributions sont :

| trait | contribution |
|---|---|
| `ran` | 0.036498… |
| `cheap`, `chea`, `che`, `eap`, `␣che`, `␣chea`, `heap`, `hea` | **0x1.1a7099231bd4ap-5**, pour les huit |
| `␣ra` | 0.031706… |

Les huit n-grammes de « cheap » sont **exactement égaux**, au bit près. La
raison est structurelle : dans le jeu d'entraînement, ils apparaissent toujours
ensemble (« cheap » est le seul mot qui les porte). Leurs colonnes de la
matrice TF-IDF sont donc identiques, et une régression logistique régularisée
leur donne le même poids. Les huit ex æquo occupent les rangs 2 à 9. Le test
coupe à 5 : il en garde quatre, et exige que « cheap » soit du nombre.

Lesquels sont gardés dépend de l'ordre dans lequel `np.argsort` (tri rapide
par défaut, **non stable**) range des valeurs égales. Depuis numpy 2, ce tri
est vectorisé (x86-simd-sort) et **choisi à l'exécution selon le processeur**.
Mesuré sous l'émulateur Intel SDE 10.13 :

| Processeur simulé | Jeu retenu | 5 premiers | Test |
|---|---|---|---|
| machine de travail (Core Ultra 7 258V, AVX2) | AVX2 | ran, **cheap**, chea, che, eap | passe |
| Haswell (`-hsw`) | AVX2 | ran, **cheap**, chea, che, eap | passe |
| AVX2 désactivé (`NPY_DISABLE_CPU_FEATURES`) | base | ran, che, hea, ␣chea, **cheap** | passe |
| Skylake-X (`-skx`) | AVX-512 | ran, heap, ␣che, ␣chea, hea | **échoue** |
| Ice Lake (`-icx`) | AVX-512 | idem | **échoue** |
| Sapphire Rapids (`-spr`) | AVX-512 | idem | **échoue** |

Sous `-skx`, le vrai pytest de la fiche reproduit exactement l'échec de la CI,
et lui seul. La machine de travail n'a pas d'AVX-512 (Lunar Lake). Une partie
des coureurs GitHub en a (Xeon récents, EPYC Zen 4), une autre non (EPYC Zen 3).
Ce que les journaux ne disent pas, c'est le processeur. Tout le reste
concorde :

- **l'échec est intermittent à code identique.** Le dossier de la fiche a le
  même arbre git (`4c5d013`) dans les runs 35238101308 et 35240291917 (rouges
  sur ce test) et dans les runs 35238554658 et 35242180477 (verts sur ce test).
  Sur les sept runs de la branche lot15 relus, le test apparaît dans quatre ;
- les versions ne sont pas en cause : scikit-learn 1.7.2 et numpy 2.3.4 des deux
  côtés, comme annoncé ;
- l'égalité n'est pas un effet d'arrondi qui varierait avec la bibliothèque
  BLAS : les poids viennent d'une matrice creuse, et cinq noyaux OpenBLAS
  forcés (Haswell, Zen, Sandybridge, Nehalem, Prescott) donnent le même
  résultat.

Le premier trait, `ran`, est hors de cause : il devance le groupe de 6 %.

### Options

**A. Rendre l'assertion consciente des ex æquo.** Garder `top[0] == "ran"` et
remplacer « `cheap` dans les cinq premiers » par « la contribution de `cheap`
est au moins égale à la cinquième plus grande ». Même affirmation,
déterministe sur tous les processeurs, aucun changement de fiche. En
contrepartie, le test ne montre plus une liste imprimée telle que le lecteur
la verrait.

**B. Trier de façon stable** (`np.argsort(…, kind="stable")`). Mesuré : le
tri stable donne `ran, heap, hea, eap, cheap` sur tous les processeurs essayés,
donc le test passerait. En contrepartie, « cheap » n'y entre que par sa
**place dans le vocabulaire** : il sort cinquième sur huit ex æquo. Un message
d'entraînement de plus renumérote les traits et le refait tomber. Un départage
par nom (`sorted(key=(-contribution, nom))`) l'exclut déjà : `ran, ␣che, ␣chea,
che, chea`. C'est déterministe, mais pas robuste.

**C. Montrer les contributions par mot, pas par n-gramme.** Sommer les
contributions des n-grammes d'un même mot, ou regrouper les colonnes
identiques avant de classer. C'est plus fidèle à « the features that pushed a
message over the line » pour un humain qui lit la liste. En contrepartie,
c'est une modification de la fiche (docstring, texte, peut-être un utilitaire
dans `n1.py`), à relire comme telle.

**D. Changer la phrase d'exemple** pour qu'aucun groupe d'ex æquo ne soit
coupé par le rang 5. Non recommandé : cela tient tant que le vocabulaire ne
bouge pas.

**E. Neutraliser AVX-512 en CI** (`NPY_DISABLE_CPU_FEATURES`). Non recommandé :
la CI ne mesurerait plus ce que voit un lecteur sur une machine récente, et
l'extrait lui-même, s'il imprimait ses traits, donnerait un ordre différent
selon la machine.

Remarque valable pour toutes les options : la fiche invite le lecteur à
« imprimer les traits ». Sur ce modèle, il obtiendra une liste où des
n-grammes redondants se départagent au hasard du processeur. Si la fiche
montre un jour ce code, le problème du test devient celui du lecteur.

---

## Inventaire — les autres tests qui reposent sur un détail d'environnement

### Méthode

Chaque axe a été essayé pour de bon sur la totalité des extraits, pas seulement
relu :

| Axe | Comment | Résultat |
|---|---|---|
| Version de Node | suite JS complète sous 22.12.0, 22.23.2, 24.11.1 ; image `node:24` (24.21.0) | 1 test cassé (FTS5) + 1 latent sous Node 24 |
| Conditions du coureur | `test-snippets` complet, clone propre, Node 22.23.2, `TZ=UTC`, `LC_ALL=C.UTF-8` | seul FTS5 échoue |
| Processeur | suite Python complète sous SDE `-skx` (AVX-512), horloges figées pour neutraliser la lenteur de l'émulation | seul `detect-spam` échoue pour une raison de calcul |
| Python ↔ JS sous AVX-512 | pour les deux fiches où le côté Python passe par numpy (`route-support-tickets` n1, `rank-products-by-relevance` n1) : sorties Node enregistrées en natif, rejouées sous SDE | identiques |
| Noyau BLAS | 16 fiches numpy sous `OPENBLAS_CORETYPE` = Haswell, Zen, Sandybridge, Nehalem, Prescott | rien |
| Hachage | toutes les fiches Python sous `PYTHONHASHSEED` = 0, 1, 2, 3, 7, 42, 99, 1234 | rien |
| Temps | horloges (`perf_counter`, `monotonic`, `time`, `performance.now`, `Date.now`) accélérées ×2, ×3, ×5, ×10, trois passages chacun | 10 tests sous la marge de dix |
| Historique | relecture des journaux des runs de main et de lot15 du 15 au 18 septembre | 2 autres échecs d'environnement, déjà « réparés » |

Les échecs propres à l'émulation (sous-processus impossibles sous SDE, test de
rapport de durées sous horloges figées) ont été écartés un par un.

### 1. Seuils de temps — le gros du risque

**209 assertions de durée** (109 en Python, 100 en JavaScript) dans les
**25 fiches**. La charte des tests (règle T7) exige une marge de dix « sans
exception ». Elle dit aussi qu'« une classe de latence se justifie dans le
relevé, par une mesure écrite, jamais par une assertion serrée ».

**Déjà cassés sur le coureur**, et réparés sans que la cause soit nommée :

| Test | Run | Borne | Mesuré | Devenu |
|---|---|---|---|---|
| `tag-articles-by-topic/n0.test.py`, « un article se traite en moins d'une milliseconde » | 35238101308 | 1 ms | ~0,5 ms | borne portée à 100 ms (`754e1ac`) |
| `translate-interface-strings/n0.test.js`, « une recherche prend de l'ordre de dix millisecondes » | 35242180477 | 32 ms | ~21 ms | test retiré (`4154ac1`) |

Pour le second, le journal tronqué ne donne pas le nom. C'est le seul test de
la fiche qui cède sous horloge accélérée (entre ×10 et ×20), sa marge était de
1,5, et le même arbre `translate` est vert dans quatre autres runs. C'est
**très probablement** lui ; ce n'est pas démontré.

**Encore en place et sous la marge de dix** (échec reproductible, trois
passages sur trois, sauf mention) :

| Test | Casse à | Marge |
|---|---|---|
| `moderate-user-comments/n1.test.py:207`, une note en moins d'une milliseconde | ×3 | **< 3** |
| `mask-personal-data-in-chat/n1.test.py:222`, une décision en moins d'une milliseconde | ×5 | 3 à 5 |
| `tag-articles-by-topic/n1.test.js:306`, un fonds de trois cents articles ne s'entraîne pas (une époque < 1 s) | ×5 | 3 à 5 |
| `route-support-tickets/n1.test.js:208`, 630 tickets s'entraînent vite | ×5 (1 sur 3), ×10 | ~5 |
| `forecast-weekly-sales/n1.test.py:378`, ajustement et prévision en moins d'une milliseconde | ×10 | 5 à 10 |
| `parse-address-into-fields/n1.test.py:179`, une adresse en moins d'une milliseconde | ×10 | 5 à 10 |
| `generate-test-data/n0.test.py:430`, cinquante mille lignes terminent vite | ×10 | 5 à 10 |
| `tag-articles-by-topic/n1.test.py:297`, un fonds de trois cents articles s'entraîne | ×10 | 5 à 10 |
| `find-duplicate-records/n1.test.js:124`, deux mille fiches dans une borne large | ×10 | 5 à 10 |
| `show-similar-articles/n1.test.js:330`, mille articles de deux cents mots | ×10 | 5 à 10 |

Ces marges sont celles de la machine de travail, un processeur récent. Un
coureur partagé est plus lent et plus bruité : la marge réelle en CI est
inférieure. Les quinze assertions « en moins d'une milliseconde » (`min(runs) <
0.001`, `best < 1`…) sont par nature les plus exposées, même quand elles passent
à ×10.

Options, de la plus locale à la plus structurelle :

- **Appliquer T7 aux dix tests** : bornes multipliées jusqu'à la marge de dix
  mesurée. C'est rapide et conforme à la charte. En contrepartie, une borne
  de 10 ms ne démontre plus « moins d'une milliseconde » : le titre du test
  ment ou doit changer.
- **Sortir les classes de latence des assertions**, comme la charte le
  demande : la mesure va au relevé, le test ne garde qu'une borne
  d'effondrement (secondes). Cela concerne les quinze assertions sous la
  milliseconde, plus celles de l'ordre de la dizaine de millisecondes. C'est
  le plus sûr. En contrepartie, la fiche perd la démonstration automatique de
  sa latence publiée : elle devient une mesure écrite.
- **Remplacer le temps par un compte** quand ce qu'on veut attraper est une
  complexité (quadratique, retour arrière) : compter les appels ou comparer
  deux tailles, comme le fait déjà `mask-personal-data-in-chat/n0.test.py:315`
  avec un rapport. Plus robuste, mais demande une réécriture test par test.
- **Isoler les tests de temps** (marqueur pytest, fichier à part) et les
  lancer en CI sans bloquer. Protège la CI. En contrepartie, un effondrement
  réel ne bloque plus rien.

### 2. Paquets qui doivent être absents — 20 tests

Onze tests Python (`pytest.raises(ModuleNotFoundError, match="openai")`, idem
pour `transformers`, `sentence_transformers`, `gcld3`, `postal`) et neuf tests
JavaScript (`error.code === 'ERR_MODULE_NOT_FOUND'` sur `openai`,
`@huggingface/transformers`) démontrent « le client est injecté, et par défaut
c'est le vrai » **en comptant sur l'absence** du paquet dans `.venv-tools` ou
`node_modules`. Aucun n'a encore cassé. Il suffit d'un
`pip install transformers` dans le venv d'un contributeur, ou d'une dépendance
qui l'amène par transitivité, pour qu'ils échouent, ou pire, tentent de charger
un modèle.

Le dépôt a déjà la forme robuste, deux fois :
`moderate-user-comments/n2.test.py:216` force l'absence avec
`monkeypatch.setitem(sys.modules, "transformers", None)`, et
`search-in-your-own-documents/n2.test.js` intercepte `@huggingface/transformers`
par un crochet de chargement. Options :
- **aligner les vingt tests sur ces deux formes** : un changement mécanique, et
  le test ne dépend plus du contenu du venv ;
- **ou garder l'hypothèse et la rendre explicite** : `test-snippets` vérifie
  au démarrage que ces paquets sont absents, comme il vérifie déjà que numpy est
  présent (`verifierPython`). Moins de changements, mais l'environnement reste
  une précondition.

### 3. Version de Node — 2 tests

- `search-in-your-own-documents/n0.test.js:125` : le test 1 ci-dessus.
- `convert-messy-csv-to-clean-data/n0.test.js:178`, « cp1252 et non Latin-1,
  pour le signe euro » : **passe** sous 22.12.0, 22.23.2 et 24.21.0, **échoue**
  sous Node 24.0.0 à 24.12.0 (essayés : 24.0, 24.5, 24.8, 24.10, 24.11.1,
  24.12). Ces versions décodent l'octet 0x80 en U+0080 au lieu de « € » avec
  `TextDecoder('windows-1252')`. Ce test **a raison** : il attrape un vrai
  bogue de Node, que `n0.js:60` subirait aussi. Il n'y a rien à changer dans le
  test. Il faut seulement savoir que la CI cassera ici si elle passe à Node 24
  sur une version de ce créneau.

### 4. Ex æquo et processeur — 1 test

`detect-spam-in-contact-form` (test 2 ci-dessus). Les deux autres classements
par `argmax` du dépôt ont été vérifiés :
- `moderate-user-comments/n1.test.py:172` : le maximum `arn` est unique, et
  `np.argmax` rend toujours le premier indice ;
- `forecast-weekly-sales/n1.test.py:340` : tolère une plage de semaines.
Aucun ne dépend de l'ordre des ex æquo.

### 5. Ce qui a été cherché et n'est pas en cause

Fuseau horaire et locale (suite complète en UTC et `C.UTF-8`), graine de
hachage de Python, noyau BLAS, ordre du système de fichiers (aucune lecture de
répertoire non triée dans les tests), hasard non fixé (le seul `Math.random`
teste justement qu'il ne prend pas de graine, avec une probabilité de faux
échec négligeable), accord numérique Python ↔ JavaScript sous AVX-512.

---

## Environnement — les écarts entre la machine de travail et le coureur

| | Machine de travail | Coureur (runs observés) |
|---|---|---|
| Node | 22.12.0 | 22.23.2, **non épinglé** (`node-version: '22'`) |
| Python | 3.13.3 | 3.13.15 (`python-version: '3.13'`) |
| Processeur | Core Ultra 7 258V, AVX2, sans AVX-512 | variable selon la machine attribuée, non journalisé |
| Dépendances Python directes | épinglées, identiques | identiques |
| Dépendances Python transitives | scipy 1.18.1, threadpoolctl 3.6.0, joblib 1.6.0 | **non épinglées** : threadpoolctl est passé de 3.6.0 à 3.7.0 entre le run du 15 et celui du 17 septembre |
| Fuseau | Europe/Paris | UTC |
| Dictionnaire de `check-french` | hunspell-fr-classical 1:7.0-3 | 1:7.0-1 (paquet Ubuntu du coureur) |

Aucun de ces écarts, hormis Node et le processeur, n'explique un échec
aujourd'hui. Le seul échec de `check-french` de la période (run 34958061095,
« stack » dans `docs/sprints/15-fiabiliser-les-fiches.md`) se reproduit à
l'identique sur la machine de travail : il ne venait pas du dictionnaire.
`check-french` ne se tait que si spylls ou le dictionnaire manquent, ce qui
n'est pas le cas ici. Chacun peut en expliquer un demain. Options, indépendantes des
corrections de tests :

- **épingler Node à une version exacte**, dans `ci.yml` et dans un `.nvmrc`
  que la machine de travail suit aussi. La CI et la machine voient la même
  chose. En contrepartie, chaque montée de version devient un commit
  délibéré ;
- **figer les transitives Python** (fichier de contraintes ou verrou
  `pip-compile`). Même logique, même coût ;
- **faire écrire l'environnement par la CI** : une étape qui imprime `lscpu`,
  `node -p process.versions`, `numpy.show_config()`. Ça ne corrige rien, mais
  le prochain diagnostic commencera par une ligne de journal au lieu d'une
  émulation ;
- **faire citer par `test-snippets` les tests en échec** plutôt que les dix-huit
  dernières lignes (les lignes `not ok` et `FAILED`). Sans cela, chaque échec
  JavaScript restera anonyme dans les journaux.

---

## Pour reproduire

```sh
# Le test JavaScript, sous la Node du coureur
curl -sL https://nodejs.org/dist/v22.23.2/node-v22.23.2-linux-x64.tar.xz | tar xJ
node-v22.23.2-linux-x64/bin/node --import ./content/snippets/_harness/no-network.mjs \
  --test content/snippets/search-in-your-own-documents/n*.test.js

# Le test Python, sous un processeur AVX-512 simulé
# Intel SDE : https://www.intel.com/content/www/us/en/download/684897/
sde64 -skx -- .venv-tools/bin/python -m pytest content/snippets/detect-spam-in-contact-form

# L'ordre des ex æquo selon le jeu d'instructions, sans émulateur
NPY_DISABLE_CPU_FEATURES="AVX2 FMA3 AVX512F AVX512CD AVX512_SKX" \
  .venv-tools/bin/python -m pytest content/snippets/detect-spam-in-contact-form
# (passe aussi, mais avec un autre ordre des cinq premiers)
```

Les horloges accélérées sont un `conftest` et un module `--import` de quelques
lignes : `t0 + (maintenant − t0) × K` sur `perf_counter`, `monotonic`, `time`,
`performance.now` et `Date.now`. Ils n'ont pas été versés. Un test qui échoue à
×K a une marge inférieure à K sur la machine qui l'exécute.
