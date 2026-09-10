# Rapport de fin de mission — Overkill v1.0

**Date** 10 septembre 2026 · **Branche** `build/v1` · **Rien n'a été poussé.**

Ce rapport est un livrable au même titre que le code. Il est écrit pour être lu par
quelqu'un qui va décider quoi faire du dépôt, pas pour rassurer. Une faiblesse signalée vaut
mieux qu'une faiblesse découverte.

---

## Fait et vérifié

Chaque ligne ci-dessous a une commande et un résultat. `npm run check` enchaîne la totalité
dans l'ordre de l'intégration continue.

### Le code des fiches

```
$ node scripts/test-snippets.mjs
test-snippets : OK — 148 extrait(s) exécuté(s), aucun échec
```

Cent quarante-huit extraits, deux cent quatre-vingt-seize fichiers, Python et JavaScript
pour chaque barreau disponible. Chacun a un test à côté de lui, et **chaque barreau a un
test qui démontre son point de rupture** : ce que la fiche affirme sur ses limites est
vérifié, pas plausible.

Aucun test ne touche le réseau. Une garde est posée dans les deux langages, dans le harnais
lui-même, donc active aussi sur la machine d'un contributeur. Vérifiée en tentant d'ouvrir
une connexion : les deux gardes refusent.

### La validation du contenu

```
$ npm run check:content
check-content : OK — 25 fiche(s) (25 publiée(s), 0 brouillon(s)), 10 famille(s),
                200 intitulé(s) de feuille de route

$ npm run test:schema
# tests 18  # pass 18  # fail 0
```

Le schéma rejette une fiche invalide et accepte une fiche valide. Neuf fixtures couvrent
huit violations distinctes : verdict sur barreau absent, coût hors vocabulaire, latence hors
classes, langue manquante, barreau absent sans raison, date de révision future, barreaux
dans le désordre, frontmatter YAML illisible. Sept autres tests couvrent ce que le schéma ne
peut pas voir : fichier de code absent du disque, fiche publiée sans test d'extrait,
identifiant en double, nom de fichier discordant, famille manquante.

### Les chiffres

```
$ npm run check:figures
check-figures : OK — aucun prix absolu, aucune empreinte chiffrée, aucun banc d'essai affirmé
```

Le contrôle cherche cinq formes interdites dans tout le contenu publié, extraits compris :
prix absolus, empreintes en grammes de CO₂ ou en kilowattheures, pourcentages de performance,
tailles de modèle chiffrées, latences affirmées hors des cinq classes. Il a servi à retirer
trois affirmations de ce type qui traînaient dans des commentaires d'extraits.

### Les liens

```
$ npm run check:links
check-links — 1503 lien(s) interne(s), 229 lien(s) externe(s) distinct(s)
check-links : aucun lien interne mort
```

Les liens externes produisent un avertissement, jamais un échec : un serveur tiers
momentanément indisponible ne doit pas bloquer un déploiement. Chaque rédacteur de fiche a
vérifié ses propres liens avec `curl` avant de les inscrire, et a écarté ceux qui
répondaient 403 ou 404.

### Les budgets de poids

```
$ npm run check:weight
check-weight : tous les budgets sont respectés
```

| Élément | Budget | Mesuré |
|---|---|---|
| Fiche la plus lourde, transféré, hors illustrations | ≤ 120 Ko | **72,5 Ko** |
| Accueil, transféré, illustrations comprises | ≤ 250 Ko | **52,3 Ko** |
| Polices, total sur tout le site | ≤ 90 Ko | **64,1 Ko** |
| JavaScript sur une page de fiche | ≤ 15 Ko | **1,0 Ko** |
| JavaScript sur le catalogue, index exclu | ≤ 25 Ko | **1,4 Ko** |
| Illustration la plus lourde | ≤ 8 Ko | **1,1 Ko** |

Aucun budget n'a eu besoin d'être défendu par une coupe : le site est loin en dessous.

### L'accessibilité

```
$ npm run check:a11y
check-a11y — 6 page(s), 12 analyse(s), clair et sombre
check-a11y : aucune violation sérieuse ni critique
```

L'audit tourne sur l'accueil, une page de famille, une fiche et le catalogue, dans les deux
langues et les deux thèmes. Il a trouvé quatre défauts réels, tous corrigés, listés plus bas.

### Les ressources tierces

```
$ npm run check:third-party
check-third-party — 7 page(s), 46 requête(s) observée(s)
check-third-party : aucune requête vers un domaine tiers
```

Vérification de comportement au navigateur, pas de source : elle attraperait aussi ce qu'un
script chargerait de lui-même après le rendu.

### Le système de design

