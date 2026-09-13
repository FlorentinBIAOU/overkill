# Overkill — Cahier des charges

**Version** 1.0 · **Date** 10 septembre 2026 · **Commanditaire** Florentin Biaou
**Destinataire** agent de développement autonome
**Statut** spécification d'exécution, à suivre littéralement

---

## 0. Comment utiliser ce document

Tu es développeur full-stack senior spécialisé en sites de contenu statiques et en systèmes de design. Tu construis Overkill de bout en bout, seul, à partir de ce document.

**Ta méthode de travail :**

1. Lis le document en entier avant d'écrire une ligne de code.
2. Déduis un découpage en sprints à partir de la section 13, qui donne les lots et leurs dépendances. Un lot ne commence que si ses dépendances sont satisfaites.
3. À la fin de chaque lot, exécute la commande de vérification indiquée. Si elle échoue, corrige avant de passer au lot suivant.
4. Quand le document est muet sur un point, tranche toi-même, note la décision, et fais-la figurer dans le bilan final (section 15).
5. Quand le document est explicite, ne réinterprète pas. Les valeurs chiffrées, les noms de tokens, les noms de fichiers et les critères d'acceptation sont contractuels.

**Ce que tu livres :** un dépôt Git complet, buildable, déployable, avec 25 fiches de contenu vérifiées, toutes les pages du site, les illustrations, la CI, et le rapport de fin de mission.

---

## 1. Vision et mission

### 1.1 Le problème

L'IA générative est aujourd'hui le réflexe par défaut. On l'appelle pour filtrer un message, extraire une date, trier un formulaire, chercher dans trois cents documents. Dans une grande partie de ces cas, une règle, une requête ou un modèle classique de quelques mégaoctets fait le travail, souvent mieux.

Ce réflexe a un prix que peu de gens calculent au moment de la décision :

- un coût récurrent qui croît avec l'usage, là où une règle coûte zéro à perpétuité
- de la latence, de quelques centaines de millisecondes à plusieurs secondes
- des données qui sortent de l'infrastructure et partent chez un tiers
- un résultat non déterministe, donc difficile à tester et à garantir
- une dépendance à un fournisseur, à ses prix et à ses dépréciations de modèles
- un périmètre réglementaire qu'on ne s'était pas choisi
- une empreinte énergétique sans commune mesure avec l'alternative

Les plus exposés sont ceux qui n'ont ni expert interne ni budget de conseil : développeurs juniors, développeurs solo, PME. Ils reproduisent ce qu'ils voient, et ce qu'ils voient est un écosystème qui a intérêt à leur vendre de l'IA.

### 1.2 La mission

**Overkill aide à développer de façon responsable.**

Deux questions, dans cet ordre :

1. Est-ce que cette tâche a réellement besoin d'IA ?
2. Si oui, quel est le modèle le plus frugal qui la fait correctement ?

Pour chaque tâche du catalogue, Overkill montre toutes les options connues, de la plus simple à la plus lourde, avec le code qui tourne, les ordres de grandeur de coût et d'empreinte, les limites réelles de chaque approche, et la condition précise qui justifie de passer à l'option supérieure.

**On recommande toujours l'option la plus frugale qui fait le travail.**

### 1.3 Positionnement

Overkill n'est pas anti-IA. C'est un point non négociable, qui doit se sentir dans le contenu comme dans le design.

- Le principe est « le bon outil pour la bonne tâche », pas « l'IA c'est mal ».
- Certaines fiches recommanderont franchement un LLM, et c'est ce qui rendra crédibles celles qui recommandent l'inverse.
- Le badge « recommandé » peut se poser sur n'importe quel barreau, y compris le plus lourd.
- La couleur n'exprime jamais un jugement de valeur sur l'IA (voir section 8.3).

### 1.4 Ce que le site n'est pas

- Ni un annuaire d'outils d'IA
- Ni un blog d'opinion
- Ni un service de conseil juridique
- Ni un SaaS : pas de comptes, pas de paiement, pas de base de données

---

## 2. Cibles

| Cible | Ce qu'elle vient chercher | Conséquence de conception |
|---|---|---|
| Développeur junior | Comment implémenter une fonctionnalité, et les références qu'il n'a pas | Code visible tout de suite, copiable, avec les pièges expliqués |
| Développeur expérimenté | Un arbitrage argumenté et chiffré qu'il n'a pas le temps de faire lui-même | Densité, chiffres, sources, pas de vulgarisation superflue |
| CTO ou dev solo de PME | Décider sans expert, sans prendre de risques cachés | Bloc risques, coût récurrent, périmètre réglementaire |
| Visiteur venu des réseaux | Comprendre l'idée en trente secondes | Accueil éditorial fort, une fiche compréhensible sans contexte |

Le site doit servir les quatre sans en sacrifier aucune. La règle d'arbitrage : **le contenu est dense, la navigation est simple.**

---

## 3. Lexique

Termes contractuels, à utiliser tels quels dans le code, les URL et l'interface.

| Terme | Anglais | Définition |
|---|---|---|
| Fiche | *entry* | Une unité de contenu, traitant un besoin |
| Besoin | *need* | Ce que l'utilisateur veut faire, formulé comme il le dirait |
| Famille | *family* | Un des dix regroupements par verbe |
| ~~Barreau~~ Niveau | *rung* | Un des quatre niveaux de solution, N0 à N3. **Révisé au lot 14** : l'interface, les fiches et la page « Comment ça marche » disent « niveau » ; `rung` reste l'identifiant dans le code et le schéma. |
| Verdict | *verdict* | Le barreau recommandé par défaut pour ce besoin |
| Déclencheur | *escalation trigger* | La condition qui justifie de monter d'un barreau |
| Point de rupture | *breaking point* | Ce qui fait échouer un barreau donné |

---

## 4. Modèle de contenu

### 4.1 Les quatre barreaux

