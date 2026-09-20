# Lot 17 — rapport

Vingt-cinq fiches écrites, testées et publiées, dans l'ordre de la mission.
Chacune a son relevé de test dans `docs/lot17/releves/`, et une ligne dans
`docs/lot17/ETAPES.md`. Ce rapport dit ce que le lot a produit, ce qu'il a
appris, ce qu'il a décidé seul et ce qu'il laisse ouvert.

---

## 1. Les vingt-cinq fiches

| # | Fiche | Verdict | L'outil standard entré dans l'échelle | Niveaux fermés, et pourquoi |
|---|---|---|---|---|
| 1 | check-a-company-identification-number | N0 | `python-stdnum` 2.2 / `stdnum-js` 1.12.6 | N1–N3 : la clé de Luhn est une arithmétique, il n'y a rien à apprendre |
| 2 | check-bank-details-before-a-transfer | N0 | `python-stdnum` 2.2 / `ibantools` 4.5.4 | N1–N3 : ISO 13616 donne la clé ; le reste est un service, pas un modèle |
| 3 | validate-a-phone-number-and-its-country-code | N0 | `phonenumbers` 9.0.39 / `libphonenumber-js` 1.13.13 | N1–N3 : les plans de numérotation sont publiés et livrés avec la bibliothèque |
| 4 | validate-an-email-address-without-sending-a-message | N0 | **aucun** : les deux bibliothèques sont écartées avec une mesure | N1–N3 : la syntaxe est une grammaire ; l'existence de la boîte ne s'infère pas |
| 5 | check-a-file-is-really-the-format-it-claims | N0 | `puremagic` 2.2.0 / `file-type` 22.1.1 | N1–N3 : la signature est aux premiers octets, pas dans une distribution |
| 6 | know-whether-a-pdf-needs-ocr | N0 | `pypdf` 6.1.3 / `pdf.js` 5.4.149 | N2–N3 : N1 ouvert (paires de lettres contre vos pages sûres) |
| 7 | repair-text-with-broken-encoding | N0 | `ftfy` 6.3.1 en Python, **rien** en JavaScript | N1–N3 : l'aller-retour d'encodage est réversible, donc vérifiable |
| 8 | validate-an-imported-file-against-a-schema | N0 | `jsonschema` 4.26.0 / `ajv` 8.20.0 | N1–N3 : le schéma est le contrat ; un modèle ne le lirait pas mieux |
| 9 | validate-an-api-payload-against-its-contract | N0 | `jsonschema` 4.26.0 / `ajv` 8.20.0, dialecte OpenAPI | N1–N3 : idem, avec le document OpenAPI comme racine |
| 10 | check-a-password-against-a-policy | N0 | NIST SP 800-63B-4 et Have I Been Pwned en k-anonymat | N1–N3 : la règle est une politique, pas une prédiction |
| 11 | extract-product-data-from-a-shop-page | N0 | JSON-LD de schema.org, publié par la boutique | N1–N2 ; **N3 ouvert** pour la boutique qui n'émet rien |
| 12 | extract-main-content-from-a-web-page | N0 | `trafilatura` 2.2.0 / `@mozilla/readability` 0.6.0 | N1–N3 : les deux bibliothèques *sont* déjà des classifieurs de blocs |
| 13 | extract-tables-from-a-pdf | N0 | `pdfplumber` 0.11.10 en Python, **rien** en JavaScript | N1–N3 : les filets sont dans le fichier |
| 14 | convert-a-pdf-to-plain-text | N0 | `pypdf`, `pdftotext`, `pdfplumber` / `pdf.js` | N1–N3 : les caractères sont dans le fichier, rien n'est reconnu |
| 15 | extract-fields-from-a-log-line | N0 | la notation Grok, réimplémentée en douze lignes | N1–N3 : le format est écrit dans le programme qui produit le journal |
| 16 | extract-the-latest-reply-from-an-email-thread | N0 | `email_reply_parser` 0.5.12 / `email-reply-parser` 2.3.9, **nommées, mesurées, pas appelées** | N1 (talon, 2017) et N2 ; **N3 ouvert** pour la réponse écrite dans la citation |
| 17 | extract-amounts-and-currencies-from-text | N0 | `price-parser` 0.5.1, **nommé, mesuré, pas appelé** | N1 : spaCy n'a pas d'étiquette `MONEY` en français ; N2 ; **N3 ouvert** |
| 18 | extract-key-terms-from-a-document | **N1** | `yake` 0.7.3 (LGPLv3) et `keyword-extractor` 0.3.0 (sans licence déclarée) — **nommés, la méthode écrite** | N2–N3 : ils lisent un document à la fois, ce que le verdict reproche à N0 |
| 19 | extract-people-and-companies-from-an-article | **N2** | spaCy 3.8.16 / `@huggingface/transformers` 4.3.0 | N1 : un CRF réclame un corpus annoté ; N3 : coût et périmètre vont ensemble |
| 20 | extract-links-from-a-page | N0 | `urllib.parse.urljoin` / `new URL` — et la norme WHATWG l'emporte | N1–N3 : l'adresse est un attribut, la résolution est publiée |
| 21 | extract-metadata-from-a-file | N0 | bibliothèque standard Python ; `fflate` 0.8.3 et `fast-xml-parser` 5.2.5 | N1–N3 : les noms des champs sont fixés par ECMA-376 |
| 22 | extract-a-table-from-a-web-page | N0 | `html.parser` / `linkedom` 0.18.13, algorithme du standard HTML | N1–N3 : la norme décrit l'algorithme elle-même |
| 23 | extract-tracking-numbers-from-an-email | N0 | la norme **UPU S10-12**, lue à la source | N1–N3 : la forme est publiée, le contrôle est une multiplication |
| 24 | aggregate-a-column-of-data | N0 | l'addition, sur des entiers mis à l'échelle | N1–N3 : une somme a une valeur exacte, il n'y a rien à approcher |
| 25 | estimate-the-cost-of-a-model-call | N0 | `tiktoken` 0.14.0 / `gpt-tokenizer` 4.0.0, nommés sans être des dépendances | N1–N3 : demander à un modèle ce que coûte un appel de modèle se facture soi-même |

