# read-text-from-a-scanned-page — vérification du lot 16

Avis d'origine : `docs/lot15/avis/read-text-from-a-scanned-page.md` (REFUSÉE).

## Motif 1 — N0 ne lisait pas le document que le scénario donne en exemple

**Le refus.** Le relecteur a produit trois PDF et les a passés à l'extrait :
l'export PDF d'un traitement de texte, cas donné en exemple par le `scenario`,
revenait `has_text_layer: False`. Les traitements de texte embarquent des
sous-ensembles de polices renumérotés, que le lecteur de flux écrit à la main
sait détecter mais pas décoder. Et, plus largement : écrire son propre lecteur
de flux PDF — cent quatre-vingts lignes par langage — est un piège que tout
praticien évite, quand la même question se pose à une bibliothèque PDF.

**Ce qui a été fait.** La première branche de l'avis, qui est aussi la décision
du commanditaire : l'outil standard entre dans l'échelle.

- **N0 est refondé sur une bibliothèque PDF** : `pypdf` 6.1.3 en Python,
  `pdfjs-dist` 5.4.149 (pdf.js, la bibliothèque de Mozilla) en JavaScript. Les
  deux sont déclarées, l'une dans `content/snippets/requirements-snippets.txt`,
  l'autre dans les dépendances de développement.
- **L'extrait passe de 183 lignes à 67** (66 en JavaScript), et ce qui reste est
  ce que la fiche avait de bon : la question, le seuil de caractères, et le
  refus qui nomme l'étape suivante au lieu de rendre une chaîne vide « qu'un
  appelant lirait comme "la page est blanche" ».
- **La docstring dit pourquoi l'extracteur n'est pas là** : « Writing the
  extractor is the trap: […] two hundred lines that still lose to the first font
  the file renumbers for itself, which is what a word processor does on every
  export. That work is done and shipped — `pypdf` here, `pdf.js` in JavaScript,
  `pdftotext` at a shell prompt — and what is left to write is the decision. »
- **Le `name` du niveau, le `scenario` et le `vendor_lock` suivent** : « Demander
  sa couche de texte au document, par une bibliothèque PDF », `vendor_lock:
  library`, et le scénario dit désormais que la question se règle « y compris
  sur l'export d'un traitement de texte, dont les polices sous-ensemble mettent
  en échec tout lecteur de flux écrit à la main ».

**La preuve.** Les tests ne fabriquent plus de PDF à la main : ils lisent deux
documents réels, versionnés à côté d'eux.

- `contrat-libreoffice.pdf` est l'export PDF d'un traitement de texte, produit
  par LibreOffice — exactement le document que l'ancien extrait ne lisait pas.
  Test `lit l'export d'un traitement de texte, polices sous-ensemble comprises` :
  le texte revient, il commence par « Contrat de prestation », il contient
  « Papeterie Lambert » et « trente jours ».
- `scan-image-seule.pdf` est la même page, rendue en image puis remise dans un
  PDF. Test `point de rupture : une page scannée ne rend pas une chaîne vide mais
  un refus` : zéro caractère, une page, et la raison qui renvoie vers un OCR.
- Les deux langages comptent **233 caractères lisibles** sur le même document, et
  le test l'épingle des deux côtés.
- Un test vérifie que les deux fichiers sont bien ce qu'ils prétendent être :
  `LibreOffice` dans l'un, une image dans l'autre et aucune dans le premier.
- Douze tests par langage, dont le fichier cassé qui ne lève pas, la
  bibliothèque qui lève en cours de lecture, le document sans page, le seuil
  paramétrable et l'injection de la bibliothèque.

## Motif 2 — le point de rupture de N0 faisait deux cent trente mots

**Le refus.** Trois sujets dans un paragraphe, et le relevé du testeur à la
place du point de rupture.

**Ce qui a été fait.** Deux phrases : la page scannée qui ne porte aucun
caractère, et le rapport qui nomme la raison au lieu de rendre une chaîne vide.
Le reste — ce que la bibliothèque sait faire, ce qu'elle ne sait pas — a
disparu avec le lecteur maison qu'il décrivait. Même travail en anglais.

## Motif 3 — marquages et adaptateur N3

- **N2 `INFIRMÉ` « relever le seuil n'y change rien »** : devenu
  `point de rupture : le seuil ne sépare pas la lecture fausse de la juste`, qui
  compare, pour trente seuils, la page mal lue et la page bien lue notées au même
  score : le drapeau est toujours le même pour les deux. C'est ce que dit
  désormais le point de rupture, raccourci au passage (remarque non bloquante).
- **N2 `INFIRMÉ` « started once and kept for the process »** : c'était vrai en
  JavaScript et faux en Python, où `read_page` construisait un moteur par page.
  **Le code est corrigé plutôt que la phrase** : `default_engine` est mis en
  cache (`functools.cache`), comme la promesse mémorisée de JavaScript. Le test
  vérifie maintenant un seul moteur construit et deux appels au binaire — car
  `pytesseract` lance bien `tesseract` à chaque page, et la docstring le dit.
- **L'adaptateur N3 est exercé** contre `_harness/fake_sdk.py` et
  `fake-sdk.mjs`, dans les deux langages (règle T2) : la requête
  (`chat.completions`, modèle, température nulle), **la forme du message image**
  — `{"type": "image_url", "image_url": {"url": "data:image/png;base64,…"}}`,
  avec les octets exacts — un `content` nul qui lève après trois appels, et une
  panne retentée.
- **Les noms `test_defaut_…` et `test_infirme_…` restants** sont réécrits sur ce
  qu'ils démontrent.

## Remarques non bloquantes de l'avis

- **Longueur du point de rupture de N2** : ramené de dix lignes à quatre, en
  gardant l'argument que l'avis voulait lire.
- **Le prétraitement** : entré dans l'`escalate_when` de N2 — « vous avez déjà
  fait ce que cette même documentation demande d'abord, binariser, redresser et
  numériser à trois cents points par pouce, qui fait plus pour la qualité d'une
  lecture que le choix du seuil ».
- **`unavailable_reason` de N1** : gardée telle quelle, l'avis la juge juste.
- **N3, l'image vide transcrite en facture** : gardé, la fiche dit déjà que le
  double l'écrit.

## État

**Levée.** `node scripts/test-snippets.mjs read-text-from-a-scanned-page` vert
(6 extraits, 3 py, 3 js) ; `check-content`, `check-figures`, `check-french`
verts (`binariser` ajouté au lexique) ; `npm run check:fast` vert ; et
`node scripts/test-snippets.mjs` sur les 146 extraits du dépôt, vert.