> **Révisé au lot 14.** Ce document continue de dire « barreau » là où il a été
> écrit ; le site dit « niveau », partout. La métaphore de l'échelle reste, elle
> se dit « échelle » et « niveau ».

L'échelle est fixe et identique sur toutes les fiches.

| Barreau | Nom | Nom EN | Contenu typique |
|---|---|---|---|
| **N0** | Règle et algorithme classique | Rule and classic algorithm | Regex, requête SQL, automate, parseur, algorithme déterministe, automatisation par règles |
| **N1** | Modèle classique léger | Lightweight classic model | TF-IDF, régression logistique, gradient boosting, k-NN, spaCy, modèles de quelques Mo tournant sur CPU |
| **N2** | Petit modèle spécialisé auto-hébergé | Small self-hosted specialised model | Encodeur type BERT distillé, modèle d'embeddings, modèle de reconnaissance dédié, LLM 1–4B quantifié |
| **N3** | API de LLM généraliste | General-purpose LLM API | Appel à un fournisseur externe, modèle généraliste |

**Règles :**

- Tous les barreaux ne sont pas présents sur toutes les fiches. Une fiche « traduire un texte » peut démarrer à N2. Un barreau absent doit être marqué absent avec une raison courte, jamais laissé vide sans explication.
- Un barreau présent est toujours documenté intégralement (section 4.2).
- L'ordre d'affichage est toujours N0 → N3, jamais inversé, jamais réordonné par pertinence.

### 4.2 Structure d'un barreau

Chaque barreau présent comporte, dans cet ordre :

1. **Nom de l'approche** — court et concret, par exemple « Regex avec normalisation préalable »
2. **Code** — minimal, exécutable, en Python et en JavaScript, en onglets
3. **Coût** — ordre de grandeur uniquement (voir section 4.5)
4. **Latence** — ordre de grandeur
5. **Bloc risques** — six champs, toujours renseignés :
   - Sortie de données : rien ne sort / reste dans votre infra / part chez un tiers
   - Déterminisme : oui / non
   - Testabilité : testable unitairement / testable statistiquement / difficilement testable
   - Dépendance fournisseur : aucune / bibliothèque / fournisseur externe
   - Empreinte : ordre de grandeur relatif
   - Périmètre réglementaire : liste courte, factuelle, ou « aucun spécifique »
6. **Point de rupture** — ce qui fait échouer cette approche, concrètement, avec un exemple
7. **Déclencheur de montée** — la condition précise qui justifie le barreau suivant

### 4.3 Structure d'une fiche

```
En-tête          titre, besoin en une phrase, famille, verdict, date de révision
Le scénario      2 à 4 phrases : ce qu'on voit faire, et pourquoi c'est discutable
Tableau récap    une ligne par barreau, lecture en un coup d'œil
Barreaux         N0 à N3, détaillés selon 4.2
Verdict          le barreau recommandé, assumé, avec 2 à 3 phrases de justification
Pour aller plus loin  liens externes, dépôts, articles de référence
Métadonnées      date, contributeurs, source des chiffres
```

Le verdict apparaît **deux fois** : en badge dans l'en-tête et dans le tableau récapitulatif, pour que quelqu'un qui ne lit rien reparte quand même avec la réponse.

### 4.4 Les dix familles

Rangement par verbe, jamais par secteur. Une fiche appartient à une seule famille.

| id | Français | Anglais | Exemples de besoins |
|---|---|---|---|
| `detect-filter` | Détecter et filtrer | Detect and filter | Modération, masquage de données personnelles, détection de spam, anti-doublons |
| `extract` | Extraire | Extract | Dates, montants, entités, champs d'un document, données d'une page |
| `classify-route` | Classer et router | Classify and route | Tri de tickets, étiquetage, aiguillage de messages, catégorisation |
| `search` | Chercher | Search | Recherche plein texte, recherche sémantique, autocomplétion, déduplication floue |
| `recommend` | Recommander | Recommend | Articles similaires, suggestions, tri par pertinence |
| `predict` | Prédire | Predict | Séries temporelles, scoring, estimation, détection d'anomalies |
| `generate` | Générer | Generate | Texte, images, données de test, variantes |
| `transform` | Transformer | Transform | Résumé, traduction, reformulation, changement de format |
| `recognize-transcribe` | Reconnaître et transcrire | Recognise and transcribe | OCR, parole vers texte, lecture de codes, analyse d'image |
| `decide-validate` | Décider et valider | Decide and validate | Validation de formulaire, règles métier, contrôles de cohérence, arbitrages |

Chaque famille a sa page, sa couleur d'illustration et son pictogramme (section 8.6).

### 4.5 Règles de chiffrage

Ces règles protègent la crédibilité du site. Elles sont contractuelles.

**Coûts.** Ordres de grandeur uniquement, jamais de prix absolus. Vocabulaire imposé :

- `nul` — aucun coût marginal
- `négligeable` — moins d'un euro par million d'opérations
- `faible` — de l'ordre de l'euro par million d'opérations
- `modéré` — de l'ordre de la dizaine d'euros par million d'opérations
- `élevé` — de l'ordre de la centaine d'euros par million d'opérations ou plus

Raison : les prix des fournisseurs changent tous les trimestres, une valeur absolue périme le contenu et détruit la confiance.

**Latences.** Classes fixes : `<1 ms`, `~10 ms`, `~100 ms`, `~1 s`, `>1 s`.

**Empreinte.** Ordres de grandeur relatifs, jamais de gCO₂e inventés. Toute affirmation chiffrée sur l'empreinte doit renvoyer à une méthodologie publiée et la citer nommément. La page méthodologie précise que ce sont des estimations et pourquoi une mesure exacte est impossible côté API.