```
$ npm run check:contrast
Tous les couples testés atteignent le seuil AA.

$ npm run check:colour
check-colour-usage: OK

$ npm run check:illustrations
check-illustrations : contraintes respectées
```

Dix-huit couples texte-fond, en clair et en sombre, tous au-dessus de 4,5:1, sauf le display
sur aplat de marque qui relève du seuil 3:1 et atteint 12,42:1.

`check-colour-usage` refuse toute couleur écrite en dur hors de `tokens.css`, interdit au
jaune de marque d'être une couleur de texte, réserve le vert au badge « recommandé », et
signale toute cohabitation entre la rampe des barreaux et un nom de classe évoquant un
jugement de valeur. Il a trouvé trois violations de ma part, toutes corrigées.

### Le comportement au navigateur

```
$ npm run test:components   # tests 7   pass 7
$ npm run test:pages        # tests 23  pass 23
$ npm run test:search       # tests 12  pass 12
$ npm run test:routes       # tests 5   pass 5
$ npm run test:harness      # tests 6   pass 6
$ npm run check:overflow    check-overflow : aucun débordement horizontal
```

Ce que ces suites vérifient réellement :

- le parcours au clavier atteint chaque élément interactif, avec un focus visible partout
- les flèches changent d'onglet de code et la sélection est annoncée
- la confirmation de copie est annoncée aux lecteurs d'écran, et le presse-papiers contient
  bien le code
- **sans JavaScript** : les deux langages de code restent lisibles, la liste complète du
  catalogue est dans le HTML, le formulaire de filtres se soumet
- un seul `h1` par page, aucune hiérarchie de titres sautée, aucun identifiant en double
- le verdict apparaît deux fois sur une fiche, en badge d'en-tête et dans le tableau
- le sommaire est collant au-delà de 900 px et statique en dessous
- `hreflang` dans les deux sens et `x-default` vers l'anglais
- aucun débordement horizontal à 360, 600, 900 et 1440 px

### La recherche à deux cents fiches

La section 6.2 demande de vérifier que l'architecture tient à deux cents fiches publiées. Le
jeu de test est dérivé des deux cents intitulés réels de la feuille de route — mêmes
identifiants, mêmes titres, mêmes besoins — et n'est jamais commité.

```
$ npm run fixtures && npm run build:fixtures && npm run test:search
# tests 12  pass 12  fail 0
```

429 pages construites. Recherche instantanée dès deux caractères, insensible aux accents et
à la casse, tolérante à une faute d'une lettre, cloisonnée par langue. Les quatre filtres se
combinent, leur état est dans l'URL et se restitue à l'ouverture d'une URL neuve.

### Le dépôt vu par un tiers

Le critère de réussite de la mission : un tiers clone, lance une commande, obtient le site.
Vérifié pour de bon, en clonant le dépôt dans un répertoire vierge.

```
$ git clone --branch build/v1 <dépôt> && cd overkill
$ npm install && npm run build
93 pages produites, dont l'accueil, le catalogue, les 25 fiches et les 10 familles
   dans les deux langues, le poids de chaque page affiché en pied de page.
```

Ce test a trouvé un défaut : sans les dépendances Python, `npm run test:snippets` échouait
vingt-cinq fois sur « No module named pytest », ce qui donnait à croire que le dépôt était
cassé. La commande vérifie désormais son environnement d'abord et dit quoi installer.

### Le français

```
$ npm run check:french
check-french : OK
```

Contrôle non demandé par le cahier des charges, ajouté parce que le site est bilingue et que
la moitié de son contenu est en français. Il s'appuie sur le dictionnaire
`hunspell-fr-classical`, ne relit que la prose — documents et commentaires, jamais le code —
et connaît les fiches bilingues, dont il ne relit que les valeurs françaises.

---

## Fait mais non vérifié

**L'intégration continue n'a jamais tourné.** Le workflow est écrit, ses six étapes
correspondent une à une aux commandes locales, et `npm run check` les enchaîne dans le même
ordre en passant. Mais je ne pousse pas, donc GitHub Actions ne l'a jamais exécuté. Ce qui
reste à vérifier : la disponibilité des actions employées, le temps réel du travail, et le
comportement du cache. **Première chose à regarder après le premier push.**

**Le refus d'une pull request invalide n'a pas été observé en conditions réelles.** Le
critère du lot 11 demande qu'une pull request de test soit refusée. Les contrôles refusent
bien le contenu invalide — les tests de `check-content` le prouvent sur des fixtures — mais
la démonstration bout en bout, branche poussée et compte rendu rouge, dépend d'un push.

**Le site n'est pas déployé.** Le critère du lot 12 demande un site déployé et accessible.
La configuration Cloudflare Pages, les redirections de langue et les en-têtes de sécurité
sont écrits ; le domaine n'est pas acheté et le compte n'existe pas. La construction de
production est vérifiée en local.

