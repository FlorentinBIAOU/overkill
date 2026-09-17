# Lot 15 — synthèse des avis du relecteur, tour 1

Vingt-cinq fiches relues dans l'ordre du catalogue (tri sur le titre anglais).
Le détail, les exécutions et ce qu'il faut faire sont dans
`docs/lot15/avis/<id>.md`. Ce document donne le résultat, les motifs classés
par nature, et surtout **ce qui revient d'une fiche à l'autre** : c'est la
partie destinée à la charte de rédaction et à la charte des tests.

**Une fiche acceptée, vingt-quatre refusées.** Le chiffre est sévère ; il ne
vient pas du style. Dix-sept refus reposent sur au moins un défaut **exécuté et
reproduit** pendant la relecture — une sortie fausse sur une entrée ordinaire,
un verdict contredit par les données de la fiche, une suite rouge. Cinq
reposent sur un fait vérifié à la source sans exécution possible ici (langue
ou licence d'un modèle, point d'accès d'un fournisseur, plafond contredit par
le verdict, point de contrôle inexistant). Deux ne reposent que sur les
preuves : marquages `INFIRMÉ` / `DÉFAUT` laissés actifs, adaptateur N3 jamais
exécuté par un test. Trois fiches sur le fond solide (`route-support-tickets`,
`search-in-your-own-documents`, `show-similar-articles`) ont d'abord reçu un
avis favorable, retourné quand le relevé systématique des marquages a été
fait : la consigne du relecteur range un marquage oublié parmi les motifs de
refus, et `search-in-your-own-documents` en portait deux qui décrivent des
bugs toujours présents.

État de la suite au moment de la relecture : `tag-articles-by-topic` et
`translate-interface-strings` sont **rouges** sur la machine de travail, à
cause de tests chronométrés trop serrés (voir motif A4).

---

## 1. Les vingt-cinq fiches

