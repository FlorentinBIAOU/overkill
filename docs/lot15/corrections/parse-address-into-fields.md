# parse-address-into-fields — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets parse-address-into-fields` **rouge sur trois tests** qui fixent un
comportement que les réparations changent (voir « À retester ») :
`test_les_etiquettes_qui_partagent_un_champ_sont_jointes_le_reste_est_ecarte`
(Python et JavaScript) et `INFIRMÉ : « cela fait quarante lignes »` (JavaScript,
épingle 79 lignes). Aucune assertion n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario fr/en (#77, #78) | « On voit passer un appel de modèle… » ; « la convention postale : cinq chiffres suivis d'un nom de commune » ; « La réponse tient le plus souvent en un mot : le complément » | La Poste, SP 8855 vol. 2 : adresse d'un particulier en six lignes, ligne 6 « CODE POSTAL et LOCALITE DE DESTINATION », lignes 2 et 3 pour appartement, escalier, entrée, bâtiment, résidence. « le plus souvent » et le constat d'usage : non sourcés | « tient en un appel » ; « fixée par la norme postale : sa dernière ligne porte le code postal à cinq chiffres et la localité » ; « Dans les tests de cette fiche, c'est d'abord le complément — appartement, escalier, bâtiment, résidence — que la même norme place sur des lignes à part » |
| N0 breaking_point fr/en (#3) | « et l'adresse entière passe en nom de rue » | Code postal et ville sont lus ; seule la ligne de voie passe en rue | « et toute la ligne de voie, complément compris, passe en nom de rue » |
| N0 commentaire py/js (#13) | « Take the last postcode: a street name may carry a year » | Une année a quatre chiffres, jamais prise ; SP 8855 : code postal et localité ferment l'adresse | « Take the last run of five digits: in a French address the postcode and the town close the address, so a five-digit number earlier in the line is not taken for the postcode. » |
| N0 commentaire py/js | « A house number, and the repetition index that may follow it: 8, 8 bis, 12B. » | Code réparé (#11, #22) | « A house number or a range of them, and the repetition index that may follow: 8, 8-10, 8 bis, 12B. A lone letter counts only when it touches the number, so the "r" of "8 r des Lilas" stays a street type. » |
| N1 docstring de `features` py/js (#29) | « five digits followed by one capitalised word is a postcode and a town, wherever it sits in the line » | « 75011 Paris, 8 rue des Lilas » : `city: "Lilas"` dans les deux langages | « five digits followed by a capitalised word look like a postcode and a town. Position counts as well: on "75011 Paris, 8 rue des Lilas" the end of the line wins, and the town comes out as "Lilas". » |
| N1 docstring py + `doc.fr.yaml` (#30) | « A few dozen addresses tagged by hand are enough to start » | Le jeu du test et de l'essai compte 18 adresses ; il lit « Moulin », « Charmes », « Dijon », absents du jeu (#37) | « The test and the tryout train it on eighteen addresses tagged by hand, and it already reads a street, a residence and a town it never saw » |
| N1 docstring JS + `doc.fr.yaml` (#33) | « because that is forty lines and it is the argument of this rung » | 79 lignes (80 après réparation) | « Written out rather than pulled from a library: no dependency to install for a model this size. » |
| N2 docstring py/js + `doc.fr.yaml` (#48, #49) | « trained on tens of millions of addresses » ; « its training set is the planet: the German number…, the British postcode…, the Japanese order… » | README : « trained on over 1 billion addresses in every inhabited country on Earth » ; la lecture de chaque convention par le vrai modèle n'est pas mesurée | « trained on over a billion addresses from every inhabited country […] libpostal's training covers the conventions of other countries too. Whether it reads a given one right, nothing here measures. » |
| N2 commentaire py/js (#53) | « Two of its labels can land in one of our fields » | Quatre, cinq après ajout de `house` | « Five of its labels land in our complement, "house" among them » |
| N2 docstring `parse_addresses` py/js (#57) | « the model is loaded once and a batch of a hundred is one pass through it » | `predict` appelle `parse_address` par adresse ; Deepparse (2023) : « Libpostal does not offer batching functionality » | « The whole batch goes to the parser object in one call, but libpostal has no batching: `LibpostalParser.predict` parses the addresses one after the other. » |
| N2 `_predict` py/js (#59) | « Retry once: loading the data files is the call that fails, and once » | Le chargement a lieu hors de la boucle. Décision : ne pas retenter un chargement (module absent, fichiers manquants) et le laisser échouer avec son erreur | « Retry a failed parse once. Loading is not retried: a parser that cannot load its data files fails before this point, with its own error. » |
| N2 commentaire `MAX_CHARACTERS` py/js (#52) | « Anything longer is a paste, and feeding it to the parser only produces confident nonsense more slowly » | SP 8855 : 38 caractères par ligne, six lignes | « A postal address is short: La Poste's rules allow six lines of 38 characters. Anything longer is not an address line, and is refused before parsing. » |
| N2 latency | `~10 ms` | Deepparse, tableaux 1 et 2 : libpostal, temps moyen d'exécution ∼0,00004 s par adresse | `<1 ms` |
| N2 breaking_point fr/en (#45, #46) | « Une ligne qui n'est pas une adresse […] ressort avec un numéro et une rue » | Étiquettes écrites par le test ; l'absence de score est dans l'API (paires valeur/étiquette) | « libpostal rend des étiquettes, ni score ni refus. Si une ligne qui n'est pas une adresse […] revient étiquetée en numéro et en rue, ou si « 8 rue des Lilas, 75011 Lyon » […] revient en champs propres — deux réponses que le test simule —, rien dans le code ne distingue ce résultat d'un bon. » |
| N3 breaking_point fr/en | « le modèle intervertit la rue et la ville » | Réponse écrite par le double | « Si, sur « 12 rue de Lille, 59000 Lille », le modèle intervertit la rue et la ville — le test simule cette réponse — » |
| N3 docstring py/js + `doc.fr.yaml` (#69) | « a model asked for a postcode and given none will happily supply a plausible one » | Comportement du modèle, non sourcé | « a value the address does not contain is dropped, because a plausible postcode is worse than an empty field — nothing downstream will ever question it » |
| N3 commentaire py/js (#73) | « a model charges by the token, on the way in as well as out » | Tarifs OpenAI : prix par million de jetons en entrée et en sortie | « the provider bills the tokens of the prompt as well as those of the answer » |
| verdict_rationale fr/en (#30, #80) | « c'est ce que vos formulaires reçoivent vraiment » ; « quelques dizaines d'adresses » ; « élargir l'étiquetage pays par pays coûte alors plus cher qu'installer un analyseur déjà entraîné sur le monde entier » | Usage et comparaison de coûts non sourcés ; 18 adresses ; README libpostal | « la norme postale leur donne des lignes à part, un formulaire d'une ligne les reçoit mêlés à la voie » ; « dix-huit dans le test » ; « parce que N1 ne connaît que les conventions qu'on lui a étiquetées, quand libpostal a été entraîné sur des adresses de tous les pays habités » |
| further_reading | « Base Adresse Nationale — API de recherche et de validation d'adresses françaises » | La page est désormais le « Service de géocodage Géoplateforme », l'API BAN est dépréciée ; c'est une recherche, pas une validation | « Géoplateforme — service de géocodage des adresses françaises, qui remplace l'API de la Base Adresse Nationale » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#19) | « short enough to read in one sitting » | Appréciation |
| N3 docstring py/js + `doc.fr.yaml` | « This is the option people reach for first » | Constat d'usage non sourcé |
| N2 regulatory fr/en | « dans un service permanent » | L'extrait charge une bibliothèque dans le processus ; rien n'impose un service |
| Essai, `why` allemand fr/en (#39) | « et avec le même aplomb » | Aucun score exposé, non testable |
| Essai, en-tête | « Compter environ 120 millisecondes » | Durée chiffrée, fausse (216 ms mesurés par le testeur) ; « barreau » remplacé par « niveau » dans deux commentaires (décision de vocabulaire) |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#11) | « 8 r des Lilas » : « r » pris pour un indice de répétition | Une lettre isolée n'est un indice que collée au numéro (« 12B ») ; « bis », « ter », « quater » gardent l'espace permise |
| n0.py / n0.js (#22) | « 8-10 rue des Lilas » : rue « -10 rue des Lilas » | Le numéro accepte une plage `\d{1,4}-\d{1,4}` : numéro « 8-10 », voie « rue des Lilas » |
| n0.py (#21) | marque d'ordre des octets en tête : numéro vide | `normalise` replie `[\s﻿]+` en espace, comme `\s` de JavaScript |
| n1.js (#44) | jeu d'entraînement vide accepté, `parse` lève `TypeError` | `RangeError` à l'entraînement s'il y a moins de deux étiquettes différentes (scikit-learn lève déjà en Python) |
| n2.py / n2.js (#62) | ligne qui n'est pas un dictionnaire : `AttributeError` en Python, champs vides en JS | `ParsingUnavailable` ; `None` reste une réponse vide, comme le fixe le test existant |
| n2.js (#66) | `postal.parser` vaut `undefined` sous `import()` (module CommonJS) | `const { parser } = (await import('node-postal')).default;` avec un commentaire qui dit pourquoi. Non exécuté contre le vrai paquet (absent) ; la reproduction du testeur montre `default` présent |
| n2.py / n2.js (précision) | libpostal range un nom de résidence sous `house`, écarté en silence | `house` → `complement` (README : « venue name […] and building names ») |
| n2.py (précision) | lot vide : `LibpostalParser()` construit avant de voir que le lot est vide | Le parseur n'est construit qu'après la vérification des longueurs et du lot vide, dans les deux langages |
| n2.js (#64) / n3.js (#75) | plafond en unités UTF-16 | `[...address].length`, points de code comme Python |
| n3.py / n3.js (#71) | un fragment d'un autre champ (« 12 » d'« Appartement 12 ») passait pour un code postal | La garde compare des suites de mots entiers, et chaque mot de l'adresse ne sert qu'à un champ ; les valeurs les plus longues réclament leurs mots d'abord. La rue et la ville interverties passent toujours (point de rupture intact) |
| n3.py / n3.js (#72) | valeurs rendues en nombres JSON vidées | Un entier (ou un flottant entier en Python, que JSON.parse rend entier en JS) est lu comme ses chiffres |
| n3.py / n3.js (#74) | client par défaut sans méthode `complete` | Correctif imposé : `ProviderClient` / `providerClient`, `client = client or ProviderClient()` / `client ??= await providerClient()`, commentaire du fournisseur donné en exemple ; le client n'est construit qu'après le contrôle de longueur |
| n3.py / n3.js | `message.content` à `null` confié à `json.loads` / `JSON.parse` | Traité explicitement comme réponse inutilisable, retentée, puis `ParsingUnavailable` |

Marquages retirés (assertions inchangées) : n0 — 3 `DÉFAUT` en Python, 2 en
JavaScript ; n1 — 1 `DÉFAUT` en JavaScript ; n2 — 1 `DÉFAUT` en Python, 2 en
JavaScript ; n3 — 2 `DÉFAUT` en Python, 3 en JavaScript.

Restent marqués : n0 `INFIRMÉ` « l'adresse entière » et « l'année » (py/js), n1
`INFIRMÉ` « où qu'ils soient » (py/js), n2 `INFIRMÉ` « un seul passage », « deux
étiquettes », « le chargement est retenté » (py/js) : les phrases ont changé, les
tests décrivent l'ancienne. n3 `DÉFAUT` client par défaut (py/js) : il passe le
double du kit directement comme `client`.

Lignes hors commentaires et lignes vides : n1.js 80, n2.js 72, n3.js 75, au-delà
des quarante de la charte ; n3 porte l'adaptateur imposé et la garde par mots.

## Sources consultées

- La Poste, SP 8855 volume 2, « Adressage des plis », § 3.2 « L'adresse d'un particulier » : six lignes, ligne 2 « N° APP ou BAL-ETAGE-COULOIR-ESCALIER », ligne 3 « ENTREE-BATIMENT-IMMEUBLE-TOUR-RESIDENCE-LOTISSEMENT », ligne 4 « NUMERO-LIBELLE DE LA VOIE », ligne 6 « CODE POSTAL et LOCALITE DE DESTINATION » ; « 38 caractères ou espaces au maximum ».
- libpostal, README : « trained on over 1 billion addresses in every inhabited country on Earth », CRF ; étiquettes `house`, `house_number`, `road`, `unit`, `level`, `staircase`, `entrance`, `po_box`, `postcode`, `city` ; liaisons pypostal et node-postal.
- Yassine et al., « Deepparse : An Extendable, and Fine-Tunable State-Of-The-Art Library for Parsing Multinational Street Addresses », arXiv 2311.11846 : « Libpostal does not offer batching functionality » ; tableaux 1 et 2, temps moyen ∼0,00004 s par adresse, RAM ∼2,3 Go et ∼1 Go.
- Tarifs de l'API OpenAI : gpt-4.1-mini 0,40 $ en entrée, 1,60 $ en sortie par million de jetons ; une centaine de jetons d'invite et une quarantaine en sortie donnent de l'ordre de 100 $ par million d'adresses : classe `élevé` cohérente.
- `further_reading` : Géoplateforme (page existante, ancienne API BAN dépréciée), Michael Tandy « Falsehoods programmers believe about addresses » (2013, page existante), wiki OpenStreetMap `Key:addr` (page existante, `addr:housenumber`, `addr:street`, `addr:postcode`, `addr:city`).

## À retester

- **n2 `test_les_etiquettes_qui_partagent_un_champ_sont_jointes_le_reste_est_ecarte` (py/js)** : `house: 'résidence les ormes'` rejoint désormais `complement`. Garder `country`, `po_box`, `suburb` écartés.
- **n1 js `INFIRMÉ : quarante lignes`** : épingle 79 lignes ; la phrase ne donne plus de nombre, test à retirer.
- **n0 `INFIRMÉ` « l'adresse entière » et « l'année » (py/js)** : tester les nouvelles phrases (ligne de voie complément compris ; un nombre de cinq chiffres placé avant le vrai code postal n'est pas pris).
- **n0** : nouveaux cas — « 12 B rue… » (lettre séparée) : « B » passe en voie, décision assumée ; « 8-10 » rend le numéro « 8-10 » ; « 8 r des Lilas » rend `street_type: "rue"` ; U+FEFF en milieu de ligne.
- **n1 `INFIRMÉ` « où qu'ils soient » (py/js)** : tester la phrase nouvelle, `city == "Lilas"` sur « 75011 Paris, 8 rue des Lilas ». **n1 js** : `train` refuse une seule étiquette.
- **n2 `INFIRMÉ` « un seul passage », « deux étiquettes », « chargement retenté » (py/js)** : phrases remplacées (pas de lots dans libpostal ; cinq étiquettes vers `complement` ; chargement non retenté, son erreur sort telle quelle — c'est ce que fait déjà `l'analyseur est injecté…`).
- **n2** : lot vide sans analyseur injecté ne construit pas `LibpostalParser` (py) ni n'appelle `load` (js) ; `None` → champs vides, liste → `ParsingUnavailable` ; `load` lit `parser` sous `default` (double d'import impossible par nom nu : au moins un test de la forme `{ default: { parser } }` si le testeur trouve un moyen).
- **n3 `DÉFAUT` client par défaut (py/js)** : tester l'adaptateur, `parse(…, client=ProviderClient(sdk=RealShapedClient(…)))` / `providerClient(realShapedClient(…))`, requête `{model, messages: [{role: 'user', content}], temperature: 0}`, `content: null` → `ParsingUnavailable` après les essais.
- **n3** : garde par mots — « Lille » deux fois dans l'adresse, rue et ville toutes deux gardées ; une valeur qui ne coïncide qu'avec un morceau de mot (« Lil ») écartée ; flottant `75011.0` lu « 75011 » ; 300 emojis acceptés en JS.
- **Noms des tests démarqués** : le préfixe est retiré, la suite du nom décrit encore le défaut ; à renommer avec leurs jumeaux.
- **Essai** : `why` allemand sans « le même aplomb ».

## Pour l'orchestrateur

- `test-snippets parse-address-into-fields` reste rouge sur les trois tests ci-dessus jusqu'au passage du testeur.
- Le chargement réel de `node-postal` par `import()` et `.default` n'a pas été exécuté (paquet natif absent) ; seule la forme CommonJS du module, lue par le testeur, fonde la réparation.
- n1.js, n2.js et n3.js dépassent les quarante lignes utiles de la charte des extraits.