Vingt-trois verdicts N0, un N1, un N2. Deux verdicts seulement sont
`stubbed` : la fiche 10, dont le niveau recommandé interroge un service, et la
fiche 19, dont le niveau recommandé charge un modèle local — les vingt-trois
autres tournent avec leurs vraies dépendances à chaque construction du site.
Trois niveaux N3 sont ouverts, sur les fiches 11, 16 et 17, chacun avec une
garde vérifiable et un point de rupture qui dit ce que cette garde laisse
passer.

---

## 2. Les fiches dont la conclusion a surpris

**18 — les mots-clés d'un document.** La surprise est dans l'énoncé lui-même.
« Les termes qui *caractérisent* un document » : caractériser, c'est
distinguer, et distinguer demande une collection. Un document lu seul ne peut
dire que ce qu'il répète, et tous les contrats d'un dossier de contrats
répètent les mêmes clauses. Le verdict est donc N1 — non pas parce qu'un
modèle fait mieux, mais parce que le corpus est le modèle. Le test le montre en
une ligne : lu seul, le contrat rend « conditions générales » ; lu dans son
dossier, il rend « moulin » et « café ».

**19 — les personnes et organisations d'un article.** Premier verdict N2 du
lot, et il a été pris contre la pente du site. La moitié difficile de l'énoncé
— ce qu'un nom *est* — n'est écrite nulle part dans le texte, et un pipeline
local de quelques dizaines de mégaoctets la règle. La frugalité n'est pas
l'absence de modèle : c'est l'absence d'appel facturé et de sortie de données.
Le niveau N0 garde tout son emploi parce qu'il sait répondre `unknown`, ce que
le pipeline ne sait pas faire.

**20 — les liens d'une page.** La fiche devait être la plus simple du lot. La
mesure a montré sept divergences entre `urllib.parse.urljoin` et `new URL` sur
trente-huit adresses, dont une qui change l'hôte : `href="\\chemin"` mène à un
chemin de votre site sous RFC 3986 et à l'hôte `chemin` sous la norme WHATWG.
La bibliothèque standard de Python n'est pas la norme du web.

