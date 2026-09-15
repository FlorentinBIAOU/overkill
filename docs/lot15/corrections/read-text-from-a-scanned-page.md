# read-text-from-a-scanned-page — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets read-text-from-a-scanned-page` **rouge sur des tests qui fixent
l'ancien comportement** (voir « À retester ») : n0 `une page dont un caractère
sur dix se lit n'est pas lue` et `les codes de contrôle 127 à 159…` (py/js) ;
n3 `lit le format dans les octets…` (TIFF II, TIFF MM) et `refuse un format non
reconnu…` (GIF, WEBP) (py/js) ; n3 JS `le client par défaut a la forme du vrai
kit` (assertion hors marquage : « aucune requête ne part »). Aucune assertion n'a
été touchée.

Vérifications hors des tests, sur cette machine : n0 exécuté sur un PDF exporté
par LibreOffice (police renumérotée : renvoi vers une bibliothèque, ancien et
nouveau code), un PDF de Ghostscript (texte lu) et le PDF 32000-1 d'Adobe, qui
est **chiffré** : l'ancien extrait le déclarait lu (`has_text_layer: true`, 1 235
caractères de charabia), le nouveau le renvoie vers une bibliothèque. n2 exécuté
contre le vrai Tesseract 5.5.0 (pytesseract, Pillow) et tesseract.js 6.0.1, page
rendue à 300 ppp : les deux adaptateurs rendent les lignes et une confiance de
0,90. n3 exécuté contre les vrais kits `openai` 3.14.0 et 7.15.0, transport
remplacé : requête `/v1/chat/completions` avec un élément `text` et un élément
`image_url` en URI de données ; `content: null` → `ReadingUnavailable`.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 breaking_point (#5) | police sous-ensemble « compte alors zéro caractère lisible » | Faux au-delà de 32 glyphes. PDF 32000-1 annexe D : aucun encodage nommé d'une police simple (Standard, MacRoman, WinAnsi) ne place de glyphe sous le code 32 (seul PDFDocEncoding, « not customary […] to show text from fonts »). Code réparé : un seul code sous 32 suffit à refuser. Nouvelle limite vérifiée : codes 33 à 80 seulement → `has_text_layer: true`, 400 caractères de charabia | le second renvoi (chiffré, autre filtre, police renumérotée) ; la police est reconnue « à un seul signe, un code sous 32 » ; « c'est là qu'il casse : une page dont la police renumérotée n'emploie que des codes à partir de 33 […] passe pour une couche de texte lisible » |
| N0 docstring py/js + `doc.fr.yaml` (#10) | « two ways of saying no […] Plenty was shown and none of it reads » | Trois raisons désormais, deux suites | « a no comes with one of two next steps […] a font with its own table, an encrypted document, a filter other than Flate: a full PDF library » |
| N0 commentaire py/js (#15) | « A string no operator shows is not text » | Chaîne de `BDC` collée au texte. Code réparé | « A string any other operator takes is not text: a marked-content property, a name, an argument » |
| N0 commentaire py/js (#17, #21) | `HEADER` « three hundred bytes reach the keys that matter » ; BT…ET « belt and braces » | Palette en ligne : dictionnaire de plusieurs Ko. Code réparé | « The whole declaration is read, from its `obj` keyword on: an image with an inline colour palette runs to kilobytes » ; « belt and braces » retiré |
| N0 commentaire py/js (#23) | « Latin-1, because a simple font encodes one byte per character » | Annexe D, table D.1 : WinAnsiEncoding = Windows code page 1252 ; note 3 : codes inutilisés au-dessus de 32 → puce | « WinAnsiEncoding is Windows code page 1252 (PDF 32000-1, annex D), not Latin-1 » |
| N0 docstring de `_readable` (#19) | les codes renumérotés sortent en caractères de contrôle, 128–159 exclus du compte | Voir #5 et #23 | `_is_control` : « A code no named encoding of a simple font puts a glyph on (annex D) […] one of them is enough » |
| N2 breaking_point, essai `why` (#37) | « relever le seuil n'y change rien » | Un seuil à 0,97 lève le drapeau, sur la bonne lecture au même score aussi | « Un seuil relevé au-dessus de ce score le lèverait, mais sur toutes les lectures justes rendues au même score aussi » ; essai : « le niveau N0 » au lieu de « le barreau N0 » (vocabulaire) |
| N2 docstring de `TesseractOCR` (#43) | « started once and kept for the process » | Python : pytesseract lance le binaire par appel (`run_tesseract`, `subprocess.Popen`, source lu). JS : un worker neuf par page. Code JS réparé | py : « The real engine. pytesseract starts the tesseract binary for every call. » ; js : « one worker, started on first use and kept for the process » |
| N2 commentaire JS (#44) | `createWorker` « pulls the language data once » | Documentation tesseract.js (`local-installation.md`) : sans `langPath`, données téléchargées depuis jsDelivr | « tesseract.js downloads the language data from a CDN unless `langPath` points at local files » |
| N2 regulatory | « données linguistiques du moteur comprises » | Idem | « seules les données linguistiques du moteur viennent de l'extérieur, que tesseract.js télécharge par défaut depuis un CDN » |
| N2 escalate_when (#52) | « un tampon en travers d'un tableau, deux colonnes qu'il aplatit » | tessdoc ImproveQuality : segmentation automatique par défaut, problème connu sur les tableaux ; FAQ : « Tesseract is designed for printed text » (manuscrit). Rien ne source les colonnes aplaties | « ce que la documentation de Tesseract dit mal lire : de l'écriture manuscrite […] ou des tableaux » |
| N2 commentaire py/js (#48) | « exemp-\nlaire » recollé (JS : pas pour les accents ; tout trait d'union recollé) | Code réparé | « Letters only: « 2024-\n000431 » is a reference, and keeps its hyphen. » |
| N3 commentaire de SIGNATURES (#59) | « refused […] because a provider will reject it too » | Guide « Images and vision » : PNG, JPEG, WEBP, GIF non animé. Code réparé | « The formats the provider's vision input lists […] Anything else, a TIFF included, is refused before it is sent: convert it first. » |
| N3 commentaire (#60) | « A page scan larger than this is a photograph of a desk […] A model charges by what it is given, so refusing it is a cost control » | Guide vision : facturation par pavés de 32 px, selon les dimensions ; rien sur les octets | « A cap on what is encoded and uploaded […] It is not a cost control: the provider bills an image by its dimensions, not by its bytes. » |
| N3 commentaire (#61) | « Temperature zero: a transcription that changes between two identical calls cannot be checked » | Docstring du kit : « lower values like 0.2 will make it more focused and deterministic » | « The lowest temperature: the SDK documents lower values as more focused and deterministic. » |
| N3 commentaire (#62) | « What the model admits it could not read is the only doubt it reports » | Code réparé (page vide signalée) | « Two doubts, and neither is a confidence: what the model admits it could not read, and a page that came back empty. » |
| N1 unavailable_reason (#34) | « un projet de plusieurs mois, dont le résultat reste en deçà des moteurs libres qui s'installent en une commande » | Durée et comparaison non sourcées ; tessdoc Installation : `sudo apt install tesseract-ocr` | « refait ce que fait déjà Tesseract, un moteur libre que les distributions courantes proposent en paquet, installé par une seule commande » |
| scenario (#8, #70) | « On voit régulièrement… » ; « Beaucoup de « scans » n'ont pourtant jamais été scannés » | Constats de fréquence sans source | « Une chaîne de traitement qui envoie chaque page […] ne demande jamais au document… Un document arrivé en PDF n'a pourtant pas forcément été scanné » |
| verdict_rationale (#68, #69) | N2 lit « deux fois de la même façon » ; « N3 lit ce que N2 aplatit, une annotation en marge ou deux colonnes » | Déterminisme du moteur non sourcé ; capacité du modèle non sourcée (le guide vision ne dit rien du manuscrit) | « N3 reste pour ce que Tesseract dit lui-même mal lire, l'écriture manuscrite et les tableaux, sans que rien ici ne prouve que le modèle les lise mieux » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#8) | « Most « scanned pages » were never scanned » | Proportion sans source |
| N2 docstring py/js + `doc.fr.yaml` (#45) | « the same image gives the same reading every time » | Comportement du moteur, non sourcé |
| N2 commentaire py/js (#46) | « an engine reading French with an English model invents accents it has never seen » | Non sourcé, et contradictoire ; remplacé par ce que fait la constante : « The language data the engine loads » |
| N3 docstring py/js + `doc.fr.yaml` (#63) | « This is the option people reach for first […] a model that sees the page reads a handwritten annotation in the margin, a stamp across a table, a column layout » | Constat d'usage et capacité d'un modèle réel, non sourcés |
| Essai, cas 6 `why` | « le scan est net, les glyphes sont détachés, et c'est justement pour cela qu'il est sûr de lui » | Attribue au moteur ce que le double écrit |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#22) | image au dictionnaire long lue comme du texte | La déclaration est lue depuis le dernier `obj` après la fin du flux précédent (borné, linéaire) |
| n0.py / n0.js (#5) | police renumérotée de plus de 32 glyphes acceptée | Un code sous 32 (hors tabulation, fin de ligne, saut de page, retour) ou entre 127 et 159 dans le texte refuse la page ; la règle « la moitié des caractères » disparaît. Cela attrape aussi les chaînes CID sur deux octets (`<0024…>`), dont l'octet nul faisait passer la moitié |
| n0.py / n0.js (#23) | WinAnsi décodé en Latin-1 | Table 127–159 de la page de code 1252, puce sur les codes inutilisés (annexe D, note 3), appliquée aux chaînes littérales et hexadécimales |
| n0.py / n0.js (#24, #25) | ASCII85/LZW, chiffrement : renvoi vers un OCR | `/Encrypt` dans le document, ou un filtre `LZWDecode`, `ASCII85Decode`, `ASCIIHexDecode`, `Crypt` sur un flux de contenu : troisième raison, « encrypted or encoded content this function cannot open: this needs a full PDF library, not a scan » |
| n0.py / n0.js (#26) | parenthèses équilibrées non échappées | Un niveau d'imbrication accepté dans le motif de chaîne |
| n0.py / n0.js (#27) | pages dans un flux d'objets : `pages: 0` | Les flux `/Type /ObjStm` sont décompressés et leurs `/Type /Page` comptés |
| n0.py / n0.js (#28) | temps quadratique sur BT sans ET | Plus de motif `BT(.*?)ET` : un seul passage sur les jetons, avec un état « dans un objet texte ». 80 000 BT : sous le seuil |
| n0.py / n0.js (#15) | propriété de contenu balisé collée au texte | Les noms sont des jetons ; tout opérateur autre qu'un opérateur de montrage vide les chaînes en attente |
| n0.py / n0.js (#29) | U+001C–U+001F : espace en Python, pas en JS ; UTF-16 impair : `RangeError` en JS | Ensemble explicite des blancs (`\t\n\f\r`) dans les deux langages, classe `[ \t\n\r\f\v]` explicite en JS ; octet impair → `�`, comme le décodeur Python |
| n2.py (#41) | un mot par ligne | Les lignes de niveau 4 ouvrent une ligne, les mots de niveau 5 la remplissent (format TSV lu dans `baseapi.cpp` de Tesseract, vérifié sur une vraie sortie) |
| n2.js (#42) | `data.words` absent en v6 : `TypeError` à chaque page | `data.confidence / 100` : `dump.js` de tesseract.js rend `confidence: api.MeanTextConf()` hors options de sortie ; `MeanTextConf` = moyenne des confiances de mots (`baseapi.cpp`). Vérifié sur tesseract.js 6.0.1 |
| n2.js (#43) | un worker neuf par page, jamais terminé | Promesse de worker gardée au niveau du module ; un démarrage échoué n'est pas gardé |
| n2.py / n2.js (#48) | trait d'union recollé entre chiffres ; JS ASCII seulement | Lettres seulement : `[^\W\d_]` en Python, `\p{L}` avec drapeau `u` en JS |
| n3.py / n3.js (#57) | `client.complete` absent du kit | Correctif imposé, adapté à l'image : `ProviderClient.complete(prompt, image, temperature)` envoie un élément `text` et un élément `image_url` (`data:<type>;base64,…`), type `ChatCompletionContentPartImageParam` lu dans le kit 3.14.0 ; `gpt-4.1-mini` accepte l'image en entrée (page du modèle) ; `client = client or ProviderClient()` / `client ??= await providerClient()` |
| n3.py / n3.js | `message.content` nul passé à `json.loads` | Traité explicitement, retenté, puis `ReadingUnavailable` |
| n3.py / n3.js (#59) | TIFF envoyé, WEBP et GIF refusés | Signatures PNG, JPEG, WEBP (`RIFF….WEBP`), GIF (`GIF87a`/`GIF89a`) |
| n3.py / n3.js (#62) | transcription vide non signalée | `review` levé sur un texte vide ou fait d'espaces |

Marquages retirés (assertions inchangées) : n0 — 2 `INFIRMÉ` et 9 `DÉFAUT`,
py et js ; n2 — 1 `INFIRMÉ` et 2 `DÉFAUT`, py et js ; n3 — 1 `INFIRMÉ` et 2
`DÉFAUT`, py et js.

Restent marqués : n2 `INFIRMÉ : relever le seuil ne change rien` (py/js), phrase
corrigée ; n2 `INFIRMÉ : le moteur par défaut est démarré une fois` (py : phrase
retirée ; js : voir « À retester »).

Lignes utiles (avant → après) : n0.py 86 → 101, n0.js 88 → 105, n2.py 46 → 52,
n2.js 49 → 55, n3.py 47 → 68, n3.js 54 → 78.

## Sources consultées

- PDF 32000-1:2008 (Adobe), téléchargé et lu : 7.3.4.2 « Balanced pairs of parentheses within a string require no special treatment » ; 7.5.7 flux d'objets ; 7.4 filtres (`LZWDecode`, `ASCII85Decode`) ; table 15, `Encrypt` ; 9.4.3 opérateurs de montrage ; annexe D, table D.1 (WinAnsiEncoding = Windows Code Page 1252 ; PDFDocEncoding seul à coder sous 040 octal) et note 3 (codes inutilisés au-dessus de 40 octal → puce). https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf
- Tesseract, `src/api/baseapi.cpp` (`GetTSVText` : lignes de niveau 4 puis mots de niveau 5, `-1` hors mots ; `MeanTextConf`) et `renderer.cpp` (en-tête TSV). https://github.com/tesseract-ocr/tesseract
- pytesseract, `pytesseract.py` : `image_to_data`, `file_to_dict` (`int(float())`), `run_tesseract` (`subprocess.Popen`). https://github.com/madmaze/pytesseract
- tesseract.js : README (« disabling all output formats other than text by default » en v6), `docs/api.md` (`createWorker`, `recognize`, `output`), `docs/local-installation.md` (`langPath` absent → jsDelivr), `src/worker-script/utils/dump.js` (`confidence: api.MeanTextConf()`). https://github.com/naptha/tesseract.js
- tessdoc : ImproveQuality (PSM 3 par défaut ; « tesseract has a problem to recognize text/data from tables »), FAQ (« Tesseract is designed for printed text »), Installation (`sudo apt install tesseract-ocr`). https://tesseract-ocr.github.io/tessdoc/
- OpenAI, guide « Images and vision » : formats « PNG, JPEG, WEBP, and non-animated GIF », facturation par pavés de 32 px, multiplicateur 1,62 pour gpt-4.1-mini, 2 048 px et 6 144 pavés au plus ; section « Limitations » sans mention du manuscrit. https://developers.openai.com/api/docs/guides/images-vision
- OpenAI, page du modèle gpt-4.1-mini : entrée texte et image, Chat Completions ; tarifs : 0,40 $ / 1,60 $ par million de jetons. Classe `élevé` vérifiée, non publiée : une page A4 réduite à 1 448 × 2 048 px fait 2 880 pavés × 1,62 ≈ 4 700 jetons d'entrée, soit de l'ordre du millier de dollars par million de pages avant la sortie.
- Kits `openai` 3.14.0 (Python, `completion_create_params.py` pour `temperature`, `chat_completion_content_part_image_param.py`) et 7.15.0 (JS), installés dans un répertoire temporaire.
- `further_reading` : les cinq liens répondent (200) et disent ce que leur libellé leur prête ; FAQ de tessdoc ajoutée.

## À retester

- **n0 `une page dont un caractère sur dix se lit n'est pas lue` (py/js)** : l'assertion « 30 A + 30 codes 1 → lue » fixe l'ancienne règle de la moitié. Règle nouvelle : un seul code sous 32 refuse. Tester 24 « A » + un code 1 → refusé avec la raison « font table », et 24 « A » + une tabulation → lu.
- **n0 `les codes de contrôle 127 à 159…` (py/js)** : 128, 150, 159 sont désormais « € », « – », « Ÿ » (WinAnsi), lisibles ; 127 est une puce. Tester la table (0x80 → €, 0x81 → •, 0x92 → ’, 0x9F → Ÿ) et que U+0080–U+009F venus d'une chaîne UTF-16 refusent la page.
- **n0, nouveau point de rupture** : codes 33 à 80 seulement (`[((i*37)%48)+33 for i in range(400)]`) → `has_text_layer: true`, 400 caractères, texte commençant par « !F;0%J?4) » ; témoin : les mêmes codes plus un code 1 → refusé.
- **n0 nouveaux cas** : la troisième raison exacte (chiffré ; `/LZWDecode` ; `/ASCIIHexDecode`) ; chaîne CID `<00240025…>` refusée ; image dont `/Subtype /Image` est à plus de 300 octets de `stream` mais dans le même objet ; deux niveaux de parenthèses non échappées (non gérés : `(a (b (c)) d)`) ; `'` et `"` ne passent pas à la ligne (inchangé) ; BT sans ET en fin de flux : rien n'est lu ; parité py/js sur une chaîne UTF-16 à surrogat isolé (Python rend `�`, JS le garde : non réparé).
- **n0 noms** : les tests démarqués décrivent parfois encore le défaut dans leur commentaire (« 24 778 caractères de bruit », « Temps quadratique ») ; à reformuler avec leurs jumeaux.
- **n2 `INFIRMÉ : relever le seuil ne change rien` (py/js)** : phrase corrigée ; remplacer par « un seuil au-dessus du score lève le drapeau sur la fausse et sur la juste ».
- **n2 `INFIRMÉ : le moteur par défaut est démarré une fois` (py/js)** : py, la phrase est retirée (le test peut partir, ou vérifier la nouvelle docstring) ; js, le worker est maintenant gardé, mais le test passe encore marqué pour une mauvaise raison — le worker a été créé par le test précédent, donc `workers.length` vaut 0. Isoler le test (réinitialiser le module ou tester deux `readPage` dans un processus neuf) et vérifier `workers.length === 1`.
- **n2 double tesseract.js** : ajouter `confidence` (0–100, entier) à la réponse du faux `recognize`, comme la vraie v6 ; tester `confidence: 90` → `0.9`, `review: false`. Tester qu'un `createWorker` qui échoue n'est pas gardé (deuxième appel retente).
- **n2 double pytesseract** : ajouter `block_num`, `par_num` et une ligne vide (niveau 4 sans mot) ; deux paragraphes d'une ligne chacun ne se fondent pas.
- **n2** : « porte-\nmonnaie » est toujours recollé (lettres des deux côtés) ; « 2024-\n000431 » garde son trait d'union ; « réfé-\nrence » identique py/js.
- **n3 formats (py/js)** : les paramètres TIFF de `lit le format…` et GIF/WEBP de `refuse un format…` fixent l'ancienne liste ; TIFF, PDF, vide, PNG tronqué, `RIFF….WAVE` doivent être refusés, GIF87a, GIF89a et WEBP acceptés.
- **n3 JS `le client par défaut a la forme du vrai kit`** : marquage retiré, mais l'assertion finale « aucune requête ne part » décrit l'ancien défaut ; attendre une requête `{ model: 'gpt-4.1-mini', messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: 'data:image/png;base64,…' } }] }], temperature: 0 }`. Même vérification en Python sur `module.requetes`.
- **n3** : `content: null` → `ReadingUnavailable` après les essais ; transcription faite d'espaces → `review: true`.
- **Essai** : `why` du cas 6 réécrit (seuil relevé, « niveau N0 »).

## Pour l'orchestrateur

- Les six extraits dépassent les quarante lignes utiles (n0 : 101 et 105). Lire un PDF de façon qui tienne en production — déclaration entière, WinAnsi, chiffrement, filtres, flux d'objets, parenthèses, tokenisation linéaire — ne rentre pas dans quarante lignes ; l'alternative, déléguer à `pypdf`/`pdf.js`, contredit « bibliothèque standard seule » et exigerait une dépendance dans `requirements-snippets.txt`. Décision prise : garder l'extrait autonome et dire sa limite dans le point de rupture. N3 porte en plus l'adaptateur imposé.
- Constat réel, non publié faute d'être reproductible en intégration continue : Tesseract 5.5.0 (`fra`) sur une facture rendue à 300 ppp lit « 2024-006431 » pour « 2024-000431 », mot à 44 de confiance, **moyenne de page 0,90, drapeau baissé**. C'est le point de rupture de N2 observé sur le vrai moteur, et il montre qu'une moyenne de page cache un mot douteux. Une fiche future pourrait signaler le mot le plus faible plutôt que la moyenne.
- Le double `faux_openai` et le crochet `tesseract.js` des tests auraient leur place dans `_harness/`.
