# extract-people-and-companies-from-an-article — avis du relecteur

## Tour 1 — REFUSÉE

Le verdict N2 est bien pris et bien défendu : la moitié difficile de l'énoncé
— ce qu'un nom *est* — n'est écrite nulle part, un pipeline local de quelques
dizaines de mégaoctets la règle, et la frugalité n'est pas l'absence de modèle
mais l'absence d'appel facturé et de sortie de données. Le maintien de N0 pour
sa capacité à répondre `unknown` est juste. Le refus porte sur ce que N0 rend
sur de la prose de presse française, c'est-à-dire sur le texte que la fiche
prend pour exemple.

### Raisons du refus

1. **Un nom propre placé après un mot capitalisé d'ouverture de phrase revient
   avec ce mot collé devant.** `n0.py:78-88` : le test `opens` — « la plupart
   des mots qui ouvrent une phrase ne sont pas des noms » — n'est appliqué que
   lorsque la suite capitalisée fait **un seul** mot (`if length == 1 and
   opens …`). Dès qu'elle en fait deux, le mot d'ouverture entre dans le nom.
   Mesuré, dans les deux langages, qui donnent la même réponse :

   | Phrase | Nom rendu |
   |---|---|
   | « Après Renault, Stellantis a annoncé un accord. » | **`Après Renault`** |
   | « Selon Le Monde, Renault et Stellantis ont signé… » | **`Selon Le Monde`** |
   | « Depuis Lyon, Marie Martin dirige le groupe. » | **`Depuis Lyon`** |
   | « Chez Boulanger, les prix ont baissé. » | **`Chez Boulanger`** |
   | « Malgré Airbus, le marché recule. » | **`Malgré Airbus`** |
   | « Lors du salon, Renault a présenté sa voiture. » | `Renault` (et `Lors` compté) |

   La dernière ligne montre que le code *sait* qu'un mot d'ouverture est
   suspect : seul, il est écarté et compté. Suivi d'un vrai nom, il est avalé,
   et l'entité sort avec `evidence: null, type: "unknown"`, exactement comme
   un nom correct. Rien dans le rapport ne la distingue, et
   `skipped_at_sentence_start` vaut zéro.

   « Après », « Selon », « Depuis », « Chez », « Pour », « Malgré », « Dès »,
   « Lors », « Entre », « Face » ouvrent une phrase de presse une fois sur
   trois. C'est la règle R1 : l'extrait n'a pas été passé sur l'entrée
   ordinaire de son public avant d'être publié, et R2 : la sortie est fausse
   et rien ne le signale. Le `verdict_rationale` écrit d'ailleurs que N0
   « compte ce qu'il a laissé passer au lieu de le taire » — ici il ne compte
   rien et ne dit rien.

   Le correctif n'est pas de retirer le premier mot : « Jean Dupont,
   président… » ouvre aussi une phrase et le nom commence bien au premier mot.
   Deux voies possibles, et la fiche a déjà le vocabulaire pour les deux :
   ajouter aux listes déclarées — comme `HONORIFICS` et `PARTICLES` — une
   liste de mots d'ouverture français et anglais qui ne sont jamais un nom,
   extensible et documentée ; ou porter l'information dans le rapport, un
   `at_sentence_start: true` sur le nom concerné, que l'appelant traite comme
   il veut. On saura que c'est fait quand les cinq phrases du tableau
   ci-dessus rendront `Renault`, `Le Monde`, `Lyon`, `Boulanger` et `Airbus`,
   ou les rendront marquées.

2. **Le point de rupture de N0 n'est donc pas le premier à se produire.**
   « Sans marqueur, la phrase ne prouve rien : le nom revient `unknown` » est
   vrai, honnête et voulu — c'est même la qualité du niveau. Mais un nom rendu
   `unknown` est une non-réponse assumée, tandis qu'un nom **faux** est une
   réponse. R1 demande que le point de rupture nomme la seconde. Une fois le
   point 1 corrigé, la phrase actuelle peut rester ; tant qu'il ne l'est pas,
   c'est lui qu'il faut écrire.

### Remarques non bloquantes

1. **Une référence de produit est rendue comme un nom.** « Airbus a livré son
   premier A350 à Air France » rend `A350` parmi les noms. `WORD` exige une
   initiale non numérique, donc `A350` passe. Ce n'est ni une personne ni une
   entreprise, et le niveau n'a aucun moyen de le savoir ; un mot dans la
   docstring suffirait, à côté de celui qui parle déjà des mots d'ouverture.

2. **Le niveau N2 n'est pas exécuté ici, et c'est correctement déclaré.**
   `verification: stubbed`, spaCy absent de l'environnement, `MODEL` présenté
   comme un exemple, et la licence LGPL-LR du pipeline français nommée à côté
   du MIT de spaCy. C'est la bonne façon de faire, et c'est la seule fiche du
   lot qui distingue la licence de la bibliothèque de celle du modèle
   téléchargé. À reprendre dans la charte.

3. **R11 — points de rupture de 66 mots (N0, trois phrases) et 99 mots (N2,
   trois phrases).** Voir la synthèse.

### Ce qui est solide

- Le verdict est pris à contre-pente du site et il est assumé sans s'excuser,
  comme la charte le demande. L'argument — la frugalité, c'est l'absence
  d'appel facturé et de sortie de données, pas l'absence de modèle — est le
  bon, et il est rare de le voir écrit aussi nettement.
- Le maintien de N0 pour une raison précise : il sait répondre `unknown`, le
  pipeline affirme toujours quelque chose et ne rend aucun score. C'est un
  argument de forme de la réponse, pas de qualité, et c'est le seul qui tienne.
- `MISC` écarté **et compté** plutôt que deviné : la règle « ce qui n'est pas
  lu est nommé » appliquée à un jeu d'étiquettes. Et le constat qui porte la
  fiche — dix-huit étiquettes en anglais, quatre en français — est un fait de
  langue mesuré à la source, pas une impression.
- La décision sur « et », assumée par écrit : « Marks and Spencer » coupé en
  deux plutôt que « Alex Ferguson et Acme » fusionnés en un, parce qu'inventer
  une entité à partir de deux est pire. C'est le bon arbitrage, il est expliqué,
  et il est vérifiable.
- Le `regulatory` est le plus juste du lot : « une liste de noms de personnes
  est un traitement de données personnelles, quel que soit le niveau employé
  pour la produire ». Factuel, sans conseil juridique, et vrai des quatre
  niveaux.
- La fermeture de N1 sur `sklearn-crfsuite` — un champ aléatoire conditionnel
  réclame un corpus annoté entité par entité, qui est précisément ce qu'on n'a
  pas — est une raison, pas une formule.
