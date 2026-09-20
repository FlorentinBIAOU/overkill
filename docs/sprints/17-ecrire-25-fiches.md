# Lot 17 — Écrire les vingt-cinq fiches suivantes

## Rôle

Tu es développeur full-stack senior, spécialisé en traitement de données et en
outillage. Tu interviens sur **Overkill**, catalogue technique en ligne sur
https://isitoverkill.dev.

Tu travailles sans supervision. Le commanditaire ne répondra à aucune question
pendant l'exécution. Quand tu hésites, tu tranches, tu notes, tu continues.

---

## Le contexte

Le catalogue compte **vingt-cinq fiches publiées**, écrites, testées, relues par
un relecteur exigeant et corrigées. Elles sont le patron. Ce lot en ajoute
vingt-cinq, choisies pour leur valeur et validées par un relecteur extérieur.

Les chartes portent désormais **vingt et une règles** (R1 à R13, T1 à T8) tirées
de cette relecture, chacune avec le cas réel qui l'a fait naître. Elles sont la
contrainte principale de ce lot : une fiche qui les respecte n'aura pas à être
reprise.

---

## Avant de commencer

Lis, dans cet ordre, **en entier** :

- `docs/sprints/CHARTE-REDACTION.md` — les règles R1 à R13
- `docs/sprints/CHARTE-TESTS.md` — les règles T1 à T8
- `docs/sprints/CHARTE-EXTRAITS.md` — la limite de longueur porte sur la
  logique, pas sur les gardes de production ni sur l'adaptateur N3 commun
- `docs/CDC.md` — le schéma d'une fiche
- `docs/DECISIONS-CLARTE.md` — le vocabulaire
- `docs/lot15/AVIS-SYNTHESE.md` — ce qui a été reproché aux vingt-cinq
  premières, et pourquoi
- `content/tryouts/README.md` — le contrat de la zone d'essai

Puis lis **deux fiches existantes comme référence** :

- `content/entries/generate-placeholder-images.mdx` — la seule fiche acceptée
  du premier coup par le relecteur. Courte, juste, sourcée, son code tient en
  production. C'est l'étalon de ton et de périmètre.
- `content/entries/extract-fields-from-invoice.mdx` — ce que donne la règle
  R3 : le niveau N0 lit un format structuré standard plutôt que de réécrire un
  analyseur.

Utilise la version de Node de `.nvmrc` (`nvm use`) : c'est celle de la CI.

---

## Les vingt-cinq fiches à écrire

Dans cet ordre. Le groupe 1 d'abord : ce sont les démonstrations les plus
solides, parce qu'il existe une réponse exacte que le modèle ne peut que
deviner.

La colonne de droite dit ce qu'un relecteur extérieur attend. Ce sont des
pistes vérifiées par lui, pas des conclusions : **tu vérifies tout à la source**
(version, licence, maintenance, langues) avant de l'écrire.

### Groupe 1 — une réponse exacte contre une devinette (10)

| # | Besoin | Ce qui est attendu |
|---|---|---|
| 1 | Contrôler un numéro d'identification d'entreprise | Clé de Luhn sur SIREN et SIRET. Le répertoire Sirene comme niveau au-dessus : la clé dit si le numéro est bien formé, pas s'il existe |
| 2 | Contrôler des coordonnées bancaires avant un virement | Clé ISO 13616, modulo 97, longueur par pays. L'erreur coûte cher : le déterminisme est l'argument |
| 3 | Vérifier un numéro de téléphone et son indicatif | `phonenumbers` / `libphonenumber-js` : pays, format et validité, sans API |
| 4 | Vérifier une adresse e-mail sans envoyer de message | Distinguer la syntaxe du contrôle DNS/MX. Aucun niveau n'a besoin d'un modèle |
| 5 | Vérifier qu'un fichier est bien du type annoncé | Les premiers octets, jamais l'extension (`filetype`, `python-magic`). Enjeu de sécurité réel |
| 6 | Savoir si un PDF a besoin d'OCR | Chercher la couche texte avant de lancer un OCR ou un modèle de vision |
| 7 | Réparer un texte au mauvais encodage | `ftfy`, déterministe depuis dix ans. Un modèle altère la donnée qu'il prétend réparer |
| 8 | Valider un JSON contre un schéma | JSON Schema est une norme. La validation de structure est déterministe |
| 9 | Valider une requête d'API contre son contrat | OpenAPI, même logique |
| 10 | Vérifier qu'un mot de passe respecte la politique | Règles pures en N0. Les fuites via le service public Have I Been Pwned, en k-anonymat : seul un préfixe de haché sort |

### Groupe 2 — extraction (14)