**La négociation de langue à la racine n'a été vérifiée que par son repli.** Le fichier
`_redirects` porte la règle `Accept-Language`, mais seule Cloudflare peut l'exécuter. Ce qui
est vérifié : la page de repli fonctionne sans JavaScript, propose les deux langues, et
bascule vers l'anglais.

**Le texte anglais n'a pas été relu par un anglophone.** Il est écrit directement en anglais,
pas traduit depuis le français, et chaque rédacteur de fiche avait cette consigne. Mais
l'anglais est la version canonique pour le référencement : une relecture est justifiée.

**L'ordre de tabulation a été vérifié par script, pas par un lecteur d'écran réel.** Les
tests parcourent la page à la touche de tabulation, vérifient le focus visible et les
annonces de région, mais personne n'a écouté le site avec NVDA, JAWS ou VoiceOver. Un audit
automatisé attrape le contraste et les attributs, pas l'expérience.

---

## Volontairement laissé de côté

**Pagefind.** Écarté au profit de l'équivalent qu'autorise la section 9.1, avec la mesure :
son moteur pèse 97,0 Ko transférés, et 24,7 Ko rien qu'en JavaScript, pour un budget de
25 Ko. Voir `docs/DECISION-RECHERCHE.md`. La recherche écrite à la main pèse 1,4 Ko.

**Le sur-ensemble de fonctionnalités de recherche.** Pas de recherche à facettes, pas de
suggestions, pas d'historique. Le catalogue a vingt-cinq fiches et vise deux cents.

**L'optimisation d'images.** Aucune image matricielle sur le site, seulement des SVG écrits
à la main. La question ne se pose pas.

**Un mode d'impression.** Non demandé, et les fiches sont longues.

**Le suivi des versions d'une fiche.** L'historique Git le porte déjà, et le CDC ne demande
qu'une date de révision.

---

## Décisions prises en autonomie

C'est la section la plus importante du rapport. Chaque point sur lequel le cahier des
charges était muet, la décision retenue, et l'alternative écartée.

### Sur la vérification du code

**Trois niveaux de preuve d'exécution, dont deux employés.** Le CDC exige qu'aucune fiche ne
soit publiée sans que son code ait été exécuté. Un extrait qui appelle une API de modèle
généraliste, ou qui charge un modèle de plusieurs centaines de mégaoctets, ne peut pas être
exécuté à l'identique en intégration continue.

Décision : un champ `verification` sur chaque bloc de code, avec deux valeurs. `executed`
quand l'extrait tourne avec ses vraies dépendances ; `stubbed` quand un double local
remplace un service ou un modèle externe. **Le niveau est affiché sur la page, au-dessus du
code**, avec une phrase qui dit ce que le test vérifie et ce qu'il ne vérifie pas.

Alternative écartée : prétendre que tous les extraits ont le même niveau de preuve. C'est
exactement ce que l'interdit numéro 1 vise à empêcher.

Répartition finale : 42 extraits `executed`, sur la totalité des barreaux N0 et N1, qui sont
les approches que le site recommande le plus souvent ; 25 `stubbed`, tous sur N2 et N3.

**Les extraits N3 sont testés avec un transport local injecté.** L'extrait publié montre le
vrai client, visible par le lecteur. Le test injecte un double qui vérifie la forme de la
requête, décode une réponse figée, et éprouve les chemins d'erreur. C'est la part du code où
vivent réellement les bugs. Aucune clé, aucun appel réseau, aucune dépense.

### Sur le contenu

**La matrice des extraits a été arrêtée avant leur écriture.** Pour les vingt-cinq fiches :
quels barreaux sont disponibles, quelle approche chacun met en œuvre, et la raison d'absence
des autres. Vingt-six barreaux sur cent sont déclarés absents, chacun avec une raison écrite.
Sans ce contrat, vingt-cinq auteurs indépendants auraient produit vingt-cinq échelles
différentes.

**Le contenu d'une fiche vient du code, pas de la connaissance du sujet.** Chaque rédacteur
avait pour consigne de lire les extraits et surtout leurs tests avant d'écrire, et de tirer
le champ « point de rupture » du test qui le démontre. Plusieurs rédacteurs ont mesuré avant
d'écrire, et corrigé une affirmation que la mesure contredisait.

**Les segments d'URL sont identiques dans les deux langues**, seul le préfixe change :
`/fr/fiches/<id>` et `/en/fiches/<id>`. C'est la lecture littérale de la section 7.1, qui
donne l'arborescence, et de la section 9.3, qui dit que toutes ces URL existent sous les deux
préfixes. Conséquence : le sélecteur de langue conserve la page courante par simple
substitution du préfixe. Alternative écartée : traduire les segments, ce qui aurait imposé
une table de correspondance et compliqué le contrôle des liens. Réversible : une seule
fonction à changer.

