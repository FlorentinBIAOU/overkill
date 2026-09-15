# forecast-weekly-sales — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets forecast-weekly-sales` **rouge sur trois tests**, tous écrits
contre le comportement que la réparation du défaut #70 supprime (voir « À
retester ») : `refuse un historique plus court que le nombre de variables`,
`réajuster après la rupture rapproche la prévision` (Python et JavaScript), et
le test JavaScript `INFIRMÉ : escalate_when dit de relire le coefficient…`,
qui reçoit désormais une `RangeError` au lieu d'un échec d'assertion. Aucune
assertion n'a été touchée : ces trois tests sont au testeur.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N1 docstring Python + `doc.fr.yaml` (#45) | « Two pairs are enough to draw a Christmas peak and a summer dip; more pairs start drawing the noise as well » | Relevé : sur un pic de trois semaines, erreur 36,5 (2 paires), 14,6 (4), 7,8 (6) ; le bruit ne coûte qu'au-delà de 6. Deux paires placent pic (49 pour 50) et creux (32 pour 30) | « Two pairs are enough to place a Christmas peak and a summer dip; a peak only a few weeks wide needs more pairs to reach its full height. » |
| N1 escalate_when (#61) | « réajuster sur la période qui suit la rupture, et relire le coefficient de croissance » | Relevé : sur 20 semaines d'après rupture, croissance lue -7 760/an pour +146 ; le coefficient ne se relit qu'à partir d'un cycle (#70 : +225 à 52 semaines). L'extrait refuse désormais moins d'un cycle | « réajuster sur la période qui suit la rupture dès qu'elle couvre un cycle complet, puis relire le coefficient de croissance. Plus tôt, l'extrait refuse l'ajustement : sur vingt semaines, la tendance et la saison se confondent, et le coefficient de croissance ne se relit plus. » |
| N0 breaking_point (#2) | « — elle y restera » | Relevé : vrai tant que le recul continue ; si le niveau se stabilise, l'écart retombe à 7-12 % en quatre semaines | « — elle y reste tant que le recul continue » |
| N1 docstrings py/js + `doc.fr.yaml` (#47) | « it is the growth per year » | `coefficients[1]` est la croissance par cycle (docstring de `fit`) ; « par an » seulement avec `season_length=52` | « it is the growth per cycle, per year with the default 52-week season » |
| N0 docstrings py/js + `doc.fr.yaml` (#17) | « `window` is the only real knob » | `season_length` et `horizon` sont aussi des paramètres ; l'effet de `window` est démontré (#16) | « `window` trades reactivity for stability » |
| N1 docstring JS + `doc.fr.yaml` (#48) | « twenty lines that no dependency is worth » | `solve` 17 lignes, équations normales 6 : le chiffre ne tient pas | « short enough that no dependency is worth it » |
| scenario (#63) | « La réponse revient rédigée, plausible, et différente au prochain appel » | Seule la non-reproductibilité est sourcée : OpenAI Cookbook, « The Chat Completions and Completions APIs are non-deterministic by default (which means model outputs may differ from request to request) ». « rédigée, plausible » : rien ne le source | « Par défaut, la même question posée deux fois peut recevoir deux réponses : la documentation d'un fournisseur le dit en toutes lettres. » (« peut » est la formulation de la source, « may differ ») |
| scenario (#64) | « tient sur une page » ; « un chiffre qu'aucune invite ne rend » | Appréciation ; affirmation sur ce qu'un modèle rend, non sourcée | « tient dans les deux extraits ci-dessous » ; « livre au passage un coefficient qui se relit » |
| N2 unavailable_reason (#65) | « Un modèle profond de séries temporelles s'entraîne sur des milliers de séries, ou sur des décennies d'observations » ; « le service permanent à exploiter serait bien réel » | DeepAR (arXiv:1704.04110), résumé : « training an auto regressive recurrent network model on a large number of related time series ». « Milliers », « décennies » : non sourcés | « Un modèle profond de prévision comme DeepAR tire sa force de l'apprentissage sur un grand nombre de séries apparentées. […] une seule série […] Le modèle, lui, serait à entraîner, à conserver et à réentraîner. » |
| N3 unavailable_reason (#66) | « La réponse change d'un appel à l'autre » | Même source OpenAI : non déterministe par défaut, déterminisme non garanti | « Par défaut, un fournisseur ne garantit pas la même réponse d'un appel à l'autre » |
| verdict_rationale (#58) | « sur une série plate les deux niveaux rendent le même nombre » | 750 contre 749,9999999999997 | « la même prévision, à l'erreur d'arrondi près » |
| Essai, libellé de refus | « Refusé : moins de semaines que de coefficients à estimer » | Le refus le plus courant est maintenant « moins d'un cycle » ; le message de l'extrait reste affiché en détail | « Refusé : historique trop court » / « Refused: history too short » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N0 docstrings py/js + `doc.fr.yaml` (#10) | « and it still carries most small businesses » | Fait de marché, aucune source trouvée |
| N0 docstrings py/js + `doc.fr.yaml` (#11) | « and short enough to read in one sitting » | Appréciation invérifiable |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#29) | `NaN` rend `[nan]` ; en JS `null` compté zéro, `"1000"` rend `NaN` | Garde `math.isfinite` / `Number.isFinite` sur chaque semaine : `ValueError` sur `NaN` (Python ; `TypeError` sur `None`, `"1000"` comme avant), `TypeError` en JS |
| n0.py / n0.js (#30) | Semaine fermée chaque année : coefficient nul, `ZeroDivisionError` (py), `NaN` (js) | Les semaines de coefficient nul sont écartées de la moyenne (elles ne disent rien du niveau) ; leur prévision vaut zéro |
| n0.py / n0.js (#33) | `window=0` fait la moyenne de tout l'historique | `ValueError` / `RangeError` si `window < 1` |
| n1.py / n1.js (#67) | Entrée vide : `IndexError` / `TypeError` sur `design[0]` | Le nombre de variables est calculé (`2 + 2 * harmonics`) avant de construire la matrice : refus nommé |
| n1.py / n1.js (#69) | Semaine manquante : prévision `NaN`, ou `null` compté zéro | Garde de finitude après conversion (`np.isfinite`) / `Number.isFinite` : `ValueError` / `TypeError` |
| n1.py / n1.js (#70) | Moins d'un cycle accepté, croissance absurde (+899 850/an à 10 semaines) | Refus sous un cycle complet : « a trend cannot be told apart from the season on less than one full cycle ». La garde « fewer weeks than features » reste en premier (elle compte quand `harmonics` est grand, et c'est elle qui refuse les cinq semaines de l'essai) |

Marquages retirés (assertions inchangées) : les trois `DÉFAUT` de n0 et les
trois `DÉFAUT` de n1, en Python (décorateur) et en JavaScript (enveloppe et
préfixe).

n1.js compte 47 lignes utiles (45 avant ce tour) : au-dessus des quarante de la
charte des extraits avant même la réparation, à cause de l'élimination de Gauss
écrite à la main.

## Sources consultées

- OpenAI Cookbook, « How to make your completions outputs consistent with the new seed parameter » — https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter (lu : « non-deterministic by default », « Determinism is not guaranteed »). Ajouté à `sources`.
- Salinas et al., DeepAR — https://arxiv.org/abs/1704.04110 (résumé lu). Ajouté à `sources`.
- `further_reading` vérifiés : fpp3 3.4 « Classical decomposition » (indices saisonniers ajustés pour sommer à m, soit une moyenne de 1 : ce que fait N0) ; fpp3 7.4 « Some useful predictors » (tendance linéaire, indicatrices saisonnières, termes de Fourier) ; NIST 6.4.4.3 « Seasonality » (détection de la saisonnalité, le libellé ne lui prête rien de plus) ; `numpy.linalg.lstsq(a, b, rcond=None)`, solution en premier élément.

## À retester

- **#70, n1 (py/js) `refuse un historique plus court que le nombre de variables`** : l'assertion « six semaines acceptées » décrit le défaut réparé. Six semaines sont désormais refusées (moins d'un cycle). Garder le refus à cinq semaines (message « fewer weeks ») et tester le nouveau refus sous 52 semaines, accepté à 52.
- **#60, n1 (py/js) `réajuster après la rupture rapproche la prévision`** : réajuste sur `REGIME_CHANGE[-20:]`, désormais refusé. L'escalate_when corrigé dit « dès qu'elle couvre un cycle complet » : tester le refus à vingt semaines, et le réajustement sur un cycle complet d'après rupture (série à prolonger, la rupture de `REGIME_CHANGE` n'a que 20 semaines).
- **#61, n1 (py/js) `INFIRMÉ : escalate_when … relire le coefficient`** : l'affirmation a changé. En JS le test est rouge (`RangeError` au lieu d'`AssertionError`), en Python il reste `xfail` pour une autre raison (ValueError). À remplacer par : sur un cycle complet d'après rupture, le coefficient se relit.
- **#45, n1.py `INFIRMÉ : au-delà de deux paires…`** : la docstring dit désormais qu'un pic de quelques semaines demande plus de paires. Le test marqué teste encore l'ancienne phrase (toujours `xfail`, toujours vert) : à remplacer par un test de la nouvelle (erreur à 4 paires < erreur à 2 sur le pic de trois semaines).
- n0 : nouveau refus `window < 1` (tester aussi `window` négatif), exclusion des semaines de coefficient nul (prévision nulle pour la semaine fermée, niveau calculé sans elle), `NaN` en Python → `ValueError`.
- n1 : `harmonics` grand (ex. 30 avec 52 semaines) pour vérifier que la garde « fewer weeks than features » reste atteignable ; historique d'exactement 52 semaines accepté.
- Noms JavaScript des six tests démarqués : le préfixe `DÉFAUT :` a été retiré comme prévu, mais le reste du nom décrit encore le défaut (« …ne lève aucune erreur », « …fait tomber la prévision à NaN ») alors que le test prouve l'inverse. À renommer en `production : …`, avec les noms Python jumeaux.
- Essai : libellé de refus changé (« historique trop court »).
- #2 « tant que le recul continue » ; #58 « à l'erreur d'arrondi près » ; #47 « par cycle, par an avec 52 semaines » : formulations nouvelles, déjà couvertes par les tests existants à vérifier.

## Pour l'orchestrateur

- `test-snippets forecast-weekly-sales` reste rouge sur les trois tests listés ci-dessus tant que le testeur ne les a pas réécrits : réparer le défaut #70 contredit forcément une assertion qui fixait l'ancien comportement.
- n1.js dépasse les quarante lignes utiles de la charte (47), dépassement antérieur à ce tour (45). Pas de réduction sans perdre la lisibilité de l'élimination de Gauss.