| # | Besoin | Ce qui est attendu |
|---|---|---|
| 11 | Récupérer les données produit d'une page marchande | Les microdonnées JSON-LD d'abord, les sélecteurs ensuite. Le cas de sur-ingénierie le plus documenté |
| 12 | Isoler le contenu principal d'une page web | `trafilatura` / `readability` font référence |
| 13 | Extraire les tableaux d'un PDF | `pdfplumber`, `camelot` |
| 14 | Récupérer le texte d'un PDF | `pypdf`, `pdftotext`. Beaucoup envoient le PDF entier à un modèle sans essayer |
| 15 | Découper des lignes de journal en champs | Motifs nommés, Grok. Un appel par ligne est absurde au volume |
| 16 | Isoler la dernière réponse d'un fil d'e-mails | Bibliothèques dédiées (`email_reply_parser`). Problème ancien et résolu |
| 17 | Extraire les montants d'un texte | Le piège des conventions : `1,234` contre `1.234`. Même règle que le CSV : convention déclarée, ou ambiguïté rejetée |
| 18 | Extraire les mots-clés d'un document | RAKE, YAKE, TF-IDF |
| 19 | Repérer les personnes et organisations citées dans un article | Reconnaissance d'entités : `spaCy`, `GLiNER`. Modèle français ou multilingue, obligatoirement (R6) |
| 20 | Extraire les liens d'une page | Un analyseur HTML suffit. Un modèle invente des ancres |
| 21 | Extraire les métadonnées d'un fichier | EXIF, ID3, propriétés de document : des normes binaires |
| 22 | Convertir un tableau HTML en données | Une ligne de bibliothèque contre un appel |
| 23 | Repérer un numéro de suivi dans un e-mail | Motifs stricts, documentés par transporteur |
| 24 | Calculer une somme ou une moyenne sur des données | **Des gens envoient un tableau JSON à un modèle pour lui demander un total.** Un calcul exact contre une approximation. L'absurdité la plus démonstrative du catalogue |

### Groupe 3 — la méta-fiche (1)

| # | Besoin | Ce qui est attendu |
|---|---|---|
| 25 | Estimer le coût d'un appel de modèle avant de le faire | Compter les jetons (`tiktoken` ou équivalent) et en déduire coût et latence avant exécution. S'adresse à qui signe les factures. Probablement la fiche la plus partagée du catalogue |

**Attention sur la fiche 25.** `check-figures` refuse tout prix absolu, et il a
raison : un tarif périme en trois mois. La fiche ne publie donc **aucun tarif**.
Le code prend le prix par million de jetons **en paramètre**, fourni par
l'appelant depuis la grille de son fournisseur. Ce que la fiche démontre, c'est
le compte de jetons et la formule, pas un montant.

---

## Le cycle, fiche par fiche

**Séquentiel. Un seul agent. Aucun sous-agent.** Une fiche est finie avant que
la suivante commence. Les lots précédents ont montré qu'un découpage en passes
parallèles épuise les quotas et laisse des fiches à moitié faites.

Pour chaque fiche, dans l'ordre :

### 1. Chercher

Établis ce que le lecteur brancherait en premier. **La règle R3 est la plus
importante de ce lot** : le concurrent réel d'un appel de modèle est rarement
« du code à la main », c'est une bibliothèque mûre, un service public, une
norme ou une donnée structurée. Réponds par écrit à : « qu'est-ce qu'un
développeur expérimenté utiliserait ? ». Si c'est un outil existant, il est un
niveau de l'échelle, ou il est écarté avec une raison mesurée.

Vérifie à la source : version, licence, langues traitées, maintenance. Une
bibliothèque abandonnée, ou sous licence non commerciale, ne se recommande pas
sans le dire.

**Quand l'outil de référence n'existe que dans un langage**, l'extrait de
l'autre langage prend l'équivalent le plus proche et la fiche le dit en une
phrase. On ne recommande pas une approche moins bonne pour préserver la
parité : c'est ce qui est arrivé à `forecast-weekly-sales`, à ne pas refaire.

### 2. Écrire l'échelle

Les quatre niveaux, avec ce que le schéma exige. Un niveau qui n'a pas de sens
se ferme avec une raison mesurée, pas avec une opinion.

**R1 avant le point de rupture** : exécute le niveau sur une dizaine d'entrées
que ton public produit tous les jours — francophone, souvent européen ou
africain : numéros étrangers, villes à trait d'union, montants au format
anglais, mois abrégés — et note ce qui sort. Le point de rupture est la
**première** chose qui casse sur des données réelles, pas la plus élégante.

**R4 pour le verdict** : si tu recommandes un niveau plutôt que celui du
dessous, écris le test qui fait tourner les deux et publie ce qu'il montre.

**R11** : deux phrases pour un point de rupture, un exemple, un témoin.

### 3. Coder

