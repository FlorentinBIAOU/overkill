# extract-fields-from-invoice — corrections du rédacteur (tour 1)

**Statut final : `draft`.** Le niveau recommandé, N2, ne peut pas tourner tel
qu'il est écrit, et je n'ai pas pu le rendre vrai dans les deux langages sans
une décision qui dépasse mes chemins (voir « Pourquoi brouillon »). Tout le
reste a été corrigé comme pour une fiche publiable.

État après correction : `check-content` (24 publiées, 1 brouillon),
`check-figures`, `check-french` verts. `test-snippets extract-fields-from-invoice`
**rouge sur `n2.test.js`** : le fichier importe l'essai figé, que la règle
« un essai appartient à une fiche publiée » de `check-content` m'a obligé à
retirer. Python : vert (tous les fichiers, marquages restants listés plus bas).
Aucune assertion n'a été touchée.

## Pourquoi brouillon

1. **Python, N2** : `pipeline("token-classification", model=…)` appelé avec
   `{"words": …, "boxes": …}`, puis lecture de `entity_group` par ligne. La
   documentation Transformers de LayoutLMv3 passe par le processeur ou le
   tokeniseur (`processor(image, words, boxes=…)`, boîtes sur la grille 0-1000)
   et `AutoModelForTokenClassification` ; le pipeline de classification de
   jetons prend du texte. L'appel du code n'existe pas sous cette forme.
2. **JavaScript, N2** : `@huggingface/transformers` 4.2.0 (paquet npm téléchargé
   et fouillé : aucune occurrence de « layoutlm » dans `dist/`) ne prend en
   charge aucune architecture LayoutLM. `LayoutModel.load` ne peut rien charger,
   quel que soit le point de contrôle. Il n'y a pas de réparation « à
   l'identique » dans la bibliothèque autorisée.
