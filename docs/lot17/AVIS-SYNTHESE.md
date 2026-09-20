# Lot 17 — synthèse de la relecture

Vingt-cinq fiches relues une par une, code exécuté, extraits passés sur des
entrées que la fiche n'avait pas choisies, parité Python/JavaScript vérifiée
hors du jeu de tests, et chiffres publiés rejoués à la main.

**Six fiches acceptées, dix-neuf refusées.**

Aucun refus ne porte sur le style, sur le ton ni sur une préférence. Chacun
porte sur une affirmation fausse, une sortie fausse sur une entrée ordinaire,
un écart à la norme invoquée, ou une démonstration qui ne démontre pas. Le
détail est dans `docs/lot17/avis/<id>.md`.

---

## 1. Les vingt-cinq verdicts

| # | Fiche | Verdict | Motif principal |
|---|---|---|---|
| 1 | `check-a-company-identification-number` | **ACCEPTÉE** | — |
| 2 | `check-bank-details-before-a-transfer` | REFUSÉE | 0,6 % et 6 887 : deux chiffres publiés que le dépôt ne produit pas (0,450 % et 6 882) |
| 3 | `validate-a-phone-number-and-its-country-code` | **ACCEPTÉE** | — |
| 4 | `validate-an-email-address-without-sending-a-message` | REFUSÉE | l'algorithme de nettoyage du standard HTML appliqué à moitié ; l'essai affirme une résolution DNS qu'il ne fait pas |
| 5 | `check-a-file-is-really-the-format-it-claims` | REFUSÉE | `photo.jpeg` rend `matches_claim: false` ; une liste blanche écrite `jpeg` n'autorise aucun JPEG |
| 6 | `know-whether-a-pdf-needs-ocr` | REFUSÉE | le témoin de N1 est une page d'entraînement ; la marge par défaut refuse trois pages françaises ordinaires sur quatre |
| 7 | `repair-text-with-broken-encoding` | REFUSÉE | `ftfy` ne répare pas « ÃŽle-de-France » ni « Å'uvre », l'extrait JavaScript si — divergence non publiée |
| 8 | `validate-an-imported-file-against-a-schema` | **ACCEPTÉE** | — |
| 9 | `validate-an-api-payload-against-its-contract` | REFUSÉE | la clé du cache sérialise le document OpenAPI à chaque requête : 90 % du temps d'appel, classe de latence fausse |
| 10 | `check-a-password-against-a-policy` | REFUSÉE | `data_egress: none` pour un niveau qui appelle un service tiers ; panne du service jamais écrite ni testée |
| 11 | `extract-product-data-from-a-shop-page` | REFUSÉE | le N3 réintroduit l'effondrement d'expression régulière que le N0 évite (42 s) ; `price` en flottant, `price_text` perd les centimes |
| 12 | `extract-main-content-from-a-web-page` | REFUSÉE | une brève de 125 caractères revient avec « rien n'a été extrait : page construite par son JavaScript » |
| 13 | `extract-tables-from-a-pdf` | REFUSÉE | sur une facture sans filets, l'en-tête de la page devient des lignes du tableau |
| 14 | `convert-a-pdf-to-plain-text` | REFUSÉE | une page de tableau ressort transposée, en silence ; la docstring nomme des bibliothèques que le code n'appelle pas |
| 15 | `extract-fields-from-a-log-line` | REFUSÉE | le motif syslog livré rejette toutes les lignes d'un fichier de journal ; l'exemple du point de rupture n'est pas celui du test |
| 16 | `extract-the-latest-reply-from-an-email-thread` | REFUSÉE | toute réponse plus courte que la ligne d'attribution est signalée à tort, et routée vers le niveau payant |
| 17 | `extract-amounts-and-currencies-from-text` | **ACCEPTÉE** | — |
| 18 | `extract-key-terms-from-a-document` | REFUSÉE | sur une petite collection, le classement de N1 est une liste alphabétique de termes à égalité |
| 19 | `extract-people-and-companies-from-an-article` | REFUSÉE | « Après Renault », « Selon Le Monde », « Chez Boulanger » rendus comme des noms |
| 20 | `extract-links-from-a-page` | **ACCEPTÉE** | — |
| 21 | `extract-metadata-from-a-file` | REFUSÉE | une partie de métadonnées illisible rend « aucune métadonnée », ce que la fiche existe pour interdire |
| 22 | `extract-a-table-from-a-web-page` | REFUSÉE | « mille, le maximum que la norme autorise » est faux pour `rowspan` (65 534) ; `rowspan="0"` décale la grille |
| 23 | `extract-tracking-numbers-from-an-email` | REFUSÉE | « cette famille ne porte rien à vérifier » est faux pour UPS ; l'exemple du point de rupture manque au test |
| 24 | `aggregate-a-column-of-data` | **ACCEPTÉE** | — |
| 25 | `estimate-the-cost-of-a-model-call` | REFUSÉE | le coût par appel est arrondi avant d'être multiplié : `decimals=2` rend « 0,00 » pour cent mille appels |

