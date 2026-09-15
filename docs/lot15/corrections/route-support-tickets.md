# route-support-tickets — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets route-support-tickets` : Python vert ; **JavaScript rouge sur
neuf tests qui fixent l'ancien comportement** (voir « À retester ») : n1
`une archive déséquilibrée pondérée…`, `INFIRMÉ : … soixante lignes`, `INFIRMÉ :
l'essai anglais…`, `une archive d'une seule équipe est refusée`, `production :
une archive vide lève à la première question` ; n2 `l'encodeur par défaut a la
forme de transformers.js`, `un index encodé par un autre modèle est refusé` ; n3
`le client par défaut a la forme du vrai kit`, `production : la limite compte
des unités UTF-16 en JavaScript`. Aucune assertion n'a été touchée.

Vérifications hors des tests : n1.js et n1.py entraînés sur la même archive,
seize tickets comparés : écart de probabilité maximal 0,0003, mêmes décisions ;
l'écart restant vient de la tolérance par défaut de lbfgs (avec `tol=1e-8`,
scikit-learn et n1.js concordent à 4·10⁻⁷ sur le ticket double). n3 exécuté
contre les vrais kits `openai` 3.14.0 et 7.15.0, transport remplacé : requête
`{model, messages, temperature}`, `content: null` → `RoutingUnavailable`.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 commentaire py/js (#9) | « "facture" then also matches "factures" and "facturation" » | Faux (f-a-c-t-u-r-a). Code réparé : « facturation » ajouté aux mots de facturation | « "facture" then also matches "factures" and "facturé"; "facturation" does not start with it, and has its own entry » |
| N1 breaking_point, essai `why` fr (#23) | « ne recoupe aucun mot des tickets déjà résolus » ; « Aucun mot de ce ticket ne figure dans l'archive » | Vocabulaire scikit-learn : seul « le » est commun (et en JS depuis que le découpage est le même) | « ne partage avec les tickets déjà résolus que le mot « le » » ; essai : « De ce ticket, l'archive ne connaît que le mot « le » » |
| essai `why` en (#42) | « Not one word […] the three teams come out nearly tied » | Archive anglaise : « does » et « on » communs ; 40 %, 37 %, 23 % avec le nouveau modèle | « Of this ticket, the archive only knows « does » and « on »: no team stands out, the best one stays under the floor » |
| N1 commentaire py (#29) | « the default […] flattens the probabilities so far that no ticket ever clears a useful floor » | Relevé : avec C=1, un ticket sur trois franchit 0,5 ; avec C=10 les trois (test `route un ticket qu'il n'a jamais vu`) | « With the default C=1, two of the three unseen tickets in the test stay under the 0.5 floor; with C=10 all three clear it. » |
| N1 docstring js + `doc.fr.yaml` (#33, #34) | « TF-IDF and a softmax regression are sixty lines […] small enough to keep beside the code, retrained while you read this » | 65 lignes (88 après réparation) ; temps d'entraînement fonction de l'archive | « written to learn what the Python snippet learns with scikit-learn: the same words and word pairs, the same TF-IDF weighting, the same penalised objective » |
| verdict_rationale (#30) | « l'équipe suivante figure dans la réponse » | Vrai de `rank`, pas de `route` | « `rank` rend l'équipe suivante avec sa probabilité » |
| N2 breaking_point (#45–#48) | « part chez facturation avec un score élevé […] le vote y voit une forte ressemblance. Un vrai encodeur déplace l'accident » | Encodeur de substitution (mots partagés) ; vote 0,617 contre 0,606 ; sans le ticket poli, technique ; comportement d'un vrai encodeur non testable | « Le test tourne avec un encodeur de substitution, qui rapproche les tickets partageant des mots […] ce seul voisin l'emporte de justesse sur deux tickets techniques. Retirez ce ticket de l'archive et le même message part chez technique » |
| N2 docstring py/js + `doc.fr.yaml` (#49) | « "je n'arrive plus à entrer dans mon espace" lands next to the archived tickets about a lost password » | Comportement d'un vrai modèle, non testable. sbert.net : cas d'usage « semantic search », « paraphrase mining » ; carte du modèle : 384 dimensions, recherche sémantique | « The encoder is a model trained for semantic search and paraphrase mining: it maps each ticket to a vector, and a ticket is routed by the resolved tickets whose vectors are closest » |
| N3 breaking_point (#59, #61) | « il en renvoie une quatrième […] comme le fait la première version de ce genre de code » | Réponse écrite par le double ; constat d'usage non sourcé. Démontré : la liste seule arrête l'équipe inventée ; une équipe réelle dictée passe (remarque 5) | « Rien dans la requête n'oblige la réponse à nommer une équipe de la liste : le test fait répondre au double local […] c'est la liste, et elle seule, qui l'arrête. Elle n'arrête d'ailleurs que l'invention » |
| N3 commentaire py/js | « A model charges by the token […] Refusing oversized input is […] a cost control » | Tarifs : « per 1M tokens » ; le plafond compte des caractères | « The provider bills every token of the prompt […] The cap counts characters, not tokens » (js : « code points, as in Python ») |
| N3 commentaire py/js (#64) | « Temperature zero, because a routing decision that changes between two identical calls cannot be reviewed » | Docstring du kit : « lower values like 0.2 will make it more focused and deterministic » | « The lowest temperature: the SDK documents lower values as more focused and deterministic. » |
| scenario (#72) | « Le premier réflexe est un appel de modèle […] un jeu d'entraînement payé depuis des années et laissé de côté » | Constat d'usage sans source | « Un appel de modèle par ticket entrant, avec les noms des équipes dans l'invite, route sans règle ni archive. Or l'outil de ticketing contient déjà les tickets résolus […] un jeu d'entraînement qui existe avant qu'on le demande » |
| Essai, commentaires | « Ce barreau », « le gain du barreau » ; « une soixantaine de millisecondes » | Vocabulaire ; durée non publiable | « niveau » ; durée retirée |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N1 docstring py + `doc.fr.yaml` (#32) | « The model is a table of weights small enough to keep in the repository, and retraining it is a step in the nightly export, not a project » | Dépend de la taille de l'archive réelle, non sourcé |
| N2 docstring py/js + `doc.fr.yaml` (#50) | « the neighbours are shown to the agent as the reason for the routing — which is more than N1's weights ever explain » | `neighbours` ne rend pas le ticket voisin. Rendre `(score, équipe, ticket)` aurait cassé une douzaine de tests qui déstructurent des couples ; la phrase est retirée plutôt |
| N3 docstring py/js + `doc.fr.yaml` (#66) | « This is the option people reach for first, and it is the shortest piece of routing logic on the entry […] a ticket in any language » | Constat d'usage, jugement devenu faux avec l'adaptateur, comportement du modèle |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.js (#19) | `\b` ASCII : « 我的colis » routé autrement qu'en Python | `(?<![\p{L}\p{N}_])` avec le drapeau `u`, la frontière de `\b` Unicode de Python |
| n0.py / n0.js (#9) | « Question sur la facturation » en file par défaut | « facturation » dans les mots de facturation |
| n1.js (#38) | ne route pas comme Python : aucune régularisation, découpage différent | Même découpage que `TfidfVectorizer` (minuscules, NFKD sans marques, mots de deux caractères ou plus, paires), même objectif que `LogisticRegression(C=10, class_weight="balanced")` (entropie croisée pondérée + ‖W‖²/2C, biais non pénalisé ; lu dans `_logistic.py` et `_linear_loss.py` de scikit-learn 1.7.2), minimisé par gradient accéléré avec un pas par coordonnée (majorant diagonal de la courbure) et redémarrage du moment ; aucune source externe invoquée, la convergence est vérifiée par le critère d'arrêt (gradient < 10⁻⁶) et la concordance avec scikit-learn |
| n1.js (#37) | lignes TF-IDF denses, 630 tickets bien au-delà de 2 s | Lignes creuses `[terme, valeur]` : 630 tickets synthétiques en 0,38 s, 2 000 en 1,6 s, 5 000 en 6,6 s mesurés ici |
| n1.js (#39) | archive d'une équipe : tout routé à 1 | `RangeError` si moins de deux équipes ou si tickets et équipes n'ont pas la même longueur |
| n2.py / n2.js (#57) | index d'un autre encodeur : score tronqué ou NaN | Longueur des vecteurs comparée : `ValueError` / `RangeError`. Un modèle de même largeur n'est pas détecté, et le commentaire le dit |
| n2.js (remarque 6) | `@xenova/transformers`, ancien nom | `@huggingface/transformers`, `pipeline('feature-extraction', name, { dtype: 'fp32' })` (même précision que le Python ; README : q8 par défaut en WASM), comme `fuzzy-match-company-names` et `moderate-user-comments` |
| n3.py / n3.js (#62) | `client.complete` absent du kit | Correctif imposé tel quel : `ProviderClient` / `providerClient`, `client = client or ProviderClient()` / `client ??= await providerClient()` |
| n3.py / n3.js | `message.content` nul passé à `json.loads` / `JSON.parse` | Traité explicitement, retenté, puis `RoutingUnavailable` |
| n3.js (#71) | plafond en unités UTF-16 | `[...ticket].length`, points de code comme Python |

Marquages retirés (assertions inchangées) : n0 — 1 `DÉFAUT` py/js ; n1 — 1
`DÉFAUT` py, 3 `DÉFAUT` js ; n2 — 1 `DÉFAUT` py/js ; n3 — 1 `DÉFAUT` py/js.

Restent marqués, phrase corrigée ou retirée : n0 `INFIRMÉ facturation` (py/js) ;
n1 `INFIRMÉ aucun mot commun` (py/js), `INFIRMÉ C par défaut` (py), `INFIRMÉ
soixante lignes` (js), `INFIRMÉ essai anglais` (js) ; n2 `INFIRMÉ voisins
montrés à l'agent` (py/js).

Lignes utiles (avant → après) : n0.py 29 → 29, n0.js 29 → 29, n1.py 19 → 19,
n1.js 76 → 88, n2.py 32 → 34, n2.js 46 → 49, n3.py 31 → 47, n3.js 35 → 53.

## Sources consultées

- scikit-learn 1.7.2, source installée : `feature_extraction/text.py` (`token_pattern=r"(?u)\b\w\w+\b"`, `strip_accents_unicode` en NFKD, minuscules d'abord), `linear_model/_logistic.py` (`sample_weight *= class_weight_`, `l2_reg_strength = 1.0 / (C * sw_sum)`), `linear_model/_linear_loss.py` (perte moyenne pondérée + ½ l2 ‖coef‖², biais hors pénalité), `_loss/loss.py` (multinomiale symétrique). Page `LogisticRegression` et guide « Text feature extraction » (ancre `#text-feature-extraction` présente). https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html
- Sentence Transformers, page d'accueil : « semantic search », « semantic textual similarity », « paraphrase mining », `SentenceTransformer(...).encode(...)`. https://sbert.net/
- Carte de `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` : 384 dimensions, cinquante langues, moyenne des jetons, Apache 2.0 ; `Xenova/paraphrase-multilingual-MiniLM-L12-v2` porte `onnx/model.onnx` (fp32) et des variantes quantifiées (API du hub).
- Transformers.js (context7 `/huggingface/transformers.js`) : `import { pipeline } from "@huggingface/transformers"`, `extractor(texts, { pooling: "mean" })`, `.tolist()`, `{ dtype: "fp32" }` ; README : « 'fp32' (default for WebGPU) […] 'q8' (default for WASM) ». https://huggingface.co/docs/transformers.js/pipelines
- OpenAI : tarifs par million de jetons (gpt-4.1-mini 0,40 $ / 1,60 $). Classe `élevé` vérifiée, non publiée : consigne d'une soixantaine de jetons plus un ticket de quelques centaines, de l'ordre de la centaine de dollars par million de tickets. Kits 3.14.0 et 7.15.0 : `temperature` (« more focused and deterministic »). https://developers.openai.com/api/docs/pricing
- `further_reading` : les quatre liens répondent (200) et disent ce que leur libellé leur prête.

## À retester

- **n1 JS `une archive déséquilibrée pondérée…`** : attend « technical » ; n1.js rend maintenant « shipping » (0,504), comme Python (0,503). Retrouver le même témoin que Python (non pondéré → billing).
- **n1 JS `INFIRMÉ : … soixante lignes`** : phrase retirée ; le test compte 66 lignes. À supprimer ou remplacer par la nouvelle affirmation (« same words and word pairs, same TF-IDF weighting, same penalised objective ») : comparer le vocabulaire de n1.js à `vocabulary_` de scikit-learn, et les probabilités à 10⁻³ près sur une archive.
- **n1 JS `INFIRMÉ : l'essai anglais…`** : épingle 48/39/13 ; nouveaux scores 40/37/23, phrase réécrite ; tester « does » et « on » seuls communs, et le plancher non atteint.
- **n1 JS `une archive d'une seule équipe est refusée`** : la première ligne du test entraîne encore cette archive et attend `[['billing', 1]]` ; `train` lève désormais `RangeError`.
- **n1 JS `production : une archive vide lève à la première question`** : attend `TypeError` au routage ; `train([], [])` lève `RangeError` dès l'entraînement.
- **n1 INFIRMÉ restants** : « aucun mot commun » (py/js) → tester « seul « le » est commun » ; « C par défaut » (py) → tester « avec C=1, deux des trois sous 0,5 ; avec C=10, aucun ».
- **n1 nouveaux cas** : parité sur une archive plus variée (dont l'archive anglaise de l'essai) ; tickets et équipes de longueurs différentes → `RangeError` ; un mot d'un caractère (« l », « j ») n'est plus un terme en JS ; le ticket double sort à 0,5003, **au ras du plancher** : un test qui en dépend est fragile.
- **Essai** : cas 2 (« Mon colis n'est pas arrivé et le prélèvement automatique est passé quand même ») part désormais en file par défaut en français (45/34/21) et en anglais (48/36/17) ; le test ne vérifie que l'ordre, qui tient.
- **n2 JS `l'encodeur par défaut a la forme de transformers.js`** : le crochet sert `@xenova/transformers` ; le paquet est `@huggingface/transformers`, avec `{ dtype: 'fp32' }` en troisième argument de `pipeline`.
- **n2 JS `un index encodé par un autre modèle est refusé`** : marquage retiré, mais les deux `assert.equal` du début épinglent l'ancien défaut (« billing », file par défaut) ; attendre un rejet dans les deux sens (768 sur 384, 384 sur 768). Tester aussi l'archive vide (aucune vérification).
- **n2 `INFIRMÉ voisins montrés à l'agent` (py/js)** : phrase retirée, test à supprimer.
- **n3 JS `le client par défaut a la forme du vrai kit`** : marquage retiré ; les deux lignes suivantes attendent « aucune requête » et `/client\.complete is not a function/`. Attendre une requête `{ model: 'gpt-4.1-mini', messages: [{ role: 'user', content }], temperature: 0 }`. Même contrôle en Python sur `module.requetes`.
- **n3 JS `production : la limite compte des unités UTF-16`** : la limite compte des points de code (4 000 emoji acceptés, 4 001 refusés), comme Python.
- **n3** : `content: null` → `RoutingUnavailable` après les essais.
- **n0 `INFIRMÉ facturation` (py/js)** : tester `matches("Question sur la facturation") == {"billing": ["facturation"]}`.
- **Noms** : les tests démarqués gardent parfois un commentaire qui décrit le défaut (n1 JS « Chaque ligne TF-IDF est dense… », n2 JS « Rien ne vérifie la dimension ») ; à reformuler.

## Pour l'orchestrateur

- n1.js passe de 76 à 88 lignes utiles, n3 porte l'adaptateur imposé (47 et 53). Rendre la même décision que scikit-learn impose le même découpage, la même pénalité et un optimiseur qui converge ; c'est ce que la parité coûte. Alternative écartée : dire dans la fiche que les deux langages ne routent pas pareil, ce qui ferait de l'extrait JS un autre modèle que celui que la fiche décrit.
- `vendor_lock: library` de N1 vaut pour Python (scikit-learn) ; l'extrait JS n'a aucune dépendance. Le schéma n'a qu'une valeur par niveau.
- Deux autres fiches ont déjà tranché pour `@huggingface/transformers` ; les tests N2 JS des autres fiches qui simulent `@xenova/transformers` sont à surveiller.
