# convert-messy-csv-to-clean-data — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets convert-messy-csv-to-clean-data` **rouge** sur les seuls tests
listés dans « À retester » (2 en Python, 4 en JavaScript). Aucune assertion n'a
été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 `decode_text` py/js (#11) | « UTF-32 is left out on purpose: no spreadsheet writes it, and pretending to support an encoding… » | UTF-32 LE (marque `FF FE 00 00`, FAQ Unicode) était lu comme de l'UTF-16 ; UTF-16 sans marque passait en UTF-8 valide ; « no spreadsheet writes it » non sourcé | « UTF-32, and UTF-16 without a mark, are not decoded: they come out full of NUL characters, and `clean_csv` refuses such a file in its journal » — et le code le fait |
| N0 `decode_text` py/js | « strict UTF-8 […] then it is almost certainly right […] cp1252 is by far the most common of those » | Non sourcé | « strict UTF-8 either succeeds, and the file is read as UTF-8, or fails, and the file is read as cp1252, the Windows single-byte encoding for Western European languages » |
| N0 `detect_dialect` commentaire py/js (#13, #22) | « A quote character only counts when it opens a field: at the start of a line, or straight after the delimiter » | L'apostrophe de « '0612345678 » ouvre un champ sans jamais le fermer, et était choisie comme guillemet | « only counts when it both opens fields […] and closes them […]. A lone apostrophe in front of a value opens and closes nothing » — et le code compte ouvertures et fermetures |
| N0 js `parseRecords` (#29) | « a CSV parser is a thirty-line state machine » | 47 lignes, davantage après réparation | Phrase retirée ; la docstring décrit le refus des enregistrements illisibles |
| N1 `column_features` py/js (#38) | « Every trait is a proportion rather than a count, so a column sampled from ten rows and one sampled from ten thousand are described on the same scale » | Test : 0, 1, 2, 3 répétés → integer sur 8 lignes, boolean sur 200 ; le rapport de valeurs distinctes baisse avec l'échantillon. Un trait « deux valeurs au plus », essayé, type toute colonne de deux lignes en booléen (tests du schéma et du verdict) : écarté | « The distinct ratio depends on the size of the sample: it falls as the sample grows. Small integers repeated, 0 to 3, read as integer on eight rows and as boolean on two hundred, and rung N0 then refuses every 2 and every 3, in its journal. » |
| N1 `infer_schema` py/js (#41) | « A couple of hundred rows say as much about the shape of a column as a million do, and reading them costs nothing » | Test : 200 entiers puis des décimaux → integer | « Only the first `sample` rows are read. On a file sorted, or one that changes as it goes, they are not the whole column: whole amounts on the first two hundred rows and decimals after give integer, and rung N0 then refuses every decimal, in its journal. » |
| N1 docstring js + `doc.fr.yaml` (#44) | « because logistic regression on eight features is thirty lines […] the classical tool is small enough to read » | 38 lignes (40 désormais) | « Written out rather than pulled from a library: one logistic regression per type, fitted by gradient descent. » |
| N1 `latency` (#46) | `~10 ms` | Mesuré sur le fichier nominal des tests (cinq colonnes) : py 0,3 ms, js 0,02 ms ; sur 200 colonnes × 200 lignes, py 34 ms après réparation (45 ms avant), js 18 ms. La même base que N0 (`<1 ms`, mesuré sur le même fichier nominal) | `<1 ms`, sur le fichier nominal ; voir « Pour l'orchestrateur » |
| N2 unavailable_reason (#50) | « que huit proportions et une régression logistique décrivent déjà » ; « un service permanent à exploiter, sans rien voir de plus » | Sept proportions et une longueur ; #38 et #41 montrent ce que ces traits ne décrivent pas ; « sans rien voir de plus » non sourcé | « et c’est ce que N1 lit, sur huit traits. Un modèle auto-hébergé pour deviner qu’une colonne contient des dates ajouterait un modèle à charger et à tenir en service. » |
| N3 `repair_rejected_rows` py/js (#55) | « the number of calls made is exactly the length of that journal » | Une panne ajoute un appel | « one call per entry of that journal, and up to `attempts` for an entry whose calls fail » |
| N3 `_ask` py/js (#59) | « At temperature zero the same prompt gives the same answer, so asking a second time buys nothing but a second bill » | Non testable ; kit `openai` 7.15.0 : « lower values […] more focused and deterministic » | « an unusable answer is not, and its row goes to `unrepairable` for a person to look at » ; commentaire « The lowest temperature: the SDK documents lower values as more focused and deterministic. » |
| scenario (#67) | « puisqu’un modèle rend un tableau complet sans dire ce qu’il a deviné » | Comportement de modèle non sourcé | « puisque rien dans le tableau rendu ne distingue une valeur lue d’une valeur devinée » |
| Essai, cas 4, why (#31) | « Les lignes 41 et 42 […] Seule la ligne 43 » | 41 à 43 sont les identifiants ; le tableau affiche les lignes 2 à 4 | « Les factures 41 et 42 […] Seule la facture 43 » (et « Invoices » en anglais) |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N1 docstring py/js + `doc.fr.yaml` (#43) | « The training set is a few dozen columns labelled by hand, which is an afternoon rather than a project » | Non testable ; reste « from columns labelled by hand » |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py (#21) | marque UTF-8 puis octet invalide : `UnicodeDecodeError` | Décodage des marques avec `errors="replace"`, comme `TextDecoder` non strict en JS : le même U+FFFD dans les deux |
| n0 py/js (#20) | UTF-16 sans marque, UTF-32 : colonnes pleines de NUL, journal vide | Un texte décodé qui contient NUL est refusé entier, une entrée au journal (ligne 1, « NUL characters: UTF-16 without a byte order mark, or UTF-32, not read ») |
| n0 py/js (#22) | apostrophe de tableur prise pour le guillemet, lignes fusionnées | Le guillemet retenu est celui qui ouvre **et** ferme des champs |
| n0 py/js (#23) | guillemet jamais fermé : le reste du fichier dans un champ | Python : `csv.reader(..., strict=True)` ; JS : mêmes contrôles écrits dans `parseRecords`. Un enregistrement illisible (guillemet jamais fermé, texte après un guillemet fermant, champ trop long) est refusé à sa ligne de départ avec la ligne brute, et la lecture reprend à la ligne suivante |
| n0.py (#25) | champ de plus de 131 072 caractères : `csv.Error`, rien rendu | Refusé au journal (« field longer than 131072 characters »), la suite est lue ; JS applique la même limite (celle de `csv.field_size_limit()`, lue à l'exécution en 3.13) pour que les deux versions rendent la même chose ; le module n'est pas modifié globalement (effet de bord) |
| n0 py/js (#24) | « id,id » : une valeur écrasée | Chaque ligne de données est refusée (« column name used twice », colonne nommée) |
| n0.js (#26) | entier au-delà de 2^53 arrondi | `BigInt` au-delà de `Number.isSafeInteger` : valeur exacte, comme Python |
| n0.py (#27) | « ١٢ » accepté en Python, refusé en JS | Chiffres ASCII seuls dans les motifs Python (n0 et n1) |
| n1.js (#48) | jeu d'entraînement vide : `classify` rend `undefined` | `RangeError` si moins de deux types, comme scikit-learn (« needs samples of at least 2 classes », constaté) |
| n1.py (#46) | un `predict` par colonne | Un seul `predict` pour toutes les colonnes remplies |
| n3 py/js (#53, #63) | champ refusé rendu vide, réponse partielle ou `null` : ligne passée pour réparée ; « None » en Python | Toute colonne doit revenir en chaîne (« the answer does not give every column as text ») ; la valeur refusée ne peut pas revenir vide (« the answer empties the refused value ») |
| n3 py/js (#62) | client par défaut sans `complete` | Adaptateur commun `ProviderClient` / `providerClient` ; `content` non chaîne (refus) → `None`/`null`, consigné, jamais passé à `json.loads`/`JSON.parse` |
| n3 py/js | journal vide : client construit quand même | Retour immédiat, aucun client construit |
| n3 py/js (arbitrage de l'orchestrateur) | JSON entièrement entouré d'une clôture de code consigné comme inutilisable | Une réponse enveloppée tout entière dans une seule clôture est décodée ; tout autre écart reste consigné |

Marquages retirés (assertions inchangées) : n0 — 6 `DÉFAUT` py, 5 `DÉFAUT`
js ; n1 — 1 `DÉFAUT` js ; n3 — 2 `DÉFAUT` py, 1 js. `git diff --stat` : seules
les lignes de marquage (et l'indentation des enveloppes JS) ont bougé.

Lignes utiles : n0.py 173 (139 avant), n0.js 238 (199 avant), n1.py 55, n1.js 83,
n3.py 77 et n3.js 86 dont l'adaptateur (15 et 16). N0 dépassait déjà largement
les quarante lignes : trois tâches (encodage, dialecte, typage) et, en JS, un
découpeur écrit à la main. Les ajouts de ce tour sont ceux qui empêchent une
ligne de disparaître sans journal ; les retirer rouvrirait les défauts #20 à
#25. Scinder la fiche en extraits plus courts toucherait au patron des fiches :
question pour l'orchestrateur.

## Sources consultées

- Python, `csv` : `Dialect.strict` « When True, raise exception Error on bad CSV input » ; `field_size_limit()` (défaut 131 072 constaté par exécution, 3.13.3) ; comportements `strict=True` vérifiés à la main : fin de données dans un guillemet → « unexpected end of data », `"abc"def` → « ',' expected after '"' », `a"b` accepté.
- FAQ Unicode *UTF-8, UTF-16, UTF-32 & BOM* : marques `EF BB BF`, `FF FE`, `FE FF`, `FF FE 00 00`, `00 00 FE FF` — conforme au libellé.
- W3C, *Model for Tabular Data and Metadata on the Web* (Recommandation, 2015) : dialecte (séparateur, guillemet, encodage) — conforme au libellé.
- RFC 4180 : lien existant, format CSV de référence.
- scikit-learn : `LogisticRegression.fit` sur une seule classe lève « This solver needs samples of at least 2 classes » (exécuté, 1.7.2).
- Kit `openai` 7.15.0, `completions.d.ts` : description de `temperature`.

## À retester

- **Adaptateur N3** : `ProviderClient(sdk=FakeSDK(...))` / `providerClient(new FakeSDK(...))` avec `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` : requête `{model: 'gpt-4.1-mini', messages: [{role: 'user', content}], temperature: 0}`, réponse lue dans `choices[0].message.content`, `content` `None`/`null` → « the model did not return a usable object ». Les tests `DÉFAUT : le client par défaut a la forme du vrai kit` (py/js, toujours marqués) passent le double en `client` : à réécrire sur l'adaptateur.
- **N0 `"a"b`** (py `test_production_fins_de_ligne_cr_seules_et_guillemet_au_milieu_d_un_champ`, js idem) : `2,"a"b` est désormais refusé (« text after a closing quote ») au lieu de rendre « ab ».
- **N0 chiffres non ASCII** (py) : « ١٢ » refusé « not an integer », comme en JS.
- **N0 champ très long** (js `production : un champ très long est lu`) : refusé au journal, la ligne suivante lue ; même chose en Python.
- **N0 `INFIRMÉ trente lignes`** (js) et **N1 `INFIRMÉ trente lignes`** (js) : phrases retirées, tests à supprimer.
- **N0 nouveaux cas** : invariant `rows + rejects == lignes de données` sur le guillemet non fermé au milieu d'un fichier (reprise à la ligne suivante, raison « quote opened and never closed », champs = ligne brute) ; guillemet non fermé sur la dernière ligne ; UTF-32 BE ; marque UTF-16 suivie d'une moitié de caractère ; `id,id` → une entrée par ligne ; `"1,234"` apostrophe entourante (`'a','b'`) toujours détectée ; `BigInt` à 2^53 exactement ; numéros de ligne après une reprise (py/js identiques).
- **N1 `INFIRMÉ`** (py/js, toujours marqués) : « same scale » et « couple of hundred rows » sont désormais énoncés comme limites : retourner les deux tests en démonstration. `INFIRMÉ ~10 ms` (py) et le test JS de 32 ms : la fiche dit `<1 ms` sur le fichier nominal ; tester sur ce fichier. `train` en JS avec une seule classe → `RangeError`. Un seul `predict` en Python (colonnes vides mêlées aux remplies, ordre des colonnes gardé).
- **N3 `INFIRMÉ nombre d'appels`** (py/js, toujours marqués) : tester « 2 lignes, 1 panne → 3 appels, au plus `attempts` par ligne ». Nouvelles raisons exactes « the answer does not give every column as text » et « the answer empties the refused value » ; rejet sur nombre de champs (colonne vide) avec une réponse complète ; journal vide sans client.
- **N3 clôture de code** : « ```json {…} ``` » est décodé et la ligne réparée ; une clôture non fermée ou du texte autour reste « the model did not return a usable object ».
- **Noms** : les tests démarqués décrivent encore le défaut (« un encodage non pris en charge est lu en colonnes illisibles sans journal », « fusionne des lignes », « fait disparaître la suite », « perdent une valeur », « est arrondi sans journal », « donne un modèle qui rend undefined », « passe pour une réparation », `test_defaut_…`) ; le commentaire JS « Python lève UnicodeDecodeError… » et « Python lève csv.Error… » sont devenus faux.
- **Essai** : `INFIRMÉ` du why (js, toujours marqué) : « factures 41 et 42 » ; tester la nouvelle phrase ; le troisième élément des enregistrements refusés de `parseRecords` n'apparaît que sur eux.

## Pour l'orchestrateur

- Latence d'un niveau qui traite un fichier : la classe dépend de la taille du fichier (N0 : 0,02 ms sur le fichier nominal, 27 ms sur 200 × 200, 0,35 s sur 100 000 lignes en Python). J'ai pris le fichier nominal des tests pour N0 et N1, la même base pour les deux ; la charte devrait dire quelle entrée de référence fixe la classe pour un traitement par lots.
- N0 dépasse de loin les quarante lignes (voir « Code réparé ») ; décision à prendre pour les fiches dont le niveau recommandé est un petit programme.
- Les lignes réparées par N3 ne portent pas leur ligne d'origine ; la ligne réglementaire « garder trace de l’origine d’une valeur réparée » n'est pas outillée par la sortie. Non modifié (changement de forme de la sortie, tests et essai à reprendre) : à trancher au tour suivant.