---

## 2. Les motifs de refus, classés par nature

Un refus peut porter plusieurs motifs ; c'est le motif dominant qui classe.

### 2.1 Sortie fausse et silencieuse sur une entrée ordinaire — 11 fiches

**5, 7, 11, 12, 13, 14, 16, 19, 21, 25**, et partiellement **15**.

C'est la catégorie la plus lourde, et de loin. Dans chacune, l'extrait rend une
valeur qui a la forme d'une réponse :

- `photo.jpeg` déclenche une alerte de sécurité (5) ;
- `ÃŽle-de-France` reste cassé d'un côté et réparé de l'autre (7) ;
- `{"price": 24.90}` ressort en `price_text: "24.9"` (11) ;
- une brève de presse est déclarée non extraite (12) ;
- le bloc adresse d'une facture devient des lignes du tableau (13) ;
- une page de tableau ressort transposée (14) ;
- « Oui. » est signalé comme une réponse écrite dans la citation (16) ;
- « Après Renault » est rendu comme un nom (19) ;
- un `core.xml` illisible rend « aucun auteur » (21) ;
- cent mille appels coûtent « 0,00 » (25).

La règle R2 couvre exactement cela et elle est bien comprise — plusieurs fiches
la citent. Ce qui manque n'est pas la règle, c'est la méthode qui la ferait
respecter : voir § 3.1.

### 2.2 Chiffre publié faux, ou que rien ne tient — 4 fiches

**2, 8, 9, 20**, et le cas particulier de **22**.

- 2 : « 0,6 % » et « 6 887 » ne sont produits par aucune des deux suites
  (0,450 % / 6 882 en Python, 0,464 % / 6 892 en JavaScript). Les tests
  assertent des fourchettes larges — `0.002 < x < 0.02` — qui laisseraient
  passer n'importe quel taux dans une décade.
- 8 et 9 : « ×55 », « ×6 000 », « ×900 » publiés dans le corps de la fiche,
  tenus par un `assert garde * 5 < recompile`.
- 20 : « sept divergences sur trente-huit » n'est asserté nulle part ; le test
  affirme les réponses de l'extrait, jamais celles d'`urljoin`.
- 22 : « mille, qui est le maximum que la norme autorise » — la norme autorise
  65 534 pour `rowspan`.

À l'inverse, les fiches **4** (4 / 14 / 32), **13** (« Prix H »), **17**
(price-parser rend 2026) et **24** (244.98000000000002, 7,0 %, zéro centime)
assertent leurs chiffres à l'égalité stricte, et je les ai tous rejoués sans
une divergence. Le lot sait faire ; il ne le fait pas partout.

### 2.3 Démonstration circulaire, ou test écrit pour passer — 5 fiches

**2, 5, 6, 16, 18**.