**24 — la somme d'une colonne.** La fiche devait dire que la somme flottante
d'une colonne d'argent « perd des centimes ». La mesure l'a démentie : sur
quatre mille colonnes tirées au hasard, aucun centime déplacé après arrondi.
Ce qui est vrai, et mesuré, est plus intéressant : la somme flottante diffère
de la somme exacte environ sept fois sur cent, et **la somme compensée de
Kahan, réponse classique au problème, rend exactement la même valeur fausse**,
parce que l'erreur est dans la représentation et non dans l'accumulation.

**4 — la validation d'une adresse e-mail.** Les deux bibliothèques de
référence ont été écartées, mesure à l'appui : quatre désaccords entre elles et
quatorze avec le navigateur sur trente-deux adresses. L'extrait transcrit
l'expression régulière du standard HTML, qui est ce que le champ de saisie de
l'utilisateur appliquera de toute façon.

---

## 3. Ce que la recherche a établi

### Retenu dans l'échelle

| Outil | Version | Licence | Fiche |
|---|---|---|---|
| `python-stdnum` | 2.2 | LGPL | 1, 2 |
| `stdnum` (stdnum-js) | 1.12.6 | MIT | 1 |
| `ibantools` | 4.5.4 | MIT ou MPL-2.0 | 2 |
| `phonenumbers` | 9.0.39 | Apache-2.0 | 3 |
| `libphonenumber-js` | 1.13.13 | MIT | 3 |
| `puremagic` | 2.2.0 | MIT | 5 |
| `file-type` | 22.1.1 | MIT | 5 |
| `pypdf` | 6.1.3 | BSD-3-Clause | 6, 14 |
| `pdfjs-dist` | 5.4.149 | Apache-2.0 | 6, 13, 14 |
| `ftfy` | 6.3.1 | Apache-2.0 | 7 |
| `jsonschema` | 4.26.0 | MIT | 8, 9 |
| `ajv` + `ajv-formats` | 8.20.0 + 3.0.1 | MIT | 8, 9 |
| `trafilatura` | 2.2.0 | Apache-2.0 | 12 |
| `@mozilla/readability` | 0.6.0 | Apache-2.0 | 12 |
| `linkedom` | 0.18.13 | ISC | 12, 20, 22 |
| `pdfplumber` | 0.11.10 | MIT | 13, 14 |
| `fflate` | 0.8.3 | MIT | 21 |
| `fast-xml-parser` | 5.2.5 | MIT | 21 |
| spaCy | 3.8.16 (MIT) ; `fr_core_news_sm` 3.8.0 (**LGPL-LR**) | 19 |
| `@huggingface/transformers` | 4.3.0 | Apache-2.0 | 19 |

### Nommé, mesuré, et volontairement pas appelé

| Outil | Version | Licence | Pourquoi |
|---|---|---|---|
| `email-validator` 2.3.0 / `validator.js` 13.15.35 | — | Unlicense / MIT | quatre désaccords entre elles, quatorze avec le navigateur (fiche 4) |
| `zxcvbn` | — | MIT | dictionnaires anglais dans le portage Python (fiche 10) |
| `email_reply_parser` 0.5.12 / `email-reply-parser` 2.3.9 | 2020 / 2026 | MIT | elles se contredisent sur un fil français (fiche 16) |
| `price-parser` 0.5.1 | 2026 | BSD-3-Clause | rend le numéro de facture comme total ; défaut de séparateur à mille près (fiche 17) |
| `yake` 0.7.3 | 2026 | **LGPLv3** | six dépendances transitives pour une comparaison qui ne décide pas du verdict (fiche 18) |
| `tiktoken` 0.14.0 / `gpt-tokenizer` 4.0.0 | 2026 | MIT | nommés comme la façon de compter ; `tiktoken` télécharge ses tables au premier usage (fiche 25) |

### Écarté, avec la raison

- `keyword-extractor` (npm) 0.3.0 : **le paquet publié ne déclare aucune
  licence**, bien que le dépôt porte un fichier LICENSE de 2013. Un paquet sans
  licence déclarée est un paquet qu'on ne peut pas intégrer (fiche 18).