**Réglementaire.** Factuel, daté, sans conseil. Formulation imposée : « ce que cette approche vous fait entrer dans le périmètre de » et « ce qu'elle ne vous dispense pas de ». Aucune fiche ne dit à quelqu'un qu'il est conforme ou non. Un encadré permanent en pied de page réglementaire : information générale, pas un avis juridique, faites valider par un professionnel.

### 4.6 Règle de vérité du code

**Aucune fiche n'est publiée si son code n'a pas été exécuté et vérifié.**

C'est la règle la plus importante du document. Un catalogue dont le code ne tourne pas n'a aucune valeur et détruit la réputation de son auteur.

Chaque extrait de code vit dans un fichier réel du dépôt, sous `content/snippets/`, avec un test qui l'exécute. La fiche importe le fichier, elle ne contient pas de code recopié à la main. Si le test ne passe pas, la CI bloque le déploiement.

---

## 5. Schéma de données

### 5.1 Fichier de fiche

Un fichier par fiche, en MDX, dans `content/entries/<id>.mdx`. L'`id` est en anglais, en kebab-case, stable et définitif.

```yaml
---
id: mask-personal-data-in-chat
family: detect-filter
status: published            # published | draft
verdict: N0
updated: 2026-09-10
contributors: [florentin-biaou]

title:
  fr: "Masquer les données personnelles dans un fil de discussion"
  en: "Mask personal data in a chat thread"

need:
  fr: "Empêcher qu'un numéro de téléphone ou un email soit visible dans un message envoyé."
  en: "Prevent phone numbers and emails from appearing in a sent message."

scenario:
  fr: "On voit régulièrement un appel LLM sur chaque message entrant pour repérer les coordonnées..."
  en: "A common pattern is calling an LLM on every inbound message to spot contact details..."

rungs:
  - level: N0
    available: true
    name:
      fr: "Normalisation puis expressions régulières"
      en: "Normalisation then regular expressions"
    cost: nul
    latency: "<1 ms"
    risks:
      data_egress: none          # none | own-infra | third-party
      deterministic: true
      testability: unit          # unit | statistical | hard
      vendor_lock: none          # none | library | provider
      footprint: negligible      # negligible | low | moderate | high
      regulatory:
        fr: ["Aucun périmètre spécifique ajouté"]
        en: ["No specific scope added"]
    code:
      python: snippets/mask-personal-data-in-chat/n0.py
      javascript: snippets/mask-personal-data-in-chat/n0.js
    breaking_point:
      fr: "L'obfuscation volontaire : « zéro six », « o6 », chiffres écrits en lettres, emojis intercalés."
      en: "Deliberate obfuscation: spelled-out digits, lookalike characters, interspersed emoji."
    escalate_when:
      fr: "Vos utilisateurs contournent activement le filtre."
      en: "Your users are actively working around the filter."

  - level: N1
    available: true
    # ... même structure

  - level: N2
    available: false
    unavailable_reason:
      fr: "Sans intérêt ici : N1 couvre déjà les cas de contournement à un coût inférieur."
      en: "Not useful here: N1 already covers evasion cases at a lower cost."

  - level: N3
    available: true
    # ... même structure

verdict_rationale:
  fr: "N0 suffit dans l'immense majorité des intégrations..."
  en: "N0 is enough for the vast majority of integrations..."

further_reading:
  - label: "..."
    url: "https://..."

sources:
  - label: "Méthodologie d'estimation d'empreinte"
    url: "https://..."
---
```

### 5.2 Contraintes de validation

Un schéma de validation (Zod via les collections de contenu Astro) rejette au build toute fiche qui viole une de ces règles :

- `id` unique, en kebab-case, identique au nom de fichier
- `family` appartient aux dix familles
- `verdict` désigne un barreau dont `available` vaut `true`
- tout barreau `available: true` a un `name`, un `cost`, une `latency`, un bloc `risks` complet, un `breaking_point`, et au moins un fichier de code existant sur le disque
- tout barreau `available: false` a un `unavailable_reason`
- `cost` appartient au vocabulaire de la section 4.5
- `latency` appartient aux classes de la section 4.5
- tous les champs bilingues ont leurs deux langues renseignées
- `updated` est une date valide et n'est pas dans le futur
- `status: published` exige que tous les fichiers de code référencés passent leurs tests

### 5.3 Fichier de famille

`content/families/<id>.mdx` : titre bilingue, description bilingue de deux à quatre phrases, question type que se pose quelqu'un qui arrive dans cette famille, ordre d'affichage, référence à l'illustration.

---

## 6. Contenu de lancement

### 6.1 Les 25 fiches à produire

Complètes, vérifiées, publiées. Réparties pour couvrir les dix familles et les quatre barreaux.

**Détecter et filtrer**
1. `mask-personal-data-in-chat` — Masquer les coordonnées dans un message · verdict attendu N0
2. `detect-spam-in-contact-form` — Repérer le spam dans un formulaire de contact · N1
3. `find-duplicate-records` — Repérer les doublons dans une base clients · N0
4. `moderate-user-comments` — Modérer des commentaires publics · N2

**Extraire**
5. `extract-dates-from-text` — Extraire des dates d'un texte libre · N0
6. `extract-fields-from-invoice` — Extraire les champs d'une facture · N2
7. `parse-address-into-fields` — Découper une adresse postale · N1

**Classer et router**
8. `route-support-tickets` — Aiguiller des tickets vers la bonne équipe · N1
9. `tag-articles-by-topic` — Étiqueter des articles par thème · N1
10. `detect-language-of-text` — Détecter la langue d'un texte · N0

**Chercher**
11. `search-in-your-own-documents` — Chercher dans ses propres documents · N0
12. `add-autocomplete-to-a-search-bar` — Autocomplétion sur une barre de recherche · N0
13. `fuzzy-match-company-names` — Rapprocher des noms d'entreprises mal orthographiés · N0