Les extraits dans les deux langages, avec leur docstring d'en-tête traduite en
français (`doc.fr.yaml`).

Un extrait se lit en trente secondes. S'il enfle, c'est que tu réécris ce
qu'une bibliothèque fait déjà : retour à R3.

### 4. Tester

Selon la charte des tests, en particulier :

- **T5** : l'entrée ordinaire de ton public, en plus des cas vide, énorme, mal
  encodé, limite et hostile
- **T2** : une fiche à niveau N3 a un test qui exécute l'adaptateur contre le
  double du harnais
- **T7** : une borne de temps a une marge de dix, sans exception. Mieux :
  mesure la latence au relevé et ne garde dans le test qu'une borne
  d'effondrement
- **T1** : aucun marquage `INFIRMÉ`, `DÉFAUT` ou `xfail`
- **Aucun test ne dépend d'un ordre d'ex æquo, d'un processeur ou de l'absence
  d'un paquet dans l'environnement.** Pour simuler un paquet absent, reprends
  la forme de `moderate-user-comments/n2.test.py` ou de
  `search-in-your-own-documents/n2.test.js`

`node scripts/test-snippets.mjs <id>` passe avant de continuer.

### 5. La zone d'essai

Chaque fiche en a une. Interactive quand le code JavaScript tourne dans un
navigateur sans dépendance, figée sinon, avec des sorties calculées à la
construction. Surlignage de ce que le code a retenu, comme sur les essais
existants.

Les cas prouvent que ça marche, font comprendre pourquoi, et **montrent quand
ça cesse de marcher** : le dernier cas illustre le point de rupture.

### 6. Relire

Relis ta fiche avec l'exigence du relecteur du lot 15 : la réalité du cas, la
pertinence technique, la solidité du verdict, la vérité du point de rupture, le
style. Si un point ne tient pas, corrige avant de commiter.

### 7. Commiter

`npm run check:fast` au vert, puis **un commit pour cette fiche**. Une ligne dans
`docs/lot17/ETAPES.md` : la fiche, son verdict, l'outil standard entré dans
l'échelle s'il y en a un, ce qui reste ouvert.

Toutes les cinq fiches, `npm run check` complet.

---

## La feuille de route

`content/roadmap.yaml` liste deux cents intitulés. Certaines de ces fiches y
sont déjà, d'autres non (le calcul sur données, l'estimation de coût, les
liens, les métadonnées, le tableau HTML). Ajoute les manquantes, et retire de
la feuille de route celles que tu publies, comme le veut le schéma.

---

## Interdits

1. **Aucune fiche publiée dont le code n'a pas été exécuté.** En cas de doute,
   `status: draft` avec la raison.
2. **Aucun chiffre inventé.** Pas de prix absolu, pas d'empreinte chiffrée sans
   méthodologie citée, pas de mesure non réalisée.
3. **Aucune sortie fausse et silencieuse.** Toute ambiguïté que le code tranche
   seul — convention décimale, ordre jour-mois, casse, fuseau — est déclarée
   par l'appelant ou rejetée au journal. C'est ce que le site reproche aux
   modèles : un niveau N0 qui le fait perd l'argument.
4. **Aucun modèle nommé qui ne serve pas la langue du lecteur**, ou dont la
   licence interdise l'usage commercial, sans que ce soit dit.
5. **Ne touche pas au design ni aux gabarits.** Ce lot écrit du contenu.
6. **Ne réécris pas ce qu'une bibliothèque mûre fait déjà.**

---

## Règles Git

- **Branche dédiée**, créée depuis `main` à jour. Tu peux la pousser.
- **Un commit par fiche terminée.** Une coupure ne doit coûter qu'une fiche.
- Messages en français, format conventionnel. **Aucune mention de Claude, de
  Claude Code ou d'un modèle d'IA** nulle part.

---

## Si la session est coupée

Tiens `docs/lot17/ETAPES.md` à jour après chaque fiche. Une reprise se fait en
le lisant et en repartant de la fiche suivante, sans refaire les précédentes.

---

## Rapport de fin

Produis `docs/lot17/RAPPORT-LOT17.md` :

- **Le tableau des fiches écrites** : verdict, outil standard entré dans
  l'échelle, niveaux fermés et pourquoi
- **Les fiches où la conclusion a surpris** : celles où le niveau recommandé
  n'est pas celui qu'on attendait en commençant
- **Ce que la recherche a établi** : bibliothèques retenues, versions,
  licences, et celles écartées avec la raison
- **Les fiches où un langage n'avait pas l'outil de référence**, et ce qui a
  été fait
- **Les décisions prises seul**, avec l'alternative écartée
- **Ce qui reste ouvert**
- **Ce que les chartes devraient gagner**, si ce lot a fait apparaître une
  règle qui n'y figure pas

---

Commence par la fiche 1.
