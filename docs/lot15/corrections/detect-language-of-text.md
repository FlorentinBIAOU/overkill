# detect-language-of-text — corrections du rédacteur (tour 1)

## Corrigé

| Où | Ce que disait la fiche | Ce qui a été vérifié | Ce qu'elle dit désormais |
|---|---|---|---|
| N0 breaking_point (fr, en) | « chat » ressort en anglais, « ses quatre trigrammes étant ceux que l'anglais emploie dans « that » et « what » » (relevé 2) | « ␣ch », « cha », « hat », « at␣ » : seuls les deux derniers sont dans le profil anglais, aucun dans les profils français et espagnol ; « what » n'est pas dans l'échantillon, « that » et « at » y sont | « de ses quatre trigrammes, les deux derniers figurent dans le profil anglais, qui les tient de « that » et de « at », et aucun ne figure dans les profils français et espagnol » |
| essai, why du cas « chat » (fr, en) | même phrase (relevé 82) | idem | « dont deux, « hat » et « at », que l'échantillon anglais emploie dans « that » et « at », et qu'aucun des deux autres n'emploie » |
| N0 docstring d'en-tête (py, js, fr) | « Chaque langue répète ses propres trigrammes » (relevé 7) | « que » est au rang 34 en espagnol et 37 en français, « ent » au rang 17 en espagnol : ce ne sont pas des trigrammes propres | « Chaque langue emploie certains trigrammes bien plus que d'autres » |
| N0 docstring d'en-tête (py, js, fr) | « Un rang survit sans changer à un échantillon quatre fois plus long, et à un texte quatre fois plus court » (relevé 9) | vrai seulement pour le même texte répété ; un échantillon différent et plus long change les rangs | « Un compte grandit avec la longueur du texte, un rang non : le même texte répété quatre fois garde tous ses rangs. Et la distance est divisée par le nombre de trigrammes… » |
| N0 docstring d'en-tête (py, js, fr) | « L'idée est plus vieille que la plupart du domaine » | invérifiable tel quel | « L'idée vient de Cavnar et Trenkle, en 1994 » (article lu, SDAIR-94) |
| N1 docstring d'en-tête (py, js, fr) | « Les mêmes traits qu'en N0, un à trois caractères » (relevé 30) | N0 ne prend que des trigrammes de lettres ; N1 prend des n-grammes d'un à trois caractères, ponctuation comprise | « Des traits voisins de ceux de N0, des n-grammes d'un à trois caractères découpés aux frontières des mots » |
| N1 docstring d'en-tête js (fr) | « un bayésien naïf multinomial, c'est trente lignes de comptage » (relevé 40) | 44 lignes de code non vides dans n1.js | « n'est que du comptage, et tient dans ce fichier » |
| verdict_rationale (fr, en) | « son seuil vous protège des textes courts et de rien d'autre » ; « Montez à N1 le jour où vous devez répondre sur un ou deux mots » (relevés 76, 77) | « chat » passe à P(en) = 0,999997 au seuil 0,9 ; le seuil s'abstient sur « ça va » | « Montez à N1 le jour où vous voulez un seuil exprimé en probabilité plutôt qu'en écart de rang, en sachant qu'il s'abstient sur « ça va » mais laisse passer « chat » en anglais au-dessus du seuil, et qu'il ne connaît que les langues apprises » |
| N3 breaking_point (fr, en) | « l'extrait valide la forme, la trouve parfaite, et rend le mauvais code » (relevé 52) | l'extrait ne lit que `language` ; `confidence` absente ou textuelle passe | la confiance n'est plus demandée au modèle (voir Code réparé) ; « Une confiance écrite par le modèle n'est pas mesurée, et l'extrait n'en lit aucune. Le test lui fait répondre « es » […] assorti d'une confiance de 0,99 puis de 0,01 : le code est dans la liste, l'extrait le rend les deux fois » |
| N3 commentaire de normalisation (py, js) | « Models answer "fr", "FR", "fr-CA" and "French" for the same thing » (relevé 59) | « French » et « fr_CA » levaient ; et ce que les modèles écrivent n'est pas testable | « "fr", "FR", "fr-CA" and the locale form "fr_CA" are all read as "fr". A language name such as "French" is not a code, and is refused below » ; le code lit désormais « fr_CA » |
| N3 docstring d'en-tête (py, js, fr) | « normalise a code the model may write in half a dozen ways » | décompte non sourcé | « normalise a code the model may write in capitals, with a region or with stray spaces » |
| N3 commentaire d'`EXCERPT_CHARACTERS` (py, js) | « A language is decided in the first few sentences » (relevé 55) | affirmation sur le modèle, non testable | « N0 and N1 already name the language of a single sentence, and the model bills every token past it » (démontré par les tests N0 et N1 sur une phrase) |
| N2 unavailable_reason (fr, en) | « ne se distingue de N1 qu'en dessous de quelques dizaines de caractères » ; « tranchent mieux que n'importe quel modèle » (relevé 80) | aucune source, aucune mesure | le modèle de fastText, sourcé : 176 langues, poids entraînés sur Wikipédia, Tatoeba et SETimes, licence CC BY-SA 3.0 ; la raison dite est l'artefact tiers et sa licence, face à un paragraphe par langue pour N0 et N1 |

## Retiré

| Où | Ce que disait la fiche | Pourquoi |
|---|---|---|
| N1 docstring d'en-tête py (fr) | « et une fraction de seconde » (relevé 38) | chiffre de durée ni publiable ni sourcé |
| N3 prompt (py, js) | la clé `confidence` demandée au modèle | l'extrait ne l'a jamais lue : un champ payé au jeton, et une validation qui aurait fait échouer trois fois une réponse utilisable |

## Code réparé