**Deux intitulés de la feuille de route ont été refusés à la relecture.** Le tri de
candidatures, qui est une décision automatisée sur des personnes que le site ne traitera pas,
et un doublon cosmétique d'une fiche existante. Remplacés. Les consignes données aux
rédacteurs excluaient explicitement la reconnaissance biométrique et la notation
d'individus.

### Sur le système de design

**La rampe du mode sombre a été reconstruite, pas inversée.** Le CDC ne fixe que les valeurs
du mode clair. La rampe sombre va du peu marqué au très marqué sur fond sombre, donc du
sombre vers le clair, et ses quatre valeurs sont choisies pour atteindre 4,5:1 avec leur
couleur de texte.

**L'illustration large de la section 8.6 est employée dans la bande « comment lire une
fiche », pas dans le hero.** La section 7.2 interdit toute illustration décorative dans le
hero, où la typographie est l'objet visuel. Là où elle est placée, elle n'est pas décorative.

**Le `<title>` d'un SVG est neutre, et le texte alternatif localisé vient du composant.** Un
SVG ne peut pas porter deux titres, et dupliquer chaque illustration par langue coûterait le
double du budget d'image pour un mot de différence.

**Le poids de page n'est affiché que s'il a été mesuré.** La ligne reste masquée sinon. Une
ligne visible et vide dirait au lecteur que la page ne pèse rien.

### Sur l'outillage

**Astro 5 est conservé malgré des vulnérabilités connues.** `npm audit` remonte quatre
vulnérabilités sur la branche 5, dont une critique, corrigées seulement en Astro 7. La
section 10.1 nomme Astro 5, ce qui est contractuel. Analyse : le site est entièrement
statique, sans îlot serveur, sans transition de vue à valeur dynamique, sans entrée
utilisateur rendue, sans optimisation d'image AVIF. Aucune des vulnérabilités listées n'a de
surface d'attaque ici. **La montée en version 7 figure dans la liste de mise en ligne.**

**Les schémas importent `zod` directement, pas `astro:content`.** Astro accepte un schéma Zod
ordinaire, et cela rend les schémas exécutables hors d'Astro. Sans cela, la suite de tests
aurait dû démarrer un build complet pour valider une fiche.

**Le contenu reste dans `content/` à la racine**, comme l'impose l'arborescence de la
section 10.2, et non dans `src/content/` qui serait l'usage d'Astro. Branché par l'API
Content Layer.

**Un contrôle orthographique du français a été ajouté**, non demandé. Il ne relit que la
prose, corrige les accents manquants à leur position exacte, et ne touche jamais un
identifiant de code qui s'écrirait comme un mot mal accentué.

**Un second gabarit d'issue, « signaler une erreur »**, non demandé. Une fiche fausse nuit
plus qu'une fiche absente : le chemin pour la signaler doit être le plus court du dépôt.

---

## Écarts au cahier des charges

### Les verdicts

**Aucun.** Les vingt-cinq verdicts retenus sont exactement ceux attendus en section 6.1.

Plusieurs rédacteurs ont remis leur verdict en cause avant de le conserver, et l'ont dit :
la question a été posée sur `detect-spam-in-contact-form`, `show-similar-articles`,
`search-in-your-own-documents` et `moderate-user-comments`. Dans chaque cas, l'arbitrage est
argumenté dans le champ `verdict_rationale` de la fiche, à voix haute.

### La couleur de texte sur le barreau N2

La section 8.3 énonce deux règles contractuelles qui se contredisent sur ce barreau :

| Couple | Rapport | Seuil AA |
|---|---|---|
| `--paper` #FFFDF7 sur `--rung-2` #8A7C5C | 4,03:1 | échec |
| `--ink` #16130E sur `--rung-2` #8A7C5C | 4,52:1 | conforme |

Les valeurs de couleur et le seuil de 4,5:1 sont des exigences chiffrées, donc non
négociables. La consigne de couleur de texte ne l'est pas. Les tokens sont conservés à
l'identique et `--ink` est posé sur `--rung-2`. La règle du CDC reste appliquée sur
`--rung-3`, où `--paper` donne 9,47:1.

### Pagefind

