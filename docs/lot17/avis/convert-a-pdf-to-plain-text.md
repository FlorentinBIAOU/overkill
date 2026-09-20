# convert-a-pdf-to-plain-text — avis du relecteur

## Tour 1 — REFUSÉE

La thèse est juste — « le fichier dit où chaque mot est posé, jamais dans quel
ordre on le lit » — et la recherche de gouttières fonctionne. Je l'ai vérifiée
sur une page à deux colonnes fabriquée pour l'occasion : deux colonnes
trouvées, chacune rendue de haut en bas, dans le bon ordre, et une page de prose
pleine largeur reste bien une seule colonne. Le refus porte sur ce que la même
mécanique fait d'une page de tableau, qui est le document le plus banal du
public visé.

### Raisons du refus

1. **Une page dont le corps est un tableau ressort transposée, en silence.**
   Les gouttières entre les colonnes d'un tableau dépassent largement les
   vingt-cinq points de `MIN_GUTTER`, donc chaque colonne du tableau est prise
   pour une colonne de texte et lue de haut en bas. Sur une facture ordinaire
   à quatre colonnes que j'ai fabriquée :

   ```
   colonnes = 4
   Reference / MC-4501 / MC-9000 / MC-1200
   (blanc)
   Designation / Moulin a cafe / Bouilloire / Theiere fonte
   (blanc)
   Quantite / 2 / 1 / 3
   (blanc)
   Prix HT / 19,90 / 34,00 / 45,50
   ```

   Toutes les références d'abord, puis toutes les désignations, puis tous les
   prix : le lien entre `MC-4501` et `19,90` a disparu. Le texte rendu est
   faux — pas incomplet, faux — et rien ne le dit. Le champ `columns` vaut 4,
   et la docstring explique qu'il « tells a caller that the page was not a
   simple column of prose » : c'est vrai et c'est très loin de suffire. Un
   corpus d'un millier de factures ou de relevés passera intégralement dans
   cette moulinette sans qu'aucun signal ne remonte.

   C'est R1 — la première chose qui casse sur l'entrée ordinaire du lecteur —
   et R2 — une sortie fausse et silencieuse. La coupure de mot en fin de ligne,
   qui est le point de rupture publié, est un raffinement à côté : elle laisse
   le texte lisible, celle-ci le rend inexploitable.

   Deux correctifs, cumulables. Le premier : au-delà de deux bandes, ou quand
   les bandes contiennent surtout des lignes courtes, ne pas réordonner, rendre
   la lecture naïve et dire pourquoi — `reason: "this page looks like a table:
   read in page order"`, avec un renvoi à `extract-tables-from-a-pdf`. Le
   second : nommer le cas dans le `breaking_point`, avec cet exemple, en
   gardant la césure comme seconde phrase. On saura que c'est fait quand la
   facture ci-dessus rendra ses lignes dans l'ordre imprimé.

2. **La docstring attribue le travail à des bibliothèques qui ne sont pas
   appelées.** `n0.py:5-7` : « Reading them is what `pypdf` and `pdftotext` do
   **here**, and `pdf.js` in JavaScript ». Le code importe `pdfplumber`, et
   ni `pypdf` ni `pdftotext` n'apparaissent nulle part dans l'extrait. Le
   rapport de lot explique l'intention — les deux premiers sont *nommés* comme
   l'outil qu'on branche d'abord, `pdfplumber` est *utilisé* parce qu'il donne
   les coordonnées — mais la fiche, elle, dit « here ». Un lecteur qui installe
   `pypdf` et copie l'extrait obtient un `ModuleNotFoundError`. Écrire la
   phrase telle qu'elle est vraie : `pypdf` et `pdftotext` rendent le texte,
   cet extrait passe par `pdfplumber` parce qu'il lui faut la position des
   mots.

### Remarques non bloquantes

1. **`MIN_GUTTER = 25.0` n'a pas de contre-mesure.** Le commentaire est bien
   argumenté — une espace fait moins de cinq points, une gouttière vingt à
   quarante — mais la valeur n'est ni un paramètre de la fonction, ni
   mentionnée dans le rapport. Un appelant qui constate le défaut du point 1
   n'a aucun levier. L'exposer comme `read_text(..., min_gutter=...)`, comme
   la fiche voisine expose `min_characters`, coûte une ligne.

2. **Le refus de recoller les césures est la bonne décision et elle est bien
   argumentée** — « Boulogne- » et « Billancourt » sont deux mots —, mais le
   rapport ne compte pas les lignes qui finissent par un tiret. Trois lignes
   donneraient à l'appelant de quoi décider pour son corpus, ce que la
   docstring lui demande précisément de faire.

3. **R11 — `breaking_point` de 69 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- La recherche de gouttières est du bon travail, et elle est robuste là où on
  l'attend : un seul paragraphe pleine largeur suffit à annuler toutes les
  bandes, donc une page de prose ordinaire reste une colonne. Vérifié.
- L'exemple à deux colonnes est réel et convaincant : la lecture naïve donne
  « La boulangerie Martin fête Clémentine Martin a repris », et la fiche le
  montre plutôt que de l'affirmer.
- Le refus de recoller les mots coupés, avec « Boulogne- » / « Billancourt »
  comme contre-exemple sur la même page : c'est exactement la façon dont R2
  veut qu'on traite une ambiguïté — on ne la tranche pas, on la rend à
  l'appelant, et on dit pourquoi.
- La même mécanique de gouttières écrite dans les deux langages, plutôt que
  laissée à deux bibliothèques différentes : la parité est ici un choix
  d'architecture, pas un rattrapage.
- L'`escalate_when` est observable et juste : zéro colonne et un texte vide
  veut dire scan, et la suite est une autre fiche.
