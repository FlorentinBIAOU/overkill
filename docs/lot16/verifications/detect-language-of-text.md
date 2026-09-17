# detect-language-of-text — vérification du lot 16

Avis d'origine : `docs/lot15/avis/detect-language-of-text.md` (REFUSÉE).

## Motif 1 — le verdict reprochait à N1 ce que N0 fait aussi

**Le refus.** Le verdict tenait sur une seule idée : « son seul signal est
l'écart entre les deux premières langues, et cet écart s'effondre exactement là
où il le faut ». Mesuré avec les profils du test, `ranked("chat")` rend
`en 158, es 300, fr 300` : un écart de 142 sur une échelle de 300, sur une
réponse fausse. L'`escalate_when` de N0 (« vous voyez l'écart tomber à zéro »)
ne se déclenchait donc pas sur le cas même que cite le `breaking_point`.

**Ce qui a été fait.** La première branche de l'avis : l'argument devient le
message bilingue, et « chat » est dit comme un échec commun aux deux niveaux.

- **Le `verdict_rationale` est réécrit.** Il porte sur le message qui contient
  deux langues (l'écart se resserre là où la probabilité de N1 monte à la
  quasi-certitude), puis dit en toutes lettres que sur le mot isolé « aucun des
  deux ne prévient » et que « la seule parade est de savoir que vos textes sont
  courts ».
- **L'`escalate_when` de N0 change d'événement observable** : la longueur des
  textes, pas l'écart. « C'est leur longueur qui doit vous alerter, pas
  l'écart : l'écart ne signale rien sur un mot isolé. »
- **La docstring de `ranked` ne présente plus l'écart comme une mesure de
  confiance.** Elle dit l'échelle, qui manquait au lecteur (`PROFILE_SIZE` au
  pire), et ce que l'écart est : « how far the runner-up finished behind, not
  how right the winner is. A single word can win by half the scale and still be
  the wrong language. » Deux langages, plus la traduction.
- **L'essai interactif est corrigé au même endroit** : sa note disait « l'écart
  entre les deux premières dit ce que vaut la réponse ».

**La preuve.** `escalate_when : un mot isolé peut sortir faux avec l'écart le
plus large`, en Python et en JavaScript : `detect("chat") == "en"`,
`gap("chat") == 142.0`, et `gap("chat") > gap(FRENCH)` — l'écart d'un mot faux
est plus large que celui d'une phrase entière juste. Et
`l'écart se resserre sur le message bilingue et tombe à zéro sur « ça va »` :
`gap(MIXED) = 3,4` contre `gap(FRENCH) = 12,1`, `gap("ça va") = 0`. La règle T4
était déjà tenue par `verdict : N0 ne se tait pas non plus sur « chat »` ; sa
docstring cite désormais la nouvelle phrase.

## Motif 2 — N2 était fermé sur une raison qui ne tenait pas

**Le refus.** Le lecteur qui doit reconnaître une langue sans échantillon était
envoyé directement à N3, coût élevé, données chez un tiers. La raison donnée
(licence CC BY-SA 3.0 des poids fastText, « un artefact tiers à embarquer ») est
vraie de `scikit-learn` en N1 aussi.

**Ce qui a été fait.** La première branche : **N2 est ouvert**, sur CLD3, le
détecteur dédié de Google, avec `verification: stubbed` comme les N3.

- **`n2.py` et `n2.js` sont écrits** : `gcld3` en Python, `cld3-asm` en
  JavaScript, le même modèle dessous. L'extrait possède trois choses et le dit :
  la correspondance des codes (`hi-Latn`), le refus (« und », `is_reliable`,
  seuil de probabilité), et le chargement (un identifiant construit une fois et
  gardé — `cld3-asm` demande un `dispose()` que personne n'appellera si on en
  crée un par message).
- **Le plancher d'octets est celui de la bibliothèque, pas un chiffre inventé** :
  `MIN_BYTES, MAX_BYTES = 140, 700`, qui sont `kMinNumBytesToConsider` et
  `kMaxNumBytesToConsider` de `nnet_language_identifier.cc`. C'est ce plancher
  qui fait l'intérêt du niveau dans cette fiche — sous 140 octets la
  bibliothèque répond « und » au lieu de deviner, ce que ni N0 ni N1 ne savent
  faire — et c'est aussi son point de rupture : sur un objet de message, elle ne
  répond pas.
- **L'`escalate_when` de N1 pointe vers cette solution locale** avant N3, et le
  `verdict_rationale` dit en une phrase que « couvrir une centaine de langues est
  l'affaire d'un identifiant dédié local, embarqué avec son modèle, pas d'un
  appel de modèle généraliste ».
