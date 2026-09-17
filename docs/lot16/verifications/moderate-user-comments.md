# moderate-user-comments — vérification du lot 16

Avis d'origine : `docs/lot15/avis/moderate-user-comments.md` (REFUSÉE).

## Motif 1 — le modèle de N2 ne note que l'anglais, et la fiche se taisait

**Le refus.** `unitary/unbiased-toxic-roberta` est entraîné sur Civil Comments,
en anglais. Le public de ce site est d'abord francophone ; branché sur un forum
français, le niveau recommandé rend des notes sans valeur et sans erreur. Tous
les exemples de la fiche étant anglais, rien ne le montrait.

**Ce qui a été fait.** Les deux branches à la fois : l'identifiant multilingue
est nommé et vérifié, **et** la langue est écrite dans le niveau et le verdict.

- **L'extrait publie les deux couples**, modèle et étiquettes ensemble, parce
  qu'ils ne se séparent pas : `ENGLISH` (sept nuisances, corpus anglais) et
  `MULTILINGUAL`. La dernière ligne choisit, et elle est commentée : « The
  examples on this page are English, so this file is set to the English pair. A
  French forum swaps the line, and loses the breakdown with it. »
- **`moderate` prend les étiquettes en paramètre** (`labels`), pour que le couple
  reste cohérent quand on en change.
- **L'identifiant multilingue est vérifié sur sa fiche** :
  `gravitee-io/distilbert-multilingual-toxicity-classifier` en Python,
  `onnx-community/distilbert-multilingual-toxicity-classifier-ONNX` (la même
  conversion ONNX, pour Transformers.js) en JavaScript — quatorze langues dont
  le français, étiquettes `not-toxic` et `toxic`, licence `openrail++`, F1 de
  validation français publié par les auteurs. Le modèle `multilingual` de
  Detoxify que la fiche du modèle anglais propose n'a pas de conversion pour
  Transformers.js : il n'aurait pas tenu dans les deux langages.
- **Le `name`, le `breaking_point` et le `verdict_rationale` disent la langue**,
  et disent ce qu'elle coûte : le couple multilingue couvre le français mais ne
  rend qu'une étiquette, « toxic », donc « le relecteur reçoit un nombre et plus
  une raison ».

**La preuve.** `point de rupture : le couple multilingue ne rend qu'une
étiquette`, dans les deux langages : le couple par défaut est l'anglais, le
multilingue est nommé avec sa seule étiquette, le même commentaire rend
`insult 0,96` d'un côté et `toxic 0,96` de l'autre, et brancher le couple
anglais sur des notes multilingues ne lève pas — la décision tombe en
« review », ce qui est exactement le silence que l'avis reproche.

## Motif 2 — N3 payait ce que le fournisseur rend gratuitement

**Le refus.** Le fournisseur pris en exemple par tout le catalogue publie un
point d'accès de modération dédié et gratuit, dont les catégories sont celles
que l'extrait faisait noter à un modèle de conversation. Et la seule raison de
préférer un modèle de conversation — une catégorie qui n'a d'étiquette nulle
part — n'était pas exploitée : `CATEGORIES` ne contenait pas la divulgation d'un
domicile, que le point de rupture de N2 montre pourtant.

**Ce qui a été fait.** La seconde branche de l'avis.

- **`personal_information` entre dans `CATEGORIES`** et dans l'invite, avec sa
  définition (« giving out where somebody lives, works, or how to reach them,
  without their consent »), puisque c'est le modèle qui décide du sens.
- **La docstring dit pourquoi ce fichier existe** : « Before writing this, look
  at whether your provider publishes a moderation endpoint. […] If the harms you
  care about are on that list, this file is the expensive way to get them. What
  it buys, and the only thing it buys, is a category that is yours ».
- **Le `name` et le `breaking_point` du niveau le disent aussi**, et le verdict
  ferme la porte : « le fournisseur pris en exemple publie un point d'accès de
  modération dédié que sa documentation donne pour gratuit : personne ne paie un
  modèle de conversation pour ce qu'il rend sans compteur ».
