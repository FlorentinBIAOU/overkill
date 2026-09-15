# detect-anomalies-in-metrics — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures` et `check-french` verts.
`test-snippets detect-anomalies-in-metrics` rouge sur deux tests marqués que la
correction ne fait passer qu'à moitié (voir « À retester »). Aucune assertion
n'a été modifiée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 breaking_point fr/en (#3) | « chaque pas reste loin en deçà de l'écart toléré, et la fenêtre a déjà avalé les précédents » | Le pas de 40 vaut 13 % de l'écart toléré le plus étroit ; l'écart à l'habituel monte jusqu'à 96 % de la limite | « chaque pas reste loin en deçà de l'écart toléré et la fenêtre avale les précédents, si bien que l'écart à l'habituel approche la limite sans jamais la franchir » |
| N0 docstring py/js + `doc.fr.yaml` (#8) | « The median and the median absolute deviation ignore up to half the window » | Test : à 11 aberrations sur 24 l'habituel tient (1 320) mais l'écart toléré quadruple ; à 12 l'habituel part (50 660). Mesuré en plus : une seule aberration fait passer la limite de 311 à 415, quand la moyenne passe de 1 190 à 5 312 et 3,5 écarts types de 281 à 69 104 | « hold while outliers fill less than half the window: the usual value stays among ordinary values, and the tolerated gap widens as the outliers pile up instead of jumping with the first one » |
| N0 commentaire `NORMAL_SCALE` py/js (#10) | « so that a threshold of 3.5 keeps the meaning it has everywhere else » | Sur 20 000 points de bruit gaussien, 0,75 % signalés à la fenêtre de 24 contre 0,047 % pour 3,5 écarts types | « Estimated on a short window it is noisy: pure Gaussian noise crosses 3.5 of these far more often than it crosses 3.5 true standard deviations, and the tests measure how often. » Le facteur 1,4826 = 1/Φ⁻¹(3/4) reste, sourcé |
| N0 escalate_when fr/en (#16, #17) | « chaque métrique était dans sa plage habituelle, seule leur combinaison ne l'était pas » | N0 juge chaque série contre sa fenêtre, pas contre la plage de l'exploitation | « aucune métrique ne sortait de sa propre fenêtre, seule leur combinaison était inhabituelle » |
| N1 docstring py/js + `doc.fr.yaml` (#17) | « every metric stays inside its usual range, and only the combination is impossible. Night-time traffic with daytime errors is one such minute, and no single-series threshold will ever ring for it » | Sur les données des tests N1, N0 signale les minutes 90 et 91 : sa fenêtre précédente est la nuit | « The robust threshold of N0 watches one metric at a time, each against its own recent window. An isolation forest watches the metrics together, against everything it was trained on: night-time traffic with daytime errors is a minute whose values each sit inside the range the service has known, and whose combination does not. A threshold on each series rings for such a minute only if one of its values leaves that series' own window. » |
| N1 docstring py/js + `doc.fr.yaml` (#34) | « the only real knob is the size of the forest » | De 10 à 500 arbres, mêmes minutes (py) ; le seuil les fait passer de 43 à 2 | « the knob that changes what rings is the threshold, not the size of the forest » |
| N1 breaking_point fr/en (#30) | « ré-entraîner sur le mois écoulé, c'est décider de ce qui compte comme normal » | Conseil non testable ; ce que le test montre : quinze minutes glissées dans l'entraînement deviennent un régime ordinaire | « ce qui entre dans l'entraînement devient normal » |
| verdict_rationale fr/en (#17) | « N1 voit ce que N0 ne verra jamais — la minute où chaque métrique reste dans sa plage et où seule la combinaison est impossible » | Infirmé par le test N0 sur la série N1 | « N1 juge les métriques ensemble, contre tout son entraînement, là où N0 juge chaque série contre sa propre fenêtre : il voit la minute dont chaque valeur est connue et dont seule la combinaison ne l'est pas » |
| Essai, cas 4, libellé fr/en (#24) | « La même hausse, étalée sur trente-six minutes » | +1 440 au bout de la rampe, +1 400 pour la marche | « Une hausse de 1 440, étalée sur trente-six minutes » / « A rise of 1,440, spread over thirty-six minutes » |
| Essai, cas 4, why fr/en (#24, #25) | « aucun écart d'une minute à la suivante n'approche l'écart toléré » ; « La même hausse totale livrée d'un coup, au cas précédent » | La série varie jusqu'à 200 d'une minute à l'autre (64 % de 311) ; N0 compare à la médiane, pas à la minute précédente ; l'écart mesuré atteint 73 % de la limite | « La hausse est de quarante requêtes par minute, bien moins que l'écart toléré, et la fenêtre a déjà avalé les pas précédents : l'habituel monte avec la série, et l'écart ne franchit jamais la limite. Une marche de 1 400 livrée d'un coup, au cas précédent, … » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N1 docstring py/js (#17) | « no single-series threshold will ever ring for it » | Faux sur les données des tests (voir ci-dessus) |
| N1 breaking_point fr/en (#30) | « ré-entraîner sur le mois écoulé » | Conseil non testable, remplacé par ce que le test démontre |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#19) | compteur nul la plupart des minutes : écart absolu médian nul, chaque erreur isolée sonne | paramètre `min_spread` / `minSpread`, plancher de l'écart dans l'unité de la métrique, documenté dans la docstring (« pass 1 for it ») ; défaut 0, voir « Pour l'orchestrateur » |
| n0.py / n0.js (#20) | fenêtre nulle : `StatisticsError` en Python, verdicts à NaN silencieux en JavaScript | `ValueError` / `RangeError` si la fenêtre compte moins d'un point |
| n1.py / n1.js (#32) | minute hors de toute plage d'entraînement (un million partout) : score 0,616 / 0,605, non signalée | les bornes de chaque métrique sont gardées à l'entraînement (valeurs manquantes exclues) ; une valeur hors bornes score 1 |
| n1.py (#47) | `score_samples` appelé ligne par ligne | `scores` note toutes les lignes en un appel ; `score` et `anomalies` passent par elle |
| n1.js (#45) | zéro ligne : aucune erreur ; une ligne : score NaN | `RangeError` sans ligne complète ; une seule ligne d'entraînement score 0,5, comme scikit-learn |
| n1.js (#46) | une valeur NaN dans l'entraînement met NaN dans les coupes : 72 minutes sur 92 signalées | les lignes incomplètes sont écartées de l'entraînement ; la sortie est [90, 91], comme en Python |
| n1.js (production) | bornes calculées par `Math.min(...colonne)` : dépassement de pile au-delà de quelque cent mille lignes | bornes calculées par `reduce` |
| Essai (#26) | « 4,800 » lu 4,8 en anglais | lecture par langue : en anglais, une virgule suivie de trois chiffres sépare les milliers ; en français, la virgule marque les décimales et les milliers se séparent par une espace insécable (U+00A0 ou U+202F). Une espace ordinaire sépare deux minutes, en français comme en anglais : « 4 800 » avec une espace ordinaire reste deux points, parce que « 1080 1120 » en est deux (décision : fusionner des groupes de trois chiffres séparés par une espace ordinaire lirait « 980 990 » comme 980 990) |

Marquages retirés (assertions inchangées) : n0 — 1 `DÉFAUT` js ; n1 — 2
`DÉFAUT` py, 2 js.

Lignes utiles : n0.py 27, n0.js 29, n1.py 18, n1.js 66.

## Sources consultées

- Wikipedia, *Median absolute deviation* : « For normally distributed data k is taken to be k = 1/(Φ⁻¹(3/4)) ≈ 1/0.67449 ≈ 1.4826 » — conforme au libellé de `further_reading` et au commentaire.
- Liu, Ting et Zhou, *Isolation Forest* (ICDM 2008) : PDF existant (HTTP 200), article d'origine.
- scikit-learn, `IsolationForest` : page existante ; `score_samples` rend l'opposé du score de l'article, d'où le signe dans l'extrait.
- Google SRE Book, *Monitoring Distributed Systems* : page existante, conforme au libellé.

## À retester

- **Rouges, à reprendre** :
  - `n0.test.js` « DÉFAUT : l'essai lit « 4,800 » comme 4,8 et « 4 800 » comme deux points » : la moitié anglaise passe désormais (le `assert.rejects` échoue) ; la moitié française, écrite avec une espace ordinaire, reste deux points par décision. Scinder : démontrer « 4,800 » → 4800 (en), et « 4 800 » avec U+202F ou U+00A0 → 4800 (fr) ; l'espace ordinaire reste un séparateur de minutes.
  - `n1.test.js` « DÉFAUT : une valeur manquante fait signaler presque toutes les minutes » : la sortie est désormais [90, 91] ; l'assertion hors marquage (`72`) échoue, la partie marquée passe. À retourner en démonstration.
- **Resté marqué** : `n0.test.py` / `n0.test.js` « DÉFAUT : une métrique de comptage presque toujours nulle sonne à chaque unité » : avec `min_spread=1` / `{ minSpread: 1 }`, `anomalies(errors)` rend `[]` ; le test aux valeurs par défaut reste en échec, voir « Pour l'orchestrateur ».
- **Toujours marqués, et toujours vrais comme constats de code** : n0 `INFIRMÉ` « le seuil de 3,5 garde son sens » (py/js) et « N0 ne sonne pas pour les minutes que N1 signale » (py/js) ; n1 `INFIRMÉ` « la taille de la forêt est la seule vraie molette » (py/js) ; essai `INFIRMÉ` « la même hausse » et « aucun écart d'une minute à la suivante ». Les phrases sont corrigées : à retourner en démonstrations (taux mesuré sur bruit gaussien, N0 qui sonne sur la série N1, seuil plutôt que taille, 1 440 et 1 400 nommés, écart qui approche la limite sans la franchir).
- **Noms des tests démarqués** : « une fenêtre nulle rend des verdicts à NaN au lieu d'être refusée », « une minute hors de toute plage n'est pas signalée », « aucune ligne ou une seule ligne rend des scores NaN au lieu de lever », `test_defaut_…` ; docstring de `test_production_une_fenetre_nulle_leve_une_erreur_de_valeur` (« le JavaScript, lui, rend des NaN ») et de `test_production_une_valeur_manquante_est_acceptee_et_le_reste_tient` (« JavaScript : DÉFAUT ») devenues fausses.
- N0 : une seule aberration fait passer la limite de 311 à 415 (docstring « instead of jumping with the first one »), quand moyenne et écart type bondissent ; `min_spread` plus grand que l'écart mesuré ; fenêtre négative et `NaN` en JavaScript → `RangeError`.
- N1 : valeur juste sous le minimum ou juste au-dessus du maximum d'entraînement → score 1, valeur égale à la borne → score de la forêt ; `scores` rend les mêmes nombres que `score` ligne à ligne ; une colonne entièrement manquante en Python (bornes infinies) ; ligne de NaN à la notation en JavaScript.
- Essai : « 1,440 » (en) et « 1 440 » avec U+202F (fr) lus 1440, surlignage aux bons emplacements ; « 4,8 » en français lu 4,8 ; nouveaux libellé et why du cas 4.

## Pour l'orchestrateur

- **Défaut du compteur presque toujours nul (#19)** : il entre en conflit avec le test non marqué « une métrique constante n'est une anomalie qu'au premier mouvement » (500 × 29 puis 501 doit être signalé, limite 0). Un plancher par défaut non nul casse ce test et, pire, rendrait muette sans prévenir toute métrique d'unité petite (une latence en secondes). Décision : plancher en paramètre, défaut 0, documenté. Le test `DÉFAUT` écrit aux valeurs par défaut ne peut donc pas passer ; à arbitrer (le testeur peut passer `min_spread=1`).
- n1.js (66 lignes utiles) dépasse les quarante : la forêt est écrite à la main en JavaScript, c'était déjà le cas avant ce tour.
- Le taux de fausses alertes de N0 (0,75 % à la fenêtre de 24, plus de 2 % à 12) est un constat de test, pas une phrase de la fiche ; l'escalade et le verdict ne le mentionnent pas. Le relecteur pourrait juger qu'une fiche sur « être réveillé et pas le reste du temps » doit le dire ; je ne l'ai pas écrit faute d'un chiffre que la charte autorise.
