# validate-an-imported-file-against-a-schema — avis du relecteur

## Tour 1 — ACCEPTÉE

Fiche exemplaire sur le fond. Le point de rupture est le bon — il n'est pas
dans le validateur, il est dans le modèle de données — et il est reproductible :
j'ai rejoué `multipleOf: 0.01` sur les dix mille montants de 0,00 à 99,99 et
j'obtiens **1 363** refus, les mêmes, à commencer par 0,07 ; 19,99 et 4,35 sont
bien refusés, et les mêmes valeurs en centimes entiers passent toutes. J'ai
aussi vérifié la seconde affirmation du verdict : `ajv` 8 lève bien à la
compilation sur un `"format": "date"` non enregistré (« unknown format "date"
ignored in schema at path "#" »), là où `jsonschema` laisse passer
« 2026-02-30 » sans un mot tant que le vérificateur de formats n'est pas
allumé.

### Remarques non bloquantes

1. **« 1 234,56 » n'est pas un des dix mille montants de 0,00 à 99,99.**
   `breaking_point`, fr et en : « refuse 1 363 des 10 000 montants de 0,00 à
   99,99, **dont** 19,99, 4,35 et 1 234,56 ». Les deux premiers sont dans
   l'intervalle, le troisième non. La valeur est bien refusée — vérifié —, mais
   la phrase la range là où elle n'est pas. Écrire « … dont 19,99 et 4,35 ; et
   hors de cet intervalle, 1 234,56 ».

2. **« ×55 » et « ×6 000 » sont publiés sur la page, et rien ne les tient.**
   `verdict_rationale`, fr et en. Le test, lui, n'affirme que
   `garde * 5 < recompile` (`n0.test.py:182`), soit un facteur cinq : la fiche
   pourrait annoncer trois ordres de grandeur de plus ou de moins sans qu'un
   test bouge. Ces facteurs dépendent en outre de la machine, de la version
   d'`ajv` et de la taille du schéma. La charte de rédaction interdit le
   « pourcentage de performance » dans le corps d'une fiche ; un facteur en est
   un. Le relevé est le bon endroit — il porte déjà la mesure complète, avec
   les quatre durées —, et la page devrait se contenter de « deux ordres de
   grandeur en Python, davantage en JavaScript ». `scripts/check-figures.mjs`
   ne voit pas ces facteurs : c'est un trou d'outillage, signalé dans la
   synthèse.

3. **La clé du cache est recalculée à chaque appel, et ce n'est pas gratuit.**
   `_compiled` fait `json.dumps(schema, sort_keys=True)` à chaque
   `validate_import`. Mesuré sur un schéma réaliste de cent vingt propriétés :
   0,049 ms de sérialisation pour 0,49 ms d'appel total, soit **10 % du temps
   passé à fabriquer la clé du cache censé faire gagner du temps**. Ce n'est
   pas un défaut, c'est un plafond au gain annoncé, et il croît avec la taille
   du schéma. La forme qu'on retient en production — exposer le validateur
   compilé et laisser l'appelant le garder — mériterait une phrase.

4. **Le cache est un état global mutable.** `_COMPILED` est un dictionnaire de
   module, écrit sans verrou. Sur un serveur à fils d'exécution multiples,
   l'éviction (`del _COMPILED[next(iter(_COMPILED))]`) peut courser une
   lecture. Le risque réel est faible — au pire une recompilation —, mais la
   charte des extraits demande qu'un extrait soit sans état partagé, et
   celui-ci en a un. Une ligne de commentaire disant que ce cache est un
   exemple et qu'en production il appartient à l'appelant suffirait.

5. **R11 — `breaking_point` de 60 mots, deux phrases.** Le deuxième plus court
   du lot. Voir la synthèse.

### Ce qui est solide

- Le point de rupture est intellectuellement honnête : il ne reproche rien au
  validateur, il montre que la règle qu'on écrit naturellement est fausse, et
  il donne le remède dans le témoin — les centimes entiers. C'est la même
  leçon que les fiches 17, 24 et 25, et c'est bien qu'elle apparaisse ici
  d'abord.
- Les trois réglages non par défaut sont exactement les trois qu'un
  développeur découvre en production, et chacun est épinglé par un test :
  `format` inerte d'un côté et bloquant de l'autre, la première erreur seule
  au lieu de toutes, la recompilation à chaque document.
- Le désaccord sur le texte du message entre les deux bibliothèques est dit —
  « the path and the rule are what your code should branch on » — et le test de
  parité compare le chemin, la règle, le compte et la validité en excluant le
  message. C'est la bonne façon de traiter un écart qu'on ne peut pas fermer.
- L'ordre des erreurs unifié entre les deux langages, avec l'index trié comme
  un nombre et non comme une chaîne : c'est le genre de détail qu'on ne trouve
  qu'en comparant deux implémentations pour de bon.
- Le schéma invalide traité comme une raison et non comme une exception, et le
  plafond d'erreurs qui rend le compte réel plutôt que de faire croire qu'il
  n'y en avait que deux cents. R8 appliquée correctement.
- L'`escalate_when` trace la bonne frontière : dès que la règle n'est plus dans
  le fichier, ce n'est plus une validation de schéma.
