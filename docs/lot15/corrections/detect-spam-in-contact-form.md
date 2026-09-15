# detect-spam-in-contact-form — corrections du rédacteur (tour 1)

État après correction : `check-content` et `check-french` verts ;
`check-figures` ne signale rien sur cette fiche (un signalement subsiste sur
`search-in-your-own-documents/n0.js`, hors de mes chemins). `test-snippets
detect-spam-in-contact-form` : 5 tests rouges, tous listés dans « À retester ».
Aucune assertion n'a été touchée.

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| scenario fr/en (#5, #6) | « l’essentiel du trafic vient de scripts […] un champ caché, laissé vide par tout être humain » ; « ne ressemble pas au volume qu’on croyait avoir à trier » | Répartition du trafic sans source ; « tout être humain » non vérifiable (Batchelder dit que les robots remplissent le champ, rien sur le remplissage automatique des navigateurs) | « un script qui poste […] sans afficher la page se trahit s’il remplit le champ caché que la page ne montre pas, ou s’il envoie plus vite qu’une personne ne tape : deux contrôles qui ne lisent pas une ligne du message et ne coûtent rien. Ce qui reste à lire, c’est ce qui passe ces deux contrôles, pas tout le flot. » |
| N0 docstring py/js + `doc.fr.yaml` (#5, #6) | « hidden in the form and left empty by every human being […] That is the bulk of the traffic, and no amount of reading the message would have caught it any better » | Même raison | « kept out of sight in the form, and the time spent on the page catch the scripts that post to the endpoint without rendering it, as long as they fill in every field or post faster than a person types. Neither needs to read the message. » |
| N0 commentaire BANNED (#9) | « Phrases that no customer of this form has ever written » | Test : « Géant Casino », « cryptographie » rejetés | « Whole words only, so `cryptographie` or a shop called `Casino` is not rejected. Every word on such a list is one a customer may write some day. » (la limite est écrite) |
| N1 docstring py + `doc.fr.yaml` (#22, #23, #24) | « the model learns the register rather than the vocabulary list » ; « They survive the spellings […] `b a c k l i n k s`, `backl1nks`, and they need no tokeniser that would have to be tuned per language » | INFIRMÉ (test) : `char_wb` ne forme aucun n-gramme à travers une espace ; « backl1nks » ne score pas plus qu’un mot neutre en JS ; segmenteur non testable | « This one scores the character fragments of a message, with weights learnt from labelled submissions […] Character n-grams rather than words, so `backlink`, `backlinks` and `backlinking` share most of their features. A word spelt out letter by letter, `b a c k l i n k s`, shares none: no n-gram crosses a space. » (documentation `char_wb`) |
| N1 docstring js + `doc.fr.yaml` (#29) | « is forty lines » | 48 lignes (test), 52 après réparation | « fit in this file, with no dependency » |
| N1 commentaire IDF js (#30) | « an n-gram every message carries says nothing » | IDF lissé : poids 1 (test) ; formule identique au guide scikit-learn | « Smoothed inverse document frequency, as scikit-learn computes it: an n-gram every message carries weighs one, a rarer one weighs more. » |
| N1 commentaire LogisticRegression py (#27, #31) | « because a real inbox holds far more spam than enquiries » ; « a few hundred examples with a heavy regulariser » | Proportion non sourcée ; l’effet de `C` est démontré sur 32 exemples ; `balanced` documenté : poids inversement proportionnels aux fréquences | « Balanced, so whichever class is rarer in your labels weighs as much as the other. `C` above one because, on a small labelled set, a heavy regulariser leaves every score sitting near a half » |
| N1 breaking_point fr/en (#22) | « Ce niveau apprend le registre des messages qu’on lui a montrés » | « registre » non testable | « Ce niveau pèse les fragments de caractères des messages qu’on lui a montrés » |
| N2 unavailable_reason (#40) | « un encodeur distillé […] pour un gain nul sur des messages courts et très typés, que N1 sépare déjà » | Gain non mesuré, niveau absent | « un encodeur auto-hébergé ajoute un modèle à télécharger et un service à exploiter, alors que N1 s’entraîne et répond dans le processus même du formulaire, sans aucune dépendance en JavaScript » |
| verdict_rationale (#23, #31, #56) | « la sollicitation qu’on reçoit vraiment » ; « comme il range « backl1nks » et « b a c k l i n k s » » ; « quelques centaines d’envois étiquetés, que la boîte de réception contient déjà » ; « écartent des scripts qu’aucune lecture du message n’écarterait mieux ; N3, lui, ne rattrape pas l’envoi que N1 rate » | INFIRMÉ pour les graphies ; volume et comportement du modèle non testables ; démontré (#21) : un script au pot de miel rempli, écrit comme un client, passe N1 | « parce qu’une sollicitation n’a pas besoin des mots de la liste de N0 » ; exemples de graphies retirés ; « des envois étiquetés, pris parmi ceux que la boîte de réception a déjà reçus, et on étiquette les envois ratés au lieu d’ajouter un mot » ; « écartent le script qui remplit le champ caché en écrivant comme un client, que N1 laisse passer. N3 ajoute un appel payé par envoi, et une invite sans parade. » |
| N3 docstring py/js + `doc.fr.yaml` (#45, #50) | « cap the input size, retry a provider that failed […] because the model itself is not testable » | Une réponse inutilisable est aussi redemandée, trois appels payés (test) ; l’entrée vide est désormais refusée | « refuse an empty or oversized input before paying for a call, ask again when the provider fails or answers something unusable, every attempt being billed, […] because a test against a double says nothing of how the model judges » |
| N3 commentaire température (#49) | « because a moderation decision that changes between two identical calls cannot be reviewed » (laissait croire que zéro l’empêche) | Kit `openai` 3.14.0 : « between 0 and 2 […] lower values like 0.2 will make it more focused and deterministic » | « Temperature zero, the low end of the range, which the provider documents as more focused and deterministic. It does not promise that two identical calls agree. » |
| further_reading, libellé Graham | « l’article fondateur du filtrage statistique » | L’article décrit une combinaison bayésienne des probabilités des mots ; « fondateur » est un jugement non sourcé | « le filtrage bayésien sur les mots » |
| Essai, cas 3 (#38) | « Le même démarchage, lettres espacées pour passer » | Le mot espacé n’apporte rien (0,97 / 0,96 / 0,98) : le reste du message classe | « Un démarchage au mot-clé espacé : le reste du message suffit » / « A solicitation with its keyword spaced out: the rest of the message is enough » |
| Essai, commentaire d’en-tête | « Ce barreau » ; « ce qu’un après-midi […] produit » ; « une quarantaine de millisecondes » | Vocabulaire ; durée non mesurée dans le dépôt | « Ce niveau n’existe qu’entraîné, et il ne pèse que les n-grammes des messages qu’on lui a montrés. Il y a donc deux modèles, un par corpus de trente-deux envois » |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N3 docstring py/js + `doc.fr.yaml` (#50) | « This is the option people reach for first » | Non sourcé |
| N0/N1 docstring (#5) | « That is the bulk of the traffic » | Non sourcé (voir Corrigé) |
| N0 `BANNED` | les mots seuls `casino`, `crypto` | Mots qu’un client écrit (enseigne, question sur un paiement) ; `online casino` remplace `casino` |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| n0.py / n0.js (#15) | « example.com » d’une adresse électronique compté comme un lien | Un domaine nu ne commence qu’un mot qui ne suit ni `@` ni un point (`(?<![\w@.-])`) ; un domaine à sous-domaines (`shop.example.com`) reste un lien |
| n0.py / n0.js (#17) | retour arrière quadratique de `\b[\w-]+\.` sur « a-a-a-… » | Même lookbehind : un seul point de départ par mot. Mesuré : 1 Mo de `a-`, `a.`, `-a`, `x@` en 90 à 145 ms (py), 10 à 40 ms (js) |
| n0.py / n0.js (#18) | phrase interdite trouvée dans un mot | `\b(…)s?\b`, groupe capturé (le motif rendu reste au singulier : « banned phrase: backlink » pour « BACKLINKS »). Limite écrite dans le commentaire ; conséquence : « guest posting » n’est plus attrapé |
| n0.py / n0.js (#16) | délai NaN accepté | `not seconds_on_page >= MINIMUM_SECONDS` / `!(secondsOnPage >= …)` : NaN (et `undefined` en JS) compte comme trop rapide |
| n1.py / n1.js (#35) | message vide tranché par le biais, en sens contraire selon le langage | Message vide ou blanc après repli : score 0 dans les deux langages |
| n1.js (#36) | entraînement dégénéré silencieux | `RangeError` si le nombre d’étiquettes diffère du nombre de messages, ou s’il n’y a pas deux classes (jeu vide compris), comme le `ValueError` de scikit-learn |
| n3.py / n3.js (#48) | client par défaut sans méthode `complete` | Adaptateur commun `ProviderClient` / `providerClient`, construit après les refus d’entrée (une entrée vide ou trop longue ne demande ni clé ni kit) |
| n3.py / n3.js | `message.content` à `None`/`null` passé à `json.loads`/`JSON.parse` | `_parse`/`parse` : une réponse qui n’est pas une chaîne est inutilisable, explicitement ; `JSON` invalide ou sans booléen `spam` aussi |
| n3.py / n3.js (#46) | clôture ```json non décodée | Clôture retirée avant décodage |
| n3.py (#47) | raison `null` → « None » | `""` quand la raison est absente ou nulle, comme en JS |
| n3.py / n3.js (#52) | envoi vide ou blanc : un appel payé | `ValueError` / `RangeError` avant tout appel |
| n3.js (#44) | plafond compté en unités UTF-16, divergent du Python | Compté en points de code (`[...message].length`) |
| n3.py | `json.loads` sur une réponse très imbriquée : `RecursionError` hors du réessai | attrapée avec `ValueError` |

Marquages retirés (assertions inchangées) : n0 — 4 `DÉFAUT` py, 4 js ; n1 — 1
`DÉFAUT` py, 1 js ; n3 — 4 `DÉFAUT` py, 3 js.

Lignes utiles : n0.py 26, n0.js 21, n1.py 21, n1.js 52, n3.py 55 (41 hors
adaptateur), n3.js 59 (42 hors adaptateur).

Dépassements justifiés : **n1.js** (52) écrit à la main le TF-IDF et la
régression logistique, faute de bibliothèque en JavaScript, et c’est
l’argument même du niveau ; il était à 48 avant ce tour, la garde
d’entraînement et celle du message vide en ajoutent 4. **n3.py** (41) et
**n3.js** (42) : le dépassement vient du traitement explicite d’un contenu nul
et de la clôture de code, exigés par la consigne.

## Sources consultées

- Ned Batchelder, *Stopping spambots with hashes and honeypots* : « Honeypot fields are invisible fields on the form » ; les robots « will put data into honeypot fields because they don't know any better ». Rien sur le remplissage automatique des navigateurs. Libellé conforme.
- Paul Graham, *A Plan for Spam* : « a Bayesian combination of the spam probabilities of individual words ». Libellé corrigé.
- scikit-learn, `TfidfVectorizer` : « Option 'char_wb' creates character n-grams only from text inside word boundaries; n-grams at the edges of words are padded with space » ; `sublinear_tf` « replace tf with 1 + log(tf) » ; guide *Feature extraction* : idf(t) = log((1 + n) / (1 + df(t))) + 1 avec `smooth_idf`.
- scikit-learn, `LogisticRegression` : `class_weight="balanced"` « n_samples / (n_classes * np.bincount(y)) » ; `C` « smaller values specify stronger regularization ».
- OWASP GenAI, *LLM01 Prompt Injection* : « Direct prompt injections occur when a user's prompt input directly alters the behavior of the model ». Libellé conforme.
- Kit `openai` 3.14.0 (installé dans le bac à sable) : `temperature` « between 0 and 2 […] more focused and deterministic » ; `ChatCompletionMessage.content: Optional[str]`, `refusal: Optional[str]` ; `gpt-4.1-mini` présent dans `ChatModel`.
- Tarifs OpenAI (developers.openai.com/api/docs/pricing, via recherche) : gpt-4.1-mini à 0,40 $ le million de jetons d’entrée et 1,60 $ en sortie. Pour une invite d’environ 150 jetons et une réponse de 20, environ 90 $ par million d’envois : de l’ordre de la centaine, `cost: élevé` tient. Aucun prix n’entre dans la fiche.
- Latence mesurée sur la machine de test, une décision sur un envoi : N0 ≈ 0,0015 ms (js) ; N1 ≈ 0,32 ms (py), 0,06 ms (js). `<1 ms` tient pour les deux. N3 `~1 s` : non mesurable ici (appel réseau), classe conservée.

## À retester

- **Adaptateur N3** : le tester avec les doubles à la forme du vrai kit, `content/snippets/_harness/fake_sdk.py` et `fake-sdk.mjs` (`chat.completions.create`, `choices[0].message.content`) : requête (`model`, `messages[0].content` = l’invite, `temperature: 0`), contenu `None`/`null` → `ClassificationUnavailable` après trois appels, panne `fail_times`.
- **n3 `le client par défaut échoue en service indisponible sans appel` (py/js), rouge** : décrit l’ancien défaut ; le client par défaut rend désormais le verdict (le test démarqué le montre). À retirer ou retourner.
- **n3.js `production : constat, le plafond compte en unités UTF-16`, rouge** : le plafond compte en points de code ; 2 001 emoji passent désormais, comme en Python.
- **n0 `un rejet vient avec ses motifs…` (py/js), rouge** : `casino` et `crypto` seuls ne sont plus dans la liste ; reprendre avec `online casino`, `viagra`. Ajouter : « guest posting » n’est plus attrapé (limite des mots entiers), « BACKLINKS » rend « banned phrase: backlink », un domaine à sous-domaines compte comme un lien, NaN et `undefined` (js) comptent comme trop rapides, entrées `a.a.a…`, `x@x@…`, `-a-a…` d’un mégaoctet bornées en temps.
- **n1.js `INFIRMÉ : … « is forty lines »`, rouge** : la phrase est retirée ; le test attend 48 lignes, il y en a 52.
- **n1.js `DÉFAUT : un entraînement dégénéré ne lève pas`, rouge** : ses lignes d’avant l’enveloppe appellent `train([], [])`, qui lève désormais ; le marquage n’a pas pu être retiré sans toucher au corps. Tester aussi des étiquettes de longueur différente.
- **n1 `INFIRMÉ : les graphies contournées survivent` (py/js) et n1.js `INFIRMÉ : un n-gramme que tout message porte « says nothing »`** : encore verts, mais les affirmations sont retirées ou réécrites. Retourner en démonstrations des nouvelles phrases : « backlink », « backlinks », « backlinking » partagent l’essentiel de leurs traits et « b a c k l i n k s » aucun (py, `char_wb`) ; un n-gramme présent partout pèse 1 (js).
- n1 : message blanc ou vide → score 0 (py/js) ; nouveau commentaire `balanced`.
- n3 : clôture ```json et ``` sans langage décodées (py/js) ; envoi vide → `ValueError`/`RangeError` sans construire le client par défaut ; réponse `"[[[[…"` très imbriquée → `ClassificationUnavailable` (py).
- **Noms des tests démarqués** : suite du nom décrivant encore le défaut (« des adresses électroniques comptent comme des liens », « un délai NaN passe le contrôle de vitesse », `test_defaut_…` en Python…), et docstring de `test_production_un_entrainement_degenere_leve` (« le JavaScript, non : DÉFAUT côté js »).
- Essai : libellé du cas 3 changé (fr/en).

## Pour l'orchestrateur

- `check-figures` échoue sur `content/snippets/search-in-your-own-documents/n0.js:33` (`'$1'` lu comme un prix) : fiche d’un autre rédacteur, et probablement un faux positif du script sur une référence de groupe d’expression régulière.
- n1.js dépasse la limite des quarante lignes (52), justifié ci-dessus ; à trancher si la charte doit prévoir une exception pour un algorithme écrit à la main faute de bibliothèque standard.
- Les classes `\w` et `\b` diffèrent entre Python (Unicode) et JavaScript (ASCII) dans N0 ; sans effet sur les tests actuels, le message étant replié sans accents, mais un domaine précédé d’une lettre non latine ne se comporte pas pareil. Non réparé : il faudrait écrire les classes à la main dans les deux motifs pour un cas (un domaine collé à une lettre non latine) qui ne change pas la décision sur un envoi réel observé dans les tests.
