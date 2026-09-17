# translate-interface-strings — vérification du lot 16

Avis d'origine : `docs/lot15/avis/translate-interface-strings.md` (REFUSÉE, et
rouge sur la machine du relecteur).

## Motif 1 — N0 payait le coût maximal sur le cas majoritaire

**Le refus.** La correspondance exacte était cherchée **dans** la boucle qui
note les correspondances approchées : pour trouver qu'une chaîne est inchangée,
l'extrait comparait d'abord par similarité toutes les entrées qui la précèdent.
Mesuré par le relecteur : exacte en dernière position d'une mémoire de mille
libellés, 106 ms ; deux cents chaînes inchangées, 1,8 s. Or l'argument de la
fiche est que l'essentiel d'un fichier d'interface ne bouge pas.

**Ce qui a été fait.**

- **`index(memory)` construit le dictionnaire `clé exacte → (source, cible)`**,
  et `lookup` le consulte avant toute notation. Il se passe en paramètre
  (`exact`), pour être construit une fois par fichier ; sans lui, `lookup` le
  construit, ce qui reste un parcours linéaire au lieu d'une notation par
  entrée.
- **La docstring dit la règle** : « Scoring a string that was already there is
  the expensive way to learn nothing. »
- **Mesures après correction**, sur une mémoire de mille libellés (les deux
  langages) : exacte avec index fourni, 0,004 ms en Python et 0,002 ms en
  JavaScript ; sans index fourni, 1,2 ms et 0,5 ms ; deux cents chaînes
  inchangées, 0,7 ms et 0,4 ms — contre 1,8 s avant. Une chaîne absente, elle,
  coûte toujours 18 ms et 6,7 ms : c'est la notation, et elle est inchangée.
- **La classe de latence de N0 passe de `~100 ms` à `<1 ms`**, celle du cas
  ordinaire, et le point de rupture dit quand elle change : « une chaîne absente
  […] est notée contre toutes les entrées de la mémoire, et cette recherche-là
  se compte en dizaines de millisecondes sur mille chaînes ». C'est la
  décision 13 : la classe se mesure sur l'entrée nominale, et la fiche dit quand
  elle ne vaut plus.

**La preuve.** `une chaîne inchangée ne déclenche aucun calcul de score`, dans
les deux langages : la mémoire est instrumentée — une sous-classe de `dict` en
Python, un `Proxy` en JavaScript — et compte ses parcours. Avec l'index fourni,
zéro parcours ; sans index, un seul, pour le construire ; sur une chaîne
absente, un de plus, parce qu'elle est bien notée contre toute la mémoire. La
chaîne cherchée est la dernière des mille, celle qui coûtait le plus cher.

## Motif 2 — une borne de temps qui rend la suite rouge

**Le refus.** 32 ms pour 21 ms observés : la suite tombe dès que la machine est
chargée, et c'est ce qui est arrivé chez le relecteur (55 ms).

**Ce qui a été fait.** Le test chronométré est remplacé par
`production : une passe de publication tient dans une borne large` : deux cents
chaînes inchangées, moins d'une milliseconde mesurée, **borne à deux secondes**,
et la docstring dit pourquoi — « La borne attrape un effondrement, elle ne
mesure pas […] La classe de latence de la fiche est justifiée dans le relevé,
pas ici. »

## Motif 3 — quatre marquages et l'adaptateur N3

- **N0 (py, js), « a variable moves […] still nearly right »** : périmé. Devenu
  `une variable déplacée ne remonte rien au seuil par défaut`, qui épingle les
  deux scores (0,727 et 0,6) et montre, en témoin, que la chaîne remonte bien
  sous un seuil plus bas, en relecture.
- **N0 (py), `latency « ~10 ms »`** : périmé deux fois, puisque la classe change
  encore avec le motif 1. Remplacé par les deux tests ci-dessus.
- **N2 (js), le `why` de l'essai** : périmé. Devenu `le modèle ne voit jamais le
  nom de la variable`, qui est l'argument du niveau : `count` n'est pas dans
  l'appel, `[0]` y est.
- **N3 (py, js), `DÉFAUT` décoratif** : remplacé par trois tests d'adaptateur par
  langage contre `_harness/fake_sdk.py` et `fake-sdk.mjs` (règle T2) — requête,
  modèle, température nulle, `content` nul qui lève après trois appels, panne
  retentée. Les doubles locaux `RealShapedClient` sont supprimés.

**La preuve.** `node scripts/test-snippets.mjs translate-interface-strings` :
**6 extraits, 3 py, 3 js, aucun échec** ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche.

## Remarques non bloquantes de l'avis

- **Le point de rupture de N2, cent vingt mots et deux sujets** : le message ICU
  passe en tête, la variable ordinaire est reléguée en une phrase, et l'ensemble
  perd un tiers de sa longueur.
- **`sources: []` alors que le vrai modèle avait été lancé** : trois sources
  écrites, la carte du modèle (Apache 2.0), sa conversion ONNX, et le relevé
  d'exécution avec les versions exactes (`transformers` 5.17.0, `torch`
  2.14.0+cpu, `sentencepiece` 0.2.2, `@huggingface/transformers` 4.2.0) et les
  trois observations qui fondent le point de rupture.
- **N2 sans contexte d'interface** : rien changé, l'avis juge l'`escalate_when`
  juste.
- **Le marqueur `[N]`** : gardé, l'avis le juge bon.

## État

**Levée.** `test-snippets` vert (6 extraits) ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche ; `check-content`,
`check-figures`, `check-french` verts (`other` ajouté au lexique).