**Recommander**
14. `show-similar-articles` — Proposer des articles similaires · N1
15. `rank-products-by-relevance` — Trier des produits par pertinence · N0

**Prédire**
16. `forecast-weekly-sales` — Prévoir des ventes hebdomadaires · N1
17. `detect-anomalies-in-metrics` — Repérer une anomalie dans des métriques · N0

**Générer**
18. `generate-test-data` — Produire des jeux de données de test · N0
19. `write-product-descriptions` — Rédiger des descriptions produit · N3
20. `generate-placeholder-images` — Produire des images de remplacement · N0

**Transformer**
21. `summarise-a-long-document` — Résumer un document long · N3
22. `translate-interface-strings` — Traduire les libellés d'une interface · N2
23. `convert-messy-csv-to-clean-data` — Nettoyer un CSV mal formé · N0

**Reconnaître et transcrire**
24. `read-text-from-a-scanned-page` — Lire le texte d'une page scannée · N2

**Décider et valider**
25. `validate-a-form-server-side` — Valider un formulaire côté serveur · N0

Les verdicts indiqués sont ceux attendus. Si en écrivant la fiche tu établis qu'un autre barreau est le bon, change le verdict et signale-le dans le bilan. Le catalogue doit refléter la réalité, pas la liste.

### 6.2 La feuille de route de 200

Produis **200 intitulés** de fiches futures, répartis sur les dix familles, en incluant les 25 ci-dessus. Chaque intitulé comporte un `id`, un titre bilingue, une famille et une ligne de besoin. Ils sont stockés dans `content/roadmap.yaml`.

> **Révisé au lot 14.** Les 200 intitulés restent, comme document de travail du
> dépôt : ils valident que l'architecture tient à cette échelle et donnent aux
> contributeurs une liste dans laquelle se servir. La **page publique** qu'ils
> alimentaient est retirée. Annoncer cent soixante-quinze fiches qui n'existent
> pas est une promesse, et ce site n'en fait pas. Ce qui la remplace côté
> lecteur, ce sont les dernières fiches publiées et le flux RSS.

Ces 200 ne sont **pas** des fiches. Aucun contenu de barreau n'est généré pour eux. Ils servent à trois choses : montrer l'ampleur du catalogue visé, valider que l'architecture tient à 200 entrées, et donner aux contributeurs une liste dans laquelle se servir.

L'architecture du site, la navigation, la recherche et les filtres doivent fonctionner correctement avec 200 fiches publiées. Génère un jeu de données de test à 200 entrées pour le vérifier, non commité, ou derrière un drapeau de développement.

---

## 7. Arborescence et spécification des pages

### 7.1 Arborescence

```
/                              accueil
/catalogue                     toutes les fiches, recherche et filtres
/familles/<family>             une par famille (10)
/fiches/<id>                   une par fiche (25 au lancement)
/methodologie                  les barreaux, comment on évalue, comment on chiffre
/a-propos                      le projet et son auteur
/contribuer                    comment proposer une fiche
/accompagnement                mise en place chez vous, contact
/mentions-legales
/confidentialite
/credits                       licences, polices, sources
/404
/rss.xml  /sitemap.xml
```

Toutes les URL existent en `/fr/...` et `/en/...`. Voir section 9.3.

### 7.2 Accueil

Registre éditorial, DA assumée. C'est la seule page où l'on vend l'idée.

- **Hero** : un aplat de couleur de marque pleine largeur, la phrase de mission en très grosse typo. Pas d'illustration décorative dans le hero, la typo est l'objet visuel.
- **La démonstration** : un exemple concret immédiatement sous le hero, sur le modèle « ce qu'on vous propose » contre « ce qui suffit », avec deux blocs de code côte à côte et les chiffres en dessous. C'est l'élément le plus important de la page : quelqu'un doit comprendre le produit sans lire une phrase d'explication.
- **Les dix familles** : grille, chacune avec son illustration et sa question type, cliquable.
- **Comment lire une fiche** : les quatre barreaux expliqués en une bande visuelle.
- **Trois fiches mises en avant**, choisies pour leur diversité de verdict, dont une qui recommande N3.
- **Le pied de page éditorial** : la contribution, l'accompagnement, le poids de la page.

### 7.3 Catalogue

Outil de consultation. C'est la page qui doit devenir un réflexe.

- Barre de recherche en haut, focus au chargement, résultats instantanés en tapant
- Filtres : par famille, par verdict, par sortie de données, par déterminisme
- Résultats en liste dense, une ligne par fiche : titre, famille, badge de verdict, mini-échelle des barreaux disponibles
- Compteur de résultats, état vide utile qui propose de contribuer la fiche manquante
- Fonctionne sans JavaScript en dégradé : la liste complète est rendue au build, la recherche et les filtres l'enrichissent

### 7.4 Page de famille

- Bandeau avec l'illustration de la famille et sa description
- La question type, en gros
- Liste des fiches de la famille, même composant que le catalogue
- ~~Les intitulés de la feuille de route appartenant à cette famille, en grisé, avec un lien pour la proposer~~ — retiré au lot 14 avec la page feuille de route. La page de famille se termine sur l'appel à proposer un besoin.

### 7.5 Page de fiche

Registre dense. Peu de DA, beaucoup de contenu.

- En-tête : titre, besoin, famille, badge de verdict, date de révision
- Le scénario, en encadré
- ~~Tableau récapitulatif des barreaux, colonnes : barreau, approche, coût, latence, données, déterministe, verdict~~ — **révisé au lot 14** : sept colonnes ne se lisent ni à 360 px ni à 1440. Remplacé par quatre cartes, une par niveau, portant le nom de l'approche, le coût et la latence en langage courant, et le marqueur « recommandé » sur celle du verdict. Le verdict apparaît toujours deux fois : en réponse dans le bandeau, et sur cette carte.
- Les barreaux détaillés, ancrables, avec sommaire latéral collant sur grand écran
- Blocs de code avec onglets Python et JavaScript, coloration syntaxique effectuée au build, bouton copier, pas de numéros de ligne
- Verdict argumenté
- Pour aller plus loin, sources, métadonnées
- Bloc d'accompagnement en fin de page (section 7.9)
- Liens vers deux ou trois fiches voisines