- **`cost: élevé` est conservé**, et c'est maintenant le bon chiffre pour la
  bonne approche : ce que coûte le modèle de conversation, pour la seule chose
  qu'il apporte.
- **La page du fournisseur est citée en `sources`** : « The moderation endpoint
  is free to use », `omni-moderation-latest`, et ses treize catégories, dont
  aucune ne nomme la divulgation d'informations personnelles.

**La preuve.** `la catégorie que N2 n'a pas est demandée, et elle peut décider`,
dans les deux langages : la catégorie est la dernière de la liste, elle est dans
l'invite avec sa définition, elle bloque le commentaire d'adresse — et, témoin,
les quatre autres catégories le publient.

## Motif 3 — quatre marquages vivants

**Le refus.** Quatre défauts encore actifs sous marquage, donc quatre défauts
réels sur une fiche publiée.

- **`casefold` avant NFKD** (N0, py) : `𝐁𝐋𝐎𝐑𝐏𝐓𝐀𝐑𝐃` devenait `BLORPTARD` et
  n'était jamais replié. Corrigé : NFKD, repli de casse, NFKD de nouveau. La
  parité avec JavaScript, qui les signalait déjà, est testée.
- **Les diacritiques non latins** (N0, py et js) : une voyelle du devanagari est
  une marque, `मल` se trouvait dans `कोमल` et la fenêtre de `तुम कमीने हो` sortait en
  morceaux. Corrigé des deux côtés : le découpage garde les marques
  (`[\p{L}\p{N}\p{M}]` en JavaScript, une boucle sur les catégories Unicode en
  Python, faute de classe équivalente), et le repli ne retire que les accents
  latins, U+0300 à U+036F.
- **Le commentaire de `n0.js`** disait que « ß » et « ς » sont les deux seules
  lettres dont le repli diverge des minuscules : il y en a 254. Le commentaire
  dit maintenant « two hundred and fifty-two others, in Cherokee, Greek and
  Cyrillic », et le test les compte sur la table Unicode elle-même.
- **Un commentaire d'espaces notait 0,71 en JavaScript** (N1), au-dessus du
  seuil : un formulaire vide envoyé en modération. Corrigé : un n-gramme qui
  n'est fait que de blancs n'est pas une preuve, et n'est plus haché — ce que
  Python ne faisait jamais, son analyseur bordant chaque mot plutôt que le
  commentaire entier.
- **Une réponse close par une seule clôture ```` ```json ````** n'était pas
  décodée (N3, py et js) : trois appels facturés puis une erreur, contre la
  décision 12. Corrigée dans les deux langages, avec ou sans le mot `json`, et
  le test qui montre que tout autre écart lève toujours est conservé.

**La preuve.** `node scripts/test-snippets.mjs moderate-user-comments` :
**8 extraits, 4 py, 4 js, aucun échec**, et plus aucun `INFIRMÉ`, `DÉFAUT`,
`xfail` ni `assert.rejects` décoratif dans le dossier. Chaque marquage est
devenu un test qui affirme le comportement réparé, avec son témoin.

## Remarques non bloquantes de l'avis

- **Le corpus américain de N2** : la langue est désormais dite, et le
  `breaking_point` nomme le corpus.
- **Le plafond de N3 sur un commentaire long** : le commentaire du code dit
  maintenant où va un commentaire trop long — « On a forum that is the review
  queue, not the bin — a comment of four thousand and one characters is not an
  anomaly. »
- **La troncature de N2** : entrée dans le `breaking_point`, « une insulte à la
  fin d'un long message passe ».
- **Les deux seuils** : présentés comme des valeurs à étalonner, dans le
  commentaire du code (« These two numbers are examples, not defaults to leave
  alone: calibrate them on a sample of your own comments that somebody has read
  by hand ») et dans le verdict.

## État

**Levée.** `test-snippets` vert (8 extraits) ; `check-content`, `check-figures`,
`check-french` verts (`toxic` et `comments` ajoutés au lexique) ; `npm run
check:fast` vert.