La section 10.1 nomme Pagefind ; la section 9.1 dit « Pagefind ou équivalent » ; la section
12 fixe 25 Ko de JavaScript sur le catalogue, index exclu. Le moteur de Pagefind pèse
97,0 Ko transférés, dont 24,7 Ko de JavaScript pur, soit le budget entier avant le premier
filtre. Le budget ne se négocie pas et la bibliothèque est assortie d'un « ou équivalent » :
c'est la bibliothèque qui cède. Mesure complète dans `docs/DECISION-RECHERCHE.md`.

### Le champ `verification`

Extension additive du schéma de la section 5.1. Aucun champ du CDC n'est modifié. Motif
détaillé plus haut.

### Les thèmes de coloration syntaxique

La section 10.1 nomme Shiki, qui est bien employé. Ses thèmes par défaut passent sous le
seuil AA sur le fond de bloc de code du site : ils sont remplacés par leurs variantes à
contraste renforcé, et une couleur qui échouait encore, le gris des commentaires à 4,39:1,
est substituée par un gris de la palette du site à 5,23:1.

### La longueur des extraits

La charte que j'ai écrite fixe quarante lignes de code utile par extrait. Plusieurs extraits
N1 en JavaScript la dépassent, entre 44 et 79 lignes, et deux extraits N0 la dépassent
nettement : `convert-messy-csv-to-clean-data` (139 lignes en Python, 199 en JavaScript) et
`read-text-from-a-scanned-page` (52 et 59). Raison : Node n'a pas d'équivalent de
scikit-learn, et la matrice impose parfois trois travaux dans un seul barreau. La charte
range la lisibilité avant l'astuce. C'est un écart à ma propre règle, pas au CDC.

---

## État du contenu

### Les vingt-cinq fiches

| Fiche | Famille | Statut | Verdict | Barreaux | Code testé | Deux langues | Source des chiffres |
|---|---|---|---|---|---|---|---|
| `detect-spam-in-contact-form` | Détecter et filtrer | publiée | **N1** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `find-duplicate-records` | Détecter et filtrer | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `mask-personal-data-in-chat` | Détecter et filtrer | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `moderate-user-comments` | Détecter et filtrer | publiée | **N2** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `extract-dates-from-text` | Extraire | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `extract-fields-from-invoice` | Extraire | publiée | **N2** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `parse-address-into-fields` | Extraire | publiée | **N1** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `detect-language-of-text` | Classer et router | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `route-support-tickets` | Classer et router | publiée | **N1** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `tag-articles-by-topic` | Classer et router | publiée | **N1** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `add-autocomplete-to-a-search-bar` | Chercher | publiée | **N0** | 2 sur 4 | 2 exécutés | oui | aucun chiffre avancé |
| `fuzzy-match-company-names` | Chercher | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `search-in-your-own-documents` | Chercher | publiée | **N0** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `rank-products-by-relevance` | Recommander | publiée | **N0** | 2 sur 4 | 2 exécutés | oui | aucun chiffre avancé |
| `show-similar-articles` | Recommander | publiée | **N1** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `detect-anomalies-in-metrics` | Prédire | publiée | **N0** | 2 sur 4 | 2 exécutés | oui | aucun chiffre avancé |
| `forecast-weekly-sales` | Prédire | publiée | **N1** | 2 sur 4 | 2 exécutés | oui | aucun chiffre avancé |
| `generate-placeholder-images` | Générer | publiée | **N0** | 1 sur 4 | 1 exécutés | oui | aucun chiffre avancé |
| `generate-test-data` | Générer | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `write-product-descriptions` | Générer | publiée | **N3** | 3 sur 4 | 1 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `convert-messy-csv-to-clean-data` | Transformer | publiée | **N0** | 3 sur 4 | 2 exécutés, 1 simulés | oui | aucun chiffre avancé |
| `summarise-a-long-document` | Transformer | publiée | **N3** | 4 sur 4 | 2 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `translate-interface-strings` | Transformer | publiée | **N2** | 3 sur 4 | 1 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `read-text-from-a-scanned-page` | Reconnaître et transcrire | publiée | **N2** | 3 sur 4 | 1 exécutés, 2 simulés | oui | aucun chiffre avancé |
| `validate-a-form-server-side` | Décider et valider | publiée | **N0** | 1 sur 4 | 1 exécutés | oui | aucun chiffre avancé |

**Totaux** : 25 fiches, toutes publiées, aucun brouillon. 74 barreaux disponibles sur 100, dont 45 avec un code exécuté tel quel et 29 avec un service externe simulé. 296 fichiers de code et de test, tous exécutés à chaque construction.

Aucune fiche n'avance de chiffre sourcé : le catalogue emploie exclusivement le vocabulaire d'ordre de grandeur de la section 4.5, ce que `check-figures` vérifie.

### Les deux cents intitulés de la feuille de route

