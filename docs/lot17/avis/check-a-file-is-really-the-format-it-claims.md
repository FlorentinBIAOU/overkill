# check-a-file-is-really-the-format-it-claims — avis du relecteur

## Tour 1 — REFUSÉE

Le cas est le bon, la thèse est la bonne — « d'où vient la réponse » plutôt
que « quelle est la réponse » —, et l'ouverture de l'archive ZIP pour aligner
`puremagic` sur `file-type` est du vrai travail d'exploitation. Le refus porte
sur une asymétrie de trois lignes qui fait mentir le champ le plus important du
rapport, sur l'entrée la plus banale qui soit.

### Raisons du refus

1. **`matches_claim` est faux sur `photo.jpeg`, dans les deux langages.**
   `n0.py:108-109` et `n0.js:80` appliquent la table `ALIASES` au **format
   détecté** (`jpeg` → `jpg`), et `_report` / `report` compare ensuite ce `jpg`
   à l'extension **réclamée**, laissée telle quelle. Mesuré :

   | `claimed_name` | `detected` | `matches_claim` |
   |---|---|---|
   | `photo.jpg` | `jpg` | `True` |
   | `photo.jpeg` | `jpg` | **`False`** |
   | `scan.tiff` | `tiff` | `True` |
   | `scan.tif` | `tiff` | **`False`** |

   Or la docstring écrit, à propos de ce champ : « a caller that logs a False
   there is looking at either a mistake or an attack ». `.jpeg` est
   l'extension que produisent l'export d'un téléphone Android, la plupart des
   appareils photo et `image/jpeg` lui-même. La fiche promet donc une alerte de
   sécurité, et la déclenche sur la moitié des photos téléversées. C'est une
   sortie fausse sur une entrée ordinaire, exactement ce que R2 interdit, et
   elle est d'autant plus gênante qu'elle est *bruyante du mauvais côté* : le
   journal se remplit de fausses tentatives d'attaque, et on cesse de le lire.

2. **Même asymétrie sur `allowed`, et là elle est silencieuse.**
   `allowed=("jpeg",)` — une liste blanche écrite avec le nom du type MIME,
   ce que fait n'importe qui — rend `allowed: False` sur un vrai JPEG, avec
   `detected: "jpg"` et `reason: None`. Aucun message, aucune raison : le
   formulaire refuse toutes les photos et rien dans le rapport ne dit
   pourquoi. Vérifié dans les deux langages.

   Correctif commun aux deux points : normaliser par `ALIASES` les trois
   côtés — le détecté, le réclamé et chaque entrée de `allowed` — dans
   `_report` / `report`. Trois lignes. On saura que c'est fait quand
   `sniff_file(JPEG, claimed_name="photo.jpeg", allowed=("jpeg",))` rendra
   `matches_claim: True, allowed: True`.

3. **Le test ne pouvait pas l'attraper, parce qu'il est écrit dans la forme du
   code.** `n0.test.py:82` construit le nom du fichier à partir du format
   attendu : `claimed_name=f"fichier.{attendu}"`, avec `attendu` pris dans les
   clés canoniques de `RECONNUS`. Le nom ne peut donc jamais porter un alias,
   et `ALIASES` — quatre entrées, dont deux sont les extensions les plus
   courantes du web — n'est exercée dans aucun sens. C'est le cas d'école de
   la règle T3. Ajouter au moins `photo.jpeg`, `scan.tif` et une liste blanche
   écrite en `jpeg` aux entrées banales, et au test de parité.

### Remarques non bloquantes

1. **`HEAD` promet de ne pas lire le fichier entier, et `_inside_zip` le lit.**
   Le commentaire de `n0.py:47-48` dit « reading more than this from an
   untrusted upload buys nothing and costs memory », puis la ligne 111 appelle
   `_inside_zip(bytes(data))`, qui recopie l'intégralité du téléversement en
   mémoire. C'est nécessaire — le répertoire central d'un ZIP est à la fin —,
   mais alors le commentaire doit le dire : la borne de quatre kilooctets vaut
   pour la signature, pas pour les conteneurs. Un plafond explicite sur la
   taille d'archive qu'on accepte d'ouvrir serait la suite logique (R8).

2. **`except Exception` autour de `puremagic.magic_string`** (`n0.py:104`).
   Défendable dans un chemin de téléversement — mieux vaut « non reconnu »
   qu'une pile —, mais un `# noqa: BLE001` n'est pas une justification : écrire
   quelles exceptions la bibliothèque lève réellement sur des octets tronqués,
   ou laisser le commentaire dire que la liste n'est pas documentée.

3. **R11 — `breaking_point` de 78 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- Le point de rupture est le bon et il est courageux : dire que les formats
  texte — CSV, JSON, SVG — ne sont pas lisibles par cette méthode, et qu'ils
  sortiront donc non autorisés *même quand ils sont ce qu'ils prétendent
  être*, c'est refuser de vendre une couverture qu'on n'a pas.
- Le détail des cent octets nuls rendus par `puremagic` comme un fichier de
  broderie Compucon-Singer est vrai, je l'ai rejoué : confiance 0,8, la même
  qu'un vrai PNG. C'est l'argument exact qui justifie la liste `KNOWN`, et il
  est mesuré plutôt qu'affirmé.
- `MIN_BYTES = 16` aligné sur la plus gourmande des deux tables, avec la
  raison écrite — répondre la même chose des deux côtés plutôt que répondre
  plus vite d'un côté. C'est la bonne façon de traiter une divergence entre
  langages.
- Le polyglotte est traité de face : `PNG + ZIP` est lu comme un PNG, il est
  autorisé si vous autorisez les images, et le test dit que c'est « une
  décision, pas un accident ». Beaucoup de fiches auraient tu le cas.
- Le `regulatory` qui rappelle que reconnaître un format n'est pas analyser
  son contenu, et l'`escalate_when` qui renvoie au bac à sable plutôt qu'à un
  niveau supérieur : la frontière du besoin est tenue.
