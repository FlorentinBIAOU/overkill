# extract-the-latest-reply-from-an-email-thread — avis du relecteur

## Tour 1 — REFUSÉE

Le raisonnement qui mène à écrire les marqueurs plutôt qu'à appeler les deux
bibliothèques est le mieux argumenté du lot : elles se contredisent sur le même
fil français, la fiche le mesure, et deux extraits qui ne répondent pas la même
chose sur une page qui montre les deux ne servent à rien. Les marqueurs
couvrent Gmail, Outlook français, Apple Mail et « Message d'origine » — je les
ai tous passés, et la coupe est juste à chaque fois.

Le refus porte sur le champ `reason`, qui est faux sur la majorité des fils
ordinaires, et qui est précisément celui dont dépend la décision de payer un
appel de modèle.

### Raisons du refus

1. **La ligne d'attribution est comptée comme du texte écrit sous la
   citation.** `_first_marker` rend l'index de la ligne
   « Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit : »
   avec le type `quoted`, et `_unquoted_under(lines[cut:])` compte ensuite
   toutes les lignes non préfixées par `>` — donc **cette ligne-là d'abord**,
   qui fait soixante-neuf caractères. Toute réponse plus courte que la ligne
   d'attribution déclenche donc le signal.

   | Réponse | Longueur | `reason` |
   |---|---|---|
   | « Oui. » | 4 | **« more text was written under the quote than above it »** |
   | « Oui, c'est signé. » | 17 | **idem** |
   | « Bonjour Marie, / Oui, le contrat est signé. / Bien à vous, / Jean Dupont » | 68 | **idem** |
   | la même, avec une phrase de plus | 125 | `None` |

   Les deux langages font la même erreur, je les ai passés tous les deux. Or
   une réponse d'affaires courte — « C'est noté », « Oui, je confirme »,
   « Ci-joint » — est le cas majoritaire d'une boîte aux lettres.

   La conséquence n'est pas cosmétique : l'`escalate_when` de la fiche dit
   « Le rapport signale qu'il y a plus de texte sous la citation qu'au-dessus…
   Pour ces fils-là, et pour ceux-là seulement, le niveau N3 lit ce qu'aucun
   marqueur ne délimite ». Un lecteur qui suit cette consigne enverra au
   niveau N3 — `cost: modéré`, `data_egress: third-party`, un appel facturé
   par message — la plus grande part de ses fils, alors que N0 les a
   parfaitement découpés. Une fiche dont la règle de montée dans l'échelle se
   déclenche à tort sur le cas courant retourne son propre argument.

   Correctif : la ligne d'attribution fait partie de l'habillage de la
   citation, pas de ce qui est écrit dessous. Compter à partir de
   `lines[cut + 1:]` quand le marqueur est une attribution (et, pour un
   marqueur `>`, la ligne de coupe est déjà exclue par le filtre existant).
   On saura que c'est fait quand « Oui. » suivi de l'attribution et de deux
   lignes citées rendra `reason: None`.

2. **Le fixture du test passe à trente-cinq caractères près.** `FIL_FR`
   (`n0.test.py:15`) porte une réponse de 104 caractères, et
   `test_point_de_rupture_temoin_le_fil_ordinaire_revient_entier` affirme
   `reason is None`. Une phrase de moins dans le fixture et le test tombait.
   C'est le cas typique d'une donnée de test choisie du bon côté du seuil sans
   que le seuil soit interrogé. Il faut, une fois le point 1 corrigé, une
   valeur limite explicite : une réponse d'un mot, une réponse de la longueur
   exacte de l'attribution, une réponse d'un caractère de plus — et le
   `reason` attendu pour chacune.

### Remarques non bloquantes

1. **Une réponse qui commence par « Le … a écrit : » est coupée à zéro.**
   `extract_reply("Le client a écrit :\n« merci pour le devis »\n\nJe confirme la commande.\n\nJean")`
   rend `reply: ""`. C'est un vrai message, dont la première ligne cite
   quelqu'un. Le `reason` est levé, donc rien n'est perdu en silence, et le
   `ATTRIBUTION_LINES = 3` limite la casse. Mais la fenêtre de recherche
   pourrait exiger que la ligne d'ouverture contienne aussi une date ou une
   adresse, ce que fait tout client de messagerie.

2. **`quoted_from_line` est un numéro de ligne dans un texte que l'appelant a
   dû redécouper lui-même.** La fiche prend soin d'expliquer pourquoi elle
   coupe sur `\r\n|\r|\n` et pas sur `splitlines()` ; un appelant qui utilise
   ce numéro doit faire exactement le même découpage, et rien ne le lui dit.
   Une phrase dans la docstring.

3. **R11 — `breaking_point` de 84 mots et trois phrases** pour N0. C'est le
   plus long des seize premières fiches. Voir la synthèse.

### Ce qui est solide

- Le verdict est le mieux étayé du lot. Nommer les deux bibliothèques, mesurer
  leur désaccord sur le même fil français, et en tirer la conséquence — les
  écrire soi-même — est exactement ce que R3 demande : l'outil standard est
  nommé, et s'il est écarté, c'est avec une raison mesurée.
- Le refus de toucher à la signature, avec la raison : « un nom seul sur une
  ligne est parfois tout le message », et le renvoi à une autre fiche pour ce
  sujet-là. La frontière du besoin est tenue.
- `ODD_SPACES` et le découpage explicite des fins de ligne, avec le commentaire
  qui dit lesquelles Python et JavaScript ne classent pas pareil : c'est de la
  parité obtenue par construction, pas par rattrapage.
- Les marqueurs couvrent les clients français réels — « De : », « Envoyé : »,
  « Message d'origine », l'attribution Gmail repliée sur deux lignes — et je
  les ai tous vérifiés sur des fils fabriqués à la main, hors du jeu de tests.
- Le niveau N3 rend des numéros de ligne plutôt que du texte : c'est la bonne
  décision, elle évite la reformulation partielle, et elle est cohérente avec
  la fiche 17.