### 7.6 Méthodologie

Page de confiance. Elle doit exister avant que quiconque la demande.

- Les quatre barreaux, définis
- Comment un verdict est déterminé
- Comment les coûts sont exprimés et pourquoi il n'y a pas de prix absolus
- Comment l'empreinte est estimée, avec la méthodologie citée nommément, et pourquoi c'est une estimation
- Pourquoi la couleur des barreaux n'exprime pas un jugement de valeur
- La limite explicite sur le réglementaire : information générale, pas un avis juridique
- Comment signaler une erreur

### 7.7 À propos

Deux sections distinctes.

**Le projet** : pourquoi il existe, ce qu'il refuse d'être, comment il se finance, à savoir pas du tout, ce qui explique l'absence de publicité et de partenariat.

**L'auteur** : présentation de Florentin Biaou, ingénieur IA et data. Photo, parcours court, ce sur quoi il travaille, liens GitHub et LinkedIn. Le ton est direct et professionnel, à la première personne. Cette page est un actif de réputation, elle doit être soignée.

Contenu à rédiger par tes soins à partir de ces éléments, puis à faire relire. Marque le texte comme brouillon dans le bilan.

### 7.8 Contribuer

- Ce qui fait une bonne fiche, avec la règle de vérité du code mise en avant
- La structure imposée, avec un lien vers le gabarit
- Le processus : fork, écriture, pull request, relecture, fusion
- Le bouton « proposer une fiche sans coder », qui ouvre une issue GitHub pré-remplie
- Ce qui est refusé : contenu non vérifié, promotion d'un outil, chiffres sans source

### 7.9 Accompagnement

Page dédiée, plus un bloc en fin de chaque fiche.

- Formulation : « Vous voulez mettre ça en place chez vous ? »
- Ce qui est proposé : audit d'un cas d'usage, mise en place de l'alternative, formation d'équipe
- Lien `mailto:biaouflo@gmail.com` avec objet pré-rempli reprenant le titre de la fiche d'origine, pour tracer la provenance
- L'adresse est obfusquée côté rendu pour limiter l'aspiration automatique, tout en restant cliquable et lisible sans JavaScript

### 7.10 Pages légales

**Mentions légales** : éditeur du site, statut, adresse de contact, directeur de publication, hébergeur avec ses coordonnées, référence au dépôt.

**Confidentialité** : le site ne dépose aucun cookie, n'utilise aucun traceur, ne collecte aucune donnée personnelle, ne fait aucune mesure d'audience côté client. Si un jour une mesure est ajoutée, elle sera sans cookie et anonyme. Le seul traitement possible est l'email envoyé volontairement via le lien de contact, avec sa finalité et sa durée de conservation.

Cette page n'est pas une formalité. Sur un site qui parle de sobriété et de risques réglementaires, l'absence totale de traceurs est un argument. Affiche-la comme telle.

**Crédits** : licence du contenu (CC BY 4.0), licence du code des exemples (MIT), polices utilisées et leurs licences, sources des méthodologies, contributeurs.

### 7.11 ~~Feuille de route~~ — retirée au lot 14

~~Les 200 intitulés, groupés par famille, avec pour chacun son état : publié, brouillon, à écrire. Un compteur global. Un lien pour se saisir d'un intitulé.~~

La page a existé et a été retirée au lot 14. Les 200 intitulés restent dans
`content/roadmap.yaml`, où ils servent au jeu de test à deux cents fiches et
aux contributeurs. Ce que le lecteur veut savoir — ce qui vient d'être publié —
est servi par la page des dernières fiches et par le flux RSS (section 8.4 du
lot 14).

---

## 8. Système de design

### 8.1 Direction artistique

Esprit éditorial, à la manière des magazines en ligne du recrutement et de la culture tech : **aplats de couleur francs, typographie très grande et très grasse posée dessus, illustration vectorielle, ton chaleureux et assumé.** L'inverse du minimalisme anonyme et l'inverse du corporate froid.

Cette direction s'applique en deux registres, avec **un seul système de tokens** :

| Registre | Pages | Traitement |
|---|---|---|
| **Éditorial** | accueil, familles, méthodologie, à propos, contribuer | Aplats pleine largeur, titres démesurés, illustrations, respiration généreuse |
| **Documentaire** | fiches, catalogue | Dense, strict, exemple avant explication, code visible immédiatement, DA réduite à l'en-tête |

Le passage de l'un à l'autre doit être évident sans être une rupture : mêmes couleurs, mêmes polices, mêmes rayons, mêmes espacements de base.

### 8.2 Ce qui est interdit visuellement

Ces traitements sont proscrits parce qu'ils signalent immédiatement une page produite sans intention :

- surtitres en majuscules espacées au-dessus des titres
- accentuation d'un seul mot du titre en couleur ou en italique
- contenu découpé en cartes identiques avec la même ombre grise douce partout
- même rayon de bordure sur tous les éléments quelle que soit leur hiérarchie
- dégradés décoratifs sans fonction
- flèche « → » collée au texte des liens et des boutons
- chaînes de métadonnées jointes par des points médians
- animations d'entrée en fondu-glissé sur chaque section au défilement
- numérotation 01 / 02 / 03 sur du contenu qui n'est pas une séquence

Le mouvement est réservé à ce qui répond à une action de l'utilisateur : ouverture d'un onglet de code, confirmation de copie, dépliage d'un barreau.

### 8.3 Couleur