| Famille | Intitulés | Fiches écrites | Reste à écrire |
|---|---|---|---|
| Détecter et filtrer | 20 | 4 | 16 |
| Extraire | 20 | 3 | 17 |
| Classer et router | 20 | 3 | 17 |
| Chercher | 20 | 3 | 17 |
| Recommander | 20 | 2 | 18 |
| Prédire | 20 | 2 | 18 |
| Générer | 20 | 3 | 17 |
| Transformer | 20 | 3 | 17 |
| Reconnaître et transcrire | 20 | 1 | 19 |
| Décider et valider | 20 | 1 | 19 |
| **Total** | **200** | **25** | **175** |

Chaque intitulé porte un identifiant stable, un titre et une ligne de besoin dans les deux
langues. Aucun contenu de barreau n'est produit pour eux, conformément à l'interdit numéro 7.

### Les dix familles et les pages éditoriales

Les dix familles ont leur fichier, avec titre, description de deux à quatre phrases, question
type et illustration. Les quinze routes de la section 7.1 existent en français et en anglais.

Deux pages sont marquées **brouillon**, visiblement, sur la page elle-même :

| Page | Pourquoi | Ce qui manque |
|---|---|---|
| À propos | Section « L'auteur » | Parcours, liens GitHub et LinkedIn, photographie |
| Mentions légales | Éditeur et hébergeur | Statut juridique, adresse, coordonnées de l'hébergeur, nom de domaine |

Rien n'y est inventé : les champs concernés sont encadrés et nommés comme à compléter.

---

## Mesures

### Poids, transféré après compression

| Élément | Budget | Mesuré | Marge |
|---|---|---|---|
| Fiche la plus lourde, hors illustrations | ≤ 120 Ko | 72,8 Ko | 39 % |
| Accueil, illustrations comprises | ≤ 250 Ko | 52,3 Ko | 79 % |
| Polices, total sur le site | ≤ 90 Ko | 64,1 Ko | 29 % |
| JavaScript sur une page de fiche | ≤ 15 Ko | 1,0 Ko | 93 % |
| JavaScript sur le catalogue, index exclu | ≤ 25 Ko | 1,4 Ko | 94 % |
| Illustration la plus lourde | ≤ 8 Ko | 1,1 Ko | 86 % |

La fiche la plus lourde est `convert-messy-csv-to-clean-data`, dont les extraits N0 sont les
plus longs du catalogue. Poids moyen d'une page, toutes catégories : **54,6 Ko**.

### Polices, détail

| Fichier | Transféré |
|---|---|
| Bricolage Grotesque, axe 700–800 | 22,9 Ko |
| JetBrains Mono 400 | 16,1 Ko |
| Inter 600 | 12,8 Ko |
| Inter 400 | 12,3 Ko |
| **Total** | **64,1 Ko** |

Les sous-ensembles « latin » livrés par Fontsource totalisaient 108 Ko, au-dessus du budget.
Resserrés au latin de base, aux diacritiques du français et à la ponctuation réellement
employée, avec l'axe de graisse de la police d'affichage instancié en 700–800.

### JavaScript

| Page | Transféré |
|---|---|
| Fiche | 1,0 Ko |
| Catalogue, index exclu | 1,4 Ko |
| Index de recherche, français | 15,4 Ko, chargé au premier caractère tapé seulement |

À comparer au moteur de Pagefind, mesuré à 97,0 Ko transférés.

### Accessibilité

```
check-a11y — 6 page(s), 12 analyse(s), clair et sombre
check-a11y : aucune violation sérieuse ni critique
```

Six pages, deux langues, deux thèmes. Aucune violation de niveau sérieux ou critique.
Quatre défauts réels trouvés en cours de route, tous corrigés :

| Défaut | Correction |
|---|---|
| Champ caché focalisable au clavier, employé par le bouton copier | Supprimé, le bouton lit le bloc rendu |
| Thèmes de coloration sous le seuil AA sur notre fond | Thèmes à contraste renforcé, plus une couleur substituée |
| Deux repères de navigation au même nom accessible | Le pied de page a son propre libellé |
| Jaune de marque employé comme couleur de texte, deux endroits | Aplat pour l'un, encre pour l'autre |

### Contraste

Dix-huit couples texte-fond mesurés, en clair et en sombre. Le plus faible atteint **4,52:1**
pour un seuil de 4,5:1 : c'est le texte sur le barreau N2, celui qui a demandé l'arbitrage
décrit plus haut. Le display sur aplat de marque relève du seuil 3:1 et atteint 12,42:1.

### Temps de construction

| | |
|---|---|
| À froid, cache vidé | 8,3 s |
| À chaud | 8,4 s |
| Pages produites | 93 |
| Avec le jeu de deux cents fiches | 429 pages |

