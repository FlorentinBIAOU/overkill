# estimate-the-cost-of-a-model-call — avis du relecteur

## Tour 1 — REFUSÉE

L'idée de la fiche est excellente et son abstinence est exemplaire : aucun
tarif nulle part, les deux prix en paramètres, un test qui relit le fichier
source pour vérifier qu'aucun symbole monétaire ni code de devise n'y figure,
et le `break_even_items` qui est bien, comme le dit le verdict, la question du
site entier réduite à une division.

Le refus porte sur l'arithmétique, c'est-à-dire sur la seule chose que cette
fiche a à faire.

### Raisons du refus

1. **Le coût par appel est arrondi avant d'être multiplié, et l'erreur est
   multipliée avec lui.** `n0.py:74-76` : `per_item` est arrondi à `scale`
   décimales, puis `total = per_item * items`. Mesuré, pour cent mille appels
   de 1 200 jetons en entrée et 300 en sortie, aux prix 0,15 et 0,60 par
   million — le total exact est **36,00** :

   | `decimals` | `per_item` rendu | `total` rendu | erreur |
   |---|---|---|---|
   | 6 (défaut) | `0.000360` | `36.000000` | aucune |
   | 4 | `0.0004` | **`40.0000`** | **+11 %** |
   | 2 | `0.00` | **`0.00`** | **−100 %** |

   Les deux langages donnent la même réponse, j'ai vérifié. Et `decimals=2`
   n'est pas un réglage tordu : c'est ce que demande l'appelant qui veut des
   euros et des centimes. Il obtient alors qu'une campagne de cent mille
   appels ne coûte rien, avec `reason: null`.

   C'est très exactement la faute que la fiche voisine
   `aggregate-a-column-of-data` existe pour dénoncer, dans la fiche dont le
   verdict dit « c'est la même discipline que la fiche voisine sur la somme
   d'une colonne ». Arrondir une fois, à la fin : calculer le total sur la
   valeur non arrondie et n'arrondir que pour l'affichage. Le code tient déjà
   tout en entiers mis à l'échelle, donc le correctif est de garder l'échelle
   interne la plus fine et de n'appeler `_text` qu'au rendu. On saura que
   c'est fait quand les trois lignes du tableau ci-dessus rendront toutes
   36 dans leur précision respective.

2. **Le seuil de bascule disparaît en silence dans le même cas.**
   `break_even = None` dès que `per_item == 0` (`n0.py:80`), c'est-à-dire dès
   que l'arrondi du point 1 l'a écrasé. Avec `decimals=2`,
   `estimate_cost(1, 1200, 300, "0.15", "0.60", decimals=2,
   fixed_alternative="40")` rend `break_even_items: null` — alors que le
   seuil réel est d'environ 111 000 appels. Le nombre que le verdict présente
   comme « la question de ce site tout entier » n'est pas rendu, et aucune
   `reason` ne dit pourquoi. Une fois le point 1 corrigé, ce cas disparaît ;
   il reste à décider ce que `break_even_items: null` veut dire — prix nul,
   ou pas d'alternative déclarée — et à le dire.

### Remarques non bloquantes

1. **Le commentaire de `break_even` ne décrit pas le calcul.** `n0.py:82` :
   `# the first call that costs more`. Le calcul est un plafond, donc il rend
   le premier appel dont la facture **atteint** le coût fixe, pas celui où
   elle le dépasse : avec un coût fixe de 100 et 10 par appel, il rend 10, et
   au dixième appel la facture vaut exactement 100. La fiche française dit
   « atteint », qui est juste ; c'est le commentaire anglais qu'il faut
   corriger, ou le calcul si l'on veut vraiment le dépassement strict.

2. **`source` vaut « mixed » quand l'un des deux comptes est zéro.**
   `estimate_cost(1, {"characters": 4800, "characters_per_token": "4"}, 0, …)`
   rend `source: "mixed"` parce que `0` jeton de sortie est « compté ». Ce
   n'est pas faux, mais un appelant qui n'attend aucune sortie lira « mixte »
   là où tout ce qui compte est estimé. Une sortie déclarée à zéro pourrait ne
   pas peser dans le verdict de source.

3. **R11 — `breaking_point` de 108 mots, deux phrases.** La structure est
   respectée, la longueur non. Voir la synthèse.

### Ce qui est solide

- L'abstinence tarifaire, et surtout le fait qu'elle soit **vérifiée par un
  test qui relit le fichier source**. C'est trois lignes, ça garde un interdit
  du cahier des charges, et le rapport de lot a raison de proposer d'en faire
  une règle générale.
- La distinction comptés / estimés portée par la donnée (`source`) et non par
  la prose, avec la raison écrite : « an estimate presented as a count is the
  failure this page exists to avoid ». C'est le bon réflexe et c'est le point
  de rupture de la fiche.
- Le point de rupture est juste et il est le bon : une estimation vaut ce que
  vaut le rapport déclaré, et le code ne peut pas le vérifier. Les deux
  valeurs citées — 1 200 et 1 920 jetons pour les mêmes 4 800 caractères — sont
  exactes, je les ai rejouées.
- Le refus d'un niveau supérieur, formulé sans détour : « ce serait une
  plaisanterie ». Demander à un modèle ce que coûte un appel de modèle se
  facture soi-même.
- `tiktoken` et `gpt-tokenizer` nommés comme la façon de compter exactement,
  sans être des dépendances, avec la raison — l'un télécharge ses tables au
  premier usage, ce qui est incompatible avec la règle hors-ligne du dépôt.
  C'est R3 appliquée à un outil qu'on nomme sans l'installer.
- Le `regulatory` fait une distinction que peu de gens font : compter les
  jetons d'un document se fait chez vous ; c'est l'appel qui fait sortir les
  données, pas le comptage.
