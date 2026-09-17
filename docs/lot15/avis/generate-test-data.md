# generate-test-data — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs generate-test-data` : vert, 3 py, 3 js.

### Raisons du refus

1. **[pertinence technique]** `n0.py` / `n0.js` et `n1.py` / `n1.js`, `draw`.
   La valeur d'une cellule est `FNV-1a(seed ␟ field ␟ row) % n`. Les bits de
   poids faible de FNV-1a sont mauvais : le dernier octet haché est le dernier
   chiffre du numéro de ligne, et le préfixe `seed ␟ field` est identique pour
   toute la colonne. Le bit de poids faible du résultat ne dépend donc que de la
   parité de ce dernier chiffre, à une constante de colonne près. Exécuté :

   ```python
   generate_rows({"plan": {"type": "choice", "values": ["free", "pro"]}}, 40, "demo")
   # plan : p f p f p f p f p f f p f p f p f p f p p f …   (alternance stricte)
   generate_rows({"type": "int", "min": 1, "max": 4} …)
   # qty  : 3 2 1 4 3 2 1 4 3 2 4 1 2 3 4 1 …                 (période 4)

   rows = generate_rows({"a": {"type": "choice", "values": ["x", "y"]},
                         "b": {"type": "choice", "values": ["x", "y"]}}, 10000, "s")
   Counter((r["a"], r["b"]) for r in rows)
   # {('y', 'x'): 5000, ('x', 'y'): 5000}      ← ('x', 'x') et ('y', 'y') n'existent jamais
   ```

   Même résultat avec `sample_rows` en N1 sur deux colonnes catégorielles à
   deux modalités. Deux colonnes que la docstring dit « drawn independently »
   sont parfaitement anticorrélées : un test sur « client pro **et** VIP » ne
   trouve **aucune ligne**, quelle que soit la taille du jeu. C'est exactement
   le bug de couverture que la fiche reproche aux autres approches, fabriqué
   par le générateur lui-même. Et le `breaking_point` de N1 (« près d'une ligne
   sur deux associe une ville à un code postal qui n'est pas le sien », « une
   sur vingt annonce Nantes avec un code postal parisien ») est mesuré sur ce
   générateur biaisé : ses proportions ne sont pas celles d'un tirage
   indépendant.

   Ce qu'il faut faire : passer le haché dans une fonction de finalisation
   avant tout modulo — le `fmix32` de MurmurHash3 (trois décalages, deux
   multiplications, entiers 32 bits, faisable à l'identique en JavaScript avec
   `Math.imul`) — ou hacher une chaîne où le numéro de ligne n'est pas en
   dernier. Ajouter, en Python et en JavaScript, un test d'indépendance : deux
   colonnes `choice` à deux valeurs sur dix mille lignes produisent les quatre
   combinaisons, chacune entre 20 % et 30 % ; une colonne à deux valeurs n'a
   pas de période 2 sur les cent premières lignes. Recalculer ensuite les
   proportions citées dans le `breaking_point` de N1 et les attendus figés des
   tests. C'est fait quand le tableau de contingence ci-dessus a ses quatre
   cases.

### Remarques non bloquantes

- `escalate_when` de N0 (« la donnée réelle avait une forme que le générateur
  ne produit jamais ») envoie vers N1, qui tire des distributions observées :
  N1 ne produit pas davantage l'étiquette après un plus dans l'adresse du
  `breaking_point`, puisqu'il ne tire que des valeurs d'une table fournie. La
  réponse à ce point de rupture est la génération par propriétés — Hypothesis,
  cité en `further_reading` — qui cherche justement les formes qu'on n'a pas
  prévues. Le dire en une phrase dans `escalate_when` rendrait l'échelle
  cohérente ; N1 répond à une autre question (des proportions réalistes).
- Le choix d'un générateur écrit à la main plutôt que Faker est défendu par la
  parité entre langages ; Faker prévient lui-même que la sortie d'une graine
  peut changer d'une version à l'autre. Une phrase le dirait et éviterait la
  question que tout lecteur se pose.
- N1, `draw` n'échappe pas le séparateur dans la graine et le nom de champ,
  contrairement à N0 : deux clés distinctes peuvent se confondre. Rare, mais
  N0 prouve que le correctif tient en une ligne.

### Ce qui est solide

- Le `scenario` a le bon angle : la qualité première d'un jeu de test est
  d'être rejouable, pas crédible, et c'est sourcé.
- Une valeur tirée par cellule (graine, champ, ligne) plutôt qu'un flux, pour
  qu'un champ ajouté ne décale pas les autres : c'est une vraie leçon
  d'exploitation, bien expliquée.
- Le `breaking_point` de N3 (du JSON valide et faux, clé renommée, doublon) est
  démontré, et l'extrait vérifie ce qu'il a demandé au lieu de se contenter
  d'analyser le JSON.
- Le bloc `regulatory` de N0 dit la chose juste et rarement dite : une valeur
  réelle écrite dans le schéma ressort telle quelle.
