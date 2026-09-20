# extract-tables-from-a-pdf — avis du relecteur

## Tour 1 — REFUSÉE

L'idée centrale est juste et elle est rare : la question n'est pas de lire le
tableau mais de savoir si la grille a été **lue** ou **devinée**, et le rapport
le dit sur chaque tableau. Le défaut nommé de `pdfplumber` est vrai — je l'ai
rejoué, sa stratégie texte rend bien `['Référence', 'Désignation', 'Quantité',
'Prix H']` là où l'extrait rend `'Prix HT'`. Le refus porte sur le point de
rupture, qui n'est pas le premier à se produire, et de loin.

### Raisons du refus

1. **R1 — sur une facture sans filets, l'en-tête de la page devient des lignes
   du tableau.** C'est le cas que la docstring appelle elle-même « the common
   case in an emailed invoice ». J'ai fabriqué la facture correspondante — bloc
   adresse, numéro de facture, puis un tableau à quatre colonnes sans un seul
   filet — et voici ce que `read_tables` rend :

   ```
   page 1  strategy text  4 colonnes
      ['SARL Le Moulin', '', '', '']
      ['12 rue des Freres-Lumiere', '', '', '']
      ['92100 Boulogne-Billancourt', '', '', '']
      ['Facture n FA-2026-0412 du 12 janvier 2026', '', '', '']
      ['Reference', 'Designation', 'Quantite', 'Prix HT']
      ['MC-4501', 'Moulin a cafe', '2', '19,90']
      ['MC-9000', 'Bouilloire', '1', '34,00']
   ```

   Quatre lignes sur sept sont l'habillage de la page, rendues comme des lignes
   du tableau, avec trois cellules vides chacune. Un appelant qui itère sur
   `rows[1:]` lira « 12 rue des Freres-Lumiere » comme une référence d'article
   au prix vide. Le même effet est déjà visible sur le fixture `PROSE` du test :
   une page de prose pure, sans le moindre tableau, ressort comme un tableau
   d'une colonne et quatre lignes — le test
   `test_une_page_sans_tableau_ne_rend_pas_un_tableau_invente` le constate et
   s'en accommode, alors que son nom dit le contraire de ce qu'il observe.

   C'est la règle R1 : le point de rupture publié doit être la **première**
   chose qui casse sur des données réelles. Une cellule repliée dans un tableau
   tracé est un raffinement du cas où tout va bien ; la page entière prise pour
   un tableau est ce qui arrive à la première facture sans filets.

   Deux correctifs possibles, et ils ne s'excluent pas : que la lecture devinée
   ne rende que les lignes qui ont au moins deux cellules remplies, en comptant
   les autres dans le rapport ; et que le `breaking_point` nomme ce
   comportement, avec cet exemple, en gardant la cellule repliée comme
   deuxième phrase. On saura que c'est fait quand la facture ci-dessus rendra
   trois lignes et dira que quatre lignes de la page n'ont pas été retenues.

2. **Le nom du niveau promet aux deux langages ce qu'un seul sait faire.**
   `name` : « Les filets quand la page en a, la position des mots sinon ». Côté
   JavaScript, `strategy` ne vaut jamais `lines` : aucun paquet ne lit les
   filets. La docstring JavaScript est parfaitement honnête là-dessus — c'est
   à son crédit — mais le lecteur voit d'abord le nom du niveau et les deux
   extraits côte à côte. Le nom, ou le point de rupture, doit porter la
   restriction : « les filets en Python, la position des mots dans les deux ».
   Sinon la page affirme des deux extraits ce qui n'est vrai que d'un, ce que
   la charte des tests interdit explicitement.

### Remarques non bloquantes

1. **Les colonnes sont déduites de toute la page, pas du tableau.** Les bords
   gauches sont collectés « across the whole page » : un bloc adresse, un pied
   de page ou un filigrane textuel ajoutent donc des colonnes au tableau. C'est
   la mécanique qui produit le défaut ci-dessus, et une fois celui-ci corrigé,
   il restera à dire que la grille est celle de la page.

2. **`if ruled: … continue`.** Dès que `extract_tables()` rend quoi que ce soit,
   la lecture devinée n'est pas tentée sur cette page. Un encadré décoratif
   autour d'un titre suffit à produire un « tableau » d'une cellule en
   `strategy: lines`, et le vrai tableau sans filets de la même page ne sera
   jamais lu. Le cas ne figure dans aucun fixture.

3. **R11 — `breaking_point` de 73 mots, deux phrases.** Voir la synthèse.

### Ce qui est solide

- `strategy` dans le rapport est la bonne idée, et elle est la raison d'être de
  la fiche : rendre une grille sans dire si elle était écrite ou déduite est
  malhonnête, et personne ne le fait. À garder tel quel.
- Le défaut de `pdfplumber` est réel, précis et vérifié : sa stratégie texte
  coupe « Prix HT » en « Prix H » parce qu'elle découpe la cellule à la
  frontière de colonne. C'est exactement la raison mesurée qu'exige R3 pour
  écrire soi-même plutôt que d'emprunter.
- Le regroupement est le même code dans les deux langages, avec trois
  constantes nommées, commentées en points typographiques et justifiées par la
  taille d'une police de dix points. C'est lisible et c'est réglable.
- La fermeture de l'échelle est juste : dès que le PDF ne porte plus de texte,
  ce n'est plus cette fiche, c'est la reconnaissance de caractères. Le renvoi
  est explicite.
- Le `regulatory` dit la bonne chose sur une facture ou un relevé : ce que le
  niveau permet de garder chez soi est ce que le niveau au-dessus coûterait.