3. **Le point de contrôle** : `microsoft/layoutlmv3-base` est la base non affinée
   (l'extrait le dit lui-même), et sa carte le publie sous **CC BY-NC-SA 4.0**,
   licence d'usage non commercial. Le verdict recommande pour des factures, en
   production, un modèle dont les poids nommés ne s'y prêtent pas.

Pistes pour republier (à trancher par l'orchestrateur, voir plus bas) :
LayoutLM v1 (`microsoft/layoutlm-base-uncased`, licence MIT d'après sa carte,
texte et boîtes sans image, ce que N2 reçoit déjà) côté Python ; côté
JavaScript, `onnxruntime-node` sur un export ONNX, nouvelle dépendance ; ou
renoncer à la parité des langages pour ce niveau ; ou changer de verdict.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 commentaire AMOUNT py/js (#7) | « Requiring exactly three digits per group is what keeps the pattern from swallowing a quantity and a unit price as one number » | « 2 380,50 » est lu comme un seul montant (test) | « Exactly three digits per group keeps "2 38,50" apart, a quantity then a price; "2 380,50" still reads as one number. » |
| N0 commentaire parse_amount py/js (#8) | « A comma means French spelling: the dots left are thousands separators » | Faux pour « 1,234.56 » (défaut #13) ; code réparé | « An AMOUNT match always ends on two decimals: whatever the separators, the last two digits are the cents. » |
| N1 breaking_point (#19) | « Rien dans le jeu d’entraînement ne disait le contraire. » | Test : entraîné sur cette facture, indemnité étiquetée, il rend encore 40,00 | « Et l’annoter ne suffit pas : entraîné sur cette facture même, l’indemnité étiquetée comme une ligne sans champ, il la retient encore, parce que ses traits ne la distinguent pas du total. » |
| N1 escalate_when | « Vous recevez plus de mises en page différentes que vous ne pouvez en annoter » | Même test : annoter ne corrige pas | « Un montant de bas de page passe pour le montant dû, et l’ajouter annoté au jeu d’entraînement ne change pas la lecture. » |
| N1 commentaire js `trainOne` (#24) | « three lines out of thirty carry a field, and an unweighted fit […] is right nine times in ten » | Proportions inventées (le jeu des tests : 6 sur 21) ; ce que fait le code : poids `n / (2 × effectif de la classe)` | « Each line is weighted so that the lines carrying the label weigh, together, as much as the lines that do not: on a page, they are the few. » |
| N2 breaking_point (#30, #31) | « le modèle désigne la ligne de l’acompte […] et lui donne un score haut » ; « Relever le seuil n’y change rien, l’erreur score au-dessus de la bonne réponse » | Les scores sont posés par le double ; au seuil 0,97 le champ part en relecture (test) | « Un score haut sur la mauvaise ligne passe le seuil. Si […] le modèle désigne la ligne de l’acompte […] avec un score de 0,96, le champ revient avec 120,00 […] Relever le seuil au-dessus de 0,96 envoie ce champ en relecture, et avec lui tous les champs notés plus bas ; la valeur lue, elle, ne change pas. » |
| N2 commentaire MAX_LINES py/js (#34) | « One pass reads one page. Beyond that the model would truncate in silence. » | Documentation LayoutLMv3 : `max_position_embeddings` 512, une limite en jetons, pas en lignes | « A cap on the page, checked before the model runs. It is not the model's own limit: LayoutLMv3 reads at most 512 tokens, and a page under this cap can still hold more. » |
| N2 regulatory | « Licence et provenance du point de contrôle à établir » | Carte Hugging Face : CC BY-NC-SA 4.0 | Ajoute : « microsoft/layoutlmv3-base, nommé par l’extrait, est publié sous Creative Commons BY-NC-SA, une licence d’usage non commercial » |
| N3 docstring py/js + `doc.fr.yaml` (#44) | « This is the option people reach for first […] so it sees the column an amount sits in » | Usage non sourcé ; capacité du modèle non testable ; ce qui l'est : l'image part avec le texte | « The model is sent a picture of the page along with its text, and the picture still holds what the extracted text has lost: the column an amount sits in. » |
| N3 commentaire py/js | « A model charges by the token, and a scanned page is a lot of them. Refusing an oversized image is […] a cost control » | Guide *Images and vision* du fournisseur : une image est facturée selon ses dimensions et le niveau de détail, pas selon son poids | « The provider bills every token of the prompt: the text is capped before the call […]. An image is billed by its dimensions, not its bytes, so its cap only bounds what is encoded and uploaded. » |
| N3 breaking_point (#42) | « Le modèle renvoie un objet parfaitement valide dont le montant n’apparaît nulle part » | Ce que renvoie le modèle est écrit par le double | « Un objet parfaitement valide dont le montant n’apparaît nulle part sur la facture passe » |
| verdict_rationale (#54) | « c’est le seul niveau qui la lise sans qu’on la lui décrive » | Non testable, et N3 reçoit aussi l'image | « un modèle de document affiné la reçoit avec le texte au lieu de traits écrits à la main » |
| Essai, cas 6, why (#59, #60) | « Le montant dû est de 360,00 […] il s’est trompé avec assurance. Relever le seuil n’y change rien […] le coût qu’on suppose absent de ce barreau » | La facture porte « Solde à régler 240,00 » ; seuil : voir #31 ; modèle : non testable ; « barreau » proscrit | Texte corrigé, consigné ici puisque l'essai est retiré : « Le solde à régler est de 240,00 : le code rend 120,00, l’acompte déjà versé, avec un score de 0,96 et aucun drapeau de relecture. Le seuil n’attrape qu’un score bas. Pour rattraper celui-ci, il faudrait le monter au-dessus de 0,96, et tous les champs notés moins partiraient en relecture avec lui ; la valeur lue, elle, resterait 120,00. » (en : « The balance to pay is 240.00: … the value read would still be 120.00. ») |
| further_reading | `entreprendre.service-public.fr/vosdroits/F31808` | Redirige (301) vers `service-public.gouv.fr` ; la page « Mentions obligatoires sur une facture » porte bien la mention de l’indemnité forfaitaire | URL mise à jour |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#10) | « Two hours of work and you can read every invoice from the supplier you wrote it for » | Durée sans mesure ; remplacé par « It reads the invoices of the supplier whose labels it was written for » |
| N3 docstring py/js + `doc.fr.yaml` | « This is the option people reach for first » | Usage non sourcé |
| Essai figé `content/tryouts/frozen/extract-fields-from-invoice.js` | tout le fichier | `check-content` refuse un essai sans fiche publiée. Version d'origine dans l'historique (commit parent de celui-ci) ; le why corrigé est ci-dessus |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#13) | « 1,234.56 » lu 1,23 | `AMOUNT` à deux branches : groupes par espace ou point puis virgule décimale, ou groupes par espace ou virgule puis point décimal ; regard arrière `(?<![\d.,])` et regard avant `(?![.,]?\d)` : jamais un morceau de nombre. `parse_amount` : tous les chiffres divisés par cent (la correspondance finit toujours sur deux décimales) |
| n0.py / n0.js (#14) | « Total TTC » retombait sur le Total HT | Chaque ligne a ses suites d'espaces (insécables comprises) ramenées à une espace avant la recherche du libellé |
| n0.py / n0.js (#15) | signe d'un avoir perdu | Signe `-` ou `−` (U+2212) collé au nombre ; un tiret séparé d'une espace n'est pas lu comme un signe (« Total TTC - 82,80 » reste positif) |
| n0.py / n0.js, hors relevé | la même expression, sur une ligne de 80 000 caractères faite de groupes « 123 », prenait 20 s en Python (retour arrière quadratique, déjà présent avant) | Quatre groupes au plus (jusqu'aux milliers de milliards) : 0,04 s |
| n1.py / n1.js (#28) | « 3 Avril 2024 », « 1 fevrier 2024 » non lus | `DATE` insensible à la casse, `f[ée]vrier`, `ao[ûu]t`, `d[ée]cembre` |
| n3.py / n3.js (#47) | client par défaut sans `complete` | Correctif imposé, adapté à l'image : partie de contenu `{"type": "image_url", "image_url": {"url": …}}` (vérifié dans les types du kit `openai` 7.15.0, `ChatCompletionContentPartImage`), `client = client or ProviderClient()` / `client ??= await providerClient()` placé après les refus |
| n3.py / n3.js | `message.content` nul | Traité comme réponse inutilisable et retenté, sans passer à `json.loads` / `JSON.parse` |
| n3.py / n3.js (#46) | texte non borné | `MAX_CHARACTERS = 8000`, en points de code dans les deux langages, refus avant l'appel |
| n3.py / n3.js (#49) | `invoice_number` entier, `date` en liste acceptés | Chaîne ou `null`, sinon `ExtractionUnavailable` |
| n3.py / n3.js (#50) | facture vide : un appel payé | Image vide refusée (`ValueError` / `RangeError`) avant l'appel |
| n3.py, hors relevé | `json.loads` accepte `NaN` et `Infinity` : un total `NaN` passait en Python, pas en JavaScript | `math.isfinite` sur le total |

Marquages retirés (assertions inchangées) : n0 — 3 `DÉFAUT` py, 3 js ; n1 — 1
`DÉFAUT` py, 1 js ; n3 — 2 `DÉFAUT` et 1 `INFIRMÉ` py, 2 `DÉFAUT` et 1 `INFIRMÉ` js.

Restent marqués : n0 `INFIRMÉ` quantité et prix (py/js) ; n1 `INFIRMÉ` annotation
(py/js) ; n2 `INFIRMÉ` seuil (py/js), `DÉFAUT` pipeline (py/js), `INFIRMÉ` 360,00
de l'essai (js) ; n3 `DÉFAUT` client par défaut (py/js).

Lignes utiles : n0.py 29, n0.js 33, n1.py 60, n1.js 80, n2.py 65, n2.js 74, n3.py
71 (dont l'adaptateur), n3.js 82.

## Sources consultées

- Service-Public Entreprendre, « Mentions obligatoires sur une facture » : numéro unique, date d'émission, « Mention de l'indemnité forfaitaire de 40 € », qui « ne peut être réclamée que par un client professionnel ».
- Hugging Face, carte `microsoft/layoutlmv3-base` : CC BY-NC-SA 4.0. Carte `microsoft/layoutlm-base-uncased` : MIT.
- Transformers, documentation LayoutLMv3 : `AutoProcessor.from_pretrained(…, apply_ocr=False)`, `processor(image, words, boxes=…)`, boîtes 0-1000, `max_position_embeddings` 512.
- Transformers.js : README (tâche `document-question-answering` présente, aucune LayoutLM listée) et paquet npm `@huggingface/transformers` 4.2.0 fouillé.
- OpenAI, guide *Images and vision* : image en URL de données base64, facturation selon les dimensions et le niveau de détail, formats PNG, JPEG, WEBP, GIF non animé. Types du kit `openai` 7.15.0 pour la partie `image_url`.
- arXiv 2204.08387 (LayoutLMv3, Huang et al.) et `fnfe-mpe.org/factur-x/` : pages existantes, conformes aux libellés de `further_reading`.

## À retester

- **`n2.test.js` ne se charge plus** : il importe l'essai retiré. Retirer les sept tests d'essai (dont l'`INFIRMÉ` 360,00) ; les vingt et un autres tests N2 JS n'ont pas pu être rejoués.
- **n2 `INFIRMÉ` seuil (py/js)** : la fiche dit maintenant ce que le test marqué démontre (au-dessus de 0,96, relecture ; valeur inchangée) : le retourner en démonstration.
- **n1 `INFIRMÉ` annotation (py/js)** : même chose, la fiche dit désormais que l'annoter ne suffit pas.
- **n0 `INFIRMÉ` quantité et prix (py/js)** : le commentaire dit désormais que « 2 380,50 » est lu comme un seul nombre ; tester aussi « 2 38,50 » gardé à part.
- **n3 `DÉFAUT` client par défaut (py/js)** : `extract_fields(…, client=ProviderClient(sdk=RealShapedClient(…)))` / `providerClient(new RealShapedClient(…))` ; vérifier `messages[0].content` = partie texte puis partie `image_url` avec l'URL de données, `model`, `temperature: 0`, et `content: null` → `ExtractionUnavailable` après trois appels.
- **Noms des tests démarqués** : préfixe retiré, suite du nom décrivant encore le défaut (« …rend le Total HT », « …perd son signe », « …coûte un appel », `test_defaut_…`).
- n0, nouveaux cas : « 1,234.56 » → 1234.56 ; « -82,80 » et « −82,80 » négatifs, « - 82,80 » positif ; « 1,234,56 » → rien ; « Total TTC 82,80. » en fin de phrase lu ; « 12 345 678 901 234,45 » (quatre groupes) lu ; groupes « 123 » sur 80 000 caractères dans une borne large ; libellé avec espace fine « Total TTC ».
- n1 : « 3 AVRIL 2024 », « 15 aout 2024 » lus ; les traits de ligne inchangés pour les jeux existants.
- n3 : texte de 8 000 caractères accepté, 8 001 refusé sans appel ; 5 000 emoji acceptés en JS ; image vide avec texte non vide refusée ; `invoice_number`/`date` nombre, booléen, objet → erreur ; total `NaN` (Python) → erreur ; `content` nul.

## Pour l'orchestrateur

- **Décision de fond sur N2** (fiche en brouillon) : choisir entre (a) LayoutLM v1 sous licence MIT en Python et `onnxruntime-node` sur un export ONNX en JavaScript (nouvelle dépendance, et la charte des extraits limite JavaScript à Node et, de fait, aux paquets déjà admis), (b) un N2 Python seul, contraire à la règle des deux langages, (c) un autre verdict. Tant que ce n'est pas tranché, la fiche ne peut pas être republiée honnêtement. Le coût `modéré` et la latence `~100 ms` de N2 n'ont aucune source et seront à revoir avec le modèle retenu.
- `check-content` interdit un essai sans fiche publiée : passer une fiche en brouillon oblige à retirer son essai, ce qui casse les tests qui l'importent. Une règle (essai toléré pour un brouillon, non construit) éviterait qu'un brouillon rende `test-snippets` rouge.
- N3 étiquette toute image `image/png` ; un JPEG part mal étiqueté. Non relevé, non corrigé (le test de taille envoie des octets qui ne sont pas un PNG) ; la fiche voisine `read-text-from-a-scanned-page` lit la signature des octets, à aligner.
- N1 et N2 gardent l'ancienne expression de montant (« 1,234.56 » lu 1,23) : non relevé, et la changer modifie les traits d'entraînement de N1 ; à reprendre avec le testeur.
- Les extraits N1, N2, N3 dépassent les quarante lignes utiles (voir plus haut).
