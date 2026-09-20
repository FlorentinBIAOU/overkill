# extract-product-data-from-a-shop-page — avis du relecteur

## Tour 1 — REFUSÉE

Le scénario est le meilleur du lot : la donnée est déjà dans la page, en clair,
quelques lignes plus haut, et on va la chercher dans le rendu. Le balayage des
blocs écrit à la main plutôt qu'en expression régulière est du vrai travail
d'exploitation, et je l'ai mesuré : **0,002 s** pour l'extrait contre
**53,5 s** pour l'expression régulière naïve sur vingt mille balises
`<script>` non refermées. La fiche annonce « dépasser dix secondes » ; c'est
vrai et prudent.

Et c'est précisément pour cela que le premier motif de refus fait mal.

### Raisons du refus

1. **Le niveau N3 de la même fiche réintroduit l'effondrement que le niveau N0
   évite, sur la même entrée.** `n3.py:37` :
   `TAGS = re.compile(r"<(script|style)\b[^>]*>.*?</\1>|<[^>]+>", ...)`, et
   `n3.js:33` la même. Mesuré sur les vingt mille `<script>` non refermés qui
   servent d'argument à N0 :

   | | temps de `TAGS.sub` |
   |---|---|
   | Python | **42,1 s** |
   | JavaScript | 1,59 s |

   (et 17,6 s en Python avec des `<style>` non refermés). Le niveau N3 est
   celui qui s'applique à la boutique dont on ne maîtrise rien — c'est sa
   définition dans cette fiche — et il passe quarante secondes de processeur
   par page hostile, **avant** même l'appel au modèle. Le commentaire de
   `_blocks` dans `n0.py` explique la faute mot pour mot ; elle est deux
   fichiers plus loin. Correctif : le même balayage linéaire, ou au minimum
   plafonner la taille du HTML **avant** le nettoyage — `html.slice(0, N)` est
   aujourd'hui appliqué après (`n3.js:75`), donc le plafond ne protège rien.
   La charte des tests demande d'ailleurs, pour un niveau à double, qu'« une
   entrée trop grande soit refusée **avant** l'appel ». On saura que c'est fait
   quand la page hostile passera sous la seconde des deux côtés, et le test
   d'entrée très grande doit la contenir.

2. **`price` est un flottant, et le lot a décidé l'inverse.** `n0.py:118` :
   `"price": float(price) if price and PRICE.match(price) else None`. Le
   rapport de lot en fait une décision de site — « Les montants ne passent
   jamais par un flottant » — et les fiches 17, 24 et 25 la tiennent ; la
   fiche 8 fait même du flottant décimal son point de rupture. Ici, le niveau
   recommandé d'une fiche de prix rend `24.9` pour une boutique qui a écrit
   `24.90`.

3. **Et `price_text` ne porte pas ce que la docstring promet.** Elle dit :
   « the price comes back as None with the raw text beside it ». Quand la
   boutique écrit son prix en **nombre JSON** — ce que fait une part des
   plateformes —, `price` vaut `str(raw_price)`, c'est-à-dire la
   représentation du flottant : `{"price": 24.90}` ressort en
   `price_text: "24.9"`. Les centimes disparaissent du champ dont toute la
   raison d'être est de les conserver. Vérifié dans les deux langages, qui
   donnent la même mauvaise réponse. Correctif : ne convertir en nombre que
   sur demande, et conserver le texte tel que l'analyseur JSON l'a lu — ou,
   plus simple et cohérent avec le reste du lot, ne rendre que la chaîne de
   chiffres et laisser l'appelant décider de son type.

### Remarques non bloquantes

1. **Le premier `offers` gagne, en silence.** `_product` fait
   `offer = _flatten(node.get("offers")); offer = offer[0] if offer else {}`.
   Une boutique qui publie plusieurs offres pour le même produit — taille,
   couleur, marchand — verra la première l'emporter sans un mot, alors que la
   fiche prend soin de ne pas trancher entre plusieurs **produits**. Les deux
   cas sont le même cas. Une phrase dans la docstring, ou le nombre d'offres
   dans le rapport.

2. **`gtin` écrase trois clés en une.** `node.get("gtin") or node.get("gtin13")
   or node.get("gtin8")` : le rapport ne dit pas laquelle a répondu, alors que
   la longueur d'un GTIN porte une information. Mineur, mais la fiche 21 pose
   la règle inverse — « ce qui n'est pas lu est nommé » — et elle vaut ici.

3. **R11 — points de rupture de 65 et 67 mots, deux phrases chacun.** Voir la
   synthèse.

### Ce qui est solide

- Le balayage linéaire des blocs `<script>`, avec la raison écrite dans le
  code, et vérifiée : c'est le meilleur détail de production du lot.
- Le refus de trancher entre plusieurs produits sur la même page, et de lire
  « 1 234,56 » comme un nombre : les deux ambiguïtés sont rendues à l'appelant
  plutôt que tranchées en silence, ce que R2 demande.
- Le champ `source` qui distingue « la page ne dit rien » de « le JSON-LD est
  cassé » : c'est ce dont on a besoin à trois heures du matin quand un flux
  d'aspiration rend zéro produit.
- Le point de rupture de N0 est le bon, et il est inattendu : le bloc peut ne
  plus correspondre à ce que la page affiche. Ce n'est pas une limite
  technique, c'est une propriété du format, et la fiche la nomme.
- La garde de N3 — toute valeur absente du texte envoyé est écartée — est
  l'idée la plus réutilisable du lot, et son point de rupture est honnête :
  elle écarte aussi « EUR » quand la page écrit « € ». Dire ce que sa propre
  garde coûte est rare.
- Le `regulatory` sur l'aspiration d'un site tiers est court, factuel et ne
  donne aucun conseil juridique. Exactement la formulation attendue.
