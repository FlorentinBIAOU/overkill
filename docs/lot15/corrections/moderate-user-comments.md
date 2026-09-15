# moderate-user-comments — corrections du rédacteur (tour 1)

État après correction : `check-content`, `check-figures`, `check-french` verts.
`test-snippets moderate-user-comments` **rouge sur sept tests** qui fixent un
comportement que les réparations changent (voir « À retester ») : Python
`test_n1_est_deterministe_et_s_appuie_sur_scikit_learn` ; JavaScript n1
`point de rupture : l'hostilité sans forme apprise reste sous le seuil`,
`point de rupture : le signalement repasse au-dessus`, `DÉFAUT : le hachage FNV…`,
`INFIRMÉ : « … tient en quarante lignes »` ; n2 `le classifieur est injecté, et
par défaut c'est le vrai`, `DÉFAUT : une ligne d'une autre forme…`. Aucune
assertion n'a été touchée.

**Le verdict N2 est maintenu, mais son fondement a changé.** La fiche le
justifiait par « le classifieur auto-hébergé lit ce contexte » (#43). La fiche
du modèle dit le contraire : « If words that are associated with swearing,
insults or profanity are present in a comment, it is likely that it will be
classified as toxic, regardless of the tone or the intent of the author ». Le
verdict repose désormais sur ce qui est sourcé : N2 est le premier niveau qui
arrive entraîné sur des commentaires étiquetés, garde le texte chez vous, et
l'extrait envoie la bande du milieu à un humain. Alternative écartée : passer la
fiche en `draft`. Je l'ai écartée parce qu'un verdict vrai et sourcé existe ;
le relecteur tranchera s'il tient face à l'usage.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| verdict_rationale fr/en (#43) | « Le classifieur auto-hébergé lit ce contexte » | Contredit par la fiche du modèle (citation ci-dessus) | « N2, parce que c'est le premier niveau qui arrive déjà entraîné sur les commentaires étiquetés d'un défi public […] Il ne règle pas la difficulté du contexte : […] la fiche du modèle prévient qu'il note toxique un commentaire qui contient des mots d'insulte, quelle que soit l'intention. C'est pour cela que l'extrait tient deux seuils et envoie la bande du milieu à un humain » |
| scenario fr/en | « Deux réflexes se croisent : une liste de gros mots recopiée d'un dépôt public […] Les deux passent à côté de la difficulté réelle » | Constat d'usage non sourcé ; « les deux passent à côté » non démontré pour N3 | « Deux solutions sont à portée de main : une liste de gros mots, ou un appel de modèle généraliste […] La difficulté, pourtant, n'est pas de reconnaître le mot mais de savoir ce qu'il fait là » |
| N0 breaking_point fr/en (#3) | « et rien dans le résultat ne les distingue » | La fenêtre de contexte les distingue (« called me a blorptard please remove his » / « this forum you blorptard ») | « même drapeau, même terme, et seule la fenêtre de contexte, qu'un humain doit lire, les distingue » |
| N0 docstring py/js + `doc.fr.yaml` (#8) | « Accents and case […] Nothing else is touched: folding further would start inventing matches » | NFKD replie aussi pleine largeur, ligatures, exposants | « Case, accents and compatibility forms (full-width letters, ligatures, superscripts) are spellings of the same word […] Look-alikes are not: a 0 stays a 0, which is why bl0rptard walks past » |
| N1 breaking_point fr/en (#20, #22) | « ne réemploie aucune forme vue à l'entraînement » ; « Un corpus plus fourni déplace la frontière sans changer ce que le modèle regarde » | 44 n-grammes sur 114 sont dans le vocabulaire ; la phrase n'emploie aucune des insultes (inventées) du corpus. Les traits sont des n-grammes par construction | « qui n'emploie aucune des insultes du corpus, reste sous le seuil » ; « Un corpus plus fourni change les poids, pas ce que le modèle lit : des n-grammes de caractères » |
| N1 docstring JS + `doc.fr.yaml` (#30, #32) | « logistic regression on hashed character n-grams is forty lines » ; « every weight can be printed and argued about » | 41 lignes (45 après réparation) ; un poids = une case de hachage partagée | « hashing the character n-grams, training a logistic regression and scoring take four short functions » ; « Every weight can be printed, but with hashing a weight stands for every n-gram that lands in its bucket: to argue about one, list those n-grams first » |
| N1 docstring py + `doc.fr.yaml` (#30, #33) | « every weight can be printed and argued about. That last property is worth more in moderation than a point of accuracy » | Vrai en Python (`get_feature_names_out`) ; la comparaison avec la justesse est un jugement | « every weight can be printed next to the n-gram it belongs to » |
| N2 breaking_point fr/en (#46, #47) | « Le modèle note la toxicité, l'insulte et la menace ; […] ressort bas partout et part en publication » | `config.json` : sept étiquettes de nuisance plus neuf de mention d'identité ; les notes basses sont écrites par le test | « Le modèle note sept nuisances — toxicité, toxicité sévère, obscénité, attaque identitaire, insulte, menace, contenu sexuel explicite — et aucune ne nomme la divulgation d'un domicile […] la fiche du modèle prévient qu'un commentaire contenant des mots d'insulte sera probablement noté toxique […] Le test ne vérifie que la plomberie, sur des notes simulées. » |
| N2 docstring py/js + `doc.fr.yaml` (#49, #50) | « A distilled encoder fine-tuned on a moderation corpus […] It reads context the n-grams of N1 cannot » | `roberta-base`, douze couches : pas distillé. Entraîné sur Civil Comments (défi Jigsaw Unintended Bias). « lit un contexte » non sourcé, contredit par la fiche | « A RoBERTa encoder fine-tuned on the Civil Comments corpus of a public toxicity challenge […] It arrives trained on labelled comments, which N1 makes you gather yourself » |
| N2 docstring `moderate` py/js (#53) | « a batch of a hundred is one pass through the model and a hundred calls are a hundred passes » | transformers : « batch inference is disabled by default », et déconseillé sur CPU ; Transformers.js : un seul appel du modèle sur la liste tokenisée avec remplissage | Python : « Whether the model then reads the comments together is the library's business: transformers batches only when given a `batch_size`, and leaves it off by default. » JS : « Transformers.js runs it through the model in one pass, padded to the longest comment. » |
| N3 breaking_point fr/en (#68, #69) | « Dans le test, « the diagram… » revient noté en harcèlement » ; « le nombre du fournisseur, qui change au calendrier du fournisseur » | La note est écrite par le double ; Cookbook OpenAI : « Determinism is not guaranteed » | « Si « the diagram… » revient noté en harcèlement […] — le test simule cette réponse — » ; « ce nombre, que le fournisseur pris en exemple ne garantit pas identique d'un appel à l'autre, même à graine fixée » |
| N3 commentaire py/js (#75) | « A model charges by the token, and a comment that long is a bug or an attack » | Tarifs : prix par million de jetons ; un commentaire légitime long existe | « The provider bills every token of the prompt. The cap counts characters, not tokens, and is checked before any call: the caller decides where a longer comment goes instead. » |
| Essai, cas 6, `why` fr/en (#66, #67) | « il ressort bas partout » ; « c'est-à-dire le coût qu'on prête à N1 et qu'on suppose absent ici » | Notes simulées par le cas | « Aucune des sept nuisances que note le modèle ne nomme ce préjudice. Les notes basses de ce cas sont simulées, et le code publie ce qui est noté bas » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N3 docstring py/js + `doc.fr.yaml` (#70) | « The shortest code on the ladder to write » | Faux : N3 est le plus long dans les deux langages |
| N2 commentaire py/js | « and pretending otherwise is how automated moderation earns its reputation » | Appréciation non sourcée |
| N2 commentaire py/js | « Feeding comments one by one is the usual way this rung is made slow » | Constat d'usage non sourcé ; la documentation de transformers déconseille même le regroupement sur CPU |
| further_reading | Perspective API, page des attributs | Page rendue en JavaScript, contenu non consultable ; lien non vérifié |
| Essai, en-tête | « un modèle de plusieurs centaines de mégaoctets » | Taille chiffrée hors frontmatter ; remplacé par « un modèle dont les poids se téléchargent » |

## Ajouté

| Où | Ce qui est ajouté | Source |
|---|---|---|
| N2 regulatory fr/en | « Usages prévus par l'auteur du modèle : la recherche, un réentraînement sur des données construites avec soin, et l'aide aux modérateurs pour repérer plus vite les contenus nuisibles » | Fiche du modèle : « for research purposes, fine-tuning on carefully constructed datasets […] and/or to aid content moderators in flagging out harmful content quicker » |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#17) | accent tapé en NFD coupé du mot, terme non signalé | Le texte et les termes sont recomposés en NFC avant le découpage en mots |
| n0.js (#18) | `toLowerCase` ne replie pas « ß » | Après NFKD et minuscules, « ß » → « ss » et « ς » → « σ », les deux replis où `casefold` diffère encore des minuscules une fois NFKD appliqué |
| n0.py / n0.js (#12) | un terme de plusieurs mots n'était jamais trouvé | Les termes sont découpés comme le texte ; une suite de mots consécutifs est comparée, jusqu'à la longueur du plus long terme. « sale type » est trouvé dans « quel sale type celui-là » |
| n1.js (#40) | FNV multiplié en flottant : 499 cases occupées sur 1 024 | `Math.imul` : 877 cases occupées |
| n1.js (#28) | pondération sans effet sur le corpus déséquilibré (0 insulte sur 8) | Conséquence du hachage réparé : 1 sur 8 (Python 2) ; sans pondération, 0 |
| n1.js (#39) | corpus vide ou d'une seule classe accepté | `RangeError` si une classe manque ou si les étiquettes ne sont pas une par commentaire (Python : scikit-learn lève déjà) |
| n1.py / n1.js (#38) | commentaire vide signalé en JS (0,67) ; noté par la seule constante en Python (0,45) | Un commentaire sans aucun n-gramme lisible vaut 0 dans les deux langages |
| n1.py / n1.js (production) | « ｂｌｏｒｐｔａｒｄ » ne passait plus le seuil en JS une fois le hachage réparé ; aucun repli de compatibilité dans les deux | NFKC puis minuscules avant les n-grammes (`preprocessor=fold` en Python, fonction nommée pour que le modèle reste sérialisable). Le corpus du test est en ASCII : vocabulaire et poids Python inchangés |
| n2.py / n2.js (#62, #63) | maximum pris sur toutes les étiquettes : un commentaire qui mentionne une identité bloqué ; ligne `{label, score}` devenue une décision « score » | `HARM_LABELS` : seules les sept étiquettes de nuisance décident ; tout le reste est ignoré, et une ligne sans aucune d'elles part en relecture |
| n2.py / n2.js (#58) | modèle rechargé à chaque appel de `moderate` | `default_model` (`functools.cache`) / `defaultModel` (promesse gardée, oubliée si le chargement échoue) |
| n2.py / n2.js (#57) | un lot vide appelait le modèle (et le chargeait) | `[]` rendu avant tout chargement |
| n2.js (#46) | modèle différent de Python (`Xenova/toxic-bert`, six étiquettes, `toxic` au lieu de `toxicity`) | `protectai/unbiased-toxic-roberta-onnx`, export ONNX du même modèle, avec `subfolder: ''` (poids à la racine) et `dtype: 'fp32'`. Options vérifiées dans le source de `pipeline()` de Transformers.js ; chargement réel non exécuté |
| n2.py (hors relevé) | sans `truncation`, un commentaire plus long que ce que lit RoBERTa fait échouer le pipeline Python ; Transformers.js tronque déjà | `truncation=True` à la construction du pipeline, dit en commentaire : la fin d'un très long commentaire n'est pas notée |
| n3.py / n3.js (#76) | client par défaut sans méthode `complete` | Correctif imposé : `ProviderClient` / `providerClient`, `client = client or ProviderClient()` / `client ??= await providerClient()`, commentaire du fournisseur donné en exemple |
| n3.py / n3.js | `message.content` à `null`, ou JSON qui n'est pas un objet, confié à l'exception | Traité explicitement comme réponse inutilisable, retentée, puis `ModerationUnavailable` |
| n3.js (#78) | plafond en unités UTF-16 | `[...comment].length`, points de code comme Python |

Marquages retirés (assertions inchangées) : n0 — 1 `INFIRMÉ` et 1 `DÉFAUT` en
Python, 1 `INFIRMÉ` et 2 `DÉFAUT` en JavaScript ; n1 — 1 `INFIRMÉ` et 2 `DÉFAUT`
en JavaScript ; n2 — 2 `INFIRMÉ` et 2 `DÉFAUT` en Python, 2 `INFIRMÉ` en
JavaScript ; n3 — 1 `DÉFAUT` en JavaScript.

Restent marqués : n0 `INFIRMÉ` « rien ne les distingue » et « rien d'autre n'est
touché » (py/js), n1 `INFIRMÉ` « aucune forme vue » (py/js) et « chaque poids
peut être imprimé et discuté » (js), n3 `INFIRMÉ` « le plus court » (py/js) : les
phrases ont changé, les tests décrivent l'ancienne. n3 `DÉFAUT` du client par
défaut (py/js) : il passe le double du kit directement comme `client`.

Lignes (hors lignes vides et commentaires, docstrings Python comprises) : n0.js
24, n1.js 45, n2.js 46, n3.js 65 ; n3.py 82 dont une vingtaine de docstring. N1
JS, N2 et N3 dépassent les quarante lignes utiles ; pour N3, l'adaptateur imposé
en est la cause principale.

## Sources consultées

- Fiche de `unitary/unbiased-toxic-roberta` : entraînement sur le défi Jigsaw Unintended Bias in Toxicity Classification (Civil Comments), `roberta-base`, citation sur les mots d'insulte « regardless of the tone or the intent », usages prévus. https://huggingface.co/unitary/unbiased-toxic-roberta
- `config.json` des deux dépôts (`unitary/unbiased-toxic-roberta`, `protectai/unbiased-toxic-roberta-onnx`) : mêmes seize étiquettes, `multi_label_classification`, douze couches. Arborescence de `protectai/unbiased-toxic-roberta-onnx` : `model.onnx` et `tokenizer.json` à la racine, pas de dossier `onnx/`.
- `Xenova/toxic-bert` : « converted from unitary/toxic-bert ».
- Transformers.js, source de `pipeline()` : options `subfolder = 'onnx'`, `dtype`, transmises au chargement ; source de `TextClassificationPipeline` : tokenisation `padding: true, truncation: true`, un seul appel du modèle, `top_k` à 1 par défaut, sigmoïde en `multi_label_classification`.
- Transformers v5.9.0, « Pipeline tutorial », Batch inference : « batch inference is disabled by default […] generally recommended to avoid batching on CPUs » (context7).
- OpenAI Cookbook, paramètre `seed` : « Determinism is not guaranteed ». Tarifs de l'API : gpt-4.1-mini 0,40 $ en entrée, 1,60 $ en sortie par million de jetons ; une invite d'une centaine de jetons et une trentaine en sortie donnent de l'ordre de 90 $ par million de commentaires : classe `élevé` cohérente.
- Santa Clara Principles, EUR-Lex 2022/2065 (DSA) : pages existantes, conformes au libellé.

## À retester

- **n1 py `test_n1_est_deterministe_et_s_appuie_sur_scikit_learn`** : `modules == {"sklearn"}` ; n1.py importe maintenant `unicodedata` (bibliothèque standard) pour NFKC. `vendor_lock: library` tient.
- **n1 js points de rupture** : scores épinglés sur l'ancien hachage (0,1396, 0,8173). Nouveaux : hostile 0,3784 (sous le seuil), signalement 0,8904 (au-dessus). Les deux conclusions tiennent.
- **n1 js `DÉFAUT : le hachage FNV…`** : épingle 499 cases ; 877 désormais. Tester `> 800` sans l'épinglage, et l'égalité avec `stableHash` du harnais.
- **n1 js `INFIRMÉ : quarante lignes`** : épingle 41 ; la phrase ne donne plus de nombre. Tester les quatre fonctions (`features`, `train`, `predict`, `score`).
- **n1 js/py** : nouveaux cas — `train` refuse une seule classe et des longueurs différentes ; commentaire vide et commentaire d'espaces à 0 ; en Python, un commentaire dont aucun n-gramme n'est dans le vocabulaire vaut 0 ; « ｂｌｏｒｐｔａｒｄ » et une ligature repliés dans les deux langages ; modèle toujours sérialisable (`pickle`).
- **n2 js `le classifieur est injecté…`** : `MODEL_NAME` vaut `protectai/unbiased-toxic-roberta-onnx`. Tester que `pipeline` reçoit `{ subfolder: '', dtype: 'fp32' }` (double de `pipeline`).
- **n2 js `DÉFAUT : une ligne d'une autre forme`** : l'assertion hors enveloppe fixe la décision fautive `{block, 'score'}` ; la décision est désormais `review`.
- **n2 py/js** : étiquettes d'identité ignorées (le test py existe ; ajouter le jumeau js) ; `truncation=True` passé au pipeline Python ; `default_model` / `defaultModel` gardé après un chargement réussi, oublié après un échec ; lot vide sans chargement du modèle par défaut. Attention : le test py « chargé une fois » laisse son double dans le cache de `default_model` pour la suite du module.
- **n2 py `test_predict_convertit…` et js** : ils utilisent l'étiquette `toxic` (js) ; le modèle JS rend désormais `toxicity`.
- **n0** : phrases changées (#3 fenêtre, #8 formes de compatibilité et sosies) ; nouveaux cas — terme de deux mots séparés par une ponctuation (« sale, type ») ; « ẞ » majuscule et « ς » final repliés à l'identique py/js ; terme vide dans la liste sans effet.
- **n1 `INFIRMÉ` « aucune forme vue »** : tester « n'emploie aucune des insultes du corpus » ; **js « chaque poids peut être imprimé et discuté »** : phrase remplacée.
- **n3 `INFIRMÉ` « le plus court »** : phrase retirée ; test à retirer. **n3 `DÉFAUT` client par défaut (py/js)** : tester l'adaptateur, `moderate(…, client=ProviderClient(sdk=RealShaped(…)))` / `providerClient(realShapedClient(…))`, requête `{model, messages: [{role: 'user', content}], temperature: 0}`, `content: null` et JSON non objet (`[1]`) → `ModerationUnavailable` après les essais.
- **Noms des tests démarqués** : le préfixe est retiré mais la suite du nom décrit encore le défaut ; à renommer avec leurs jumeaux.
- **Essai** : `why` du cas 6 réécrit ; les notes simulées emploient `toxicity`, étiquette qui existe dans le modèle des deux langages.

## Pour l'orchestrateur

- `test-snippets moderate-user-comments` reste rouge sur les sept tests ci-dessus jusqu'au passage du testeur.
- Le verdict N2 tient désormais sur un fondement différent de celui qu'annonçait la fiche ; c'est le point à soumettre en priorité au relecteur.
- Le chargement de `protectai/unbiased-toxic-roberta-onnx` par Transformers.js n'a pas été exécuté (réseau et paquet absents) : les options existent dans le source, le dépôt a la forme voulue, rien de plus.
- `fuzzy-match-company-names` (mon lot) emploie désormais `@huggingface/transformers` comme cette fiche.
