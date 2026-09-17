# read-text-from-a-scanned-page — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs read-text-from-a-scanned-page` : vert, 3 py, 3 js.

### Raisons du refus

1. **[pertinence technique, solidité du verdict]** N0, `read_text_layer`, et la
   promesse du `scenario` : « un contrat exporté d'un traitement de texte
   transport[e] [son] texte […] Poser la question coûte un appel de fonction, et
   elle règle tout le besoin quand la réponse est oui. » J'ai produit trois PDF
   sur la machine de travail et les ai passés à `n0.py` :

   | PDF | Produit par | `n0.py` | `pdftotext` |
   |---|---|---|---|
   | `facture.pdf` (texte brut) | LibreOffice, `--convert-to pdf` | `has_text_layer: False`, « needs a full PDF library » | texte exact |
   | `contrat.pdf` (HTML) | LibreOffice, `--convert-to pdf` | `has_text_layer: False`, même raison | texte exact |
   | `gs.pdf` (Helvetica) | Ghostscript, police standard | texte exact | texte exact |

   Le cas que le `scenario` donne en exemple — l'export d'un traitement de
   texte — est celui que N0 ne lit pas : les traitements de texte embarquent
   des sous-ensembles de polices renumérotés, ce que l'extrait sait détecter
   mais pas décoder. L'extrait est honnête (il renvoie vers une bibliothèque au
   lieu de rendre du charabia), mais la fiche présente comme une marge ce qui
   est le cas ordinaire, et le lecteur découvrira qu'N0 « règle tout le
   besoin » surtout pour des PDF que plus personne ne produit à la main.

   Plus largement : écrire son propre lecteur de flux PDF — 180 lignes par
   langage, `zlib`, jetons, chaînes littérales et hexadécimales — est un piège
   que tout praticien évite. La bonne réponse de N0 est la même question posée
   à une bibliothèque PDF (`pypdf` ou `pdfminer.six` en Python, `pdftotext` de
   Poppler en ligne de commande, `pdf.js` en JavaScript) : coût marginal nul,
   déterministe, et elle lit les polices à table `ToUnicode` que l'extrait
   écarte. La charte limite JavaScript à la bibliothèque standard de Node ;
   c'est une règle à discuter pour cette fiche, pas une raison de publier un
   analyseur PDF maison comme modèle.

   Ce qu'il faut faire : soit fonder N0 sur une bibliothèque PDF (ajout à
   `requirements-snippets.txt`, et une dérogation écrite pour JavaScript, ou
   un appel à `pdftotext` par `child_process`), et tester sur un PDF exporté
   par LibreOffice, stocké dans le test sous forme d'octets ; soit garder
   l'extrait et récrire le `scenario` et le `breaking_point` pour dire en
   premier que la plupart des exports de traitement de texte partent vers une
   bibliothèque PDF, avec un test sur un PDF réellement produit par LibreOffice
   (pas fabriqué à la main) qui le montre. C'est fait quand la fiche ne promet
   plus de régler le besoin d'un document que son code renvoie ailleurs.

2. **[style]** `breaking_point` de N0 : environ 170 mots en français, neuf
   phrases, trois sujets (page scannée, renvois vers une bibliothèque,
   police renumérotée à partir de 33). La charte demande une ou deux phrases et
   un exemple concret. Le lecteur ne trouve pas le point de rupture dans ce
   paragraphe : il trouve le relevé du testeur. Ce qu'il faut faire : garder
   une phrase pour la page scannée (zéro caractère, rapport qui renvoie vers un
   OCR) et une pour là où l'extrait casse vraiment (texte illisible rendu comme
   lu) ; déplacer le reste dans la docstring. Même travail en anglais.

### Remarques non bloquantes

- `breaking_point` de N2 : même défaut de longueur, moindre ; l'argument (un
  seuil de confiance ne distingue pas une page mal lue d'une page bien lue au
  même score, seule une règle de forme sur les références le rattrape) est
  excellent et mérite d'être lu, donc court.
- N2 ne dit rien du prétraitement (binarisation, redressement, résolution),
  qui fait plus pour la qualité d'un OCR Tesseract que le choix du seuil ; la
  page « Improving the quality of the output » citée le dit. Une phrase.
- `unavailable_reason` de N1 est juste et bien tournée.
- N3 : l'exemple de l'image vide qui revient transcrite en facture complète
  est simulé par le double, et la fiche le dit. C'est la bonne discipline.

### Ce qui est solide

- Le `scenario` pose la question que presque aucune chaîne de traitement ne
  pose : « ce document porte-t-il déjà son texte ? ». C'est la meilleure idée
  de la fiche, et elle est juste.
- Refuser de rendre une chaîne vide pour une page scannée, et nommer la raison
  et l'étape suivante, est exactement le contrat qu'on veut.
- Le verdict N2 (Tesseract local d'abord, N3 pour l'écriture manuscrite et les
  tableaux sans prétendre que le modèle les lit mieux) est équilibré et sourcé
  sur la documentation de Tesseract.
