# forecast-weekly-sales — vérification du lot 16

Avis d'origine : `docs/lot15/avis/forecast-weekly-sales.md` (REFUSÉE).

## Motif 1 — le verdict était contredit par les séries de la fiche

**Le refus.** Le verdict présentait N1 comme la réponse au mouvement de
l'activité. Sur le mouvement le plus courant, un changement de niveau, N1 se
trompe de +28 % quand N0 se trompe de −3 %, et lit encore 80 unités de
croissance annuelle sur un commerce qui a perdu 30 %.

**Ce qui a été fait.** La seconde branche de l'avis, avec la mesure du premier
terme publiée en prime.

- **Le verdict est réécrit sur ce que les tests montrent**, avec les trois
  lignes chiffrées : croissance régulière (vérité 1 464 : N0 1 254, N1 1 482),
  concurrent qui ouvre (vérité 1 025 : N0 995, N1 1 310), semaine de Noël
  (vérité 2 204 : N0 2 356, N1 1 527). Et comment choisir : tenir les dernières
  semaines à l'écart de l'ajustement et comparer les deux dessus.
- **`escalate_when` de N0 est restreint à la croissance**, avec l'avertissement
  explicite de ne pas monter pour le recul.
- **Le `breaking_point` de N1** porte désormais les deux angles morts avec leurs
  nombres : la rupture de régime et le pic étroit.
- **L'outil du prévisionniste est nommé et mesuré.** Le verdict dit que sur une
  série qui change de niveau, l'outil est un lissage exponentiel à tendance et
  saisonnalité, et `sources` cite la mesure : `statsmodels` 0.14.6,
  `ExponentialSmoothing(trend="add", seasonal="add", seasonal_periods=52).fit()`,
  exécuté sur les deux séries du test — 1 486 contre une vérité de 1 464, et
  1 034 contre 1 025, soit 1 % dans les deux cas.

**La preuve.** Test `verdict : sur un changement de niveau, N0 bat N1`, en
Python et en JavaScript : le niveau recommandé et celui du dessous sur le point
de rupture du niveau recommandé (règle T4), avec les trois nombres affirmés
exactement et le témoin — sur la croissance régulière, N1 gagne.

## Motif 2 — la série « vérité » était de la forme du modèle

**Le refus.** `growing_shop` est une constante, une droite, une sinusoïde
annuelle et sa seconde harmonique : exactement les colonnes de la matrice de
conception. Le test « prévoit à deux pour cent près » démontrait que les
moindres carrés retrouvent leurs propres coefficients.

**Ce qui a été fait.** Règle T3.

- Le test est renommé `prévoit la semaine suivante à deux pour cent près, sur
  une série de sa propre forme`, et sa docstring dit ce qu'il démontre et ce
  qu'il ne démontre pas, avec le renvoi au témoin.
- Une série témoin est ajoutée, `bakery`, qui viole l'hypothèse du modèle : un
  pic de Noël étroit sur deux semaines, une semaine fermée en août, un bruit
  multiplicatif. Test `verdict : sur une série hors de la forme du modèle, N0
  bat N1`, deux langages.
- Le verdict ne s'appuie plus sur « un test qui relit la pente » : il s'appuie
  sur les trois mesures.

## Remarques non bloquantes de l'avis

- **`season_length` fractionnaire.** Dit dans la docstring de N1 et sa
  traduction : une année fait 365,25 / 7 semaines, l'année ISO en compte 53 tous
  les cinq ou six ans, et N0 ne peut pas suivre puisqu'il indexe par
  « semaine modulo saison ». Testé dans les deux langages.
- **Le pic de Noël sous-prévu.** Entré dans le `breaking_point` de N1, avec son
  nombre.
- **Aucun intervalle.** Dit en dernière phrase du verdict.

## Divergence assumée

L'avis proposait de **remplacer** N1 par un lissage exponentiel. Mesuré,
`statsmodels` le confirme : 1 % d'erreur sur les deux séries, là où les moindres
carrés font +28 % sur l'une. Le niveau n'a pourtant pas changé, pour une raison
de forme et non de fond : chaque niveau de ce site s'écrit dans les deux
langages, et il n'existe pas d'équivalent de `ExponentialSmoothing` en
JavaScript. Une version écrite à la main n'est pas « une vingtaine de lignes » :
la force de `statsmodels` vient de l'estimation conjointe de l'état initial, pas
des trois constantes de lissage — une réimplémentation par recherche sur grille,
essayée ici, tombe à −13 % là où `statsmodels` fait +1 %. La fiche montrerait
alors deux modèles différents sous un même nom. Le choix est donc : garder les
moindres carrés, publier les trois mesures, et envoyer le lecteur au lissage
exponentiel dans le verdict et dans les sources.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts (`statsmodels` ajouté au lexique). Cette fiche ne portait
aucun marquage et n'a pas de niveau N3.
