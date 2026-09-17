# show-similar-articles — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs show-similar-articles` : vert, 3 py, 3 js.

### Raisons du refus

Le fond de la fiche est bon, et le verdict tiendra. Le refus porte sur les
preuves.

1. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   Neuf affirmations marquées, toutes **périmées** d'après ma lecture : les
   phrases qu'elles contredisent ont été retirées ou réécrites par le rédacteur
   (aucune ne se retrouve dans les extraits ni dans la fiche), mais les tests
   sont restés tels quels.

   - `n0` (py, js) : « une étiquette presque universelle laisse des lignes vides » ;
   - `n1` (py, js) : « l'annonce ne partage que de la grammaire » (elle partage « day ») ;
   - `n1` (py, js) : « un mot présent partout ne pèse presque rien » ;
   - `n1` (py, js) : « sans liste de mots vides, le classement tient encore » ;
   - `n1` (py, js) : « la table ne change qu'à la publication ou au réétiquetage » ;
   - `n1` (py, js) : « écarter les jetons d'une lettre ne coûte rien » ;
   - `n1` (py, js) : « sans lissage, un terme présent partout diviserait par zéro » ;
   - `n1.test.js` : « un zéro est l'absence de tout mot commun » ;
   - `n2` (py, js) : « le modèle reste chargé entre deux constructions ».

   Ce qu'il faut faire : pour chacun, vérifier que la phrase a bien disparu
   (fiche, docstrings, `doc.fr.yaml`, essai) ; si oui, réécrire le test pour
   démontrer la formulation actuelle, ou le supprimer si elle ne dit plus rien
   de testable ; si non, corriger la phrase. C'est fait quand
   `grep -rn "xfail\|INFIRMÉ\|DÉFAUT"` ne rend plus rien dans le dossier.

### Remarques non bloquantes

- **Sources absentes de la fiche.** `sources: []`, alors que le `breaking_point`
  de N2 avance deux chiffres de configuration — 128 jetons en Python, 512 en
  JavaScript — que le rédacteur a vérifiés (`sentence_bert_config.json` du
  modèle, `tokenizer_config.json` du dépôt Xenova, citation de sbert.net sur la
  troncature). Ces trois pages sont dans `docs/lot15/corrections/show-similar-articles.md`
  et doivent passer dans `sources` : un lecteur ne lit pas le dossier de
  corrections.
- **L'écart 128 / 512 est un piège d'exploitation, pas seulement une note.**
  Le même modèle rend des vecteurs différents pour un même article long selon
  qu'on le calcule en Python ou en JavaScript. Construire la table dans un
  langage et calculer le vecteur d'un article neuf dans l'autre donne des
  voisins incohérents, sans erreur. Une phrase dans la docstring : « construisez
  et interrogez la table avec le même runtime ».
- **Ce qu'on encode.** Puisque le modèle nommé ne lit que les 128 premiers
  jetons, la pratique courante pour des articles est d'encoder le titre et le
  chapeau, qui résument le sujet, plutôt que le texte entier tronqué au milieu
  du deuxième paragraphe. L'`escalate_when` de N2 (découper en passages) est
  juste pour la recherche ; pour des articles similaires, le titre et le
  chapeau suffisent souvent. Une phrase.
- **Articles récents.** Aucun niveau ne dit ce qu'on fait d'un article publié
  entre deux reconstructions de la table : il n'a pas de voisins, et il
  n'apparaît chez personne. Le `scenario` dit « une table à construire hors
  ligne, quand le fonds change » : ajouter « à chaque publication » ou « la
  nuit, et en attendant, les articles de la même rubrique » règle la question.
- `breaking_point` de N2 : six phrases. L'essentiel tient en deux (un vecteur
  par article, qui mêle ses sujets ; un long article n'est lu que sur son
  début).

### Ce qui est solide

- **Le `scenario` a le bon réflexe d'architecture** : le résultat ne dépend ni
  du lecteur ni de l'instant, donc c'est une table hors ligne, et le code
  d'affichage ne change pas quand on monte d'un niveau. C'est ce qui rend le
  refus de N3 incontestable.
- **Le verdict N1 est celui qu'on retient** pour un site éditorial : TF-IDF et
  cosinus, pas de modèle à charger, et un prix dit honnêtement — la liste de
  mots vides, démontrée par le test (l'affûtage apparié à l'annonce du site).
- **Les points de rupture sont exacts et démontrés avec témoin.** N0 : l'échec
  total d'un étiquetage relâché, dans les deux sens (table vide, voisins
  parfaits sur une étiquette générique) — c'est ce qu'on voit sur un vrai
  fonds. N1 : le jumeau français à cosinus exactement nul, battu par une annonce
  sans rapport. N2 : la digression qui coûte le premier voisin, avec la
  mention claire que les vecteurs sont ceux du double.
- `escalate_when` de N0 est observable sur la table elle-même (lignes vides,
  voisins à 1,0) : c'est un bon modèle pour la charte.