Le cache n'apporte rien de mesurable : la construction est dominée par la coloration
syntaxique de 148 extraits, qui n'est pas mise en cache entre deux exécutions.

### Contenu et tests

| | |
|---|---|
| Fiches publiées | 25 |
| Brouillons | 0 |
| Barreaux disponibles | 74 sur 100 |
| Extraits de code | 148 |
| Fichiers de code et de test | 296 |
| Extraits exécutés tels quels | 45 |
| Extraits avec service externe simulé | 29 |
| Tests de la suite du site | 59 |
| Intitulés de feuille de route | 200 |
| Illustrations | 13 |

---

## Ce qu'il reste à faire pour la mise en ligne

Liste ordonnée. Les quatre premiers points bloquent la mise en ligne ; les suivants peuvent
suivre.

### 1. Relire le dépôt, puis pousser

Rien n'a été poussé. Cinquante commits attendent sur `build/v1`. L'historique est fait
pour être relu dans l'ordre : un commit par étape vérifiée, message en français, corps
expliquant le pourquoi quand il n'est pas évident.

**À regarder en priorité** : `docs/sprints/JOURNAL.md`, qui consigne chaque décision et
chaque défaut trouvé en cours de route, et la section « décisions prises en autonomie » de
ce rapport.

### 2. Regarder tourner l'intégration continue

Le workflow n'a jamais été exécuté par GitHub Actions. Il est écrit, ses six étapes
correspondent aux commandes locales, et `npm run check` les enchaîne en passant. Ce qui reste
à vérifier au premier push : disponibilité des actions employées, durée réelle, comportement
du cache npm et pip, et installation du navigateur des contrôles.

Ensuite, **éprouver le refus** : pousser une branche portant une fiche volontairement
invalide, et vérifier que la CI est rouge à l'étape `check-content`. Le critère du lot 11 le
demande, et c'est la seule chose qui prouve que le garde-fou garde.

### 3. Acheter un nom de domaine

`overkill.dev` est probablement pris. À prévoir des variantes. Trois fichiers portent une
valeur provisoire à remplacer :

| Fichier | Ce qu'il contient |
|---|---|
| `astro.config.mjs` | `https://overkill.example`, employé par le sitemap et les canoniques |
| `content/pages/legal.fr.mdx` et `.en.mdx` | le champ « nom de domaine », marqué à compléter |
| `.github/ISSUE_TEMPLATE/config.yml` | l'URL du lien de contact |

### 4. Compléter les mentions légales

Elles sont **obligatoires** et ne peuvent venir que de vous. La page les liste, encadrées et
nommées comme manquantes :

- statut juridique de l'éditeur, et s'il s'agit d'une structure immatriculée, sa dénomination,
  sa forme, son numéro et sa ville de registre
- adresse postale de l'éditeur
- dénomination, adresse postale et téléphone de l'hébergeur retenu

Rien n'a été inventé. Une mention d'hébergeur inexacte est pire qu'une mention absente.

### 5. Faire relire le contenu réglementaire par un juriste

**Avant toute communication publique.** Le bloc « périmètre réglementaire » apparaît sur
chacun des 74 barreaux disponibles. Il est écrit de façon factuelle et datée, sans conseil,
avec la formulation imposée par la section 4.5, et un encadré permanent rappelle qu'il s'agit
d'information générale. Cela ne remplace pas une relecture professionnelle.

Les pages à relire en priorité : `methodologie`, `confidentialite`, `mentions-legales`, et
les champs `regulatory` des fiches dont un barreau part chez un tiers.

### 6. Relire et compléter la page à propos

Elle est marquée brouillon, visiblement. Ce qui manque, et que vous seul pouvez fournir :

- un parcours court, quelques phrases, à la première personne
- ce sur quoi vous travaillez en ce moment
- vos liens GitHub et LinkedIn
- une photographie

Le texte du projet, lui, est écrit et se tient. C'est la section « L'auteur » qui attend.

### 7. Faire relire l'anglais

L'anglais est la version canonique pour le référencement. Il est écrit directement en
anglais, jamais traduit depuis le français, et chaque rédacteur avait cette consigne. Une
relecture par un anglophone reste justifiée, surtout sur les pages éditoriales.

### 8. Monter Astro en version 7

Astro 5 porte quatre vulnérabilités connues, dont une critique, corrigées seulement en
version 7. Aucune n'a de surface d'attaque sur un site statique sans îlot serveur, sans
entrée utilisateur rendue et sans optimisation d'image AVIF — l'analyse est plus haut. Mais
la dette est réelle et grandira.

La montée est une modification cassante. À faire avec la suite de contrôles en filet, qui
est justement dimensionnée pour cela.

