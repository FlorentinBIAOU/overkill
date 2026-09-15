# mask-personal-data-in-chat — corrections du rédacteur (tour 1)

État après correction : `check-content` et `check-figures` verts ;
`check-french` rouge sur `detect-language-of-text` seulement (fiche d'un autre
rédacteur), rien sur celle-ci. `test-snippets mask-personal-data-in-chat`
**rouge sur deux tests**, qui fixent un comportement que les réparations
changent (voir « À retester ») :
`point de rupture : une référence de commande est masquée comme un IBAN`
(Python et JavaScript) et `test_n1_est_une_regression_logistique_de_bibliotheque`
(Python). Aucune assertion n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#12) | « the invisible joiners it leaves behind are turned into a space » | Relevé : seul U+2060 l'était. Code réparé : U+200B, U+200C, U+200D, U+00AD, U+FEFF rejoignent la classe | « the spaces of French typography, the zero-width characters and the soft hyphen become a plain space » |
| N0 docstring py/js + `doc.fr.yaml` (#14) | « each pattern tolerates the separators people actually type inside a number » | « 06/12/34/56/78 » et la double espace passaient. Code réparé (séparateur `[ ./-]{0,2}`), et la phrase ne parle plus que du motif de téléphone | « the phone pattern tolerates the separators people type between digits — a space, a dot, a dash or a slash, one or two of them » |
| N0 commentaire py/js (#16) | « then up to thirty alphanumerics » | Le motif en acceptait 28 ; l'IBAN russe (33 caractères) passait. Wikipedia IBAN : jusqu'à 34 caractères, groupes de quatre à l'impression | « then the account number in groups of four, spaced or not, in either case. The check digits decide, not the pattern. » |
| N0 breaking_point (#4) | « le motif d'IBAN n'a pas de somme de contrôle : « DE 12 3456 7890 1234 » est masquée à tort » | Le code vérifie désormais la clé ISO 13616 (défaut #31) : « DE 12… » n'est plus masquée. Sur les cent clés 00 à 99, seule « DE 86 3456 7890 1234 » passe | « la clé de contrôle d'un IBAN peut être satisfaite par coïncidence : une référence de commande écrite « DE 86 3456 7890 1234 » la passe, et elle est masquée à tort » |
| N1 breaking_point (#39) | « rien ne survit à la mise en forme » | Les jetons cyrilliques survivent en minuscules ; aucun chiffre ne survit | « aucun chiffre ne survit à la mise en forme » |
| N1 docstring JS + `doc.fr.yaml` (#55) | « logistic regression on hashed character n-grams is forty lines » | n1.js : 55 lignes utiles (58 après réparation) | « hashing the character n-grams, training and deciding take three short functions » |
| N1 docstring de `shape`, py (#47) | « A classifier trained on raw text memorises the training phone numbers » | Relevé : le même pipeline sur texte brut attrape un numéro jamais vu (0,572) | « Every hidden digit becomes the same symbol, whatever its spelling, so the classifier learns what a hidden number looks like rather than which digits it held. » |
| N2 unavailable_reason (#60) | « un service permanent à exploiter, pour un gain nul sur des motifs […] qu'un numéro ou une adresse, que N1 traite déjà » | `shape` retire `@` et le point : N1 ne voit pas une adresse. C'est N0 qui masque adresses, numéros, IBAN (tests N0). « service permanent », « gain nul » : non sourcés | « ajoute des poids à télécharger et à tenir à jour, pour des motifs aussi structurés qu'un numéro, une adresse électronique ou un IBAN, que N0 masque déjà. Les numéros déguisés, que N0 laisse passer, sont le terrain de N1. » |
| N3 breaking_point (#65, #66, #67) | « Le modèle peut répondre n'importe quoi, y compris de la prose […] L'extrait lève une erreur » | Ce que fait le modèle n'est pas testable ; ce qui l'est : la requête n'impose aucun format (invite seule), et une liste aux mauvaises clés passait en clair. Code réparé | « Une invite n'est qu'une demande : rien dans la requête n'oblige la réponse à suivre le format voulu. De la prose, une liste aux mauvaises clés, un texte qui ne figure pas dans le message, une étiquette hors de la liste : […] L'extrait vérifie chaque élément, réessaie, puis lève une erreur » |
| N3 commentaire py/js (#70) | « A model charges by the token » | Page de tarifs du fournisseur : « Prices per 1M tokens » ; le plafond compte des caractères | « The provider bills every token of the prompt. […] the cap counts characters, not tokens. » |
| scenario (#83) | « le motif d'une adresse électronique n'a pas changé depuis vingt ans, et celui d'un numéro français non plus » | RFC 2822 (avril 2001) et RFC 5322 (octobre 2008) : même `addr-spec = local-part "@" domain` ; numérotation à dix chiffres depuis le 18 octobre 1996 | « la syntaxe d'une adresse électronique n'a pas changé depuis la RFC 2822 de 2001, ni celle d'un numéro français depuis le passage à dix chiffres de 1996 » |
| verdict_rationale (#85) | « N0 suffit dans l'immense majorité des intégrations » | Proportion non sourcée | « N0 : le besoin est déterministe, le coût marginal est nul, … » |
| further_reading | UTR 36 « sur les caractères sosies » | La page de l'UTR 36 est stabilisée depuis 2014 et renvoie à l'UTS 39, qui traite la détection des sosies (`confusables.txt`) | « Unicode Technical Standard 39 — Unicode Security Mechanisms, la détection des caractères sosies » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#9) | « fast enough that you will never find it in a profile » | Appréciation invérifiable ; la latence `<1 ms` reste, démontrée |
| N1 docstring py + `doc.fr.yaml` (#51) | « Training data is a few hundred labelled messages, not a few million » | Non testable (le jeu du test en compte 16), aucune source |
| N3 docstring py/js + `doc.fr.yaml` (#72) | « This is the option people reach for first » | Constat d'usage non sourcé |
| Essai, cas 4 (#23) | « Quelqu'un qui veut contourner le filtre le fait en deux secondes. » | Comportement humain, non sourcé |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#28) | `[\w.+-]+@` quadratique sur une longue suite de lettres | Regard arrière `(?<![\w.+-])` : une correspondance ne commence qu'en début de mot. 300 000 « a » : 0,13 s en Python |
| n0.py / n0.js (#29) | NFKC réécrivait tout le message (« … », « m² », « ﬁ », insécable) | Les motifs lisent une copie normalisée caractère par caractère ; une table `origin` ramène chaque correspondance au texte d'origine, où l'étiquette est posée. Le reste du message ressort tel quel, recomposé en NFC seulement (UAX 15 : l'équivalence canonique garde l'apparence). Les séquences d'emoji à liant (👨‍👩‍👧) sont conservées |
| n0.py / n0.js (#30) | U+200B et U+00AD laissaient passer un numéro | Ajoutés à la classe des caractères repliés en espace (avec U+200C, U+200D, U+FEFF) |
| n0.py / n0.js (#31) | IBAN en minuscules en clair | Motif insensible à la casse, **et** clé ISO 13616 vérifiée : sans la clé, l'insensibilité à la casse masquait « le 12 mars 2024 dans la salle ». Le motif accepte les groupes de quatre ; `iban_prefix` recoupe la correspondance à une espace quand elle a avalé le mot suivant (« BE68 5390 0754 7034 dans » → IBAN puis « dans ») |
| n0.py / n0.js (#32) | « +33 (0)6 12 34 56 78 » en clair | `(?:\(0\){SEP})?` après l'indicatif |
| n0.js (#33) | adresse accentuée en clair ou coupée (`\w` ASCII) | Classes `[\p{L}\p{N}_…]` avec le drapeau `u` ; en Python, `re.ASCII` sur les motifs de téléphone et d'IBAN pour que `\d` ne lise que 0-9, comme en JavaScript |
| n1.py / n1.js (#62, #63) | chiffres pleine largeur non repliés en JS ; « zéro » en NFD coupé | `shape` applique NFKC avant de découper, dans les deux langages |
| n1.js (#64) | jeu d'entraînement vide accepté, modèle qui bloque tout | `RangeError` sans message de chaque étiquette, ou étiquettes en nombre différent des messages (Python : scikit-learn lève déjà) |
| n3.py / n3.js (#67, #81, #82) | liste aux mauvaises clés, texte absent du message, `kind` hors liste : message rendu en clair ou étiquette arbitraire | `_is_usable` / `isUsable` : chaque élément a un `text` non vide présent tel quel dans le message et un `kind` parmi les quatre demandés ; sinon réponse inutilisable, retentée, puis `MaskingUnavailable` |
| n3.py / n3.js (#77) | client par défaut sans méthode `complete` | Correctif imposé : `ProviderClient` / `providerClient` sur `chat.completions.create`, `client = client or ProviderClient()` / `client ??= await providerClient()`, commentaire du fournisseur donné en exemple |
| n3.py / n3.js | `message.content` à `null` passé à `json.loads` / `JSON.parse` | Traité explicitement comme une réponse inutilisable, retentée |
| n3.js (#80) | plafond en unités UTF-16 | `[...message].length` : points de code, comme Python |

Marquages retirés (assertions inchangées) : n0 — 3 `INFIRMÉ` et 5 `DÉFAUT` en
Python, 3 `INFIRMÉ` et 6 `DÉFAUT` en JavaScript ; n1 — 1 `DÉFAUT` en Python,
3 `DÉFAUT` en JavaScript ; n3 — 1 `INFIRMÉ` et 2 `DÉFAUT` en Python, 1
`INFIRMÉ` et 3 `DÉFAUT` en JavaScript.

Restent marqués, et à reprendre par le testeur : n1 `INFIRMÉ` sur la
mémorisation (py), sur l'adresse que N1 traiterait (py/js), sur les quarante
lignes (js) ; n3 `DÉFAUT` du client par défaut (py/js), qui passe un double du
kit directement comme `client`.

Lignes utiles : n0.py 37, n0.js 40, n1.py 33, n1.js 58 (55 avant), n3.py 58
(35 avant), n3.js 66 (42 avant). N3 porte l'adaptateur imposé (une quinzaine de
lignes) et la validation des éléments.

## Sources consultées

- RFC 2822, section 3.4.1 (avril 2001) et RFC 5322, section 3.4.1 (octobre 2008) : même définition d'`addr-spec`. https://www.rfc-editor.org/rfc/rfc2822#section-3.4.1, https://www.rfc-editor.org/rfc/rfc5322#section-3.4.1
- Wikipédia, « Plan de numérotation en France » (dix chiffres depuis le 18 octobre 1996), trouvé par recherche web avec les pages de l'Arcep sur l'outre-mer.
- Wikipedia, « International Bank Account Number » : jusqu'à 34 caractères, Norvège 15, Russie 33, groupes de quatre à l'impression, algorithme modulo 97.
- Unicode Standard Annex 15 : équivalence canonique = même apparence ; compatibilité = apparence qui peut différer (ligatures, exposants, pleine largeur).
- UTR 36 (stabilisée, renvoie à l'UTS 39) et UTS 39 « Unicode Security Mechanisms », section 4 « Confusable Detection ».
- Tarifs de l'API OpenAI : « Prices per 1M tokens » ; gpt-4.1-mini 0,40 $ en entrée, 1,60 $ en sortie par million de jetons. Vérification de la classe `élevé` (non publiée) : invite d'une soixantaine de jetons plus un message court, réponse d'une vingtaine de jetons, soit de l'ordre de 70 $ par million de messages, plus près de la centaine que de la dizaine.
- `further_reading` : docs Python `re`, MDN expressions régulières : pages existantes, conformes au libellé.

Tous ces liens sont ajoutés à `sources` sauf les RFC 2822 et UTR 36 (la RFC 5322 porte la même définition).

## À retester

- **n0 point de rupture IBAN (py/js)** : l'assertion « DE 12 3456 7890 1234 masquée » décrit l'ancien défaut. La fiche cite désormais « DE 86 3456 7890 1234 », clé valide par coïncidence : tester qu'elle est masquée, et que « DE 12 … » ne l'est plus (témoin).
- **n1 `test_n1_est_une_regression_logistique_de_bibliotheque` (py)** : `modules == {"re", "sklearn"}` ; n1.py importe maintenant `unicodedata` (bibliothèque standard) pour NFKC. L'affirmation `vendor_lock: library` tient toujours.
- **n1 `INFIRMÉ` mémorisation (py)** : la phrase testée a disparu ; remplacer par la nouvelle (« chaque chiffre caché devient le même symbole »).
- **n1 `INFIRMÉ` adresse (py/js)** : l'unavailable_reason N2 attribue désormais les adresses à N0 ; le test marqué est à retirer ou à remplacer par « N0 masque adresse, numéro, IBAN ; N1 attrape le numéro déguisé que N0 laisse passer ».
- **n1 `INFIRMÉ` quarante lignes (js)** : la phrase ne donne plus de nombre ; tester les trois fonctions (`features`, `train`, `isHidingContactDetails`).
- **n3 `DÉFAUT` client par défaut (py/js)** : tester l'adaptateur avec le double à la forme du vrai kit, `mask(…, client=ProviderClient(sdk=RealShapedClient(…)))` / `providerClient(realShapedClient(…))`, requête `{model, messages: [{role: 'user', content}], temperature: 0}`, réponse `choices[0].message.content`, et `content: null` → `MaskingUnavailable` après les essais.
- **Noms des tests démarqués** : le préfixe `INFIRMÉ :` / `DÉFAUT :` est retiré, mais la suite du nom décrit encore le défaut (« …passent en clair », « …prend un temps quadratique ») ; à renommer avec leurs jumeaux Python.
- n0 : nouveaux cas à couvrir — séquence d'emoji à liant conservée, IBAN minuscule avec lettres (« gb82 west 1234 5698 7654 32 »), IBAN suivi d'un mot court ou de quatre lettres (« BE68 5390 0754 7034 dans »), phrase ordinaire en minuscules non masquée (« le 12 mars 2024 dans la salle »), NFD d'un message sans coordonnée rendu en NFC, chiffres arabes-indiens non lus comme chiffres (py/js identiques), 00 à 99 : une seule clé valide pour « DE ?? 3456 7890 1234 ».
- n1 JS : `train` refuse une seule étiquette et des longueurs différentes.
- n3 : `content` nul ; élément à `text` vide ; élément non objet (`null`, chaîne, nombre) ; texte présent mais `kind` hors liste ; plafond en points de code en JS (8 000 emojis acceptés, 8 001 refusés).
- Essai : la phrase « en deux secondes » est retirée du `why` du cas 4.

## Pour l'orchestrateur

- `test-snippets mask-personal-data-in-chat` reste rouge sur les deux tests ci-dessus jusqu'au passage du testeur.
- n1.js (58) et les deux N3 (58 et 66) dépassent les quarante lignes utiles de la charte des extraits ; pour N3 l'adaptateur imposé en est la cause principale. Soit la charte décompte l'adaptateur, soit il part dans un module partagé.
- `check-french` échoue actuellement sur `content/entries/detect-language-of-text.mdx` (« Tatoeba »), hors de mes chemins.
- Le double `RealShapedClient` écrit par le testeur dans chaque test N3 aurait sa place dans `_harness/`.
