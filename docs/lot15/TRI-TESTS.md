# Lot 15 — tri des tests en échec

`npm run test:snippets` laisse douze fiches en échec : **72 tests distincts**,
110 exécutions (45 en Python, 65 en JavaScript), un test dit dans les deux
langages comptant ici pour un.

Ce document juge chacun **avant toute correction de code**. Il est le livrable
de la première étape : ce qui suit ne fait qu'exécuter ce qui est écrit ici.

---

## La règle de tri

**Exigence** — la phrase du test décrit ce que le code *doit faire*,
indépendamment de la version du code. Elle survivrait à une réécriture complète
de l'extrait. « Refuse un format non reconnu avant de rien dépenser » en est
une : le code doit la satisfaire.

**Constat** — la phrase décrit un *état des lieux* : une divergence entre deux
langages, un décompte de lignes, une valeur de réglage, un comportement qu'une
décision de conception a depuis remplacé. Elle ne survit pas à une réécriture.
« Python accepte les chiffres arabes comme entiers, JavaScript non » en est un :
ça se documente, ça ne se corrige pas.

Un même test porte souvent les deux : l'exigence dans son titre, le constat dans
ses paramètres (« le modèle reçoit un marqueur, jamais la variable » est une
exigence ; que ce marqueur s'écrive `⟦0⟧` est un constat). Le test est alors
classé sur sa phrase, et la colonne « pourquoi » dit quelle part a vieilli.

---

## Ce que le tri donne

| | Tests |
|---|---|
| **Exigences** | **47** |
| dont déjà satisfaites par le code | 47 |
| dont le code ne satisfait pas | **0** |
| **Constats** | **25** |
| dont réécrits en assertion sur le comportement réel | 20 |
| dont retirés, ne prouvant plus rien | 5 |

**Aucun test en échec ne réclame une correction de code.** Ce n'est pas une
indulgence, c'est ce que le relevé montre : la passe 2 a corrigé les vingt-cinq
fiches, et douze n'ont pas eu leur contre-épreuve — la session a été coupée
avant. Les tests décrivent donc un code qui n'existe plus. Chaque ligne de
`docs/lot15/corrections/<id>.md`, section « À retester », annonce très
exactement la rupture qu'on observe.

L'étape 2 de la mission est donc vide, et c'est le bon résultat : corriger le
code pour satisfaire ces tests reviendrait à défaire la passe 2.

Quatre divergences Python / JavaScript que des tests documentaient ont été
**closes** par la passe 2, à peu de frais : plafonds comptés en points de code
et non en unités UTF-16, `[0-9]` au lieu de `\d`, caractères de format retirés
avant comparaison, `str(value)` avant `re.fullmatch`. Les tests
correspondants (nos 5, 12, 27, 38, 46, 65) deviennent des assertions de parité.
Une seule divergence subsiste parmi les tests en échec, et elle est structurelle :
`sshleifer/distilbart-cnn-12-6` en Python, sa conversion ONNX `Xenova/…` en
JavaScript (no 35). Elle est écrite dans le commentaire de `n2.js`.

---

## convert-messy-csv-to-clean-data

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 1 | `production : fins de ligne CR seules et guillemet au milieu d'un champ` | py+js | constat | `2,"a"b` rendait `ab`. La réparation #23 refuse l'enregistrement illisible et le consigne, au lieu de deviner. L'ancienne sortie n'était pas une exigence : c'était ce que `csv` non strict faisait. | réécrit : l'enregistrement part aux `rejects` avec sa raison, invariant `rows + rejects` = lignes de données |
| 2 | `production : un champ très long est lu` | js | constat | le champ de 200 000 caractères est désormais refusé au journal **dans les deux langages** (limite `csv.field_size_limit()`), par parité voulue. | réécrit : refusé, la ligne suivante lue ; le commentaire « Python lève csv.Error » est devenu faux |
| 3 | `INFIRMÉ : « a CSV parser is a thirty-line state machine »` | js | constat, sans objet | la phrase a été retirée de la docstring. Le test épingle un décompte (47 lignes) que plus rien n'affirme. | **retiré** |
| 4 | `INFIRMÉ : « logistic regression on eight features is thirty lines »` | js | constat, sans objet | même cause, en N1. | **retiré** |
| 5 | `production : des chiffres non ASCII divisent les deux langages` | py | constat | la divergence est close : `[0-9]` au lieu de `\d`, « ١٢ » est refusé des deux côtés. Un caractère de motif, pas dix lignes de code. | réécrit en assertion de parité, renommé |

## detect-anomalies-in-metrics

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 6 | `DÉFAUT : l'essai lit « 4,800 » comme 4,8 et « 4 800 » comme deux points` | js | constat | la moitié anglaise est corrigée. La moitié française tient à une décision : l'espace fine et l'insécable sont des séparateurs de milliers, l'espace ordinaire reste un séparateur de minutes. Trancher autrement rendrait ambiguë une saisie de série. | scindé en deux démonstrations ; l'espace ordinaire reste deux points, et c'est écrit |
| 7 | `DÉFAUT : une valeur manquante fait signaler presque toutes les minutes` | js | exigence | une valeur manquante ne doit pas faire sonner toute la série. Satisfaite : la sortie est `[90, 91]`. | réécrit en démonstration |

## detect-spam-in-contact-form

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 8 | `un rejet vient avec ses motifs, une liste vide veut dire accepter` | py+js | exigence | satisfaite. Les mots du test (`casino`, `crypto` isolés) ont quitté la liste des phrases bannies, jugés trop larges. | données reprises : « online casino », « viagra » |
| 9 | `le client par défaut échoue en service indisponible sans appel` | py+js | constat | décrit l'ancien défaut : `client.complete` n'existait pas sur le kit. L'adaptateur `ProviderClient` le corrige. | réécrit sur l'adaptateur et `_harness/fake_sdk` |
| 10 | `INFIRMÉ : … « is forty lines »` | js | constat, sans objet | phrase retirée. | **retiré** |
| 11 | `DÉFAUT : un entraînement dégénéré ne lève pas` | js | exigence | un entraînement à une seule classe doit lever. Satisfaite. | réécrit en démonstration |
| 12 | `production : constat, le plafond compte en unités UTF-16 en JavaScript` | js | constat | divergence close : le plafond compte des points de code des deux côtés. | réécrit en parité |

## extract-fields-from-invoice

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 13 | les sept tests d'essai de `n2.test.js` | js | constat, sans objet | ils importent `content/tryouts/frozen/extract-fields-from-invoice.js`, retiré quand la fiche est passée en brouillon. Le fichier ne se charge plus du tout : les vingt et un autres tests N2 ne tournaient pas non plus. | **retirés** |

## read-text-from-a-scanned-page

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 14 | `une page dont un caractère sur dix se lit n'est pas lue` | py+js | exigence | satisfaite, et plus strictement : un seul code sous 32 refuse la page. L'assertion « la moitié passe » fixait l'ancien seuil. | réécrit sur la règle nouvelle, avec témoin |
| 15 | `les codes de contrôle 127 à 159 … ne sont pas lisibles` | py+js | constat | WinAnsiEncoding (PDF 32000-1, annexe D) donne un glyphe à ces codes : 0x80 → €, 0x92 → ’, 0x9F → Ÿ. Ce n'est pas une exigence, c'est la table. | réécrit sur la table ; U+0080–U+009F venus d'une chaîne UTF-16 refusent toujours la page |
| 16 | `lit le format dans les octets et non dans un nom` [TIFF ×2] | py+js | exigence | satisfaite. TIFF a quitté la liste des formats acceptés, qui est celle des entrées visuelles du fournisseur. | paramètres déplacés du cas « lu » au cas « refusé » |
| 17 | `refuse un format non reconnu avant de rien dépenser` [GIF, WEBP] | py+js | exigence | satisfaite. GIF et WEBP sont acceptés par le fournisseur : ce ne sont plus des formats non reconnus. | paramètres repris (TIFF, `RIFF….WAVE`) |
| 18 | `le client par défaut a la forme du vrai kit` | js | exigence | satisfaite. L'assertion « aucune requête ne part » décrit l'ancien défaut. | réécrit : la requête part, sa forme est vérifiée |

## route-support-tickets

Tous en JavaScript.

| no | Test | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|
| 19 | `une archive déséquilibrée pondérée ne répond pas l'équipe la plus chargée` | exigence | satisfaite : non pondérée l'archive répond « billing », l'équipe la plus chargée ; pondérée elle répond « shipping ». Seule la valeur attendue a changé quand JS a été aligné sur Python. | valeur reprise, témoin non pondéré gardé |
| 20 | `INFIRMÉ : … soixante lignes` | constat, sans objet | phrase retirée. | **retiré** |
| 21 | `INFIRMÉ : l'essai anglais, les trois équipes ressortent presque à égalité` | constat | les scores ont changé (40/37/23), la phrase est réécrite. | réécrit en démonstration des scores réels |
| 22 | `une archive d'une seule équipe est refusée` | exigence | satisfaite, et plus tôt : `train` lève `RangeError` au lieu de laisser router. | réécrit sur le mécanisme réel |
| 23 | `production : une archive vide lève à la première question` | exigence | satisfaite ; la levée est passée du routage à l'entraînement. | réécrit |
| 24 | `l'encodeur par défaut a la forme de transformers.js` | exigence | satisfaite ; le paquet est `@huggingface/transformers`, avec `{ dtype: 'fp32' }`. | crochet repris |
| 25 | `un index encodé par un autre modèle est refusé` | exigence | satisfaite ; les deux premières assertions épinglent l'ancien défaut. | réécrit : rejet dans les deux sens |
| 26 | `le client par défaut a la forme du vrai kit` | exigence | satisfaite ; « aucune requête » et `client.complete is not a function` décrivent l'ancien défaut. | réécrit sur l'adaptateur |
| 27 | `production : la limite compte des unités UTF-16 en JavaScript` | constat | divergence close. | réécrit en parité |

## show-similar-articles

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 28 | `l'extrait n'importe que la bibliothèque standard` | py | exigence | satisfaite. L'assertion fige la liste `{math, collections}` ; `unicodedata`, qui s'y est ajouté, **est** la bibliothèque standard. Le test disait autre chose que son titre. | assertion portée sur `sys.stdlib_module_names`, pas sur une liste figée |
| 29 | `INFIRMÉ : le libellé anglais dit « Words from the body, not the title »` | js | exigence | le cas anglais de l'essai a été réécrit ; aucun jeton du titre n'y figure plus. | réécrit en démonstration |
| 30 | `le modèle par défaut a la surface de @xenova/transformers` | js | exigence | satisfaite ; le paquet importé est `@huggingface/transformers`. | crochet repris |

## summarise-a-long-document

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 31 | `l'extrait n'importe que re` | py | exigence | même cause qu'au no 28. | assertion portée sur la bibliothèque standard |
| 32 | `l'entraînement tient sur quatre documents sans rien d'autre` | py | exigence | même cause ; la docstring ne dit plus « or a corpus ». | idem |
| 33 | `la découpe se fait aux frontières de phrase sans rien perdre` | py+js | exigence | satisfaite ; `CHUNK_CHARACTERS` est passé de 3 000 à 2 000 (fenêtre de 1 024 jetons). | limite reprise |
| 34 | `production : limite de la découpe au caractère près` | py+js | exigence | idem. | idem |
| 35 | `le modèle nommé est bart-large-cnn` | py | constat | le point de contrôle nommé est `sshleifer/distilbart-cnn-12-6`. **Divergence subsistante** : JavaScript charge sa conversion ONNX `Xenova/distilbart-cnn-12-6`, mêmes poids, autre dépôt. | réécrit ; la divergence est écrite dans le commentaire de `n2.js` |
| 36 | `le modèle par défaut a la surface de transformers` | py+js | exigence | satisfaite — et c'est l'exigence même de ce lot. `transformers` 5 n'a plus de pipeline `summarization` : le code appelle `AutoTokenizer` / `AutoModelForSeq2SeqLM`. Le double du test imite l'ancienne surface. | double refait à la forme de `transformers` 5 et de `@huggingface/transformers` |
| 37 | `le client par défaut échoue en service indisponible sans appel` | py+js | constat | ancien défaut. | réécrit sur l'adaptateur |
| 38 | `production : constat, le plafond compte en unités UTF-16` | js | constat | divergence close. | réécrit en parité |
| 39 | `essai : le fournisseur échoue deux fois, trois appels` | js | constat | la note de l'essai dit « envoyés » et non plus « facturés ». | libellé repris |

## tag-articles-by-topic

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 40 | `production : valeurs aux limites de min_terms` | py+js | exigence | satisfaite ; l'article compte trois termes et non quatre, « entretien d'embauche » absorbant « embauche ». | bornes reprises à 3 / 4 |
| 41 | `point de rupture : une réponse JSON qui n'est pas une liste lève` | py+js | exigence | satisfaite. Une clôture ```` ```json ```` qui enveloppe toute la réponse est désormais décodée (décision 12 du lot) : ce n'est plus « une autre forme ». | ce cas sorti de la liste, une clôture non fermée mise à sa place |
| 42 | `production : un article vide part quand même chez le fournisseur` | py+js | exigence | un article vide ne doit rien coûter. Satisfaite : aucun appel ne part. | réécrit en démonstration |
| 43 | `l'encodeur est injecté, et par défaut c'est le vrai` | js | exigence | satisfaite ; le module est `@huggingface/transformers`. | crochet repris |

## translate-interface-strings

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 44 | `une majuscule corrigée ou une double espace restent la même chaîne` | py+js | constat | la conception a changé, et pour une bonne raison écrite dans la docstring : « Polish » et « polish » ne sont pas le même mot. Une casse corrigée donne une approchée à 1,0 renvoyée en relecture, pas une exacte. | réécrit sur le comportement réel |
| 45 | `production : encodage NFD, insécable, emoji, casse` | py+js | constat | même cause. | réécrit |
| 46 | `production : une marque d'ordre des octets divise les deux langages` | py | constat | divergence close : `exact_key` retire les caractères de format, les deux langages rendent une exacte. | réécrit en parité, renommé |
| 47–59 | treize tests N2 épinglant le marqueur `⟦0⟧` — trois points de rupture, variable déplacée, répétée, « cachées, remises et comptées », onze variables, plomberie déterministe, verdict N2/N3, `placeholders`, deux tests d'essai | py+js | exigence | satisfaites. Le marqueur s'écrit `[0]` depuis la correction, et la fiche l'écrit ainsi (« le modèle reçoit « [0] items selected », jamais « {count} » »). Seule sa graphie a vieilli. | marqueur repris |
| 60 | `DÉFAUT : les variables ICU et i18next ne sont pas protégées` | js | exigence | satisfaite autrement : `{{count}}` est masqué en entier, et un message ICU part en relecture avec son avertissement. | réécrit en démonstration |
| 61 | `point de rupture : une réponse d'une autre forme lève` | py+js | exigence | satisfaite ; la clôture est décodée (décision 12). | cas sorti de la liste |
| 62 | `production : le contexte n'est pas plafonné` | py+js | exigence | un contexte non plafonné est un défaut. Satisfaite : il est refusé avant l'appel. | réécrit en démonstration |

## validate-a-form-server-side

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 63 | `n0 est déterministe et n'emploie que la bibliothèque standard` | py | exigence | satisfaite. `unicodedata` **est** la bibliothèque standard ; l'assertion figeait `{re}`. | assertion portée sur la bibliothèque standard |
| 64 | `production : schéma vide et valeurs d'un autre type` | py+js | constat | la docstring pose la règle : « un champ que le schéma ne déclare pas est refusé, pas ignoré ». Un schéma vide refuse donc tout, et c'est voulu. | réécrit, message exact vérifié |
| 65 | `production : un motif sur un entier fait lever en Python` | py | constat | divergence close : `str(value)` avant `re.fullmatch`, les deux langages convertissent. | réécrit en parité, renommé |
| 66 | `les bornes ne comptent pas des caractères perçus` | js | constat, en partie sans objet | le test porte deux assertions contradictoires sur la même entrée — « 🙂 » refusé, puis accepté : reste d'une enveloppe `assert.throws` défaite à la main. La divergence est close, les deux langages comptent des points de code. | ligne contradictoire **retirée**, test réécrit et renommé |

## write-product-descriptions

| no | Test | Lang. | Catégorie | Pourquoi | Traitement |
|---|---|---|---|---|---|
| 67 | `le tirage donne le même texte qu'en JavaScript` / `qu'en Python` | py+js | exigence | satisfaite, et mieux : un nom en NFD tire désormais la même formulation qu'en NFC. La ligne qui échoue épinglait la divergence. | assertion NFD reprise |
| 68 | `production : encodage NFD, emoji, insécables et listes limites` | py+js | constat | même cause. | réécrit |
| 69 | `production : dossier vide, zéro essai et attribut nul` | py+js | exigence | un dossier vide ne doit rien coûter. Satisfaite : il lève avant tout essai, et un attribut nul n'entre plus dans la source. | réécrit |
| 70 | `une réponse d'une autre forme lève` | py+js | exigence | satisfaite ; la clôture est décodée. | cas sorti de la liste |
| 71 | `production : un dossier vide part quand même chez le fournisseur` | py+js | exigence | même exigence qu'au no 69, côté N3. | réécrit en démonstration |
| 72 | `DÉFAUT : un point décimal est pris pour une fin de phrase` | js | exigence | satisfaite autrement : la copie tronquée est refusée comme fragment. | réécrit en démonstration |

---

## Le garde-fou

Aucune correction d'extrait n'est demandée par ce tri, donc aucun extrait ne
grossit. C'est le seul cas où la règle des trente secondes de lecture n'est pas
mise à l'épreuve — et c'est heureux : les douze extraits concernés portent déjà
les gardes de production ajoutées à la passe 2, et la décision 10 du lot sort
ces gardes du décompte des quarante lignes.

Deux endroits où j'ai préféré documenter plutôt que corriger, et les voici
nommés :

1. **no 6, l'espace ordinaire dans « 4 800 »** — lue comme deux minutes, quand
   l'espace fine et l'insécable sont lues comme un séparateur de milliers.
   Corriger demanderait de deviner, dans une série de nombres séparés par des
   espaces, lesquelles séparent des chiffres et lesquelles des points. La limite
   est écrite dans l'essai.
2. **no 35, le nom du dépôt du modèle N2** — mêmes poids, deux dépôts, parce que
   JavaScript charge une conversion ONNX. Aligner les deux noms est impossible ;
   la divergence est écrite dans le commentaire de `n2.js`.