- 6 : le témoin du point de rupture de N1 est une page du lot d'entraînement,
  et le seuil est `min(entraînement) − marge` : le témoin ne peut pas échouer.
- 5 : les noms de fichiers du test sont construits à partir du format attendu
  (`f"fichier.{attendu}"`), donc la table d'alias n'est jamais exercée.
- 16 : la réponse du fixture fait 104 caractères pour un seuil implicite à 69 ;
  une phrase de moins et le test tombait.
- 18 : le corpus comparatif est un jeu de quatre contrats de quarante-cinq
  mots, taillé pour que le verdict gagne.
- 2 : bornes assertées à une décade près.

### 2.4 Le point de rupture n'est pas le premier à se produire (R1) — 5 fiches

**13, 14, 15, 19, 23**.

Toutes ont la même forme : le point de rupture publié est **vrai**, il est
**démontré**, et il n'est pas ce qui casse en premier chez le lecteur. La
cellule repliée d'un tableau tracé (13) est un raffinement du cas où tout va
bien ; le mot coupé en fin de ligne (14) laisse le texte lisible, alors que la
page de tableau le rend inexploitable ; le motif syslog (15) rejette cent pour
cent d'un fichier de journal ordinaire.

### 2.5 Écart à la norme que la fiche invoque comme autorité — 3 fiches

**4** (l'algorithme de nettoyage de valeur du standard HTML : « strip newlines
from the value » omis), **22** (`rowspan` plafonné à mille au lieu de 65 534,
`rowspan="0"` ignoré, cellule hors `<tr>` rattachée à la ligne précédente),
**15** (la priorité syslog traitée comme obligatoire).

Ces trois fiches tirent leur autorité d'un texte publié et s'en écartent sur un
point que le texte dit explicitement. C'est le type de refus le plus facile à
corriger et le plus coûteux à laisser passer, parce qu'il vise la crédibilité
du catalogue.

### 2.6 Défaut d'exploitation — 3 fiches