- **Les faits sont vérifiés à la source et cités** dans `sources` : le dépôt
  `google/cld3` (licence Apache 2.0, table des langues où figure `hi-Latn`,
  dépôt archivé le 15 juin 2024 — dit dans le périmètre réglementaire du
  niveau : le modèle est figé, personne ne corrigera une langue mal reconnue) ;
  `gcld3` 3.0.13 sur PyPI, publié par Google, « contains the inference code and
  a trained model », donc aucun téléchargement à l'exécution ; `cld3-asm` 4.0.0,
  liaison WebAssembly sous licence MIT.
- La ligne N2 de `docs/sprints/MATRICE-EXTRAITS.md` est corrigée et le manifeste
  régénéré (74 niveaux disponibles, 45 exécutés, 29 doublés).

**La preuve.** `node scripts/test-snippets.mjs detect-language-of-text` :
**8 extraits, 4 py, 4 js, aucun échec**. Quinze tests Python et quatorze
JavaScript sur N2, dont :

- `point de rupture : le code rendu est celui de CLD3, pas le vôtre` — `hi-Latn`
  rendu tel quel, témoin l'hindi en devanagari qui rend `hi` ;
- `production : l'adaptateur appelle la surface du vrai kit` — sur un double à
  la forme de `gcld3` (`NNetLanguageIdentifier(min_num_bytes=…,
  max_num_bytes=…)` puis `FindLanguage(text=…)`) et de `cld3-asm`
  (`loadModule()`, `create(minBytes, maxBytes)`, `findLanguage(text)`), avec les
  trois champs lus ;
- `le plancher et le plafond sont ceux de la bibliothèque` — 140 et 700, passés
  au constructeur ;
- `quatre refus, et ils ne sont pas le même dit quatre fois` — vide, « und »,
  `is_reliable` faux, sous le seuil, plus la limite exactement au seuil ;
- `l'identifiant par défaut n'est construit qu'une fois`, et, en JavaScript,
  `un chargement raté n'est pas mis en cache` (deux appels, deux
  `ERR_MODULE_NOT_FOUND`).

Ce que ces tests ne prouvent pas est écrit en tête des deux fichiers : qu'ils ne
mesurent pas la justesse de CLD3. La fiche ne l'affirme nulle part.

## Motif 3 — `MAX_CHARACTERS` ne contrôlait rien et faisait planter les longs messages

**Le refus.** Seuls les 600 premiers caractères partent (`EXCERPT_CHARACTERS`) :
le plafond de 8 000 ne bornait aucun coût, mais levait sur le premier courriel
de 8 001 caractères.

**Ce qui a été fait.** La première branche : le plafond est **supprimé**, en
Python et en JavaScript.

- `MAX_CHARACTERS` n'existe plus. Le commentaire d'`EXCERPT_CHARACTERS` dit
  maintenant où est le contrôle de coût : « That excerpt is the whole cost
  control — there is no cap on the input, because a cap would refuse a long
  email that costs exactly the same as a short one. »
- La docstring d'en-tête ne liste plus « cap the input » parmi ce que le niveau
  oblige à écrire, dans les deux langages et dans la traduction.
- Les cinq tests qui épinglaient le plafond sont remplacés :
  `un texte très long n'est pas refusé, seul l'extrait part` (cent mille
  caractères, un seul appel, la requête finit par les 600 caractères de
  l'extrait et n'en contient pas 601),
  `production : cinq mille emoji font cinq mille caractères, pas dix mille`
  (l'affirmation de comptage reste, sans le plafond), et
  `production : cent mille caractères blancs ne coûtent aucun appel`.

**La preuve.** Les deux langages, dans le même passage vert que ci-dessus.

## Remarques non bloquantes de l'avis

- **La taille de l'échantillon.** Ajouté à la docstring d'en-tête de N0 et à sa
  traduction : « One paragraph per language is enough to see this work. It is
  not enough to deploy […] Cavnar and Trenkle built theirs on corpora. Take
  several pages. »
- **L'échelle de l'écart.** C'est la docstring de `ranked` corrigée au motif 1 :
  la distance vaut au plus `PROFILE_SIZE`, et le test
  `la distance est bornée par la taille du profil` l'épingle.
- **La boucle de réessai de N3 attrapait les erreurs de programmation.** Elle
  relaie désormais `TypeError`, `NameError` et `AttributeError` (Python),
  `TypeError` et `ReferenceError` (JavaScript) au lieu de payer trois appels
  pour un bogue local ; les erreurs du client et du décodeur restent retentées.
  Les tests de réessai existants le vérifient toujours, le double `FakeLLM`
  levant une erreur de fournisseur.

## Marquages

Aucun `INFIRMÉ`, `DÉFAUT` ni `xfail` ne subsiste dans les huit fichiers de test
de la fiche. Les noms qui disaient encore l'ancienne phrase du verdict ont été
réécrits sur la nouvelle, dans les deux langages.

## État

**Levée.** `node scripts/test-snippets.mjs detect-language-of-text` vert (8
extraits) ; `check-content`, `check-figures`, `check-french` verts (`latn` et
`und` ajoutés au lexique de projet) ; `npm run check:fast` vert.