```css
--ink:        #16130E;  /* texte, aplats sombres. Brun-noir, jamais du noir pur */
--paper:      #FFFDF7;  /* fond principal, blanc chaud */
--paper-2:    #F4EFE2;  /* fonds secondaires, encadrés */
--brand:      #FFCE00;  /* couleur de marque, aplats, logo, en-têtes */
--brand-deep: #D9A600;  /* bordures et états actifs sur fond jaune */
--go:         #1B7A4B;  /* badge « recommandé », uniquement */
--rung-0:     #EDE7D7;  /* échelle de poids, du plus léger */
--rung-1:     #C8BC9E;
--rung-2:     #8A7C5C;
--rung-3:     #4C4432;  /* au plus lourd */
```

**Règles d'emploi, contractuelles :**

- Le jaune ne porte **jamais** de texte courant. Il sert en aplat, avec `--ink` par-dessus, en très gros. Le contraste du jaune sur blanc est insuffisant pour du texte fin.
- La rampe `--rung-*` code **le poids de la solution**, pas sa qualité. Elle va du clair au foncé, dans une seule famille de neutres chauds. Elle n'est **jamais** un dégradé du vert au rouge.
- Le vert `--go` est réservé au badge « recommandé ». Ce badge peut se poser sur n'importe quel barreau, N3 compris. Aucune autre couleur n'exprime un jugement.
- Texte sur `--rung-0` et `--rung-1` : `--ink`. Texte sur `--rung-2` et `--rung-3` : `--paper`.
- Tous les couples texte-fond atteignent au minimum le rapport de contraste 4,5:1, et 3:1 pour les textes de plus de 24 px en gras.

Mode sombre construit sur les mêmes tokens, avec des valeurs alternatives déclarées au même endroit. Pas d'inversion mécanique.

### 8.4 Typographie

Trois familles, toutes libres, auto-hébergées, sous-ensemble latin, format woff2.

| Rôle | Police | Emploi |
|---|---|---|
| Display | **Bricolage Grotesque** | Titres de niveau 1 et 2, chiffres mis en avant, aplats. Graisses hautes, largeur resserrée sur les très grandes tailles |
| Texte | **Inter** | Corps de texte, interface, tableaux |
| Code | **JetBrains Mono** | Blocs de code, valeurs techniques inline |

Échelle typographique, base 16 px, ratio 1,25 sur le texte et progression plus agressive sur le display :

```
display-xl   clamp(3rem, 8vw, 6.5rem)   Bricolage 800, interligne 0.95, interlettrage -0.03em
display-l    clamp(2.25rem, 5vw, 4rem)  Bricolage 700, interligne 1.0
h2           2rem                        Bricolage 700
h3           1.5rem                      Inter 650
body         1.0625rem                   Inter 400, interligne 1.65
small        0.875rem                    Inter 400
code         0.9375rem                   JetBrains Mono 400, interligne 1.6
```

Longueur de ligne du corps de texte : 68 caractères maximum. Alignement à gauche partout, jamais justifié.

Le display est un élément actif de la composition, pas un simple véhicule du contenu : il peut déborder, se poser sur un aplat, occuper toute la largeur.

### 8.5 Mise en page

- Grille de 12 colonnes, largeur maximale de contenu 1200 px, colonne de lecture 680 px
- Espacement sur une échelle de 4 px : 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
- Rayons de bordure hiérarchisés : 0 sur les aplats pleine largeur, 4 px sur les blocs de code et les tableaux, 999 px sur les badges. Pas de rayon uniforme partout.
- Ombres : aucune par défaut. La séparation vient des fonds et des filets, pas des ombres.
- Point de rupture unique à 900 px, plus un ajustement à 600 px

### 8.6 Illustrations

Tu produis les illustrations toi-même, en SVG, à la main, inline ou en fichiers dans `src/assets/illustrations/`.

**À produire :**

- 10 illustrations de famille, une par famille, format carré, 400 × 400 dans le viewBox
- 1 illustration de hero pour l'accueil, format large
- 1 illustration pour l'état vide du catalogue
- 1 illustration pour la page 404
- 4 pictogrammes de barreau, simples, pour le tableau récapitulatif

**Contraintes :**

- Vectoriel pur, pas de trame ni de dégradé complexe
- Palette limitée aux tokens : `--ink`, `--brand`, `--paper`, `--paper-2`, plus un accent chaud par famille tiré de la rampe
- Style cohérent sur les douze : formes géométriques simples, traits épais, aucun détail fin, lisible à 80 px comme à 400 px
- Chaque illustration exprime le **verbe** de sa famille, concrètement. « Chercher » n'est pas une loupe générique, c'est une idée de tri dans une masse. Cherche l'idée avant la forme.
- Poids maximal 8 Ko par illustration, optimisées
- Attribut `role="img"` et `<title>` bilingue sur chacune

Ne prends pas d'illustration existante, ne t'inspire d'aucune œuvre identifiable, ne reproduis aucun style de marque existante.

### 8.7 Plancher de qualité

Non négociable, vérifié en CI :

- Responsive jusqu'à 360 px de large
- Focus clavier visible sur tout élément interactif, jamais supprimé
- `prefers-reduced-motion` respecté, toute animation désactivée
- Navigation complète au clavier, ordre de tabulation logique
- Un seul `h1` par page, hiérarchie de titres sans saut
- Textes alternatifs sur toutes les images porteuses de sens
- Contrastes conformes AA
- Le site reste lisible et navigable sans JavaScript

---

## 9. Recherche, filtres, bilinguisme

### 9.1 Recherche

Index construit au build, exécuté côté client, sans serveur. Pagefind ou équivalent.

- Recherche sur : titre, besoin, scénario, noms des approches, famille
- Résultats instantanés, à partir de deux caractères
- Insensible aux accents et à la casse
- Tolérance aux fautes légères
- L'index couvre les deux langues, mais une recherche dans une langue ne retourne que les fiches de cette langue

### 9.2 Filtres