| Extrait | Défaut | Réparation |
|---|---|---|
| N3 py, js | client par défaut `OpenAI()` sans méthode `complete` (relevé 62) | adaptateur imposé `ProviderClient` / `providerClient`, repris tel quel, `client = client or ProviderClient()` / `client ??= await providerClient()` ; le défaut n'est construit qu'après les contrôles d'entrée |
| N3 py, js | `message.content` à `null` passé à `json.loads` / `JSON.parse` | une réponse qui n'est pas une chaîne est traitée comme inutilisable, sans passer par l'analyse JSON |
| N3 py, js | un texte vide ou blanc coûtait un appel (relevé 68) | rend `None` / `null` sans appel |
| N3 js | extrait et plafond comptés en unités UTF-16 : emoji coupé en deux, 5 000 emoji refusés (relevés 69, 70) | comptage et découpe par caractère (`[...text]`), comme en Python |
| N3 py, js | « fr_CA » refusé | le tiret bas est lu comme un tiret avant de garder la langue |

## Sources consultées

- Cavnar & Trenkle, *N-Gram-Based Text Categorization*, https://www.let.rug.nl/vannoord/TextCat/textcat.pdf (lu : distance « out-of-place », pénalité maximale pour un n-gramme absent, mots bordés de blancs, profils d'environ 300 n-grammes) ; année et conférence (SDAIR-94, 1994) confirmées par une recherche web (notices OSTI et BibSonomy dans les résultats, non ouvertes).
- fastText, Language identification, https://fasttext.cc/docs/en/language-identification.html : 176 langues, données Wikipedia, Tatoeba et SETimes, licence CC BY-SA 3.0.
- RFC 5646, https://www.rfc-editor.org/rfc/rfc5646.html : sous-étiquettes séparées par un tiret seulement ; « fr_CA » n'est pas une étiquette BCP 47, d'où « the locale form ».
- scikit-learn, Naive Bayes, https://scikit-learn.org/stable/modules/naive_bayes.html : `MultinomialNB`, lissage `alpha` (Lidstone sous 1).
- Tarifs OpenAI, https://developers.openai.com/api/docs/pricing : gpt-4.1-mini, 0,40 $ le million de jetons en entrée, 1,60 $ en sortie. Un appel porte quelques centaines de jetons en entrée (consigne et 600 caractères) et une dizaine en sortie : de l'ordre de la centaine par million d'appels, `cost: élevé` est cohérent avec la charte.

## À retester

- Tests encore marqués, dont l'affirmation a été corrigée et non rendue vraie telle qu'écrite : à réécrire sur la nouvelle phrase, puis démarquer.
  - N0 (py, js) `test_infirme_les_quatre_trigrammes_de_chat_sont_dans_le_profil_anglais` : démontrer « les deux derniers dans le profil anglais, aucun dans les profils français et espagnol ».
  - N1 (py, js) `test_infirme_le_seuil_de_n1_protege_des_textes_courts` : démontrer la nouvelle phrase du verdict (abstention sur « ça va », « chat » en anglais au-dessus du seuil).
  - N3 (py, js) `test_infirme_l_extrait_valide_la_forme_de_la_reponse_confiance_comprise` : la fiche ne dit plus que la forme est validée ; démontrer que le prompt ne demande plus de confiance et qu'une confiance fournie n'est pas lue.
  - N3 (py, js) `test_infirme_french_et_fr_ca_sont_normalises_en_fr` : scinder, « fr_CA » rend « fr », « French » lève `DetectionUnavailable`.
  - N3 (py, js) `test_defaut_le_client_par_defaut_a_la_forme_du_vrai_kit` : le double `RealShapedClient` doit passer par l'adaptateur, `detect(…, client=ProviderClient(sdk=RealShapedClient(…)))` / `providerClient(new RealShapedClient(…))`, et vérifier `model`, `messages[0].content`, `temperature == 0`, la lecture de `choices[0].message.content` ; plus un cas où `content` vaut `None`/`null` (refus) qui lève `DetectionUnavailable` après les essais.
- Noms démarqués qui ne disent plus ce qu'ils prouvent : `test_defaut_un_texte_vide_ne_coute_aucun_appel` (py) ; en js « un texte vide coûte un appel », « un emoji à la frontière de l'extrait est coupé en deux », « cinq mille emoji comptent pour dix mille caractères et sont refusés », avec leurs commentaires (« slice compte en unités UTF-16 », « text.length compte les unités UTF-16 »).
- Nouveaux cas : texte fait seulement d'espaces insécables ou de largeur nulle (`str.strip` et `String.prototype.trim` ne retirent pas exactement les mêmes caractères : U+FEFF est retiré par `trim` seulement) ; texte de 8 001 caractères blancs (refusé avant le test de blancheur, dans les deux langages).

## Pour l'orchestrateur

- L'adaptateur imposé porte n3.py à 55 lignes utiles et n3.js à 64, au-delà des quarante de la charte des extraits. n3.js en comptait déjà 47 avant ce lot. La charte devrait dire si l'adaptateur commun compte dans la limite.
- N2 reste indisponible, mais la raison est désormais sourcée et dit ce qu'un modèle dédié apporte : il reconnaît les langues sans échantillon, ce qui est exactement l'`escalate_when` de N1. Un relecteur peut juger qu'un extrait N2 fondé sur fastText serait le bon niveau suivant ; il demanderait `fasttext` dans `requirements-snippets.txt` et un modèle téléchargé, que la charte (hors ligne) ne permet pas en test sans double.
- La boucle de réessai N3 attrape toute exception : une erreur de programmation dans un client injecté reste déguisée en `DetectionUnavailable` après trois appels. Gardé tel quel, les tests de panne s'appuyant sur l'exception générique du double.