- `rake-js` 0.1.1 (2017), `price-parser` npm 3.4.0 (2018), `parse-price` 1.1.8
  (2018), `wink-ner` 2.1.0 (2020), `talon` 1.4.4 (2017) : huit à neuf ans sans
  publication.
- `retext-keywords` 8.0.2 : maintenu, mais il dépend de `stemmer`, l'algorithme
  de Porter, écrit pour l'anglais.
- `compromise` 14.17.0 : « a common-sense baseline for **english** grammar » ;
  la variante française en est à la version 0.3.1 et son propre projet la décrit
  comme un travail en cours.
- `jszip` 3.10.2 : quatre dépendances et une double licence MIT ou GPL-3.0 à
  faire lire ; `adm-zip` travaille sur des fichiers, pas sur des octets.
- `urlstd` 2023.7.26.1 : la seule mise en œuvre Python de la norme URL du
  WHATWG, sans publication depuis septembre 2023.
- `sklearn-crfsuite` 0.5.0 : ferme le niveau N1 de la fiche 19 — il réclame un
  corpus annoté entité par entité, qui est précisément ce qu'on n'a pas.

---

## 4. Les fiches où un langage n'avait pas l'outil de référence

Sept fois sur vingt-cinq, l'outil qu'un développeur expérimenté brancherait
d'abord n'existe que d'un côté. Ce qui a été fait, à chaque fois, est écrit
dans la fiche et mesuré dans son test.

| Fiche | Ce qui manquait | Ce qui a été fait | L'écart résiduel, mesuré |
|---|---|---|---|
| 7 | `ftfy` n'a pas d'équivalent JavaScript | l'aller-retour windows-1252 / UTF-8 écrit en trente lignes | les deux extraits s'accordent sur 39 chaînes sur 41 ; les deux écarts sont la règle du « Ã » suivi d'une espace, dite dans la fiche |
| 13 | aucune bibliothèque JavaScript ne lit les filets d'un PDF | la lecture devinée écrite dans les deux langages ; le rapport dit toujours laquelle des deux lectures a répondu | le mode « filets » n'existe qu'en Python, et la fiche le dit |
| 16 | les deux bibliothèques existent et **se contredisent** | les marqueurs écrits dans l'extrait, français compris ; la signature n'est pas touchée | mesuré et publié : l'une laisse l'en-tête français, l'autre retire la signature qu'elle garde en anglais |
| 17 | rien de maintenu en JavaScript | les deux extraits écrits ensemble, convention de séparateur déclarée | aucun : rapport identique sur 48 cas |
| 18 | `yake` en Python, `keyword-extractor` sans licence en JavaScript | la méthode RAKE et le TF-IDF écrits dans les deux langages | aucun : scores identiques au quatre-millième près, par un arrondi écrit avec les mêmes deux opérations |
| 19 | **la langue, pas la bibliothèque** : dix-huit étiquettes d'entités en anglais, quatre en français | le niveau N0 type seulement ce que la phrase prouve ; N2 cartographie ce qui se cartographie et compte le reste | `MISC` est écarté et compté, faute de sens |
| 20 | Python n'a pas d'implémentation maintenue de la norme URL du web | quinze lignes de normalisation qui ferment les sept écarts mesurés | l'extrait ne prétend pas être une implémentation complète, et nomme `urlstd` |

Un huitième cas mérite d'être noté à part, parce qu'il ne concerne pas une
bibliothèque mais un langage : **JavaScript n'a pas de type décimal**. Les
fiches 17, 24 et 25 rendent toutes des montants sous forme de chaînes de
chiffres et calculent sur des entiers (`int` d'un côté, `BigInt` de l'autre),
ce qui est la seule façon d'obtenir deux extraits qui donnent la même réponse.

---

## 5. Les décisions prises seul, et l'alternative écartée

Les relevés en portent une soixantaine. Voici celles qui engagent le site
au-delà de leur fiche.