Combinables, reflétés dans l'URL en paramètres de requête pour que l'état soit partageable.

- Famille (dix valeurs)
- Verdict (N0, N1, N2, N3)
- Sortie de données (rien ne sort, reste chez vous, part chez un tiers)
- Déterminisme (oui, non)

### 9.3 Bilinguisme

- Deux langues : anglais et français
- **L'anglais est la version canonique** pour le référencement. `hreflang` déclaré dans les deux sens, balise canonique pointant vers la version de la langue courante, `x-default` vers l'anglais.
- URL préfixées : `/en/...` et `/fr/...`. La racine redirige selon l'en-tête `Accept-Language`, avec une préférence mémorisée en `localStorage` uniquement après choix explicite de l'utilisateur.
- Sélecteur de langue présent sur toutes les pages, qui conserve la page courante
- Une fiche dont une langue est incomplète ne se publie pas
- Interface, navigation, messages d'erreur et états vides traduits, pas seulement le contenu

---

## 10. Stack et structure du dépôt

### 10.1 Choix techniques

| Élément | Choix | Raison |
|---|---|---|
| Générateur | Astro 5, sortie statique | Zéro JavaScript par défaut, collections de contenu typées, i18n natif |
| Contenu | MDX + collections avec schéma Zod | Validation au build |
| Styles | Tailwind CSS 4 avec tokens en variables CSS | Cohérence, poids maîtrisé |
| Coloration syntaxique | Shiki, au build | Évite le flash de code non colorisé |
| Recherche | Pagefind | Index statique, pas de serveur |
| Tests de code | pytest pour Python, node:test pour JavaScript | Exécution réelle des extraits |
| Hébergement | Cloudflare Pages | Statique, gratuit à cette échelle, build sur push |

Aucun framework d'interface côté client. Les rares comportements interactifs (onglets de code, copie, filtres, recherche) sont écrits en JavaScript natif, en modules, chargés uniquement sur les pages qui en ont besoin.

### 10.2 Structure

```
overkill/
├── content/
│   ├── entries/            25 fiches .mdx
│   ├── families/           10 fichiers .mdx
│   ├── snippets/           le code réel, par fiche
│   │   └── <entry-id>/
│   │       ├── n0.py  n0.js  n0.test.py  n0.test.js
│   │       └── ...
│   ├── pages/              contenu des pages éditoriales, bilingue
│   └── roadmap.yaml        les 200 intitulés
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   │   ├── en/
│   │   └── fr/
│   ├── styles/tokens.css   la source unique des tokens
│   ├── assets/illustrations/
│   └── i18n/
├── tests/
├── scripts/
│   ├── check-content.mjs   validation du schéma
│   ├── check-links.mjs     liens morts
│   └── check-weight.mjs    budget de poids
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/propose-entry.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── CONTRIBUTING.md
├── LICENSE          MIT, pour le code
├── LICENSE-CONTENT  CC BY 4.0, pour le contenu
└── README.md
```

---

## 11. Workflow, CI, déploiement

### 11.1 Workflow

Tout passe par un push GitHub. Aucune interface d'administration, aucune base.

- L'auteur écrit une fiche en MDX, pousse, le site se reconstruit et se déploie automatiquement
- Un contributeur fork, écrit, ouvre une pull request, l'auteur relit et fusionne
- Un visiteur non développeur utilise le bouton « proposer une fiche », qui ouvre une issue pré-remplie avec le gabarit

### 11.2 Contrôles automatiques

Sur chaque pull request et chaque push, dans cet ordre. Un échec bloque le déploiement.

1. `check-content` — validation du schéma de toutes les fiches (section 5.2)
2. `test-snippets` — exécution de tous les extraits Python et JavaScript
3. `build` — construction du site
4. `check-links` — aucun lien interne mort, liens externes signalés en avertissement
5. `check-weight` — budgets de poids respectés (section 12)
6. `check-a11y` — audit automatisé sur l'accueil, une page de famille et une page de fiche

### 11.3 Gabarits

**Pull request** : case à cocher confirmant que le code a été exécuté, la commande utilisée, les deux langues renseignées, la source des chiffres.

**Issue de proposition** : besoin en une phrase, famille pressentie, ce que la personne a vu faire, ce qu'elle pense qui suffirait.

---

## 12. Performance et budgets

Le site incarne sa propre thèse. Ces budgets sont vérifiés en CI et bloquants.

| Élément | Budget |
|---|---|
| Page de fiche, transféré, hors illustrations | ≤ 120 Ko |
| Accueil, transféré, illustrations comprises | ≤ 250 Ko |
| Polices, total sur tout le site | ≤ 90 Ko |
| JavaScript sur une page de fiche | ≤ 15 Ko |
| JavaScript sur le catalogue, index de recherche exclu | ≤ 25 Ko |
| Illustration unitaire | ≤ 8 Ko |

Le poids de la page courante est affiché en pied de page, calculé au build. C'est un argument, pas un gadget : personne d'autre ne peut le copier sans refaire son site.

Aucun traceur, aucune mesure d'audience côté client, aucune ressource tierce chargée à l'exécution. Les polices sont auto-hébergées.

---

## 13. Lots, dépendances, définition de terminé

Déduis tes sprints de ce découpage. Chaque lot ne dépend que des précédents.