| # | Fiche | Verdict de la fiche | Avis | Motifs du refus, en une ligne chacun |
|---|---|---|---|---|
| 1 | add-autocomplete-to-a-search-bar | N0 | REFUSÉE | Un seul clic, sous n'importe quelle saisie, place un terme en tête de tous les préfixes (N1 dit l'inverse) · point de rupture de N1 recopié de N0 · « Fold case » faux sur « ẞ », marquage actif |
| 2 | detect-language-of-text | N0 | REFUSÉE | Le verdict vante l'écart de N0 pour se taire, or « chat » sort anglais avec un écart de 142 sur 300 · N2 écarté sur une raison de licence qui ne tient pas, le lecteur multilingue est envoyé à N3 · N3 lève au-delà de 8 000 caractères alors qu'il n'en envoie que 600 |
| 3 | extract-dates-from-text | N0 | REFUSÉE | Mois abrégés (« 3 janv. 2024 », « Mar 3, 2024 ») jamais trouvés, absents du point de rupture · N1 lit deux dates du même document selon deux conventions · dates relatives envoyées à N3 sans nommer les analyseurs déterministes, et résolues contre la date du jour au lieu de celle du document · deux défauts marqués toujours vivants |
| 4 | extract-fields-from-invoice | N2 | REFUSÉE, reste brouillon | Réforme de la facturation électronique (septembre 2026) ignorée : lire le XML passe avant toute extraction · N2 ne peut pas tourner (pipeline, boîtes fabriquées, licence non commerciale) · point de rupture de N2 écrit par le double · marquages |
| 5 | find-duplicate-records | N0 | REFUSÉE | Enregistrement comparé en bloc : un champ vide d'un côté ou des colonnes dans un autre ordre, et aucun doublon n'est trouvé · N2 « ne coûte pas la comparaison » alors que mille fiches prennent 16,6 s · la réponse à une clé qui rate est une seconde clé, pas N1 · marquage périmé |
| 6 | forecast-weekly-sales | N1 | REFUSÉE | Sur le concurrent qui ouvre (données du test), N1 se trompe de 28 %, N0 de 3 % : le verdict dit l'inverse · la série « vérité » est construite dans la forme exacte du modèle N1 |
| 7 | mask-personal-data-in-chat | N0 | REFUSÉE | Numéros belges, britanniques et « 0033 » jamais masqués, le point de rupture parle d'obfuscation · titre anglais « personal data » pour un besoin « coordonnées » · N1 ne masque rien, il bloque le message, sans le dire · date masquée en IBAN et clôture JSON non décodée, marqués |
| 8 | fuzzy-match-company-names | N0 | REFUSÉE | « Pharmacie de la Gare » et « Pharmacie de la Mairie » à 0,963, « Ets Martin » sous le seuil : le point de rupture ne parle que des sigles · SIREN et répertoire Sirene (qui porte le sigle) jamais évoqués · N2 disponible avec un point de rupture « non mesuré » · deux défauts marqués vivants |
| 9 | moderate-user-comments | N2 | REFUSÉE | Modèle N2 entraîné sur de l'anglais seulement, sur un site francophone · N3 facture un modèle de conversation là où le fournisseur d'exemple a un point de modération gratuit, et n'emploie pas la catégorie sur mesure qui le justifierait · quatre défauts marqués vivants |
| 10 | parse-address-into-fields | N1 | REFUSÉE | N1 casse « 15 rue Victor Hugo 92100 Boulogne-Billancourt », « 10 bd Saint-Michel », que N0 lit juste · le géocodeur public national, gratuit et qui valide, est absent de l'échelle · commentaire « 6 × 38 » contre un plafond de 300, marqué · adaptateur N3 non testé |
| 11 | generate-placeholder-images | N0 | **ACCEPTÉE** | — |
| 12 | generate-test-data | N0 | REFUSÉE | FNV-1a sans finalisation : deux colonnes à deux valeurs parfaitement anticorrélées, alternance stricte, période 4 ; le point de rupture de N1 est mesuré sur ce biais |
| 13 | rank-products-by-relevance | N0 | REFUSÉE | N1 apprend des produits jamais vus sous le clic (biais de position, contraire à l'article cité) · une marge négative fait tomber toute la page · quatre défauts marqués vivants |
| 14 | read-text-from-a-scanned-page | N2 | REFUSÉE | Le lecteur PDF écrit à la main ne lit pas un export LibreOffice, le cas même du scénario · point de rupture de 230 mots · marquages périmés · adaptateur N3 non testé |
| 15 | route-support-tickets | N1 | REFUSÉE | Quatre marquages périmés · adaptateur N3 non testé (le fond est bon) |
| 16 | search-in-your-own-documents | N0 | REFUSÉE | N3 décode une clôture non refermée et la prose qui suit · `n2.js` met en cache un vecteur `NaN` avant de le vérifier, la page devient introuvable jusqu'au redémarrage · les deux marqués |
| 17 | show-similar-articles | N1 | REFUSÉE | Neuf marquages périmés (le fond est bon) |
| 18 | detect-anomalies-in-metrics | N0 | REFUSÉE | Aux réglages par défaut, une métrique saine sonne une dizaine de fois par jour, mesuré par le test et tu par la fiche · l'exemple qui justifie N1 est aussi attrapé par N0 · marquages |
| 19 | detect-spam-in-contact-form | N1 | REFUSÉE | Le délai de soumission n'est un contrôle que s'il est horodaté et signé par le serveur, rien ne le dit · marquages périmés · adaptateur N3 non testé |
| 20 | summarise-a-long-document | N3 | REFUSÉE | Le verdict dit que N3 évite la découpe, N3 lève au-delà de 40 000 caractères · modèle N2 anglais seulement · marquages · adaptateur non testé |
| 21 | tag-articles-by-topic | N1 | REFUSÉE | Suite rouge (borne de 1 ms, 1,08 ms mesuré) · l'article à trois thèmes ressort sans étiquette au niveau recommandé, hors du point de rupture · marquages décoratifs · adaptateur non testé |
| 22 | translate-interface-strings | N2 | REFUSÉE | La correspondance exacte est cherchée dans la boucle floue : 106 ms pour une chaîne inchangée, sur le cas majoritaire · suite rouge (borne serrée) · marquages · adaptateur non testé |
| 23 | convert-messy-csv-to-clean-data | N0 | REFUSÉE | « 1,234 » rendu 1,234 et « 12,500 » rendu 12,5, sans ligne au journal : ce que le scénario reproche au modèle · marquages périmés · adaptateur non testé |
| 24 | validate-a-form-server-side | N0 | REFUSÉE | Un défaut réparable (blancs de bord non retirés) présenté comme une limite de l'approche · parité des motifs documentée mais marquée, et le conseil `[A-Za-z]` refuse « Zoé » |
| 25 | write-product-descriptions | N3 | REFUSÉE | Le non-déterminisme compté comme prix permanent alors qu'une description se génère une fois et se stocke · N2 pointe vers un point de contrôle inexistant, sans modèle de départ nommé · marquages · adaptateur non testé |

---

## 2. Les motifs, classés par nature

Chaque motif renvoie aux fiches où il a été relevé. Le nombre entre
parenthèses est le nombre de fiches.

### A. Les preuves ne prouvent pas ce qu'elles semblent prouver

- **A1. Marquages `INFIRMÉ` / `DÉFAUT` laissés actifs** (21). 122 tests
  marqués au total, relevés par un script sur les dossiers d'extraits. Deux
  espèces très différentes sous le même marquage :
  - **périmés** : la phrase fausse a été corrigée ou retirée, le test vise
    encore l'ancienne (route-support ×4, show-similar ×9, csv ×6, spam ×2…) ;
  - **vivants** : le défaut est toujours dans le code (search-in-your-own-documents,
    mask, moderate, fuzzy, rank, extract-dates, autocomplete, parse-address).
  Un `xfail(strict=True)` passe dès que le corps lève, pour n'importe quelle
  raison : `tag-articles-by-topic/n3` passe le double du kit directement à
  `tag()`, qui lève faute de méthode `complete`, et le marquage « passe » sans
  rien démontrer.
- **A2. L'adaptateur N3 n'est exécuté par aucun test** (10 des 16 fiches à N3 :
  csv, spam, invoice, parse-address, read-text, route-support, summarise,
  tag-articles, translate, write-product). La décision 5 du lot a créé
  l'adaptateur précisément parce qu'aucun test ne voyait que le client par
  défaut n'existait pas ; dans ces dix fiches, c'est toujours vrai de
  l'adaptateur.
- **A3. Données de test construites dans la forme du modèle** (forecast). La
  série « vérité » est une droite plus deux harmoniques : le test prouve que
  les moindres carrés retrouvent leurs propres coefficients.
- **A4. Bornes de temps serrées** (tag-articles, translate). Marges de deux et
  trois quand la charte en demande dix : deux suites rouges au premier
  processus voisin.
- **A5. Un point de rupture écrit par le double sur un niveau qui ne tourne
  pas, ou « non mesuré » sur un niveau disponible** (invoice N2, fuzzy N2).

### B. Sortie fausse et silencieuse sur une entrée ordinaire

Le défaut le plus grave, parce que c'est celui que le site reproche aux
modèles : une valeur devinée qui ressemble à une valeur lue.

- csv : `12,500` → 12,5 ;
- find-duplicates : colonnes dans un autre ordre, ou un champ vide d'un côté → aucun doublon ;
- generate-test-data : colonnes « indépendantes » parfaitement anticorrélées ;
- mask : numéro belge ou `0033` non masqué ;
- extract-dates : `3 janv. 2024` introuvable ;
- extract-dates N1 : deux conventions dans le même document ;
- parse-address N1 : `Boulogne-Billancourt` coupé en complément et ville ;
- tag-articles N1 : l'article à plusieurs thèmes sans aucune étiquette ;
- fuzzy : deux pharmacies d'une même ville rapprochées à 0,96 ;
- autocomplete N1 : un clic de robot renverse un classement ;
- rank N1 : apprentissage sur des produits jamais vus.

### C. Le point de rupture cite l'exotique, l'ordinaire casse avant

(8) extract-dates (dates relatives citées, mois abrégés tus), mask
(obfuscation citée, numéros étrangers tus), fuzzy (sigles cités, métier en
tête tu), autocomplete (faute de frappe citée, deuxième mot tu), parse-address
(adresses étrangères citées, rue à nom de personne tue), tag-articles (thème
non étiqueté cité, article multi-thèmes tu), read-text (police renumérotée
citée, export de traitement de texte tu), csv (dates citées, virgule décimale
tue).

### D. L'échelle ignore l'outil standard que le lecteur a sous la main

(10) Le site oppose « code simple » et « appel de modèle » ; le concurrent réel
est souvent une bibliothèque, un service public ou une donnée structurée,
déterministe et gratuite.

| Fiche | Outil absent de l'échelle |
|---|---|
| extract-dates | analyseurs de dates relatives (`dateparser`, vérifié) |
| detect-language | identifiants de langue dédiés locaux (fastText, CLD3, lingua) |
| find-duplicates | plusieurs règles de blocage (Splink, pourtant cité) |
| fuzzy-match | SIREN, répertoire Sirene et son champ sigle |
| parse-address | géocodeur public national |
| extract-fields-from-invoice | Factur-X / UBL / CII, obligatoires en réception depuis septembre 2026 |
| forecast | lissage exponentiel Holt-Winters |
| moderate | point d'accès de modération gratuit du fournisseur d'exemple |
| read-text | bibliothèque PDF (pypdf, pdfminer.six, pdftotext) |
| spam | défis anti-robots gérés (écartables, mais à écarter en le disant) |

### E. Le verdict est contredit par les données de la fiche

(7) forecast (N1 pire que N0 sur la rupture du test), detect-language (N0 aussi
confiant que N1 sur « chat »), anomalies (l'exemple de N1 attrapé par N0),
parse-address (N1 régresse sur le cas nominal), summarise (« pas de découpe »
contre un plafond de 40 000 caractères), write-product (non-déterminisme
compté alors que la copie se stocke), autocomplete (« safe on a thin log »).

### F. Modèle nommé inadapté au public ou inexistant

(5) moderate N2 et summarise N2 : modèles anglais sur un site francophone ;
invoice N2 : licence non commerciale ; write-product N2 : point de contrôle
local inexistant, modèle de départ non nommé ; invoice N2 : ne tourne pas.

### G. Production : plafonds, données sales, confiance

- **Plafond qui lève là où il faudrait dégrader** (4) : detect-language N3
  (8 000 caractères, 600 envoyés), summarise N3 (40 000), route-support N3
  (4 000, un ticket n'arrive nulle part), extract-dates N3 (8 000, un contrat).
- **Une donnée sale fait échouer le lot** (1) : rank, une marge négative et la
  page de catégorie tombe.
- **Contrôle de sécurité fondé sur une valeur que le client fournit** (1) :
  spam, délai de soumission.
- **Défaut de production vivant dans un chemin chaud** (3) : search N2 (cache
  empoisonné), translate N0 (exact cherché dans la boucle floue), find-duplicates
  N2 (quadratique en Python pur).
- **Réglages par défaut jamais mesurés en conditions d'exploitation** (1) :
  anomalies, une dizaine de fausses alertes par jour par métrique.

### H. Style

- **Points de rupture trop longs** : 68 des 74 `breaking_point` français
  dépassent 60 mots, 22 dépassent 100, le plus long en fait 230
  (read-text N0). La charte demande « une ou deux phrases ».
- **Défaut réparable présenté comme limite de l'approche** : validate (blancs
  de bord).
- **Relative qui inverse le sens du verdict** : validate (« ce qui est
  exactement ce qu'on demande à une validation »).
- **Titre anglais qui promet plus que le besoin** : mask (« personal data »
  pour « coordonnées »).
- **Deux chiffres différents pour la même chose à une phrase d'écart** :
  write-product (douze motifs, seize formulations).
- **Sources vérifiées au dossier de corrections, absentes de la fiche** :
  show-similar, translate.

---

## 3. Ce qui revient d'une fiche à l'autre — à verser dans les chartes

Classé par ordre d'importance. Chaque règle est formulée pour qu'un agent qui
écrit la fiche 26 puisse l'appliquer sans avoir lu ces avis, et chacune porte
l'exemple réel qui l'a fait naître.

### Pour la charte de rédaction

**R1. Passez l'extrait sur l'entrée ordinaire de votre lecteur avant d'écrire
le point de rupture.** Le point de rupture est la **première** chose qui casse
sur des données réelles, pas la plus élégante. Avant de rédiger, exécutez le
niveau sur une dizaine d'entrées que la population visée produit tous les
jours, et notez ce qui sort. Pour un public francophone : une ville à trait
d'union, une rue au nom d'une personne, un montant au format anglais, un
numéro de téléphone étranger, un mois abrégé, un nom de société qui commence
par son métier. Exemples de ce lot : `mask` cite l'obfuscation et laisse
passer `+32 470 12 34 56` ; `fuzzy-match` cite SNCF et rapproche deux
pharmacies ; `extract-dates` cite « jeudi prochain » et manque `3 janv. 2024`.

**R2. Une sortie fausse et silencieuse sur une entrée ordinaire se corrige, ou
se dit en premier.** Jamais en dernier, jamais pas du tout. Le site reproche
aux modèles de rendre une valeur devinée qui ressemble à une valeur lue ; un
niveau N0 qui fait pareil perd l'argument. Exemple : `convert-messy-csv`
promet un journal de tout ce qui n'a pas pu être lu, et rend `12,500` en
`12.5` sans une ligne. Règle pratique : toute ambiguïté que le code tranche
seul (séparateur décimal, ordre jour-mois, casse, fuseau) est soit déclarée
par l'appelant, soit rejetée au journal.

**R3. Nommez l'outil standard avant d'en écrire un, et mettez-le dans
l'échelle.** Le concurrent réel d'un appel de modèle est rarement « du code à
la main » : c'est une bibliothèque, un service public, un identifiant ou une
donnée structurée. Pour chaque fiche, répondez par écrit à : « qu'est-ce qu'un
développeur expérimenté brancherait en premier ? ». Si c'est un outil
existant, il est un niveau, ou il est écarté avec une raison **mesurée**.
Exemples : `extract-fields-from-invoice` ignore Factur-X alors que la
réception électronique est obligatoire depuis septembre 2026 ;
`parse-address` ignore le géocodeur public ; `fuzzy-match` ignore le SIREN ;
`read-text` écrit un lecteur PDF de 180 lignes qu'un export LibreOffice met en
échec, là où `pdftotext` lit juste.

**R4. Confrontez le verdict aux données de la fiche elle-même.** Pour un
verdict qui préfère un niveau à celui du dessous, écrivez le test qui fait
tourner **les deux** sur le point de rupture du niveau recommandé, et publiez
ce que ce test montre. Ne reprochez pas à un niveau un échec que le niveau
recommandé partage. Exemples : `forecast` recommande N1 « parce qu'il suit
l'activité qui bouge » quand ses propres données donnent N1 à +28 % et N0 à
−3 % sur un concurrent qui ouvre ; `detect-language` reproche à N1 de rendre
« chat » en anglais, ce que N0 fait avec un écart maximal.

**R5. Ne présentez pas un défaut réparable comme une limite de l'approche.** Si
une ligne de code règle le cas, c'est un bug, pas un point de rupture.
Exemple : `validate-a-form` cite « un pseudonyme de deux espaces » comme ce
qu'« aucune règle ne peut dire » ; retirer les blancs de bord est la règle.

**R6. Le modèle nommé doit servir la langue et l'usage du lecteur.** Avant de
nommer un point de contrôle, lisez sa fiche : langues, licence (usage
commercial), existence. Exemples : `moderate-user-comments` et
`summarise-a-long-document` nomment des modèles anglais seulement ;
`extract-fields-from-invoice` nomme un modèle sous licence non commerciale ;
`write-product-descriptions` pointe vers `./models/catalogue-copy`, qui
n'existe pas.

**R7. Dites les réglages par défaut en conditions d'exploitation.** Un seuil,
une fenêtre, un plafond par défaut se jugent sur ce qu'ils produisent un jour
ordinaire. Exemple : `detect-anomalies` mesure dans un test une dizaine de
fausses alertes par jour par métrique saine, et la fiche promet d'être
réveillé « et pas le reste du temps ».

**R8. Un plafond refuse ce qui coûte, et dégrade plutôt que de lever dans un
chemin de requête.** Écrivez ce que l'appelant fait au-dessus du plafond.
Exemples : `detect-language` lève au-delà de 8 000 caractères alors qu'il n'en
envoie que 600 ; `summarise` affirme éviter la découpe et lève au-delà de
40 000 caractères, sur le besoin même d'« un document trop long ».

**R9. Pensez au cycle de vie réel de la sortie avant de compter un coût.** Une
description se génère une fois et se stocke ; une table de voisins se calcule
hors ligne ; une alerte se rejoue. Exemple : `write-product-descriptions`
compte le non-déterminisme comme un prix permanent alors que personne ne
régénère une description à chaque affichage.

**R10. Un contrôle de sécurité dit d'où vient la valeur qu'il contrôle.** Si
le client peut la fournir, le contrôle ne contrôle rien. Exemple :
`detect-spam` prend le délai de soumission en argument sans dire qu'il doit
être horodaté et signé par le serveur.

**R11. `breaking_point` : deux phrases, un exemple, un témoin.** 68 points de
rupture sur 74 dépassent soixante mots. Le reste — les renvois, les cas
voisins, ce que le double simule — va dans la docstring. La discipline « ce
que le test prouve, ce qu'il ne prouve pas » est bonne ; elle tient en une
proposition, pas en un paragraphe.

**R12. Tout ce qui a été vérifié pour écrire la fiche va dans `sources`.** Un
lecteur ne lit pas le dossier de corrections. Exemple : `show-similar-articles`
avance 128 et 512 jetons, vérifiés sur les fiches de modèle, avec
`sources: []`.

**R13. Le titre anglais décrit le même besoin que `need`.** L'anglais est la
version canonique. Exemple : « Mask personal data » pour un besoin qui ne
masque que téléphone, adresse électronique et IBAN.

### Pour la charte des tests

**T1. Un marquage `INFIRMÉ` ou `DÉFAUT` ne survit pas à la correction : le
testeur réécrit le test sur la phrase nouvelle.** Un marquage strict passe
quand le corps lève pour n'importe quelle raison ; laissé en place, il ne
prouve plus rien. Ce lot en a laissé 122 dans 21 fiches, dont une partie
décrit des bugs toujours présents. **Rendre la règle mécanique** : un contrôle
de `npm run check` qui échoue si un test d'une fiche `published` porte
`xfail`, `INFIRMÉ` ou `DÉFAUT`.

**T2. Chaque fiche à niveau N3 a un test qui exécute l'adaptateur sur
`_harness/fake_sdk.py` / `fake-sdk.mjs`.** Modèle, messages, température
envoyés ; lecture de `choices[0].message.content` ; `content` nul. Dix fiches
sur seize ne l'ont pas. **Rendre la règle mécanique** : un contrôle qui exige
`ProviderClient(` dans `n3.test.py` et `providerClient(` dans `n3.test.js`.

**T3. Les données de test ne sont pas construites dans la forme du modèle
testé.** Une série « vérité » faite d'une droite et de deux harmoniques ne
teste pas une régression sur une droite et deux harmoniques. Ajoutez au moins
une entrée qui viole l'hypothèse du modèle.

**T4. Le test comparatif du verdict est obligatoire** (voir R4) : le niveau
recommandé et celui du dessous, sur le point de rupture du recommandé.

**T5. Le cas de production « entrée ordinaire de la population visée » s'ajoute
aux cas obligatoires** (voir R1) : entrée vide, énorme, mal encodée, limite,
hostile… et **banale**. C'est la catégorie qui manquait : les suites de ce lot
testent très bien le NFD, la marque d'ordre des octets et l'emoji, et pas
`Boulogne-Billancourt` ni `12,500`.

**T6. Indépendance et distribution quand le code prétend tirer au hasard.**
Un générateur « aléatoire » se teste sur un tableau de contingence et une
autocorrélation, pas seulement sur la reproductibilité. Exemple :
`generate-test-data` est parfaitement reproductible et parfaitement biaisé.

**T7. Une borne de temps a une marge de dix, sans exception.** Deux suites sont
rouges pour des marges de deux et trois. Une classe de latence se justifie dans
le relevé, par une mesure écrite, pas par une assertion serrée.

**T8. Une donnée invalide dans un lot : le test vérifie que les autres
passent.** Exemple : `rank-products` lève pour toute la page sur une marge
négative.

---

## 4. Ce qui est déjà solide et doit rester le modèle

Pour que la charte ne retienne pas que des défauts :

- **Dire ce que le double simule et ce que le test établit.** Les points de
  rupture de `detect-spam` N3 (injection), `summarise` N2 et N3,
  `read-text` N3 le font avec exactitude. C'est la bonne discipline ; elle doit
  seulement tenir en une phrase.
- **Un `escalate_when` observable sur un tableau de bord** :
  `route-support-tickets` N0 (« la file par défaut devient la plus remplie »),
  `show-similar-articles` N0 (lignes vides ou voisins à 1,0 dans la table).
- **Une sortie qui porte ses raisons** : motifs de rejet de `detect-spam` N0,
  journal de `convert-messy-csv`, verdict chiffré de `detect-anomalies` N0.
- **Refuser un niveau par un argument de structure, pas de goût** :
  `generate-placeholder-images` (« rien à apprendre »), `validate-a-form`
  (« une décision qu'on ne peut ni rejouer ni justifier »),
  `show-similar-articles` N3 (un calcul par affichage pour un résultat qui ne
  change qu'à la publication).
- **`generate-placeholder-images`**, seule fiche acceptée, est courte, juste,
  sourcée, et son code tient en production : c'est l'étalon de ton et de
  périmètre.
