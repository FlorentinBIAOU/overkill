# extract-dates-from-text — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets extract-dates-from-text` **rouge sur un test**, en Python et en
JavaScript : `production : des éléments nuls ou d’un autre type sont écartés
sans exception`, qui fixe le comportement que la réparation du défaut #52
change (voir « À retester »). Aucune assertion n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario (#70) | « écrites dans trois ou quatre formats connus » | Nombre non sourcé. CLDR : les motifs de date sont une liste finie par locale | « écrites selon des motifs que l’on peut énumérer (12/03/2024, 2024-03-12, 3 avril 2024) » ; en anglais la liste ajoute March 3, 2024 |
| N0 breaking_point (#3, #4, #5) | « … il ne se trouve rien du tout. L’échec est silencieux […], et un outil de planification bâti sur ce niveau ne voit jamais la moitié de ce que les gens écrivent » | « la moitié » sans source ; « dans 15 jours » ne rend rien non plus (test) ; les autres échecs silencieux (#20-22) sont réparés ; la réparation de #13 écarte exprès « 3/4/24 » | Ajoute « « dans 15 jours », qui a des chiffres, ne rend rien non plus » et « une date abrégée comme « 3/4/24 » est écartée exprès : une année sur deux chiffres n’est lue qu’avec un jour et un mois sur deux chiffres, sans quoi « version 2.1.24 » deviendrait un 2 janvier » ; « la moitié » retirée |
| N0 docstring py/js + `doc.fr.yaml` (#26) | « it is one line long » ; « trois groupes de chiffres » | Le contrôle est l'appel `date(year, month, day)` dans un `try` de quatre lignes ; l'extrait a maintenant trois motifs | « it is a single call » ; « des groupes de chiffres » |
| N0 commentaire NUMERIC (#13) | « Years are two or four digits, never three: that is what keeps "1.2.3" out » | « 1.2.3 » a une année sur un chiffre ; la raison était fausse. Code réparé | « Never a piece of a longer dotted number: in "10.1.1.24", "1.1.24" is not a date. » + commentaire « a short year only with a padded day and month: "version 2.1.24" is no date » |
| N0 `_full_year` / `fullYear` (#8) | « Two-digit years on the usual pivot » | MySQL : 00-69 → 2000-2069, 70-99 → 1970-1999. POSIX `strptime` (docs Python `time`) : 69-99 → 1969-1999. Il n'y a pas de pivot « usuel » | « Two-digit years as MySQL reads them: 00-69 are 2000-2069, 70-99 are 1970-1999. » Comportement inchangé |
| N1 docstring py/js + `doc.fr.yaml` (#34) | « only covers the all-numeric form with a four-digit year, which is the one form the ambiguity touches » | « 03/04/24 » est aussi ambigu, N1 ne le voit pas (test) | « …which is the one form it reads. A two-digit year, 03/04/24, is just as ambiguous and escapes it; so do months written in letters… » |
| N1 docstring js + `doc.fr.yaml` (#39) | « because it is short enough to read. That is the whole argument of this rung » | Appréciation ; ce qui est vérifiable : le modèle est `{ weights, bias }` | « the whole model is one weight per word and a bias » |
| N2 unavailable_reason (#72) | « coûte un service permanent à exploiter et n’apporte rien de plus que N1 » | Non sourcé. spaCy : étiquette DATE « Absolute or relative dates or periods » (glossaire) ; un `Span` porte texte, positions, étiquette, aucune valeur de date résolue | « Un modèle de reconnaissance d’entités nommées, celui de spaCy par exemple, étiquette un passage DATE, « jeudi prochain » compris, mais rend le passage et ses positions, pas le jour qu’il désigne… » |
| N3 docstring py/js + `doc.fr.yaml` (#54) | « it is the only one on this entry that reads "jeudi prochain" » | Capacité du modèle, non testable ; ce qui l'est : la requête envoie le jour et demande la résolution | « the only rung on this entry whose request asks for relative dates, "jeudi prochain", to be resolved: it sends today's date along with the text » |
| N3 docstring py/js + `doc.fr.yaml` | « the model has no idea what day it is » ; « a model will answer 2024-02-31 in flawless JSON without blinking » | Affirmations sur le modèle, non sourcées ; charte des tests : ce que le double écrit n'est pas ce que le modèle fait | « the model is not told what day it is otherwise » ; « nothing in the request stops the answer from holding 2024-02-31 » |
| N3 breaking_point (#50, #51, #52) | « Le modèle rend « 2024-02-31 » en JSON impeccable, et à côté une date qu’il a fabriquée […] il peut aussi répondre en prose : l’extrait lève alors une erreur » | Même raison ; et une liste aux éléments mal formés rendait une liste vide. Code réparé | « Rien dans la requête n’empêche la réponse de porter « 2024-02-31 » […] ni une date qui ne figure pas dans le document […] Une réponse qui n’est pas une liste d’objets à date AAAA-MM-JJ — de la prose, une clé mal nommée, une date écrite « 12/03/2024 » — est redemandée, puis l’extrait lève une erreur » |
| N3 commentaire py/js | « A model charges by the token » | Même correction que sur mask-personal-data-in-chat (tarifs par million de jetons) ; le plafond compte des caractères | « The provider bills every token of the prompt. […] the cap counts characters, not tokens » (+ « code points » en JS) |
| verdict_rationale (#25, #26) | « écartés par une ligne » ; « Ce que ce niveau ne sait pas faire, il ne le fait pas à moitié, il rend une liste vide » | Test : une date mois-jour lue en jour-mois ressort plausible et fausse | « écartés par celui de la bibliothèque standard » ; « Ce que ce niveau ne voit pas, il le rend en liste vide ; ce qu’il lit selon la mauvaise convention, il le rend comme une date plausible, et c’est ce qui décide de monter. » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstring py/js + `doc.fr.yaml` (#15) | « the whole of it fits on a screen » | Non testable |
| N1 docstring py/js + `doc.fr.yaml` (#38) | « a few hundred labelled sentences are enough » ; « The model is small enough to keep beside the code » | Volume sans mesure ni source (les tests tiennent avec seize phrases) |
| N3 docstring py/js (repris dans la reformulation) | « the model has no idea… », « without blinking » | Affirmations sur le modèle |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#13) | « version 2.1.24 » et « 10.1.1.24 » lus comme des dates | Regard arrière `(?<!D[/.-])` et regard avant `(?![/.-]?D)` : jamais un morceau d'un nombre pointé plus long ; une année sur deux chiffres n'est lue qu'avec jour et mois sur deux chiffres. « 12.03.24 », « 01/01/70 » restent lus ; « 3/4/24 » ne l'est plus, et la fiche le dit |
| n0.py / n0.js (#17) | chevauchement quadratique (≈ 9 s pour 15 000 dates en Python) | Tableau d'octets des caractères déjà lus (`bytearray` / `Uint8Array`) : 0,05 s en Python, 0,025 s en JS sur 15 000 dates |
| n0.py / n0.js (#20) | « 1ER MARS 2024 » non lu | Motifs de mois en lettres insensibles à la casse (`re.I` / drapeau `i`) ; suffixes `er`, `st`, `nd`, `rd`, `th` |
| n0.py / n0.js (#21) | « March 3, 2024 » non lu | Troisième motif `MONTH_FIRST`, qui ne commence qu'en début de mot (sinon quadratique sur une longue suite de lettres ; motif pathologique mesuré à 0,13 s) |
| n0.py / n0.js (#22) | mois en NFD non lu | Classe du mot : lettres et diacritiques combinants (`[̀-ͯ]` en Python, `\p{M}` en JS) |
| n0.js (#23) | chiffres pleine chasse non lus en JS | Classe `[0-9０-９]` dans les deux langages (Python ne lit plus les chiffres arabes-indiens, JS non plus : identiques), valeur lue après NFKC en JS |
| n0.js, hors relevé | `Date.UTC(24, 0, 1)` rend 1924 : « 01/01/0024 » ressortait en 1924 en JS, en 0024 en Python (et 0024 passait par le pivot) | `setUTCFullYear`, année ≥ 1 ; le pivot ne s'applique qu'à une année écrite sur deux chiffres. MDN : les années 0 à 99 du constructeur sont lues 1900 à 1999 |
| n1.py (#45) | `train` lève `AttributeError` sur une phrase sans candidat | Contexte vide, comme la version JavaScript |
| n3.py / n3.js (#52) | liste d'éléments mal formés rendue comme « aucune date » | `_is_usable` / `isUsable` : chaque élément est un objet dont `date` est une chaîne `AAAA-MM-JJ` (forme vérifiée à part : `date.fromisoformat` accepte aussi `20240312` et `2024-W10-1`) ; sinon réponse inutilisable, redemandée, puis `ExtractionUnavailable`. Un jour impossible de la bonne forme reste écarté sans erreur (point de rupture) |
| n3.py (#66) | `text` nul rendu `None` | Chaîne vide si `text` n'est pas une chaîne, dans les deux langages |
| n3.js (#56) | jour de référence converti en UTC | `localDay` : année, mois, jour dans le fuseau local |
| n3.py / n3.js (#60) | client par défaut sans `complete` | Correctif imposé `ProviderClient` / `providerClient`, `client = client or ProviderClient()` / `client ??= await providerClient()`, placé **après** les refus de taille et de texte vide (aucune clé nécessaire pour refuser) |
| n3.py / n3.js | `message.content` nul passé à `json.loads` / `JSON.parse` | Traité explicitement comme réponse inutilisable, redemandée |
| n3.py / n3.js (#63) | texte vide ou blanc : un appel payé | `[]` sans appel |
| n3.js (#64) | plafond en unités UTF-16 | Points de code (`[...text].length`, calculé seulement au-delà de 8 000 unités) |

Marquages retirés (assertions inchangées) : n0 — 5 `DÉFAUT` en Python, 5 en
JavaScript ; n1 — 1 `DÉFAUT` en Python ; n3 — 3 `DÉFAUT` en Python, 4 en
JavaScript.

Restent marqués, et à reprendre par le testeur : n0 `INFIRMÉ` liste vide
(py/js) ; n1 `INFIRMÉ` forme à quatre positions (py/js) ; n3 `DÉFAUT` client par
défaut (py/js), qui passe le double du kit directement comme `client`.

Lignes utiles (hors docstrings et commentaires) : n0.py 49 (39 avant), n0.js 53
(40), n1.py 39, n1.js 52, n3.py 65 (40), n3.js 69 (41).

## Sources consultées

- MySQL 8.4 Reference Manual, « 2-Digit Years in Dates » : 00-69 → 2000-2069, 70-99 → 1970-1999.
- Python, module `time` : `strptime` et `%y`, « values 69–99 are mapped to 1969–1999, and values 0–68 are mapped to 2000–2068 » (POSIX et ISO C).
- Python, module `datetime` : calendrier grégorien proleptique, `MINYEAR` 1 ; `date.fromisoformat` accepte `20191204` et `2021-W01-1`.
- MDN, constructeur `Date` : report des valeurs hors bornes (`new Date(1990, 12, 1)` → 1er janvier 1991) ; années 0 à 99 lues 1900 à 1999.
- RFC 3339 : `full-date = date-fullyear "-" date-month "-" date-mday`, section 3 sur les années à deux chiffres, annexe C sur les bissextiles — conforme au libellé de `further_reading`.
- CLDR, « Date/Time Patterns » : page existante, l'ordre des champs se choisit par locale — conforme au libellé.
- spaCy : `glossary.py` (« DATE: Absolute or relative dates or periods ») et API `Span` (texte, positions, étiquette, aucune valeur résolue).
- Latence N1 `<1 ms` vérifiée : 0,3 ms par appel sur une phrase à une date ambiguë, modèle du test.

## À retester

- **n3 `production : des éléments nuls ou d’un autre type sont écartés sans exception` (py/js)** : rouge, attendu. `[null, "2024-03-12", 42, {…}]` n'est plus une réponse utilisable : tester `ExtractionUnavailable` après trois appels.
- **n3 `DÉFAUT` client par défaut (py/js)** : tester l'adaptateur avec le double à la forme du kit, `extract_dates(…, client=ProviderClient(sdk=RealShapedClient(…)))` / `providerClient(new RealShapedClient(…))` : requête `{model: 'gpt-4.1-mini', messages: [{role: 'user', content}], temperature: 0}`, réponse `choices[0].message.content`, `content: null` → `ExtractionUnavailable` après les essais.
- **n0 `INFIRMÉ` liste vide (py/js)** : la phrase a changé ; tester la nouvelle (liste vide sur « jeudi prochain », date plausible sur 04/05/2024 mois-jour).
- **n1 `INFIRMÉ` forme à quatre positions (py/js)** : la docstring dit désormais que « 03/04/24 » échappe à N1 ; le test marqué est à retourner en démonstration.
- **n3 JS `TODAY = new Date(Date.UTC(2024, 2, 12))`** : `today` est lu en heure locale ; sous un fuseau à l'ouest de UTC, le test d'envoi du jour de référence enverrait 2024-03-11. Construire `new Date(2024, 2, 12)`.
- **Noms des tests démarqués** : le préfixe est retiré, mais la suite décrit encore le défaut (« …n’est pas lu », « …coûte un appel », `test_defaut_…`) ; à renommer avec leurs jumeaux.
- n0, nouveaux cas : « 3/4/24 » ne rend rien (point de rupture) et « 03/04/24 » est lu ; « March 3rd, 2024 », « 3rd April 2024 » ; « 10.01.01.24 » ne rend rien ; « 01/01/0024 » rend l'an 24 dans les deux langages, « 01/01/0000 » rien ; chiffres arabes-indiens non lus (py/js identiques) ; « le 12.03.24. » en fin de phrase est lu ; long motif « March » + suite de lettres dans une borne large.
- n0 : le commentaire du pivot cite MySQL (00-69 → 2000-2069).
- n1 py : `train` sur une phrase sans candidat (le test démarqué le couvre).
- n3 : forme de date `20240312` et `2024-W10-1` → inutilisable (Python l'acceptait par `fromisoformat`) ; `text` non chaîne (nombre) → `""` ; `content` nul ; « 0024-01-01 » rend l'an 24 en JS comme en Python ; texte vide sans client fourni ne construit pas le client.
- Essai : inchangé ; ses quatre tests passent.

## Pour l'orchestrateur

- `test-snippets extract-dates-from-text` reste rouge sur le test ci-dessus jusqu'au passage du testeur.
- Les extraits dépassent les quarante lignes utiles : n0.py 49, n0.js 53 (trois motifs, lecture des chiffres pleine chasse, filtre linéaire), n1.js 52 (déjà au-dessus), n3.py 65 et n3.js 69 (adaptateur imposé, validation de forme, jour local). Même remarque que sur mask-personal-data-in-chat : soit la charte décompte l'adaptateur, soit il part dans un module partagé.
- Le double `RealShapedClient` écrit dans chaque test N3 aurait sa place dans `_harness/`.