| # | Lot | Dépend de | Terminé quand |
|---|---|---|---|
| 1 | Fondations : dépôt, Astro, Tailwind, tokens, polices, layout de base | — | `npm run build` passe, une page blanche affiche la typo et les couleurs correctes, budget polices respecté |
| 2 | Schéma de contenu et validation | 1 | Le schéma Zod rejette une fiche invalide de test, accepte une fiche valide de test |
| 3 | Système de composants : blocs de code à onglets, tableau de barreaux, badges, illustrations de barreau | 1, 2 | Une page de démonstration montre tous les composants dans leurs états, au clavier et en mode sombre |
| 4 | Gabarits de pages : fiche, famille, catalogue, éditorial | 3 | Les quatre gabarits rendent correctement avec des données factices, responsive à 360 px |
| 5 | Recherche et filtres | 4 | Recherche et filtres fonctionnent sur 200 fiches de test, état reflété dans l'URL, dégradation sans JavaScript vérifiée |
| 6 | Extraits de code et leurs tests, pour les 25 fiches | 2 | Tous les extraits s'exécutent, tous les tests passent |
| 7 | Rédaction des 25 fiches, dans les deux langues | 2, 6 | Les 25 passent la validation, aucun barreau incomplet, verdicts justifiés |
| 8 | Illustrations | 3 | 12 illustrations plus 4 pictogrammes, dans le budget, cohérentes entre elles |
| 9 | Pages éditoriales, légales, contribuer, accompagnement, feuille de route | 4, 7 | Toutes les pages de la section 7.1 existent dans les deux langues, aucun texte de remplissage |
| 10 | Bilinguisme complet | 7, 9 | Interface, erreurs et états vides traduits, `hreflang` et canoniques corrects |
| 11 | CI, gabarits GitHub, documentation de contribution | 6, 7 | Les six contrôles tournent, une PR de test invalide est bien refusée |
| 12 | Performance, accessibilité, déploiement | tous | Budgets respectés, audit d'accessibilité sans erreur bloquante, site déployé et accessible |

---

## 14. Interdits d'exécution

Ces règles priment sur toute autre considération, y compris la vitesse d'avancement.

1. **Ne publie aucune fiche dont le code n'a pas été exécuté.** En cas de doute, `status: draft`.
2. **N'invente aucun chiffre.** Pas de prix absolu, pas de gCO₂e sans méthodologie citée, pas de benchmark non réalisé. En l'absence de source, utilise le vocabulaire d'ordre de grandeur ou n'affirme rien.
3. **N'écris aucun conseil juridique.** Décris le périmètre réglementaire de façon factuelle et datée, renvoie à un professionnel.
4. **Ne code jamais un jugement de valeur sur l'IA dans la couleur.** La rampe mesure le poids.
5. **N'ajoute ni compte utilisateur, ni base de données, ni paiement, ni commentaires, ni traceur.**
6. **N'ajoute aucune ressource tierce chargée à l'exécution.**
7. **Ne génère pas les 200 fiches.** 25 fiches, 200 intitulés.
8. **N'utilise aucun contenu, illustration, police ou style appartenant à une marque existante.**
9. **N'appelle aucune API d'IA dans le site lui-même.** Le site ne contient pas d'IA, et il l'affiche. C'est un argument, pas une contrainte technique.
10. **Ne remplace pas un texte manquant par du faux contenu.** Écris un vrai texte ou marque-le explicitement comme brouillon.

---

## 15. Bilan de fin de mission

À la livraison, produis `RAPPORT.md` à la racine, structuré ainsi :

**Fait et vérifié** — ce qui fonctionne, avec la preuve : commande exécutée, résultat obtenu.

**Fait mais non vérifié** — ce qui est en place sans preuve automatisée, et pourquoi.

**Volontairement laissé de côté** — avec la raison.

**Décisions prises en autonomie** — chaque point sur lequel le cahier des charges était muet, la décision retenue, l'alternative écartée. Section la plus importante du rapport.

**Écarts au cahier des charges** — tout point où tu as fait autrement que spécifié, avec la justification. Notamment les verdicts de fiche qui diffèrent de ceux attendus en section 6.1.

**État du contenu** — tableau des 25 fiches : publiée ou brouillon, code testé, deux langues, source des chiffres. Plus le compte des 200 intitulés par famille.

**Mesures** — poids réel par type de page, poids des polices, poids du JavaScript, résultat de l'audit d'accessibilité, temps de build.

**Ce qu'il reste à faire pour la mise en ligne** — liste ordonnée et actionnable pour le commanditaire, en particulier : achat du nom de domaine, relecture du texte de la page à propos, relecture du contenu réglementaire par un juriste, fourniture de la photo de l'auteur.

**Ce qui va casser en premier** — ton évaluation honnête des trois points les plus fragiles du projet à six mois.

---

## Annexe A — Décisions déjà arbitrées

Ces points ont été tranchés par le commanditaire. Ne les rouvre pas.

| Sujet | Décision |
|---|---|
| Nom | Overkill |
| Positionnement | Le bon outil pour la bonne tâche, jamais anti-IA |
| Langues | Anglais canonique, français complet |
| Langages d'exemple | Python et JavaScript, les deux systématiquement |
| Coûts | Ordres de grandeur, jamais de valeurs absolues |
| Empreinte | Dans la v1, en estimations sourcées |
| Familles | Dix, rangées par verbe |
| Barreaux | Quatre, N0 à N3, ordre fixe |
| Contenu de lancement | 25 fiches vérifiées, 200 intitulés en feuille de route |
| Couleur de marque | Jaune en aplat, sémantique des barreaux en rampe neutre plus vert |
| Illustrations | Produites dans le cadre du projet, en SVG |
| Comptes utilisateurs | Aucun, jamais |
| Publicité et partenariats | Aucun |
| Contact | `mailto:biaouflo@gmail.com`, temporaire |
| Contribution | Pull request GitHub avec validation éditoriale |

---

## Annexe B — Points ouverts pour le commanditaire

À trancher avant la mise en ligne, sans bloquer le développement.

1. Nom de domaine : `overkill.dev` est probablement pris, prévoir des variantes
2. Statut juridique de l'éditeur, à faire figurer dans les mentions légales
3. Passage du `mailto` à un formulaire, une fois le volume de spam constaté
4. Relecture du contenu réglementaire par un juriste avant toute communication publique
5. Photo et texte définitif de la page à propos
