# extract-a-table-from-a-web-page — avis du relecteur

## Tour 1 — REFUSÉE

Le cœur de la fiche est juste et bien exécuté : déployer une fusion sur les
places qu'elle couvre **et marquer chaque répétition** est la seule façon de
garder les colonnes alignées sans faire croire que la page a écrit trois fois
ce qu'elle a écrit une fois, et le point de rupture dit honnêtement ce que ce
choix coûte à qui additionne une colonne. Le tableau imbriqué rendu à part est
le bon traitement du piège classique. J'ai vérifié les deux sur une page
fabriquée : `colspan`, `rowspan`, entités HTML, espace insécable, légende,
imbrication — les deux langages rendent la même grille.

Le refus porte sur le rapport à la norme, que la fiche invoque comme autorité.

### Raisons du refus

1. **« Une portée est plafonnée à mille, qui est le maximum que la norme
   autorise » est faux pour `rowspan`.** `verdict_rationale`, fr et en. Le
   standard HTML (section *Attributes common to td and th elements*, relue à
   la source) dit : `colspan` « less than or equal to 1000 », et `rowspan`
   « less than or equal to **65534** ». L'algorithme de formation de la grille
   le répète : « If colspan is greater than 1000, let it be 1000 instead » et
   « If rowspan is greater than 65534, let it be 65534 instead ». `_span`
   (`n0.py:136`) applique mille aux deux. Un `rowspan="2000"`, parfaitement
   légal, est donc ramené à mille sans un mot, et la phrase de la fiche
   attribue ce plafond à la norme.

2. **`rowspan="0"` est légal, il a un sens défini, et l'extrait le lit comme
   1 — en décalant les colonnes.** La norme : « For this attribute, the value
   zero means that the cell is to span all the remaining rows in the row
   group ». Mesuré :

   ```html
   <tr><td rowspan="0">Groupe</td><td>a</td></tr>
   <tr><td>b</td></tr>
   <tr><td>c</td></tr>
   ```

   | | l'extrait | un navigateur |
   |---|---|---|
   | ligne 1 | `Groupe` \| `a` | `Groupe` \| `a` |
   | ligne 2 | **`b`** \| `` | `Groupe`* \| `b` |
   | ligne 3 | **`c`** \| `` | `Groupe`* \| `c` |

   « b » et « c » se retrouvent dans la colonne de « Groupe » au lieu de celle
   de « a ». C'est exactement le décalage silencieux que le point de rupture
   dit vouloir éviter — « laisser des trous décalerait toutes les colonnes
   après la fusion sans rien signaler du tout » —, produit ici par une valeur
   que la norme définit. Correctif : traiter `rowspan="0"` comme « jusqu'à la
   fin du groupe de lignes », et porter le plafond de `rowspan` à 65534
   (`MAX_ROWSPAN` à côté de `MAX_COLSPAN`, les deux commentés avec la phrase
   de la norme). On saura que c'est fait quand le tableau ci-dessus rendra
   trois lignes à deux colonnes avec `Groupe` répété et marqué.

3. **Une cellule placée après `</tr>` est ajoutée à la ligne précédente au
   lieu d'ouvrir une ligne.** Dans le mode d'insertion « in table body », la
   norme dit qu'un `<td>` rencontré hors d'un `<tr>` provoque l'ouverture
   implicite d'un `<tr>`. L'extrait l'ajoute à la dernière ligne : sur un
   tableau à trois colonnes, un `<td>` orphelin en fin de `tbody` fait passer
   **toutes** les lignes à quatre colonnes, la dernière portant la valeur
   orpheline et les autres une cellule vide. Les deux langages font la même
   chose — `linkedom` laisse aussi la cellule hors de tout `tr` —, donc la
   parité tient ; c'est de la norme que les deux s'écartent. Le test couvre le
   cas isolé `<table><td>sans tr</td></table>`, qui tombe juste par accident
   parce qu'il n'y a pas de ligne précédente. Ajouter le cas où la cellule
   orpheline **suit** une ligne.

### Remarques non bloquantes

1. **Le plafond de portée devrait être dit dans le rapport.** Qu'un
   `colspan="5000"` ait été ramené à mille est une information que l'appelant
   n'a nulle part. Un compteur, comme `unmarked` dans la fiche 17, suffirait,
   et ce serait cohérent avec la ligne de conduite du lot.

2. **`columns` est la largeur après remplissage.** Le champ est utile ; il ne
   dit pas si la largeur vient du balisage ou du bourrage rectangulaire. Sur
   un tableau irrégulier — le cas du point 3 —, c'est la seule trace, et elle
   est muette.

3. **R11 — `breaking_point` de 100 mots et trois phrases.** La troisième
   phrase, qui explique l'alternative écartée (laisser des trous), appartient
   à la docstring ou au `verdict_rationale`. Voir la synthèse.

### Ce qui est solide

- Le déploiement des fusions avec marquage de chaque répétition, et le point
  de rupture qui dit ce qu'il coûte — « un appelant qui additionne la colonne
  compterait trois fois le même montant ». C'est la bonne décision, elle est
  argumentée contre l'alternative, et le drapeau la rend rattrapable.
- Le tableau imbriqué rendu à part, son texte ne coulant pas dans la cellule
  qui le porte, et cette cellule signalée : c'est le piège classique de
  l'aspiration de tableaux, et il est traité de face.
- La légende rendue avec la grille, parce que c'est souvent elle qui dit ce
  que les colonnes veulent dire. Détail juste, et rarement fait.
- Le choix de `html.parser` d'un côté et de `linkedom` — déjà dépendance du
  site — de l'autre : sobriété de dépendances, et l'algorithme écrit une fois
  pour les deux.
- L'`escalate_when` est honnête et utile : un « tableau » fait de `div` n'a pas
  de norme à lire, et les sélecteurs de la page font foi ; une image de
  tableau est une autre fiche.
- Les entités HTML et l'espace insécable sont décodées des deux côtés et
  rendues identiques — j'ai vérifié `&eacute;`, `&nbsp;` et `&euro;`.
