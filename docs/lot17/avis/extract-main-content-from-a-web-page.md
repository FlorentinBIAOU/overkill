# extract-main-content-from-a-web-page — avis du relecteur

## Tour 1 — REFUSÉE

La fiche a raison sur tout l'essentiel : le problème est vieux de vingt ans, il
porte un nom, il a deux mises en œuvre mûres, et ce qui reste à écrire est la
part que les bibliothèques taisent. Le seuil de part de liens tient d'ailleurs
très bien en conditions réelles — je l'ai vérifié sur de vraies pages, pas sur
des gabarits :

| Page | Part du texte dans les liens | Verdict |
|---|---|---|
| `fr.wikipedia.org/wiki/Boulogne-Billancourt` | 0,25 | article |
| `fr.wikipedia.org/wiki/Café` | 0,20 | article |
| `news.ycombinator.com` | 0,77 | liste de liens |

C'est exactement ce que R7 demande, et peu de seuils du lot ont été éprouvés
comme celui-là. Le refus porte sur l'autre règle, celle qui devait distinguer
deux situations et qui les confond.

### Raisons du refus

1. **La docstring promet de distinguer « la page était courte » de « il n'y
   avait rien à prendre », et le code rend la même raison dans les deux cas.**
   `n0.py:54-57` : « `reason` is what tells a caller that came back
   empty-handed whether the page was short or whether there was nothing to
   take » ; `n0.js:49-50` la même. Or le code n'a qu'une branche
   (`n0.py:73-75`, `n0.js:79-80`) : dès que `len(text) < min_characters`, la
   raison est *« almost nothing was extracted: this page may be built by its
   own JavaScript »*, que le texte soit vide ou complet.

   Mesuré sur une brève de presse ordinaire — un titre et trois phrases, 125
   caractères, servie en HTML statique :

   ```
   {'title': 'Grève à la SNCF',
    'text': 'Grève à la SNCF\nLe trafic sera perturbé jeudi…',
    'characters': 125,
    'reason': 'almost nothing was extracted: this page may be built by its own JavaScript'}
   ```

   L'extraction a parfaitement réussi — titre juste, texte complet, habillage
   retiré — et le rapport annonce qu'il n'y avait rien à prendre et suggère un
   navigateur sans affichage. Une chaîne d'aspiration qui branche son repli sur
   cette raison, ce que l'`escalate_when` lui dit de faire, ira rendre au
   navigateur toutes les brèves, tous les communiqués courts et toutes les
   pages produit. C'est une sortie fausse sur une entrée ordinaire (R2), et
   elle est fausse dans le champ dont la fiche fait son premier argument.

   Correctif : deux branches et deux raisons. `text` vide →
   « nothing was extracted: this page may be built by its own JavaScript » ;
   `0 < len(text) < min_characters` → « this page is short: N characters »,
   sans diagnostic sur la cause. Et le seuil doit rester ce qu'il est — une
   information rendue à l'appelant —, pas un verdict sur la technologie de la
   page.

2. **Le test des valeurs aux limites ne peut pas échouer.** `n0.test.py:176` :
   `assert read_article(page)["reason"] is None or read_article(page)["characters"] < MIN_CHARACTERS`.
   Un `or` entre la propriété qu'on veut et sa négation approximative : quel
   que soit le comportement du code, l'une des deux branches passe. C'est la
   définition du test décoratif donnée par la charte. Il faut affirmer les deux
   cas séparément — exactement au seuil, un caractère en dessous, un
   caractère au-dessus — avec la raison attendue pour chacun, ce qui suppose
   d'avoir corrigé le point 1.

### Remarques non bloquantes

1. **`_link_share` peut dépasser 1.** `total` est calculé sur le texte rogné
   (`.strip()`), `inside` ne l'est pas, et un lien imbriqué dans un autre — ce
   qu'un analyseur permissif produit sur du HTML mal formé — est compté deux
   fois. Le seuil étant à 0,5, la conséquence pratique est nulle, mais la part
   n'est pas une part. Borner à 1 et rogner des deux côtés.

2. **`MIN_CHARACTERS = 200` n'est pas justifié par une mesure.** Le
   commentaire dit « An article in the press, a documentation page or a blog
   post is an order of magnitude above » : c'est vrai de l'article moyen, pas
   de la brève ni de la page de documentation d'une fonction. Une fois le
   point 1 corrigé, le seuil ne décide plus rien de grave, mais la phrase
   mériterait la mesure qui la soutient.

3. **R11 — `breaking_point` de 59 mots, deux phrases.** Parmi les mieux tenus.
   Voir la synthèse.

### Ce qui est solide

- Le seuil de part de liens est mesuré, motivé par un désaccord réel entre les
  deux bibliothèques, et il tient sur de vraies pages. C'est le meilleur
  exemple du lot de la règle « quand deux bibliothèques mûres divergent,
  l'écart est fermé dans l'extrait et publié dans la fiche ».
- Le scénario dit la bonne chose : « Le vrai sujet n'est pas d'extraire mais de
  savoir quand il n'y a rien à extraire. » C'est juste, c'est rarement écrit, et
  toute la fiche en découle.
- Le test de parité qui compare, non pas les caractères rendus — les deux
  bibliothèques n'en rendent pas les mêmes —, mais ce sur quoi elles doivent
  s'accorder : les phrases de l'article sont dedans, le menu et le pied de page
  sont dehors. C'est la bonne façon de tester deux implémentations différentes
  d'un même besoin.
- L'`escalate_when` ne promet pas un meilleur extracteur : il nomme le
  navigateur sans affichage et le point d'accès que le site utilise lui-même.
  C'est la vraie réponse, et elle sort de l'échelle plutôt que d'y ajouter un
  niveau.
- `favor_precision=True` et `include_comments=False` : deux réglages non par
  défaut, choisis, et cohérents avec un usage où un faux positif coûte plus
  qu'un manque.