**9** (la clé du cache sérialise le document entier à chaque requête : 90 % du
temps sur un document de 129 Ko, et la classe de latence publiée est fausse),
**11** (le N3 passe 42 s de processeur sur la page hostile que le N0 traite en
2 ms), **10** (aucune réponse dégradée quand le service de la liste de fuites
ne répond pas, sur un chemin d'inscription).

### 2.7 Champ de risque ou essai qui affirme autre chose que le code — 2 fiches

**10** (`data_egress: none` pour un niveau qui émet une requête HTTPS vers un
tiers, alors que le schéma propose `third-party`), **4** (l'essai interactif
affiche « le domaine a un point : il se résout sur l'internet public » à côté
du cas `gmial.com` dont le `why` dit « la syntaxe ne consulte rien »).

---

## 3. Ce qui revient d'une fiche à l'autre malgré les chartes

C'est la partie utile. Les vingt et une règles ne sont pas mal comprises : les
relevés les citent, les tests les nomment, les fiches les appliquent
consciencieusement. Ce qui revient, ce sont les angles morts — ce que les
règles ne couvrent pas, ou ce qu'elles demandent sans donner le moyen de le
vérifier.

### 3.1 Angle mort n° 1 — les chartes couvrent ce que la **page** affirme, pas ce que le **code dit à l'exécution**

C'est le trou le plus large, et il explique la moitié des refus.

Le périmètre des affirmations à tester, dans `CHARTE-TESTS.md`, liste quatre
choses : le frontmatter, les docstrings, les commentaires, et les libellés de
l'essai. Il ne mentionne pas les chaînes que le code **rend** : `reason`,
`why`, `evidence`, `skipped`, `source`, `strategy`. Or ce sont elles que
l'appelant lit, journalise et sur lesquelles il branche son code. Six fiches
ont été refusées parce qu'une de ces chaînes affirme quelque chose de faux,
alors que la **décision** prise par le code était juste :

| Fiche | Le code décide | Et dit |
|---|---|---|
| 3 | refuse (le code région est mal formé) | « cannot be read as a phone number » — c'est le numéro qu'il accuse |
| 12 | rend le texte extrait | « almost nothing was extracted: this page may be built by its own JavaScript » |
| 16 | coupe correctement le fil | « more text was written under the quote than above it » |
| 21 | n'a pas pu lire `core.xml` | rien : `fields: {}`, `reason: null` |
| 23 | ne vérifie pas la clé UPS | « this family carries nothing to check » — la famille en porte une |
| 25 | arrondit à zéro | `break_even_items: null`, sans raison |

**Règle manquante, à ajouter à `CHARTE-REDACTION.md` et à reprendre dans le
périmètre de `CHARTE-TESTS.md` :**

> **R14. Une raison rendue par le code est une affirmation, et elle se teste
> comme les autres.** Elle ne dit que ce que le code a constaté, jamais la
> cause qu'il suppose. « Ce texte fait moins de deux cents caractères » se
> teste ; « cette page est probablement construite par son JavaScript » ne se
> teste pas et se trouve faux sur la première brève venue. Deux situations que
> le code distingue ont deux raisons ; deux situations qu'il ne distingue pas
> n'en ont qu'une, et elle ne nomme pas de cause.

### 3.2 Angle mort n° 2 — le jeu de tests est construit à partir du code, et jamais l'inverse

La règle T3 existe (« les données de test ne sont pas construites dans la forme
du modèle testé ») mais elle est écrite pour les modèles statistiques. Elle vaut
pour tout : un seuil, une table d'alias, une liste de mots-clés, un plafond.
Cinq fiches ont un jeu de tests dont chaque donnée a été choisie en regardant le
code :

- 5 : `claimed_name=f"fichier.{attendu}"` — le nom du fichier ne peut pas porter
  un alias, donc `ALIASES` n'est exercée dans aucun sens ;
- 6 : les pages notées sont les pages ajustées ;
- 7 : les treize mojibakes du test excluent, sans le savoir, toute la classe
  que `ftfy` refuse de réparer ;
- 16 : la réponse du fixture est plus longue que le seuil implicite, de
  trente-cinq caractères ;
- 18 : le corpus fait quatre documents de quarante-cinq mots.

**Élargissement proposé de T3 :**

> **T3 (étendue). Quand le code porte un seuil, une table, une liste ou un
> plafond, le test porte une entrée de chaque côté, et une entrée qui n'y
> figure pas.** Un jeu de tests dont toutes les données ont été écrites après
> le code ne démontre que la cohérence du code avec lui-même.

### 3.3 Angle mort n° 3 — R1 demande une mesure et ne laisse aucune trace

R1 est la règle la mieux écrite des vingt et une, et c'est celle qu'on enfreint
le plus. Elle demande d'exécuter le niveau sur une dizaine d'entrées ordinaires
**avant** de rédiger le point de rupture. Rien, dans le dépôt, ne dit si ça a
été fait : ni le relevé, ni le test, ni la fiche.

Les cinq refus du § 2.4 auraient tous été évités par dix minutes de travail :
coller une facture sans filets dans la fiche 13, une ligne de `/var/log/syslog`
dans la fiche 15, une phrase commençant par « Après » dans la fiche 19.

**Proposition, dans `CHARTE-TESTS.md`, au chapitre du relevé :**

> Le relevé porte une section **« Dix entrées ordinaires »** : dix entrées que
> le rédacteur n'a pas fabriquées pour la fiche — copiées d'un vrai document,
> d'un vrai journal, d'un vrai courriel —, ce que l'extrait en a rendu, et la
> ligne du point de rupture qui en découle. C'est la seule trace possible de
> R1, et elle coûte dix minutes.

### 3.4 Ce qui est publié n'est pas relié à ce qui est asserté

Quatre fiches publient un chiffre que le dépôt ne produit pas ou ne tient pas
(§ 2.2). La charte dit qu'un test qui passerait encore si la fiche disait le
contraire ne démontre rien — mais elle le dit du **comportement**, pas des
**nombres imprimés sur la page**.

**Proposition, à ajouter à R12 ou à côté :**

> Tout nombre écrit dans une fiche — pourcentage, effectif, décompte, facteur —
> est soit asserté à l'égalité stricte dans un test, soit remplacé par un ordre
> de grandeur en toutes lettres (« près de sept mille », « moins d'un demi pour
> cent »). Il n'y a pas de troisième forme. Un générateur à graine fixe est
> reproductible à l'unité : il n'y a aucune raison d'écrire une fourchette.

Et un contrôle à écrire, du même genre que `check-figures.mjs` : extraire les
suites de chiffres du frontmatter d'une fiche et exiger qu'on les retrouve dans
un fichier de test de la même fiche.

### 3.5 `check-figures.mjs` ne voit pas les facteurs de performance

La charte interdit « le pourcentage de performance ». Les fiches 8 et 9
publient « ×55 », « ×6 000 » et « ×900 » dans le corps, et le contrôle passe au
vert. Un facteur est un chiffre de performance ; le motif de reconnaissance
doit couvrir `×N`, `N fois plus`, `divise par N`.

### 3.6 Une décision de site tenue dans une fiche et enfreinte dans deux autres

Le rapport de lot pose en décision n° 5 : « Les montants ne passent jamais par
un flottant. Fiches 17, 24, 25. » La fiche 24 la tient parfaitement. La fiche
17 aussi. Mais :

- la fiche 11, sur un besoin de **prix**, rend `price` en flottant et perd les
  centimes dans le champ censé les garder ;
- la fiche 25, qui **cite** la fiche 24 dans son verdict, arrondit le coût par
  appel avant de le multiplier par le nombre d'appels — l'erreur exacte que la
  fiche 24 existe pour montrer.

Une décision qui engage le site au-delà de sa fiche doit vivre dans une charte,
pas dans un rapport de lot. **Proposition, dans `CHARTE-EXTRAITS.md` :**

> Un montant ne devient jamais un flottant, se rend en chaîne de chiffres, et
> **ne s'arrondit qu'une fois, après la dernière agrégation**. Un arrondi qui
> précède une multiplication ou une somme est une erreur multipliée.

### 3.7 Un défaut fermé sur un niveau et rouvert sur le suivant

La fiche 11 est le cas d'école : son niveau N0 écrit douze lignes de balayage
linéaire pour éviter un effondrement d'expression régulière, avec le
commentaire qui l'explique ; son niveau N3, deux fichiers plus loin, nettoie le
même HTML hostile avec une expression régulière et met quarante-deux secondes.

Les cas de production sont exigés « pour chaque extrait ». Ce qui manque est la
phrase suivante :

> Un défaut de production trouvé sur un niveau est cherché sur tous les niveaux
> de la même fiche, et l'entrée qui l'a révélé entre dans le jeu de tests de
> chacun.

### 3.8 Le bloc `risks` n'est confronté à rien

`data_egress: none` sur un niveau qui appelle `api.pwnedpasswords.com` (fiche
10) a traversé la rédaction, les tests, le relevé et les contrôles. Le champ
est pourtant affiché comme badge et sert de filtre au catalogue.

**Contrôle à écrire :** un extrait dont le code contient une adresse `http(s)`,
un `import urllib.request`, un `fetch` ou un client de fournisseur ne peut pas
déclarer `data_egress: none`. Trois lignes de `grep` dans `check-content`.

### 3.9 R11 : vingt-cinq points de rupture sur vingt-cinq dépassent le seuil

La règle est explicite — deux phrases, un exemple, un témoin — et elle porte le
constat qui l'a fait naître : « sur les 74 points de rupture du catalogue relus
au lot 15, 68 dépassaient soixante mots : ils ne se lisaient plus ». Mesure sur
les trente et un points de rupture de ce lot :

| | |
|---|---|
| plus court | 57 mots (fiche 4) |
| plus long | 117 mots (fiche 24) |
| moyenne | 79 mots |
| en dessous de soixante mots | **6 sur 31** |
| trois phrases ou plus | **11 sur 31** |

Et la dérive est régulière : 66 mots de moyenne sur les quatorze premières
fiches, 90 sur les onze dernières. Une règle qui porte un nombre et qu'aucun
contrôle ne vérifie dérive toujours dans le même sens, parce qu'il y a toujours
une bonne raison d'ajouter une phrase.

**Ce n'est plus une consigne, ça doit devenir un contrôle** — exactement le
chemin qu'a suivi `check-marquages` : `breaking_point`, deux phrases, soixante
mots, échec au-delà. La troisième phrase qu'on veut ajouter a toujours sa place
dans la docstring, et les fiches de ce lot le montrent : c'est presque toujours
le renvoi, le cas voisin, ou l'alternative écartée.

---

## 4. Ce qu'il faut copier

Trois fiches sont des modèles, et elles méritent d'être citées dans les chartes
comme les contre-exemples le sont :

- **24 — `aggregate-a-column-of-data`.** Une affirmation de départ démentie par
  la mesure, abandonnée, remplacée par ce qui est vrai et plus intéressant.
  Trois chiffres publiés, trois chiffres que j'ai rejoués à l'identique. Les
  raisons de refus d'une ligne sont distinctes et exactes.
- **17 — `extract-amounts-and-currencies-from-text`.** La convention de
  séparateur exigée sans défaut, le drapeau `ambiguous` qui dit ce qu'il dit et
  rien de plus, et l'outil de référence appelé pour de bon dans le test avant
  d'être écarté. Quinze entrées françaises ordinaires, deux langages, un seul
  rapport.
- **4 — `validate-an-email-address-without-sending-a-message`.** Écarter deux
  bibliothèques mûres est la décision la plus risquée du lot, et c'est la mieux
  étayée : trois nombres, assertés à l'égalité. Elle est refusée pour une autre
  raison, et son travail de mesure reste le modèle.

Et une règle inventée par une fiche mérite de monter dans les chartes :
**« ce qui n'est pas lu est nommé »** (fiche 21). Qu'elle-même l'enfreigne deux
fois est précisément l'argument : tant qu'elle reste une trouvaille de fiche,
elle s'applique aux cas auxquels le rédacteur a pensé.

---

## 5. Réponse à la question posée

**Les vingt et une règles ne suffisent pas, et il n'en manque pas vingt et
une : il en manque trois, et il manque surtout trois contrôles.**

Les trois règles :

1. **R14 — une raison rendue par le code est une affirmation** (§ 3.1). C'est
   le seul vrai trou de périmètre : les chartes regardent la page, et la moitié
   des défauts de ce lot sont dans ce que le code répond.
2. **T3 étendue aux seuils, tables et plafonds** (§ 3.2).
3. **L'arrondi ne précède jamais une agrégation**, dans la charte des extraits
   plutôt que dans un rapport de lot (§ 3.6).

Les trois contrôles, qui feraient plus que les règles :

1. **`check-rupture`** — deux phrases, soixante mots (§ 3.9). Vingt-cinq fiches
   sur vingt-cinq enfreignent une règle écrite en toutes lettres : la règle
   n'est pas en cause, l'absence de contrôle l'est.
2. **`check-chiffres-tenus`** — tout nombre du frontmatter se retrouve dans un
   test de la fiche (§ 3.4).
3. **`check-egress`** — un extrait qui ouvre une connexion ne déclare pas
   `data_egress: none` (§ 3.8).

Et une exigence de relevé, qui ne coûte rien et qui aurait évité cinq refus :
**la section « dix entrées ordinaires »** (§ 3.3).
