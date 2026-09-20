# validate-an-api-payload-against-its-contract — avis du relecteur

## Tour 1 — REFUSÉE

Le contenu est juste et les trois divergences fermées sont les bonnes : la
précédence du chemin exact, le `nullable: true` d'OpenAPI 3.0, le décompte des
propriétés en trop. Le point de rupture — un contrat ne sait pas additionner —
est vrai, utile et bien choisi. Le refus porte sur le cache, c'est-à-dire sur
la seule chose de cette fiche qui touche à l'exploitation, et qui est mesurée
à l'envers.

### Raisons du refus

1. **La clé du cache coûte plus cher que tout le reste, et elle est recalculée
   à chaque requête.** `n0.py:107` :
   `key = (json.dumps(document, sort_keys=True), pointer)` ; `n0.js:55` :
   `` key = `${JSON.stringify(document)}\u0000${pointer}` ``. Le document
   OpenAPI entier est sérialisé **à chaque appel**, sur ce que la fiche
   elle-même appelle « le chemin le plus chaud qui soit ». Mesuré sur un
   document de 129 Ko — quatre cents chemins, deux méthodes chacun, un schéma
   de quarante-deux propriétés : c'est un document d'API d'entreprise
   ordinaire, pas un cas extrême :

   | | temps par appel | dont la clé | validation seule |
   |---|---|---|---|
   | Python | **1,02 ms** | 0,92 ms (90 %) | 0,033 ms |
   | JavaScript | 0,279 ms | 0,227 ms (81 %) | — |

   La fabrication de la clé coûte **trente fois la validation qu'elle
   économise**. Et la progression est nette : sur le même code, 24 % du temps
   pour un document de 1 Ko, 41 % à 3 Ko, 62 % à 11 Ko, 90 % à 129 Ko.
   Correctif : ne pas dériver la clé du contenu. Le document est un objet que
   l'appelant charge une fois au démarrage — `id(document)` en Python, une
   `WeakMap` en JavaScript, ou, mieux, exposer une fonction qui compile le
   document et rend un validateur que l'appelant garde. On saura que c'est
   fait quand le temps par appel cessera de dépendre de la taille du document.

2. **La classe de latence publiée est fausse sur un document ordinaire.**
   `latency: "<1 ms"` pour N0. Sur le document de 129 Ko ci-dessus, Python met
   **1,02 ms** par requête. Le relevé mesure la latence sur `DOCUMENT`, le
   document de test, qui tient en deux chemins et quelques dizaines de lignes —
   soit trois ordres de grandeur en dessous de ce qu'une passerelle charge
   réellement. C'est la règle R7 : un réglage par défaut se juge sur ce qu'il
   produit un jour ordinaire, pas sur l'exemple qui l'illustre. Une fois le
   point 1 corrigé, la classe `<1 ms` redevient vraie et large ; en l'état,
   elle ne l'est que pour le document du test.

3. **« divise le temps par neuf cents côté JavaScript » mesure le mauvais
   écart.** `verdict_rationale`, fr et en. Le facteur compare « compiler à
   chaque appel » à « garder le compilé », sur un document minuscule. Sur un
   document réel, 81 % du temps restant est la clé : le gain annoncé n'est pas
   celui que le lecteur obtiendra. Le chiffre est en outre publié dans le corps
   de la fiche, où la charte interdit les chiffres de performance, et aucun
   test ne le tient. Le remplacer par la mesure qui compte — ce que coûte une
   requête, une fois le cache correct — et la laisser au relevé.

### Remarques non bloquantes

1. **`_match_path` départage deux gabarits par ordre alphabétique.**
   `n0.py:122`, `for template in sorted(paths)`. L'exact l'emporte, c'est
   l'essentiel et c'est testé ; mais quand deux gabarits de même longueur
   correspondent — `/factures/{id}` et `/{ressource}/{id}` —, c'est le tri des
   chaînes qui tranche, et il tombe juste par accident (`f` < `{`). Une règle
   écrite — le gabarit qui porte le moins de variables, puis le segment
   concret le plus à gauche — vaudrait mieux qu'une coïncidence d'ordre ASCII,
   d'autant que la fiche fait de la précédence un de ses trois arguments.

2. **`error_count` compte après dédoublonnage.** Le champ vaut `len(kept)`,
   c'est-à-dire le nombre d'erreurs **après** collapse des
   `additionalProperties` au même endroit. C'est cohérent avec le choix
   d'unifier les deux bibliothèques, mais la docstring ne le dit pas, et un
   appelant qui journalise `error_count` compte autre chose que les échecs du
   validateur. Une phrase suffit.

3. **R11 — `breaking_point` de 61 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- Le `regulatory` de cette fiche est le plus précis du lot : « Le rapport
  d'erreurs nomme les chemins fautifs, pas les valeurs : ce qu'il journalise ne
  contient pas le corps de la requête ». Et c'est vrai dans le code —
  `{"path", "rule"}`, sans message —, alors que la fiche voisine
  `validate-an-imported-file-against-a-schema` garde le message, qui porte la
  valeur, et le déclare aussi. Deux choix opposés, chacun assumé et chacun
  écrit : c'est exactement ce qu'on attend d'un catalogue.
- Le point de rupture est celui qu'on rencontre : une facture dont les trois
  montants ne s'additionnent pas et qui passe le contrat. Il dit la vraie
  frontière — la forme d'un côté, l'arithmétique de l'autre — et
  l'`escalate_when` en tire la bonne conséquence : cette règle vit dans le code
  métier et nulle part ailleurs.
- La précédence du chemin exact, avec `/factures/resume` comme exemple : c'est
  une faute réelle, silencieuse, qui valide une requête contre le mauvais
  schéma et répond oui. La nommer et la tester est un vrai service.
- Le `nullable: true` traduit à la main parce que les deux bibliothèques ne
  l'interprètent pas pareil — l'une l'honore, l'autre l'ignore et refuse un
  null que le contrat permet : c'est la bonne façon de fermer un écart entre
  langages, et le test met les deux comportements bruts côte à côte.
- Le document placé à la racine du schéma et désigné par un pointeur JSON, qui
  laisse les `$ref` se résoudre seuls : c'est la solution simple et correcte,
  là où beaucoup de code déréférence à la main et casse sur la récursion.
