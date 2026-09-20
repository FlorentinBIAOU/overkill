# validate-a-phone-number-and-its-country-code — avis du relecteur

## Tour 1 — ACCEPTÉE

C'est la meilleure des trois premières fiches. Le scénario met le doigt là où
ça fait mal — la région devinée, pas la validation —, l'outil est celui qu'on
branche, et les deux défauts de bibliothèque annoncés sont réels : je les ai
reproduits l'un et l'autre.

Ce que j'ai vérifié à la main, hors des tests de la fiche : les vingt-deux
entrées ordinaires d'un formulaire francophone (06/01 en région FR, 04.70 en
FR puis en BE, `+33 (0)6 …` avec le zéro entre parenthèses, `00 33 6 …`,
0692 en RE, 0800, `+352 621 …`, `+41 79 …`, `+1 514 …`, le 3949) donnent le
même rapport en Python et en JavaScript, au champ près. La parité n'est pas
seulement testée, elle tient hors du jeu de tests.

### Remarques non bloquantes

1. **Un code région en minuscules fait refuser tous les numéros, avec une
   raison qui accuse l'utilisateur.** `validate_phone_number("06 12 34 56 78",
   default_region="fr")` rend `valid: False`, `reason: "cannot be read as a
   phone number"` — dans les deux langages, j'ai vérifié. Or `fr` est
   exactement ce qu'on récupère d'un `Accept-Language`, d'une locale ou d'une
   colonne en base. Le numéro est parfaitement lisible ; c'est l'appel qui est
   mal formé, et le message dit le contraire. La fiche voisine
   `check-bank-details-before-a-transfer` fait `expected_country.upper()`,
   deux caractères. Soit `default_region.upper()`, soit une raison distincte
   (« region "fr" is not a two-letter country code, use "FR" »), et le cas au
   test de parité.

2. **« the country the caller is expecting » décrit autre chose que ce que le
   paramètre fait.** Docstring de `n0.py:61` et `n0.js:46`. Un appelant qui
   « attend » la Belgique et reçoit `+33 6 12 34 56 78` obtient
   `valid: true, region: "FR"` : le paramètre est un défaut pour les numéros
   sans `+`, pas une attente vérifiée. Rien n'est caché — `region` est dans le
   rapport —, mais la phrase promet le contrôle que la fiche 2 implémente
   vraiment sous le nom `expected_country`. Écrire « the region to assume when
   the number carries no country code ».

3. **`ETAPES.md` range l'espace fine parmi les « divergences entre les deux
   bibliothèques ».** C'en est l'inverse : les deux s'arrêtent dessus, comme
   le relevé le dit correctement. Un accord dans l'erreur n'est pas une
   divergence. À corriger dans la ligne d'étape, pas dans la fiche.

4. **R11 — `breaking_point` de 75 mots.** Voir la synthèse.

### Ce qui est solide

- Les deux défauts de bibliothèque sont vrais, et je les ai rejoués :
  `phonenumbers.parse("06 12 34 56 78 poste 42", "FR")` rend
  `+336123456787678342`, un numéro que personne n'a tapé et que la fiche a
  raison de qualifier de sortie fausse et silencieuse ; `libphonenumber-js`,
  lui, lève. Et `06 12 34 56 78` — l'espace fine que met
  un traitement de texte français — fait échouer la lecture des deux côtés.
  Nivelage des espaces d'un côté, refus des lettres de l'autre : les deux
  correctifs sont au bon endroit, avant l'appel, et ils ferment l'écart entre
  les langages. C'est R5 appliqué correctement — un défaut réparable est
  réparé, pas vendu comme une limite de l'approche.
- Le refus de deviner la région est la décision qui porte la fiche, et elle
  est tenue jusque dans le code : pas de repli sur le serveur, pas de `FR` par
  défaut, un refus nommé. C'est ce que R2 demande, et peu de fiches le font
  aussi franchement.
- Le point de rupture est le bon : une table datée, pas une règle. L'exemple
  béninois est vérifiable et daté, et le témoin — la forme à dix chiffres —
  est dans le même test.
- La distinction longueur / préfixe dans la raison (`is_possible_number` vs
  `is_valid_number`) est ce qu'on veut dans un journal d'exploitation le jour
  où un pays ouvre une tranche.
- Le renvoi au niveau supérieur — l'interrogation réseau chez l'opérateur — est
  nommé, facturé, et laissé hors de l'échelle. C'est cohérent avec les deux
  fiches précédentes.
