# aggregate-a-column-of-data — avis du relecteur

## Tour 1 — ACCEPTÉE

Fiche exemplaire, et la mieux mesurée du lot. J'ai rejoué ses trois
affirmations chiffrées, sans rien emprunter à ses tests :

- sur les six montants de la fiche, `sum(float(v) for v in …)` rend bien
  **244.98000000000002** là où la somme exacte est `244.98` ;
- la somme compensée de Kahan, réimplémentée à la main, rend **exactement la
  même valeur fausse**, et `math.fsum` aussi. L'explication de la fiche est la
  bonne et elle est vérifiable : l'erreur n'est pas dans l'accumulation, elle
  est dans la représentation — `83.87` n'est déjà pas 83,87 en binaire, donc
  aucune compensation de l'accumulation ne la rattrape ;
- sur quatre mille colonnes de trois à quarante montants tirées au hasard, la
  somme flottante diffère de la somme exacte **7,0 %** du temps, et **aucun
  centime** n'est déplacé après arrondi à deux décimales. Les deux chiffres du
  rapport de lot sont justes, y compris celui qui dément l'affirmation de
  départ.

Qu'une affirmation ait été abandonnée en route parce que la mesure l'a
démentie — la somme flottante ne « perd » pas de centimes — et que la fiche
publie à la place ce qui est vrai et plus intéressant, c'est le meilleur
moment du lot.

J'ai aussi passé seize cas limites aux deux extraits — colonne vide, colonne
sans aucun nombre lisible, négatifs, zéro négatif, `0.005`, vingt chiffres
avant la virgule, `1e3`, `3.`, `.5`, espace insécable en fin de valeur, et les
deux conventions croisées. **Parité complète sur les seize**, et la somme de
`99999999999999999999.99 + 0.01` est exacte, ce qu'aucun flottant ne donnerait.

### Remarques non bloquantes

1. **`-0.00` perd son signe.** `aggregate(["-0.00"])` rend `sum: "0.00"` et
   `minimum: "0.00"`. C'est arithmétiquement juste et typographiquement
   discutable dans une colonne de mouvements bancaires, où un `-0,00` signale
   un arrondi à la baisse. Sans conséquence, mais à savoir.

2. **Une colonne sans aucun nombre lisible et une colonne vide se
   ressemblent.** Les deux rendent `sum: null` et `reason: null` ; seul
   `skipped` les distingue. Le `reason` est le champ que la fiche utilise
   partout ailleurs pour cela ; une valeur y serait cohérente.

3. **`minimum` et `maximum` sont réécrits à l'échelle de la colonne.**
   `["-5", "3", "-0.5"]` rend `minimum: "-5.0"`. La docstring dit « read as the
   digits that were written » : c'est vrai de la lecture, pas du rendu. Une
   phrase le dirait.

4. **R11 — `breaking_point` de 117 mots et trois phrases.** C'est le plus long
   du lot. Son contenu est juste et important — la moyenne porte sur les lignes
   lues, une ligne vide n'est ni un zéro ni rien —, mais la troisième phrase et
   la moitié de la deuxième appartiennent à la docstring. Voir la synthèse.

### Ce qui est solide

- Le choix du point de rupture est le bon, et ce n'était pas le choix facile :
  ce qui casse en premier sur un fichier réel n'est pas le flottant, c'est la
  ligne qui n'est pas un nombre — et la moyenne qui porte sur une base que
  personne n'a comptée. La démonstration du flottant, plus spectaculaire, est
  restée au verdict, à sa place.
- Toute ligne illisible revient avec son numéro et sa raison, et les raisons
  sont distinctes : `empty`, `not a number`, `not text`,
  `written with « . » as the decimal sign`. Cette dernière est la meilleure du
  lot — une valeur écrite avec l'autre signe décimal est refusée et comptée,
  jamais mal lue. C'est R2 dans sa forme la plus aboutie.
- Le défaut de convention décimale est acceptable **parce qu'il ne peut pas se
  tromper en silence**, et le rapport de lot en fait une nuance explicite de la
  règle « pas de défaut » de la fiche 17. Deux fiches, deux traitements,
  une raison écrite : c'est ainsi qu'un catalogue se tient.
- Les entiers mis à l'échelle, `Decimal` d'un côté et `BigInt` de l'autre,
  avec les montants rendus en chaînes de chiffres : la seule façon d'obtenir
  deux extraits qui répondent la même chose, et elle tient jusqu'à vingt
  chiffres.
- La moyenne rendue deux décimales au-delà de la donnée, avec la règle
  d'arrondi annoncée, **et** la somme exacte et le compte à côté pour qui veut
  arrondir autrement. C'est exactement ce qu'on attend d'une bibliothèque
  qu'on met en production.
- L'`escalate_when` est juste et modeste : quand la colonne ne tient plus en
  mémoire, c'est la même addition, faite par la base de données qui détient
  déjà les lignes.
