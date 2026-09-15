# rank-products-by-relevance — corrections du rédacteur (tour 1)

Relevé : 6 `INFIRMÉE` (rangs 11, 12, 18, 46, 54, 58), 5 `DÉFAUT` (rangs 35, 36, 63, 64, 65), 2 niveaux indisponibles à sourcer (rangs 68, 69).

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 docstring (py, js, `doc.fr.yaml`), N0 name | « Every signal is reduced to the same nought-to-one scale before the weights touch it » ; « ramenés à la même échelle » (rang 11) | `margin` et `popularity` étaient recopiés tels quels, 35 restait 35 | Le code refuse désormais une marge ou une popularité hors de [0, 1] ; la docstring dit que le texte et la disponibilité y sont par construction, marge et popularité parce qu'une valeur hors de l'échelle est refusée. Nom : « Score pondéré sur quatre signaux compris entre zéro et un » |
| N0 docstring (py, js, `doc.fr.yaml`) | « the score itself stays inside the same scale whatever the weights » (rang 12) | Un poids négatif fait sortir la moyenne de [0, 1] (texte 2, marge −1 → 2,0) | Le code refuse un poids négatif ; la docstring dit « the score, a mean over weights that cannot be negative, stays inside the same scale » |
| N0 docstring de `text_match` / `textMatch` | « a shopper who types the plural is looking for the singular too » (rang 18) | Le préfixe sert l'inverse : « sandale » trouve « Sandales », « sandales » ne trouve pas « Sandale » | « and "sandale" finds "sandales". Not the other way round: "sandales" does not find "sandale". » |
| N1 docstring (py, js, `doc.fr.yaml`) | « The score is the one of N0, a weighted sum » ; « Nothing else changes: the serving code, the explanation shown to the shop, the scale of the score » (rang 46) | N0 rend une moyenne dans [0, 1], N1 une somme de poids signés normalisés, dans [−1, 1] ; N1 a sa propre fonction `rank` | « The score is built on the same four signals as N0 » ; « The signals shown to the shop stay the same; the score does not. Learned weights can be negative, so the score is a plain sum over weights whose absolute values add up to one, between minus one and one, where N0 takes a mean of weights that cannot be negative. » |
| N1 docstring de `rank` (py, js) | « Same weighted sum as N0, same stable sort, same explanation returned: only the provenance of the weights differs » (rang 47) | Voir rang 58 | « A sum weighted over the same signals, the same stable sort, the signals handed back with each candidate. Not N0's mean: dividing by the signed total of learned weights would reverse the order when that total is negative, and wipe it out when it is nought. » |
| verdict_rationale | « la même somme pondérée, la même explication » ; « gardez la même fonction de service » (rang 58) | Passer à `n0.rank` des poids appris de somme négative inversait l'ordre de `n1.rank`. `n0.rank` refuse désormais ces poids | « une somme pondérée des mêmes signaux, rendus à côté du score » ; « servez alors avec sa propre fonction : des poids appris peuvent être négatifs, et la moyenne de N0 les refuse » |
| N1 commentaire de la pénalité (js) | « The penalty keeps a signal the log never varied at exactly nought, rather than letting it drift on noise » (rang 54) | Sans pénalité, le poids d'une colonne nulle reste nul aussi. Guide scikit-learn : objectif binaire `(1/S) Σ perte + r(w)/(S·C)`, `r(w) = ½‖w‖²` ; le gradient de la pénalité est donc `w/(n·C)`, exactement ce que le code ajoute au gradient moyen | « The penalty of scikit-learn's `C`, divided by the row count because the gradient above is a mean: it is what makes both versions fit one model. » (l'accord à deux décimales est démontré, rang 52) |
| N1 docstring (js, `doc.fr.yaml`) | « The fit is thirty lines of gradient descent » | Le test compte 37 lignes avant correction, 40 après (`pairs`, `learnWeights`, `inScale`) | « The fit is forty lines of gradient descent » |
| N1 risks.regulatory | « Sa conservation entre dans le périmètre de votre registre des traitements, si vous en tenez un » | CNIL : le registre est dû par tout organisme, la dérogation des moins de 250 salariés ne couvre pas les traitements non occasionnels, ce qu'est un journal de clics | « Sa conservation entre dans le périmètre du registre des activités de traitement et de la durée de conservation que vous fixez » |
| N2 unavailable_reason | « des chiffres de gestion […] qu'aucun encodeur sémantique ne connaît » (rang 68) | Raisonnement : un encodeur lit du texte, et stock, marge et ventes n'en sont pas | « qui ne figurent dans aucun texte qu'un encodeur sémantique pourrait lire » |
| N3 unavailable_reason | « Un modèle généraliste ne donne ni l'un ni l'autre » (explication, même ordre le lendemain) (rang 69) | Cookbook du fournisseur : « The Chat Completions and Completions APIs are non-deterministic by default ». Ce qu'une réponse de modèle ne contient pas : les nombres qui ont décidé de l'ordre | « Un modèle généraliste rend un ordre sans les nombres qui l'ont décidé, et son API n'est pas déterministe par défaut, de l'aveu même du fournisseur pris en exemple » |
| essai, why | « une nouveauté n'a par définition aucune popularité » (rang 29) | La donnée de l'essai porte 0,05 | « cette nouveauté n'a presque aucune popularité » ; commentaire d'en-tête : « barreau » → « niveau » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N1 docstring | « the explanation shown to the shop, the scale of the score, all stay as they were » | Remplacé par ce qui reste (les signaux) et ce qui change (l'échelle), voir « Corrigé » |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py, n0.js | Repli des accents qui retirait toute marque : faux positifs en devanagari, arabe voyellé, et divergence entre les langages (rang 35) | `fold` ne retire que les diacritiques U+0300–U+036F ; `terms` garde les marques dans les mots (`isalnum` ou catégorie `M` en Python, `[\p{L}\p{M}\p{N}]` en JavaScript). « हिंदी » ne trouve plus « हद » dans les deux langages ; les accents latins sont toujours ôtés |
| n0.py, n0.js | Marge ou popularité hors échelle recopiée ; en JavaScript, un champ absent donnait un score NaN classé comme une égalité (rangs 11, 36) | `signals` refuse une marge ou une popularité hors de [0, 1] : `ValueError` / `RangeError`. `undefined` et `NaN` échouent au même contrôle en JavaScript ; `None` lève `TypeError` en Python |
| n0.py, n0.js | Poids négatifs acceptés : moyenne hors échelle, ordre inversé avec des poids appris de somme négative (rangs 12, 58) | `score` refuse un poids négatif |
| n1.py, n1.js | Journal sans différence entre cliqué et ignoré : `ZeroDivisionError` en Python, poids NaN en JavaScript (rang 63) | Échelle nulle après ajustement : erreur « … nothing to learn from », comme pour un journal vide |
| n1.py, n1.js | Signal hors de [0, 1] non refusé, descente de gradient JS divergente ; signal manquant JS → poids NaN (rangs 64, 65) | `pairs` refuse une page dont un signal sort de [0, 1] (`inScale` en JavaScript, qui écarte aussi `undefined`) |

Défaut non réparé : en JavaScript, des poids incomplets (`{ text: 1 }`) donnent toujours un score nul pour tous les produits (rang 36, seconde moitié). Le test « production : un produit sans champ inStock est compté hors stock » affirme ce comportement ; le réparer rendait ce test rouge. Voir « À retester ».

## Sources consultées

- Règlement (UE) 2019/1150, article 5(1) — https://www.legislation.gov.uk/eur/2019/1150/article/5 (lu : « Providers of online intermediation services shall set out in their terms and conditions the main parameters determining ranking… ») ; EUR-Lex n'a pas répondu à la lecture automatique
- CNIL, *Donnée personnelle* — https://www.cnil.fr/fr/definition/donnee-personnelle (lue : un identifiant permet l'identification indirecte)
- CNIL, *Le registre des activités de traitement* — https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement (lue)
- OpenAI Cookbook, *reproducible outputs with the seed parameter* — https://developers.openai.com/cookbook/examples/reproducible_outputs_with_the_seed_parameter (lue)
- scikit-learn, `LogisticRegression` et guide *Linear models*, perte logistique régularisée — https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html, https://scikit-learn.org/stable/modules/linear_model.html (lus)
- `further_reading` : les deux articles de Joachims répondent 200 ; Python *Sorting HOW TO* : « Sorts are guaranteed to be stable » ; MDN : « Since version 10 (or ECMAScript 2019), the specification dictates that Array.prototype.sort is stable »

## À retester

- **Restent marqués, l'affirmation ayant été corrigée plutôt que le code** : n0 `test_infirme_une_requete_au_pluriel_trouve_le_produit_au_singulier` (py, js) ; n1 `test_infirme_lechelle_du_score_reste_celle_de_n0` (py, js) ; n1 JS `INFIRMÉ : la pénalité est ce qui garde à zéro…`. À remplacer par les tests des nouvelles phrases (« sandales » ne trouve pas « sandale » ; score N1 dans [−1, 1] ; pénalité égale au gradient de `r(w)/(n·C)`).
- **Restent marqués, le code refusant désormais l'entrée au lieu de la traiter** : n0 `test_infirme_chaque_signal_est_ramene_entre_zero_et_un` et `…_le_score_reste_entre_zero_et_un_quels_que_soient_les_poids` (py, js) → une marge de 35 et un poids négatif lèvent l'erreur nommée ; n1 `test_infirme_la_fonction_de_service_de_n0_classe_comme_n1_avec_les_poids_appris` (py, js) → `n0.rank` refuse les poids appris négatifs ; n1 `test_defaut_des_signaux_hors_echelle_font_diverger_les_deux_langages` (py, js) → les deux langages refusent une popularité en pourcentage ; n1 JS `DÉFAUT : un signal manquant rend des poids NaN` → lève ; n0 JS `DÉFAUT : un produit sans popularité ou des poids incomplets…` → la première moitié lève désormais (parité avec Python), la seconde reste à trancher.
- **Contradiction entre deux tests JS de n0** : `DÉFAUT : … des poids incomplets ne lèvent aucune erreur` attend une erreur, `production : un produit sans champ inStock est compté hors stock` affirme un score nul pour tous. Trancher (Python lève `KeyError`) ; si l'erreur est retenue, le rédacteur ajoutera le refus au tour suivant.
- **Tests démarqués** : n0 `un mot en devanagari ne trouve pas un autre mot` (py, js), n1 `un journal sans aucune différence lève l'erreur nommée` (py, js). Commentaires et `reason` à reformuler.
- **Ajouter** : accents latins toujours ôtés après le changement de `fold` (NFD, « crème », « Évry ») et marques gardées en arabe voyellé ; `n0.signals` lève sur `NaN` et `undefined` ; `pairs` lève sur un signal manquant en Python (`TypeError`) et en JavaScript (`RangeError`) ; le test de longueur « l'ajustement tient en une trentaine de lignes » compte `inScale` hors des deux fonctions : le renommer « en quarante lignes » et l'inclure.

## Pour l'orchestrateur

- Rien.