1. **Un service public n'est pas un barreau.** Sirene (fiche 1), la
   vérification du bénéficiaire au sens du règlement UE 2024/886 (fiche 2), le
   contrôle DNS/MX (fiche 4), l'interface de suivi d'un transporteur (fiche 23)
   sont nommés dans le verdict, les liens ou l'`escalate_when` — jamais dans
   l'échelle. *Alternative écartée* : en faire des niveaux, ce qui aurait fait
   de l'échelle une liste de solutions plutôt qu'une comparaison de méthodes.
2. **Ce que l'appelant doit déclarer n'a pas de défaut.** La convention de
   séparateur décimal (fiche 17), la liste de mots vides (fiche 18), la base de
   résolution (fiche 20), les familles de numéros cherchées (fiche 23). *La
   nuance, décidée en fiche 24* : un défaut est acceptable quand il ne peut pas
   se tromper en silence — une valeur écrite avec l'autre signe décimal y est
   refusée et comptée, pas mal lue.
3. **Ce qui n'est pas lu est nommé, pas tu.** Les parties d'un document
   bureautique que la fiche 21 ne lit pas, les nombres sans marque de la fiche
   17, les lignes illisibles de la fiche 24, les mots capitalisés en tête de
   phrase de la fiche 19. *Alternative écartée* : le silence, qui se lit comme
   une absence.
4. **Quand deux bibliothèques mûres divergent, l'écart est fermé dans
   l'extrait et publié dans la fiche.** Fiches 3, 5, 8, 9, 12, 16, 20, 21.
   *Alternative écartée* : laisser chaque langage à sa bibliothèque, ce qui
   ferait deux fiches sous un seul titre.
5. **Les montants ne passent jamais par un flottant.** Fiches 17, 24, 25.
   *Alternative écartée* : `Decimal` en Python, qui n'a pas d'équivalent en
   JavaScript.
6. **Le niveau N3, quand il est ouvert, rend des portions du document.** La
   fiche 16 demande des numéros de ligne, la 17 des portions à relire par le
   niveau N0. *Alternative écartée* : demander la valeur et la chercher ensuite
   dans le texte, ce qui laisse passer une reformulation partielle.
7. **Aucun tarif n'est écrit nulle part** (fiche 25), et c'est vérifié par un
   test qui relit le fichier source.

---

## 6. Ce qui reste ouvert

- **Le `<base href>` relatif et les redirections** (fiche 20) : l'extrait rend
  la base employée, il ne peut pas vérifier qu'elle est la bonne. Une fiche sur
  l'aspiration d'un site devrait dire comment obtenir l'adresse d'arrivée.
- **Retirer les métadonnées** (fiche 21) : la fiche les montre et nomme les
  parties qu'elle ne lit pas ; reconstruire l'archive sans elles est un autre
  travail, sans fiche à ce jour.
- **Le chiffre de contrôle d'UPS et celui de DHL Express** (fiche 23) : les
  formes sont reconnues, les calculs n'ont pas été trouvés dans une source
  publiée par les transporteurs. L'extrait ne les invente pas et le dit.
- **Le comptage exact des jetons** (fiche 25) : aucun tokeniseur n'est une
  dépendance, parce que celui de Python télécharge ses tables. Une fiche sur le
  comptage lui-même reste à écrire, et elle devrait mesurer le rapport
  caractères par jeton en français, ce que ce lot n'a pas pu faire hors ligne.
- **Les formats texte** (fiche 5) : CSV, JSON et XML n'ont pas de signature, et
  c'est le point de rupture de la fiche.
- **Les paramètres de chemin et de requête** (fiche 9) : hors périmètre, dit
  dans la fiche.
- **Le contrôle complet de la sur-couverture des fiches voisines** : la fiche
  18 et `tag-articles-by-topic` traitent deux questions voisines, la fiche 21 et
  `check-a-file-is-really-the-format-it-claims` aussi. Les liens croisés
  existent ; une relecture d'ensemble du catalogue reste à faire.

---

## 7. Ce que les chartes devraient gagner

**CHARTE-EXTRAITS — une section « les deux langages ne disent pas la même
chose ».** Le lot a rencontré la même famille de problèmes une douzaine de
fois, et chaque fiche l'a résolue seule. Ce qui devrait être écrit une fois :

- `\d` reconnaît tous les chiffres Unicode en Python et seulement les dix en
  JavaScript ; `\w`, `\s` et `\b` diffèrent de la même façon. Les classes
  s'écrivent en toutes lettres.
