# show-similar-articles — vérification du lot 16

Avis d'origine : `docs/lot15/avis/show-similar-articles.md` (REFUSÉE). Le fond
de la fiche était jugé bon ; le refus portait sur les preuves.

## Motif unique — neuf marquages, tous périmés

Pour chacun, la phrase contredite avait bien disparu de la fiche, des
docstrings, de la traduction et de l'essai ; le test, lui, était resté. Chacun
devient la démonstration de ce que la fiche dit aujourd'hui.

- **N0, « une étiquette presque universelle laisse des lignes vides »** →
  `escalate_when : les deux signes sont la ligne vide et le voisin à 1,0`.
  L'escalade nomme deux signes distincts ; le test montre les deux sur le même
  fonds, la ligne vide d'un côté, les voisins à 1,0 de l'autre.
- **N1, « l'annonce ne partage que de la grammaire »** →
  `ce que l'annonce partage avec l'article anglais`, qui épingle l'ensemble
  exact : `{and, day, is, of, the, will}`. Le témoin suivant, déjà présent,
  montre que même sans « day » l'annonce reste devant le jumeau.
- **N1, « un mot présent partout ne pèse presque rien »** →
  `un mot présent partout pèse le moins, mais pas rien` : trois articles qui ne
  partagent que « the » sont voisins à 0,583, et la même table avec le mot dans
  la liste rend trois lignes vides. C'est l'argument du prix de N1, mesuré.
- **N1, « sans liste de mots vides, le classement tient encore »** : supprimé,
  le test voisin le démontrait déjà (l'affûtage apparié à l'annonce du site,
  0,054).
- **N1, « la table ne change qu'à la publication ou au réétiquetage »** →
  `réécrire un article change la table, puisque ce niveau lit le texte`, avec le
  scénario qui dit désormais « publié, réécrit, ou dont les étiquettes
  changent », et la ligne mesurée : `[["knife-sharpening", 0.124]]` là où la
  table de référence n'a rien.
- **N1, « écarter les jetons d'une lettre ne coûte rien »** →
  `un mot d'une lettre est écarté, et cela coûte le sujet de l'article` : deux
  articles dont C est le sujet ont un cosinus nul, et nommés en entier ils se
  retrouvent. Le commentaire du code dit la règle, le test en dit le prix.
- **N1, « sans lissage, un terme présent partout diviserait par zéro »** →
  `le lissage ne protège d'aucune division par zéro ici` : le vocabulaire vient
  du fonds, donc tout terme vu figure dans au moins un document. Ce que le
  lissage change est mesuré à la place.
- **`n1.test.js`, « un zéro est l'absence de tout mot commun »** →
  `essai : un zéro est l'absence de tout mot commun, mots vides mis à part` : les
  mots communs existent (« un », « de »), et ils sont tous dans la liste de mots
  vides de l'essai.
- **N2, « le modèle reste chargé entre deux constructions »** →
  `le modèle est chargé par construction, et lâché ensuite`, ce qui est
  précisément ce qui sépare ce niveau d'un modèle interrogé à l'affichage.

**La preuve.** `node scripts/test-snippets.mjs show-similar-articles` :
**6 extraits, 3 py, 3 js, aucun échec**, et `check-marquages` est vert sur les
vingt-cinq fiches du catalogue.

## Remarques non bloquantes de l'avis

- **Sources absentes** : les trois pages sont entrées dans `sources`, chacune
  revérifiée à la source — `sentence_bert_config.json` du modèle
  (`"max_seq_length": 128`), `tokenizer_config.json` du dépôt Xenova
  (`model_max_length` 512), et la page « Computing Embeddings » de SBERT
  (« longer texts will be truncated to the first `model.max_seq_length`
  tokens »).
- **L'écart 128 / 512 est un piège d'exploitation** : dit dans les deux
  docstrings, dans la traduction et dans le point de rupture — « the same
  article gets two different vectors depending on which runtime encoded it, with
  no error anywhere. Build the table and encode a new article with the same
  one. »
- **Ce qu'on encode** : une phrase dans les docstrings et dans l'`escalate_when`
  de N2 — pour des articles, le titre et le chapeau valent mieux que le texte
  entier coupé au milieu d'un paragraphe.
- **Articles récents** : le `scenario` dit désormais quand la table se
  reconstruit et ce qu'on montre en attendant — « à chaque publication, ou la
  nuit […] montrez-lui ceux de sa rubrique en attendant ».
- **Le point de rupture de N2, six phrases** : ramené à deux.

## État

**Levée.** `test-snippets` vert (6 extraits) ; `check-marquages` vert sur tout
le catalogue ; `check-content`, `check-figures`, `check-french` verts ;
`npm run check:fast` vert.
