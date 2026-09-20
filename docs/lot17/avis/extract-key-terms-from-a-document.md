# extract-key-terms-from-a-document — avis du relecteur

## Tour 1 — REFUSÉE

L'analyse de l'énoncé est la meilleure du lot : « caractériser, c'est
distinguer, et distinguer demande une collection ». Elle justifie un verdict
N1 à contre-pente du site, et elle a raison. Le refus ne porte pas sur le
verdict mais sur ce que le niveau recommandé rend vraiment quand on le sort du
jeu de quatre contrats de la fiche.

### Raisons du refus

1. **Le classement de N1 n'est pas un classement : sur une petite collection,
   les termes en tête sont à égalité parfaite et rangés par ordre
   alphabétique.** Le score est `count × moyenne(idf)`, et `idf = log(N/1)`
   pour tout terme présent dans un seul document. Un terme qui apparaît **une
   fois** dans son document et nulle part ailleurs — le cas ordinaire d'un
   document court — vaut donc exactement `log(N)`, comme tous ses voisins. Le
   tri final est `(-score, -count, key)` : à égalité de score et de compte,
   c'est la chaîne qui départage, c'est-à-dire l'alphabet.

   Mesuré sur un dossier de quatre comptes rendus de conseil municipal, avec
   une liste de mots vides française complète — le top 12 du premier
   document :

   ```
   1.3863 approuvé      1.3863 médiathèque accueillera
   1.3863 budget        1.3863 médiathèque commenceront
   1.3863 Frères-Lumière 1.3863 nouvelle médiathèque
   1.3863 janvier       1.3863 printemps
   1.3863 lecture       1.3863 rappelé
   1.3863 maire         1.3863 salle
   ```

   Douze termes, **un seul score**. Le sujet du document — la médiathèque —
   arrive en septième position parce que « m » vient après « a », « b », « F »,
   « j », « l » et « m(aire) ». Avec le `top=8` par défaut, le fait de garder
   ou de perdre le sujet du document dépend de la lettre par laquelle il
   commence.

   Ce n'est pas un artefact de mon jeu d'essai : sur le `CORPUS` du test
   lui-même, chaque document ne produit que **trois scores distincts pour huit
   termes**, et les trois premiers du document 0 — `café`, `moulin`,
   `moulins` — sont à égalité à 1,3863, rangés par l'alphabet. Le
   `verdict_rationale` cite ce résultat — « il rend « moulin » et « café » » —
   sans dire que l'ordre entre eux est celui du dictionnaire, ni que le
   troisième est le pluriel du premier.

   Correctif : dire la chose dans la fiche, et départager les égalités par
   quelque chose qui ait un sens — la longueur du terme, le rang de sa
   première occurrence dans le document, le nombre de mots — plutôt que par la
   chaîne. Et le `_rounded` à quatre décimales, écrit pour que le classement ne
   dépende pas de l'arrondi, mérite son pendant : un classement ne doit pas
   dépendre de l'alphabet non plus.

2. **R4 — hors du jeu de la fiche, le niveau recommandé fait parfois moins
   bien que celui du dessous, et rien ne le mesure.** Sur le document 0
   ci-dessus, N0 rend `médiathèque accueillera` dans ses trois premiers
   termes ; N1, dans ses trois premiers, ne mentionne pas la médiathèque du
   tout (`approuvé`, `budget`, `Frères-Lumière`). Sur les trois autres
   documents du même dossier, N1 fait mieux, et nettement : `piste cyclable`,
   `stationnement payant` et `école` arrivent premiers avec un score trois
   fois supérieur au reste. Le verdict est donc défendable — mais il repose
   sur un seul jeu de quatre contrats de quarante-cinq mots, taillés pour la
   démonstration. La règle R4 demande de confronter le verdict aux données, et
   T4 d'écrire le test comparatif : il existe, il porte sur un seul corpus, et
   ce corpus est le meilleur cas possible. Il faut un second corpus de
   documents courts, où les égalités dominent, et publier ce qu'il montre — y
   compris quand il n'arrange pas.

### Remarques non bloquantes

1. **`top` coupe dans une zone d'égalité sans le dire.** Tant que le point 1
   n'est pas réglé, `extract_key_terms_in_corpus(..., top=5)` rend cinq termes
   sur douze équivalents, et l'appelant croira lire les cinq meilleurs. Le
   rapport pourrait rendre le nombre de termes à égalité avec le dernier
   retenu.

2. **Le seuil des deux documents est bien gardé mais peu utile.** « a corpus of
   at least two documents is required » : avec deux documents, `log(2/1)` vaut
   0,69 et `log(2/2)` vaut 0, donc le classement est binaire — présent chez
   l'autre ou non. La docstring dit déjà « two documents are not a
   collection » ; la mettre en garde plutôt qu'en commentaire, ou relever le
   plancher, serait cohérent.

3. **R11 — points de rupture de 103 et 101 mots.** Les deux plus longs du lot
   avec la fiche 24, et celui de N0 fait trois phrases. Le contenu est
   excellent — la préposition française qui coupe « moulin à café » est un vrai
   trait de la langue du lecteur — mais la troisième phrase, qui explique la
   réponse de `yake`, appartient à la docstring. Voir la synthèse.

### Ce qui est solide

- Le raisonnement sur l'énoncé, qui fait basculer le verdict à N1, est le
  meilleur morceau de pensée du lot. Il est juste, il est écrit en trois
  lignes, et il est démontré par un test qui met les deux niveaux côte à côte.
- Le refus de plancher le logarithme à un comme le fait `scikit-learn`, avec
  la raison — un terme présent dans tous vos documents n'est le mot-clé
  d'aucun — et le renvoi à la fiche `show-similar-articles`, qui emploie la
  forme lissée pour une autre raison. C'est de la vraie cohérence de catalogue.
- La liste de mots vides exigée de l'appelant, sans défaut, avec
  l'argument : « elle est propre à chaque langue et elle est tout le travail ».
  J'ai vérifié ce que coûte une mauvaise liste : avec une liste sans les formes
  de « être », N0 rend « stationnement payant sera étendu ». La fiche a raison
  d'en faire la responsabilité de l'appelant, et raison de le dire.
- Les deux outils du domaine nommés et écartés sur des faits vérifiables — la
  LGPL de `yake`, l'absence de licence déclarée dans le paquet publié de
  `keyword-extractor`. Une licence manquante est une raison d'écarter qui tient
  devant un juriste, et elle est rarement citée.
- L'`escalate_when` de N1 est juste et non trivial : « le comptage ne rapproche
  pas deux mots qui ne s'écrivent pas pareil ». Il couvre d'avance le
  singulier/pluriel que l'on voit dans les sorties.
- Le point de rupture de N0 est un vrai trait de la langue française — le terme
  construit sur une préposition, coupé par la liste qui fait marcher la
  méthode — et non un cas exotique. C'est R1 bien appliquée.