- `str.strip()` et `String.trim()` ne retirent pas les mêmes caractères — la
  marque d'ordre des octets d'un côté, les séparateurs C1 de l'autre.
- `str.splitlines()` coupe sur des caractères que `String.split` ignore.
- L'arrondi d'un demi n'est pas le même : `floor(x * 10^n + 0.5) / 10^n` écrit
  des deux côtés donne le même résultat.
- JavaScript n'a pas de type décimal : les montants se calculent sur des
  entiers et se rendent en chaînes de chiffres.
- Un booléen est un entier en Python et nulle part ailleurs.

**CHARTE-TESTS — rendre le test de parité obligatoire, et dire comment.**
Les vingt-cinq fiches en portent un — la fiche 6 n'en avait pas, et il lui a
été ajouté à la relecture finale. Dans plusieurs d'entre elles (6, 7, 12, 13,
et la comparaison de la 16) il ne compare pas deux réponses identiques mais
deux réponses dont l'écart est mesuré et publié, parce que les deux langages
n'emploient pas la même bibliothèque. C'est ce test qui a trouvé la plupart des
défauts réels de ce lot : l'ordre des tableaux (fiche 22), la ligne implicite
d'une cellule sans `<tr>` (22), la décomposition Unicode qui coupe « société »
en deux (18), le découpage sur la ponctuation qui recollait deux phrases (18),
les références numériques de caractères non décodées (21). La charte devrait
nommer ce test, donner sa forme — le test Python envoie ses cas à `node` et
compare les rapports JSON — et exiger qu'il couvre les entrées limites, pas
seulement les entrées ordinaires.

**CHARTE-TESTS — un test qui relit l'extrait.** La fiche 25 vérifie qu'aucun
tarif n'est écrit dans son propre fichier. Le même genre de test pourrait
garder d'autres interdits du CDC, et il coûte trois lignes.

**CHARTE-REDACTION — une règle sur la mesure qui dément.** La fiche 24 devait
annoncer une perte de centimes ; la mesure l'a démentie et la fiche annonce
autre chose. La charte devrait dire explicitement que **la mesure précède la
phrase**, et que le relevé doit garder trace de l'affirmation abandonnée — ce
que les relevés de ce lot font, sans que rien ne l'impose.

**CHARTE-REDACTION — la licence du modèle n'est pas celle de la
bibliothèque.** La fiche 19 l'a rencontré : spaCy est sous MIT, ses pipelines
français sous LGPL-LR. La règle R12 demande de citer les sources ; elle devrait
demander de citer la licence de ce qui est téléchargé, pas seulement de ce qui
est installé.

**Outillage — un test qui dépendait d'un nombre écrit en dur.** Le jeu de
fiches de test de la section 6.2 du CDC est dérivé de la feuille de route, une
fiche par intitulé. `tests/search.spec.mjs` en écrivait le cardinal en dur —
deux cents — et les cinq intitulés que ce lot devait ajouter l'ont fait
échouer. Le test lit désormais la feuille de route et vérifie que le jeu porte
**au moins** deux cents fiches, ce que le CDC demande réellement. La leçon
vaut au-delà de ce fichier : un test qui fige un nombre que le contenu fait
bouger devient un frein au contenu.

**Outillage — deux corrections faites dans ce lot.** `scripts/check-french.py`
prenait un « # » au milieu d'une valeur pour un commentaire YAML et relisait en
français la fin d'une valeur anglaise ; le correctif est dans la fiche 6. Et
`scripts/lexique-projet.txt` s'est enrichi d'une trentaine de termes
légitimes — noms de bibliothèques, termes de métier, mots cités dans un
exemple.

**Un mot sur les essais.** Dix essais interactifs et quinze figés. La règle
« interactif si l'extrait tourne sans dépendance dans un navigateur » a une
conséquence que la charte ne dit pas : un essai interactif embarque les
dépendances de l'extrait dans la page. La fiche 22 a dépassé le budget de poids
de la page avant d'être basculée en figé. La charte devrait dire de vérifier le
budget après avoir écrit un essai interactif.