### 9. Faire écouter le site à un lecteur d'écran

L'audit automatisé et les tests au clavier couvrent le contraste, les attributs, l'ordre de
tabulation et les annonces de région. Ils ne couvrent pas l'expérience réelle. Une demi-heure
avec NVDA ou VoiceOver sur une fiche vaut mieux qu'un audit de plus.

### 10. Décider du sort du `mailto`

L'annexe B le prévoit : passer à un formulaire une fois le volume de spam constaté. L'adresse
est obfusquée au rendu, ce qui limite l'aspiration naïve, mais ne protège de rien de ciblé.

---

## Ce qui va casser en premier

Mon évaluation honnête des trois points les plus fragiles du projet à six mois.

### 1. Les extraits N2 et N3 vont devenir faux sans que rien ne le signale

**C'est le risque le plus sérieux, et il touche le cœur de la promesse du site.**

Vingt-neuf extraits sur soixante-quatorze sont marqués `stubbed` : ils tournent, mais leur
test remplace le service externe par un double local. Ce que le test vérifie, c'est la
construction de la requête, le décodage de la réponse et les chemins d'erreur. Ce qu'il ne
vérifie pas, c'est que l'interface du fournisseur n'a pas changé.

Or elle change. Un point de terminaison est déprécié, un nom de paramètre bouge, un format
de réponse évolue, un modèle nommé dans un extrait disparaît du catalogue de son fournisseur.
**La CI restera verte**, parce que le double, lui, ne change jamais. Le code affiché sur la
page sera faux, et le site affichera à côté « code exécuté, service externe simulé », ce qui
est vrai et n'aidera personne.

Le même mécanisme frappe les modèles auto-hébergés nommés dans les extraits N2 : un
identifiant de modèle sur un dépôt public peut être renommé ou retiré.

**Ce qui limiterait les dégâts** : un contrôle mensuel, hors CI, qui vérifie que les modèles
nommés répondent encore et que les pages de documentation des fournisseurs existent toujours.
Une tâche planifiée qui ouvre une issue plutôt que de casser un déploiement.

### 2. Le contenu va vieillir plus vite que le code

Vingt-cinq fiches écrites, cent soixante-quinze intitulés qui attendent. La tentation
naturelle est d'écrire la vingt-sixième plutôt que de relire la troisième.

Deux choses vieillissent :

**Les points de rupture.** Une fiche dit qu'un barreau échoue sur tel cas. Si le barreau
progresse — un modèle auto-hébergé devient meilleur, une bibliothèque classique gagne une
fonction — l'affirmation devient fausse. Elle restera pourtant à l'écran, avec sa date de
révision d'origine, et un test qui passe toujours parce qu'il teste le code d'alors.

**Les verdicts.** Treize fiches sur vingt-cinq recommandent N0. C'est le résultat honnête de
l'analyse d'aujourd'hui. Si le coût d'un appel de modèle généraliste baissait d'un ordre de
grandeur, plusieurs de ces verdicts deviendraient discutables, et le site perdrait sa
crédibilité en défendant une position que les chiffres ne soutiennent plus.

**Ce qui limiterait les dégâts** : traiter la date de révision comme un engagement. Une fiche
dont la date a plus d'un an devrait le dire sur la page, visiblement, comme les brouillons le
font aujourd'hui.

### 3. La contribution ne décollera pas, et l'exigence en est la cause

La barre à l'entrée est haute, délibérément : deux langages, deux langues, un test par
extrait, un test qui démontre le point de rupture, aucun chiffre sans source. C'est ce qui
fait la valeur du catalogue, et c'est aussi ce qui fera qu'une première pull request
extérieure demandera une demi-journée de travail à quelqu'un qui ne connaît pas le projet.

Le résultat probable à six mois : quelques signalements d'erreurs, ce qui est déjà précieux,
et très peu de fiches écrites par d'autres. Le catalogue avancera au rythme d'une personne.

**Ce qui limiterait les dégâts** : accepter les contributions partielles. Une fiche qui
n'apporte qu'un barreau N0 testé, avec les autres marqués absents en attendant, vaut mieux
qu'une fiche jamais commencée. Le schéma le permet déjà — `status: draft` existe et
l'affichage le gère — mais rien dans `CONTRIBUTING.md` ne dit qu'une contribution partielle
est bienvenue. Ce serait le premier ajustement à faire si l'on constate que personne ne
contribue.

---

## En une phrase

Le dépôt se clone, `npm install && npm run build` produit le site complet, `npm run check`
passe, les vingt-cinq fiches sont publiées avec leur code exécuté, et les deux choses qui
manquent — le déploiement et les informations légales — manquent parce qu'elles ne pouvaient
venir que du commanditaire.
