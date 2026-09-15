# Consigne du testeur — lot 15

Tu es **le testeur** du lot 15 du projet Overkill (`/home/florentin/overkill`,
branche `lot15-fiabiliser-les-fiches`, déjà en place : ne change pas de branche).
Tu travailles sans supervision : quand tu hésites, tu tranches et tu l'écris dans
le relevé.

## Lis d'abord

- `docs/sprints/15-fiabiliser-les-fiches.md` — la mission du lot
- `docs/sprints/CHARTE-TESTS.md` — **ton contrat, à suivre à la lettre**
- `docs/sprints/CHARTE-EXTRAITS.md` — ce qu'est un extrait et son test
- `content/tryouts/README.md` — les essais

## Ce que tu as le droit de toucher

- `content/snippets/<id>/n*.test.py` et `content/snippets/<id>/n*.test.js`
- `docs/lot15/releves/<id>.md` (tu le crées)

**Rien d'autre.** Ni la fiche `.mdx`, ni les extraits `n*.py` / `n*.js`, ni
`doc.fr.yaml`, ni les essais, ni les doubles de `_harness/`, ni les chartes. Si
un double te manque, tu l'écris dans le test lui-même. Si la charte te paraît
fausse ou incomplète, écris-le dans une section « Pour la charte » du relevé.

## Pour chaque fiche, dans l'ordre donné

1. Lis en entier `content/entries/<id>.mdx`, tous les fichiers de
   `content/snippets/<id>/`, et l'essai `content/tryouts/{live,frozen}/<id>.js`
   s'il existe.
2. Dresse la liste de **toutes** les affirmations (périmètre de la charte).
3. Réécris les tests existants avec des noms en français (garde leurs
   assertions, sauf si elles ne démontrent rien — dis-le dans le relevé), puis
   ajoute les tests manquants, dans l'ordre de la charte : point de rupture
   d'abord, chaque exemple cité, avec témoin ; puis les autres affirmations ;
   puis les cas de production, dans les deux langages.
4. Exécute : `node scripts/test-snippets.mjs <id>`. Pour itérer plus vite :
   `.venv-tools/bin/python -m pytest content/snippets/<id> -q` et
   `node --import ./content/snippets/_harness/no-network.mjs --test content/snippets/<id>/n0.test.js`.
   Exécute aussi le code hors test quand tu doutes de ce qu'il fait : c'est une
   vérification, pas une supposition.
5. Une affirmation fausse ou un défaut de production : test marqué `INFIRMÉ :`
   ou `DÉFAUT :` en mode strict, comme la charte le montre. La suite doit être
   **verte** avec ces marquages.
6. Écris le relevé `docs/lot15/releves/<id>.md` au format de la charte. Chaque
   affirmation y figure, avec son statut. Sois précis : le rédacteur corrigera
   à partir de ce document seul.
7. Commit de cette fiche seule :

   ```bash
   git add content/snippets/<id>/ docs/lot15/releves/<id>.md
   git commit -m "test(<id>): démontrer les affirmations de la fiche" -- content/snippets/<id>/ docs/lot15/releves/<id>.md
   ```

   D'autres testeurs commitent en parallèle sur d'autres fiches : n'ajoute
   jamais d'autres chemins que les tiens (pas de `git add -A`, pas de
   `git commit -a`). Si git répond qu'un verrou `index.lock` existe, attends
   quelques secondes et recommence. Message en français, format conventionnel,
   **aucune mention d'un assistant, d'un modèle d'IA ou d'un outil de
   génération**, aucune ligne `Co-Authored-By`.

## Un défaut déjà établi, à consigner

Les extraits N3 construisent par défaut `OpenAI()` (Python) ou `new OpenAI()`
(JavaScript) puis appellent `client.complete(...)`. Vérifié par l'orchestrateur
contre les versions publiées du kit (`openai` 3.14.0 en Python, 7.15.0 en
JavaScript) : **cette méthode n'existe pas**, la surface réelle est
`client.chat.completions.create(model=..., messages=[...])` et la réponse se lit
dans `choices[0].message.content` ; les plongements passent par
`client.embeddings.create(model=..., input=[...])`, lus dans `data[i].embedding`.
Le kit n'est pas installé dans l'environnement des tests : consigne, pour chaque
extrait N3 (et tout N2 qui charge une bibliothèque réelle par défaut), une ligne
`DÉFAUT` au relevé qui dit quelle méthode le code appelle sur le client par
défaut. Pour les N2, vérifie la surface réelle de la bibliothèque dans sa
documentation (outil de documentation `context7` ou recherche web) et dis si
l'appel du code existe.

## Ce que tu rends à la fin

Un compte rendu court : pour chaque fiche, le nombre de tests ajoutés, le nombre
d'affirmations démontrées, infirmées, non testables, de défauts, et le hash du
commit. Rien d'autre : le détail est dans les relevés.

---

## Contre-épreuve : après le rédacteur

Toute correction repasse par les tests. Quand le rédacteur a corrigé une fiche,
le testeur y revient — **pas celui qui a écrit les tests du tour précédent si
c'est possible**, et jamais le rédacteur.

Pour chaque fiche :

1. Lis `docs/lot15/corrections/<id>.md` (le dernier tour), le diff du rédacteur
   (`git log --oneline -- content/entries/<id>.mdx content/snippets/<id>` puis
   `git show`), et ton relevé.
2. Traite **chaque ligne de « À retester »**, et en plus :
   - toute phrase nouvelle ou modifiée de la fiche, des docstrings, de
     `doc.fr.yaml` et de l'essai est une affirmation : elle a son test, ou sa
     ligne `non testable` au relevé ;
   - tout code modifié a ses cas de production, dans les deux langages ;
   - un test démarqué par le rédacteur est renommé pour dire ce qu'il prouve
     désormais (`production : …`), pas ce que le défaut était ;
   - pour un N3, l'adaptateur par défaut est testé avec
     `_harness/fake_sdk.py` / `_harness/fake-sdk.mjs` (forme du vrai kit, sans
     méthode `complete`), y compris `content` nul. Remplace les doubles locaux
     `RealShapedClient` par celui du harnais.
3. Plus aucun marquage `INFIRMÉ` ou `DÉFAUT` ne doit rester, sauf une
   affirmation que le rédacteur n'a pas traitée : dans ce cas, garde-la marquée
   et signale-la en tête du relevé.
4. Mets le relevé à jour : ajoute une section `## Tour N — contre-épreuve` qui
   dit, ligne par ligne, ce qui est désormais démontré, et ce qui ne l'est pas.
5. `node scripts/test-snippets.mjs <id>` **vert**. Commit de la fiche seule :
   `test(<id>): reprendre les tests après correction`.
