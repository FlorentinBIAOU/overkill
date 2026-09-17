# write-product-descriptions — vérification du lot 16

Avis d'origine : `docs/lot15/avis/write-product-descriptions.md` (REFUSÉE).

## Motif 1 — le non-déterminisme était présenté comme un prix permanent

**Le refus.** Le verdict disait « une copie tirée à température non nulle donc
jamais relue une bonne fois », et le `breaking_point` de N3 « rien ne fait de la
copie relue hier celle qu'un nouvel appel écrit aujourd'hui ». Dans l'usage, une
description se génère une fois par article, se range dans le catalogue et c'est
le texte stocké qui est publié : la relecture vaut une bonne fois, comme pour un
texte de rédacteur. Le vrai prix est la régénération.

**Ce qui a été fait.** La première branche de l'avis, avec la phrase que la
seconde demandait.

- **La fin du `breaking_point` de N3 est réécrite sur le cas vrai** : « La copie,
  elle, se génère une fois par article et se range dans le catalogue : c'est ce
  texte-là qu'on relit et qu'on publie. Ce qui se paie, c'est la régénération —
  un dossier produit corrigé, et la phrase relue hier n'est plus celle qui
  partira. » Même correction en anglais.
- **Le verdict dit le stockage et le versionnement** : « la copie […] se range
  dans le catalogue et s'y versionne comme un texte de rédacteur — c'est le texte
  stocké qui est publié, pas un appel par affichage de page », et le prix devient
  « une relecture à refaire à chaque régénération ».

**La preuve.** Aucune affirmation nouvelle sur le comportement du modèle n'a été
ajoutée : ce qui reste affirmé de la température est ce que le test épingle déjà
(`point de rupture : l'extrait demande une température non nulle`, qui vérifie la
valeur envoyée, 0,7 par défaut et 0,4 quand on la passe) — et l'adaptateur la
transporte maintenant jusqu'au kit, voir le motif 3.

## Motif 2 — N2 ne nommait aucun modèle de départ

**Le refus.** `LocalCopywriter(checkpoint="./models/catalogue-copy")` pointait un
répertoire qui n'existe pas, et la fiche ne nommait ni le point de contrôle à
affiner, ni sa licence, ni ce que l'affinage demande. `cost` et `latency`
n'avaient donc aucune base.

**Ce qui a été fait.** La première branche : le point de départ est nommé et
vérifié sur sa fiche.

- **`BASE_CHECKPOINT = "moussaKam/barthez"`**, avec le commentaire qui dit quoi
  lire avant de s'engager : « language, licence, size. This one says French,
  Apache 2.0, 165 M parameters. »
- **`CHECKPOINT = "./models/catalogue-copy"` est dit pour ce qu'il est** : « the
  output of that training, not a model to download ».
- **Les docstrings disent que l'affinage n'est pas dans le fichier et ce qu'il
  demande** : « one pair per description your catalogue has already published —
  the record on one line, as `_source` writes it below, and the published
  description as the target. You are not buying a corpus; you are using the one
  your shop wrote. » Traduit dans `doc.fr.yaml`.
- **Le `name` du niveau porte le modèle** : « Petit modèle génératif auto-hébergé
  (BARThez affiné sur vos descriptions déjà publiées) », et le périmètre
  réglementaire nomme la licence Apache 2.0 du point de contrôle de départ.
- **`cost` et `latency` sont rattachés à une taille publiée**, et la source le dit
  sans prétendre à une mesure : « c'est de cette taille que se lisent
  `cost: modéré` et `latency: ~1 s`, aucune mesure n'ayant été faite ici ».

**La preuve.** `le point de contrôle de départ est nommé, et celui qui écrit est
le vôtre`, dans les deux langages : `BASE_CHECKPOINT` vaut le dépôt publié,
`CHECKPOINT` est un chemin local, et le constructeur charge bien ce dernier par
défaut. Les faits de la fiche du modèle (français, Apache 2.0, BASE 12 couches et
165 M de paramètres, `MBartForConditionalGeneration` donc chargeable par
`AutoModelForSeq2SeqLM`) sont lus sur la fiche et cités en `sources`. Le chiffre
de la taille du corpus de préentraînement, publié sur la même fiche, n'est pas
repris : `check-figures` refuse une taille en octets sans mesure faite ici, et la
phrase se tient sans elle.

## Motif 3 — marquages actifs et adaptateur N3 non testé

**Le refus.** Deux `INFIRMÉ` sur un chiffre périmé (« vingt formulations »), deux
`DÉFAUT` décoratifs, et aucun test ne faisait tourner `ProviderClient` /
`providerClient`.

**Ce qui a été fait.**

- **Les deux `INFIRMÉ`** deviennent `le gabarit compte seize formulations`, sur le
  chiffre que le verdict affirme aujourd'hui, avec la phrase qui dissipe la
  confusion relevée en remarque non bloquante : seize formulations écrites dans
  l'extrait, douze motifs de phrase sur deux cents articles une fois les valeurs
  propres à l'article effacées. Le verdict le dit dans les deux langues.
- **Les deux `DÉFAUT`** (py, js) sont remplacés par trois tests d'adaptateur par
  langage, contre `_harness/fake_sdk.py` et `fake-sdk.mjs` (règle T2) : la
  requête (`endpoint`, `model`, message utilisateur, **température demandée**,
  0,4 puis 0,7 par défaut), un `content` nul qui lève `DescriptionUnavailable`
  après trois appels, et une panne du kit retentée. Les doubles locaux
  `RealShapedClient` / `realShapedClient` n'avaient plus d'emploi et sont
  supprimés.
- **Le commentaire de `n2.test.js` qui renvoyait à un `DÉFAUT` de `n2.test.py`**
  (« Python la publie telle quelle ») était faux : `_generate` refuse déjà une
  réponse qui n'est pas une chaîne. Les deux tests le disent maintenant de la
  même façon, et le nom `test_defaut_…` est retiré.

**La preuve.** `node scripts/test-snippets.mjs write-product-descriptions` :
**6 extraits, 3 py, 3 js, aucun échec**, et plus aucun `INFIRMÉ`, `DÉFAUT` ni
`xfail` dans le dossier.

## Remarques non bloquantes de l'avis

- **Deux comptes à une phrase d'écart** : traité au motif 3, les deux chiffres
  sont gardés et distingués, chacun avec son test.
- **L'API de traitement par lots** : une phrase ajoutée au verdict, dans les deux
  langues, sans chiffre de prix. Le guide du fournisseur est cité en `sources`
  (« 50% cost discount compared to synchronous APIs », « Each batch completes
  within 24 hours ») et en lecture complémentaire.
- **Qui tient la liste de termes** : dit dans le périmètre réglementaire de N2,
  « cette liste relève de qui répond des allégations — responsable qualité ou
  juriste —, pas de qui écrit le code ».

## État

**Levée.** `test-snippets` vert (6 extraits) ; `check-content`, `check-figures`,
`check-french` verts ; `npm run check:fast` vert.
