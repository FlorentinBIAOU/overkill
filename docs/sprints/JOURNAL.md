# Journal d'exécution — Overkill v1.0

Une entrée par lot terminé. Décisions prises, écarts au plan, points bloqués contournés.
Tenu au fil de l'eau, pas reconstitué à la fin.

---

## Lot 00 — Planification

**Date** 10 septembre 2026

**Fait**

- Lecture intégrale de `docs/CDC.md`, 846 lignes.
- Douze fichiers de sprint produits dans `docs/sprints/`, un par lot de la section 13.
- `docs/sprints/PLAN.md` : graphe de dépendances, ordre d'exécution en neuf vagues,
  choix de parallélisation, estimation de volume par lot.

**Vérifications d'environnement effectuées avant d'écrire le plan**

| Point vérifié | Résultat |
|---|---|
| Node, npm, Python, Git | 22.12.0, 10.9.0, 3.13.3, 2.49.0 |
| Registre npm joignable | oui |
| Dernière version d'Astro 5 | 5.18.2 |
| Intégration MDX compatible Astro 5 | `@astrojs/mdx` 4.3.14 |
| Tailwind 4 | 4.3.3 |
| Pagefind | 1.5.2 |
| `venv` et installation de `pytest` et `scikit-learn` | fonctionnent |

**Décisions prises**

Les sept décisions structurantes D1 à D7 sont consignées dans la section 5 de `PLAN.md`.
Les trois qui engagent le plus :

- **D2** — le contenu reste dans `content/` à la racine, comme l'impose la section 10.2 du
  CDC, et non dans `src/content/` qui serait l'usage d'Astro. Branché par l'API Content Layer
  d'Astro 5. L'arborescence du CDC est contractuelle.
- **D3** — trois niveaux de vérification déclarés par extrait de code, affichés sur la fiche.
  Le CDC exige que tout code publié ait été exécuté. Un extrait N3 qui appelle une API de LLM
  ne peut pas être exécuté à l'identique en CI. Plutôt que de mentir sur le niveau de preuve,
  le niveau réel est déclaré. Extension additive du schéma de la section 5.1, signalée comme
  écart dans `RAPPORT.md`.
- **D4** — les extraits N3 sont testés avec un transport local injecté qui vérifie la forme
  de la requête et décode une réponse figée. Aucun appel réseau, aucune clé.

**Écarts au plan**

Aucun, le plan vient d'être écrit.

**Points bloqués**

Aucun.

**Prochaine étape**

Lot 01 — Fondations.

---

## Lot 01 — Fondations

**Terminé.** Commande de vérification : `npm run check` — verte.

**Fait**

- Astro 5.18.2, Tailwind 4.3.3, MDX 4.3.14, sitemap. Sortie statique, i18n `en`/`fr`
  avec préfixe sur les deux langues.
- `src/styles/tokens.css` : les dix couleurs de la section 8.3, l'échelle typographique de
  la section 8.4, l'échelle d'espacement de 4 px, les trois rayons hiérarchisés, le mode
  sombre en valeurs alternatives.
- Trois polices auto-hébergées, sous-ensemblées. **64,1 Ko** pour un budget de 90 Ko.
- Layout de base, page de contrôle `/dev/tokens`, quatre scripts de vérification.

**Mesures**

| Point | Mesure | Budget |
|---|---|---|
| Polices, total | 64,1 Ko | ≤ 90 Ko |
| Bricolage Grotesque, axe 700–800 | 22,9 Ko | — |
| JetBrains Mono 400 | 16,1 Ko | — |
| Inter 600 | 12,8 Ko | — |
| Inter 400 | 12,3 Ko | — |
| Débordement horizontal à 360, 600, 900, 1440 px | aucun | aucun |
| Focus visible sur les 5 éléments interactifs | oui | oui |

**Décisions prises**

- **Astro 5 conservé malgré des vulnérabilités connues.** `npm audit` remonte quatre
  vulnérabilités sur la branche 5, dont une critique, corrigées seulement en Astro 7.
  Le CDC nomme Astro 5 en section 10.1, ce qui est contractuel. Analyse : le site est
  entièrement statique, sans îlot serveur, sans transition de vue à valeur dynamique, sans
  entrée utilisateur rendue, et sans optimisation d'image AVIF. Aucune des vulnérabilités
  listées n'a de surface d'attaque ici. Astro 5 est conservé, et la montée en version 7 est
  portée à la liste des actions de mise en ligne du rapport.
- **Sous-ensemblage des polices plus strict que « latin ».** Les sous-ensembles latin livrés
  par Fontsource totalisent 108 Ko, au-dessus du budget de 90 Ko. Resserrés au latin de base,
  aux diacritiques du français et à la ponctuation typographique réellement employée. L'axe
  de graisse de Bricolage Grotesque est instancié en 700–800. Le repli prévu au plan, à
  savoir abandonner une famille, n'a pas eu à être employé.
- **Polices servies depuis `public/fonts/`** plutôt que depuis `src/assets/`, pour obtenir
  une URL stable préchargeable. Le CDC ne place pas les polices dans son arborescence.
- **Le poids 650 de `h3`** est déclaré sur la fonte Inter 600 avec une plage `600 700`, pour
  que la valeur du CDC tombe sur une fonte réelle plutôt que sur un gras synthétique.
- **Pages de contrôle sous `/dev/`**, retirées de la sortie de production par un script
  plutôt que par le préfixe `_` d'Astro, qui les aurait empêchées d'être rendues du tout.

**Écart au cahier des charges**

- **Couleur de texte sur `--rung-2`.** La section 8.3 énonce deux règles contractuelles qui
  se contredisent sur ce barreau :

  | Couple | Rapport | Seuil AA |
  |---|---|---|
  | `--paper` #FFFDF7 sur `--rung-2` #8A7C5C | 4,03:1 | échec |
  | `--ink` #16130E sur `--rung-2` #8A7C5C | 4,52:1 | conforme |

  Les valeurs de couleur et le seuil de 4,5:1 sont des exigences chiffrées, donc non
  négociables. La consigne de couleur de texte ne l'est pas. Les tokens sont conservés à
  l'identique et `--ink` est posé sur `--rung-2`. La règle du CDC reste appliquée sur
  `--rung-3`, où `--paper` donne 9,47:1. Vérifié par `scripts/check-contrast.mjs`.

- **Rampe du mode sombre.** Le CDC ne fixe que les valeurs du mode clair. La rampe sombre a
  été retenue à #2C2820, #453E30, #8A7C5C, #B0A184, de sorte que les quatre barreaux
  atteignent au moins 4,5:1 avec leur couleur de texte. Elle va du peu marqué au très marqué
  sur fond sombre, donc du sombre vers le clair : c'est une reconstruction du sens de la
  rampe, pas une inversion mécanique.

**Points bloqués contournés**

Aucun.

**Prochaine étape**

Lot 02 — Schéma de contenu et validation.

---

## Lot 02 — Schéma de contenu et validation

**Terminé.** Commande de vérification : `npm run check` — verte. 18 tests, 0 échec.

**Fait**

- Schémas Zod : énumérations contractuelles, aide bilingue, barreau en union discriminée
  sur `available`, fiche, famille, page éditoriale, intitulé de feuille de route.
- Collections Astro branchées sur `content/` à la racine par l'API Content Layer.
- `scripts/check-content.mjs` pour ce que Zod ne voit pas : le disque et les autres fiches.
- Neuf fixtures, une valide et huit invalides, une par règle critique.
- Gabarit de fiche commenté, qui servira à la page contribuer.

**Preuve**

| Contrôle | Résultat |
|---|---|
| `tests/schema.test.mjs` | 11 tests, 0 échec |
| `tests/check-content.test.mjs` | 7 tests, 0 échec |
| Fiche conforme acceptée | oui |
| Verdict sur barreau absent | rejeté |
| Coût hors vocabulaire | rejeté |
| Latence hors classes | rejetée |
| Langue manquante | rejetée |
| Barreau absent sans raison | rejeté |
| Date de révision future | rejetée |
| Barreaux dans le désordre | rejetés |
| Fichier de code absent du disque | rejeté par `check-content` |
| Fiche publiée sans test d'extrait | rejetée, message citant la section 4.6 |
| La même fiche en brouillon | acceptée avec avertissement |

**Décisions prises**

- **Les schémas importent `zod` directement, pas `astro:content`.** Astro accepte un schéma
  Zod ordinaire, et cela rend les schémas exécutables hors d'Astro. Sans cela, la suite de
  tests aurait dû démarrer un build complet pour valider une fiche. `zod` est épinglé en
  3.25.76, la version qu'emploie Astro 5, pour éviter deux Zod incompatibles.
- **`check-content` accepte `--content=<dossier>`.** La suite de tests monte un dossier de
  contenu jetable et y lance le contrôle réel, plutôt que de simuler son comportement. Un
  contrôle non testé est une opinion.
- **Une fiche en brouillon dont un extrait n'a pas de test passe avec un avertissement.**
  L'interdit numéro 1 vise les fiches publiées. Un brouillon assumé est le comportement que
  le CDC demande en cas de doute, il ne doit pas bloquer le travail en cours.
- **Le corps du gabarit et les fixtures vivent hors des collections.** Une fiche
  volontairement invalide dans `content/entries/` casserait le build du site entier.

**Écart au cahier des charges**

- **Champ `verification` ajouté à chaque bloc `code`.** Extension additive du schéma de la
  section 5.1. Deux valeurs : `executed` quand l'extrait tourne tel quel avec ses vraies
  dépendances, `stubbed` quand il tourne avec un double local remplaçant un service ou un
  modèle externe. Motif : l'interdit numéro 1 exige que le code publié ait été exécuté, et
  un extrait qui appelle une API de modèle généraliste ne peut pas l'être à l'identique en
  intégration continue. Déclarer le niveau réel vaut mieux que laisser croire à une preuve
  uniforme. Aucun champ du CDC n'est modifié.

**Ajout hors plan**

- **Contrôle orthographique du français.** Le CDC ne le demande pas, mais le site est
  bilingue et la moitié de son contenu est en français. Le contrôle s'appuie sur
  `hunspell-fr-classical` et `spylls`, ne relit que la prose, et corrige les accents
  manquants à leur position exacte sans jamais toucher un identifiant de code. Il connaît
  les fiches bilingues et ne relit que leurs valeurs françaises. Documenté dans
  `docs/OUTILLAGE.md`.

**Points bloqués contournés**

- Le chargeur `file` d'Astro échouait sur `content/roadmap.yaml` absent. Le fichier est créé
  vide, commenté, et sera rempli au lot 09.

**Prochaine étape**

Lot 03 — Système de composants, avec le lot 06 lancé en parallèle.

---

## Lot 03 — Système de composants

**Terminé.** `npm run check` verte, plus sept contrôles de comportement au navigateur.

**Fait**

Quatorze composants : bloc de code colorisé au build, onglets de langage, badges de verdict
et de barreau, mini-échelle, tableau récapitulatif, barreau détaillé, bloc risques, ligne de
catalogue, sommaire collant, encadrés, bloc d'accompagnement, avertissement réglementaire,
état vide, et les quatre pictogrammes de barreau. Plus les deux dictionnaires d'interface.

**Preuve**

| Contrôle | Résultat |
|---|---|
| Parcours au clavier, focus visible partout | 12 arrêts, tous avec `:focus-visible` et un contour d'au moins 3 px |
| Flèches gauche, droite, Début, Fin entre onglets | conformes |
| Confirmation de copie annoncée aux lecteurs d'écran | oui, par une région `status` |
| Contenu réellement copié | le code de l'extrait, vérifié dans le presse-papiers |
| Sans JavaScript, les deux langages restent lisibles | oui, les onglets disparaissent |
| Débordement horizontal à 360, 600, 900, 1440 px | aucun |
| Contrastes AA, clair et sombre | 18 couples, tous conformes |
| Règles d'emploi de la couleur | conformes |

**Décisions prises**

- **Les niveaux de titre sont des paramètres de composant.** Un composant ne présume pas de
  sa profondeur dans la page. Sans cela, le bloc risques imposait un `h4` sous un `h2` et
  créait un saut de hiérarchie.
- **Un seul rendu Shiki pour les deux thèmes**, porté par des variables CSS, plutôt que deux
  blocs de HTML. Le mode sombre ne coûte donc rien au budget de poids de la fiche.
- **L'adresse d'accompagnement est encodée en références numériques dans le `href`**, et son
  texte visible est écrit à l'envers puis remis à l'endroit par le CSS. Le lien fonctionne
  sans JavaScript, et l'adresse n'apparaît en clair nulle part dans le HTML livré. Vérifié
  sur la réponse brute, et non sur le DOM analysé, qui aurait déjà décodé les entités.

**Défauts trouvés en vérifiant, et corrigés**

- **Débordement horizontal à 360 et 600 px.** Un élément de grille vaut `min-width: auto` et
  refuse de rétrécir sous la largeur de son contenu : le bloc de code poussait la page
  entière au lieu de défiler dans son conteneur. Corrigé, et le contrôle
  `scripts/check-overflow.mjs` ignore désormais ce qui vit dans un conteneur défilant, pour
  ne signaler que ce qui pousse réellement le document.
- **Le vert `--go` était employé hors du badge**, sur le liseré de verdict de la mini-échelle.
  C'est `check-colour-usage` qui l'a signalé. Remplacé par un trait à l'encre : la couleur
  n'exprime aucun jugement sur ce site, y compris quand le jugement est juste.
- **Le premier contrôle de débordement était faux** : il comptait comme fautif tout élément
  large, y compris à l'intérieur d'un conteneur défilant. Réécrit.

**Ajout hors plan**

- `scripts/check-overflow.mjs`, qui n'était pas prévu au plan et qui a immédiatement trouvé
  un vrai défaut.

---

## Lot 04 — Gabarits de pages

**Terminé.** 23 contrôles de gabarit au navigateur, aucun échec.

**Fait**

Cinq gabarits : fiche, fiche en brouillon, catalogue, famille, éditorial. Plus l'en-tête, le
pied de page, l'enveloppe commune, le module de construction d'URL et son jeu de tests.

**Preuve**

| Contrôle | Résultat |
|---|---|
| Rendu sans erreur de console, cinq gabarits | oui |
| Un seul `h1`, hiérarchie sans saut | oui, sur les cinq |
| Aucun identifiant en double | oui, après correction |
| Lisible et navigable sans JavaScript | oui, sur les cinq |
| Verdict affiché deux fois sur la fiche | badge d'en-tête et tableau |
| Ancres des barreaux et du verdict | six ancres, toutes atteintes par le sommaire |
| Sommaire collant au-delà de 900 px, statique en dessous | conforme |
| `hreflang` dans les deux sens et `x-default` vers l'anglais | conforme |
| Aucune ressource tierce chargée à l'exécution | aucune |
| Débordement horizontal, cinq gabarits, quatre largeurs | aucun |

**Décisions prises**

- **Les segments d'URL sont identiques dans les deux langues**, seul le préfixe change :
  `/fr/fiches/<id>` et `/en/fiches/<id>`. C'est la lecture littérale de la section 7.1, qui
  donne l'arborescence, et de la section 9.3, qui dit que toutes ces URL existent sous les
  deux préfixes. Conséquence : le sélecteur de langue conserve la page courante par simple
  substitution du préfixe. L'alternative, traduire les segments, aurait imposé une table de
  correspondance à maintenir et compliqué le contrôle des liens. Réversible : une seule
  fonction à changer.
- **Une illustration manquante s'affiche comme manquante**, dans un cadre pointillé qui
  nomme le fichier attendu, avec un texte alternatif correct. L'interdit numéro 10 refuse le
  faux contenu ; un trou silencieux serait pire.
- **Le poids de page est masqué tant qu'il n'est pas mesuré.** L'interdit numéro 2 vaut aussi
  pour le site lui-même.

**Défaut trouvé en vérifiant, et corrigé**

- **Identifiant en double sur chaque barreau** : la section et son bloc d'onglets portaient
  tous deux `id="n0"`. Un contrôle d'unicité des identifiants a été ajouté aux cinq gabarits.

**Prochaine étape**

Lot 05 — Recherche et filtres, une fois la feuille de route disponible pour produire le jeu
de 200 fiches de test.

---

## Lot 05 — Recherche et filtres

**Terminé.** Douze contrôles au navigateur sur le jeu de 200 fiches de test, aucun échec.

**Preuve**

| Contrôle | Résultat |
|---|---|
| Catalogue rendu avec 200 fiches | 429 pages construites, 200 fiches, compteur juste |
| Recherche dès deux caractères | oui, résultats immédiats |
| Insensible aux accents et à la casse | « modérer », « MODERER » : mêmes fiches |
| Tolérance à une faute légère | « doublonz » trouve encore « doublons » |
| Cloisonnement par langue | un index par langue, vérifié terme à terme |
| Quatre filtres combinés | vérifié ligne par ligne sur les attributs |
| État reflété dans l'URL et restitué | oui, à l'ouverture d'une URL neuve |
| Focus au chargement | oui |
| Sans JavaScript | 200 fiches dans le HTML, formulaire soumissible |
| Index chargé au premier caractère seulement | une seule requête, jamais rechargée |
| JavaScript du catalogue | **1,4 Ko** pour un budget de 25 Ko |
| Index de recherche, français | 15,4 Ko transférés, exclu du budget |

**Écart au cahier des charges, mesuré**

- **Pagefind est écarté au profit de l'équivalent qu'autorise la section 9.1.** La section
  10.1 le nomme, mais son moteur pèse 97,0 Ko transférés :

  | Fichier | Rôle | Transféré |
  |---|---|---|
  | `wasm.fr.pagefind` | moteur, WebAssembly | 72,3 Ko |
  | `pagefind.js` | interface de programmation | 12,8 Ko |
  | `pagefind-worker.js` | fil d'exécution | 11,9 Ko |

  Le budget de la section 12 est de 25 Ko de JavaScript sur le catalogue, index exclu. Même
  en écartant le WebAssembly de la mesure, ce qui serait généreux puisqu'il s'agit de code,
  les deux fichiers JavaScript totalisent 24,7 Ko : le budget entier, avant le premier
  filtre. Les budgets ne se négocient pas, la bibliothèque est assortie d'un « ou
  équivalent » : c'est donc la bibliothèque qui cède. Mesure et raisonnement dans
  `docs/DECISION-RECHERCHE.md`.

  Un site qui soutient qu'on doit choisir l'option la plus frugale et qui embarque cent
  kilooctets de moteur de recherche pour deux cents fiches se contredit à sa page d'accueil.

**Décisions prises**

- **L'index n'est chargé qu'au premier caractère tapé.** Quelqu'un qui vient consulter la
  liste ne paie pas pour une recherche qu'il ne fait pas.
- **Le jeu de 200 fiches de test dérive des 200 intitulés réels** : mêmes identifiants,
  mêmes titres, mêmes besoins. Le test est donc représentatif du contenu final. Seuls les
  barreaux sont fabriqués, puisque ces intitulés n'auront jamais de contenu (interdit 7).
  Le générateur refuse d'écrire si son dossier de sortie venait à être suivi par Git.
- **La feuille de route et les dix familles ont été produites au lot 05 plutôt qu'au lot 09**,
  parce que le jeu de 200 fiches de test en dépend. Écart à l'ordre du plan, pas au CDC :
  les dépendances de la section 13 sont respectées.

**Défauts trouvés en vérifiant, et corrigés**

- **`check-weight` mesurait zéro octet de JavaScript** sur des pages qui en exécutent :
  Astro met les petits modules en ligne dans le HTML plutôt que d'émettre un fichier, et le
  contrôle ne regardait que les fichiers. Corrigé.
- **Un test de recherche cherchait un mot absent du contenu.** La recherche était juste,
  le test était faux. Corrigé côté test, ce qui est la bonne moitié à corriger.

**Prochaine étape**

Lots 06 et 08 en cours par sous-agents. Lot 09 pendant ce temps.

---

## Lot 06 — Extraits de code et leurs tests

**Terminé.** `node scripts/test-snippets.mjs` — 148 extraits exécutés, aucun échec.

**Preuve**

| Contrôle | Résultat |
|---|---|
| Extraits attendus par la matrice | 148, soit 296 fichiers |
| Extraits présents et exécutés | 148 |
| Échecs | 0 |
| Extraits `executed` | 45, sur la totalité des barreaux N0 et N1 |
| Extraits `stubbed` | 29, sur N2 et N3 |
| Accès réseau pendant les tests | aucun, garde active dans les deux langages |

**Décisions prises**

- **Trois niveaux de preuve, dont deux employés.** `executed` quand l'extrait tourne avec ses
  vraies dépendances, `stubbed` quand un double local remplace un service ou un modèle
  externe. Le niveau est déclaré par extrait et **affiché sur la page**, au-dessus du code.
  Aucun extrait N2 ou N3 ne prétend à une preuve qu'il n'a pas.
- **La garde réseau est posée dans le harnais, pas dans un bac à sable extérieur.** Elle est
  donc active partout, y compris sur la machine d'un contributeur. Vérifiée en tentant
  d'ouvrir une connexion dans les deux langages : les deux gardes refusent.
- **Chaque barreau porte un test qui démontre son point de rupture.** C'est ce qui rend vrai
  ce que la fiche affirmera sur ses limites, au lieu de le rendre plausible.

**Défauts trouvés en vérifiant, et corrigés**

- **Le hachage du harnais ne donnait pas les mêmes valeurs dans les deux langages.** Python
  faisait l'arithmétique FNV en entiers exacts, JavaScript perdait de la précision au-delà
  de 2^53. Les deux encodeurs factices rangeaient donc les mêmes mots dans des cases
  différentes, et un extrait N2 pouvait afficher deux scores différents pour ses deux
  versions. Signalé par un rédacteur d'extraits, corrigé avec `Math.imul`, et couvert par
  six tests de parité.
- **Trois affirmations de performance non mesurées** traînaient dans des commentaires
  d'extraits, du type « le modèle pèse quelques kilooctets et répond en moins d'une
  milliseconde ». Retirées. `scripts/check-figures.mjs` a été écrit à cette occasion et
  applique désormais l'interdit numéro 2 sur tout le contenu publié.

**Écart à la charte, assumé**

- **Plusieurs extraits N1 en JavaScript dépassent les quarante lignes**, entre 44 et 79.
  Node n'a pas d'équivalent de scikit-learn : TF-IDF et la régression logistique y sont
  écrits à la main. La charte range la lisibilité avant l'astuce, et c'est d'ailleurs
  exactement la thèse du site : l'algorithme classique tient en quelques dizaines de lignes
  qu'on peut lire en entier.

---

## Lot 09 — Pages éditoriales, légales, contribuer, feuille de route

**Terminé.** Les quinze routes de la section 7.1 existent dans les deux langues.

**Décisions prises**

- **L'illustration large de la section 8.6 est employée dans la bande « comment lire une
  fiche », et non dans le hero.** La section 7.2 interdit toute illustration décorative dans
  le hero, où la typographie est l'objet visuel. Là où elle est placée, elle n'est pas
  décorative : elle dit exactement ce que la bande explique.
- **Les pages à propos et mentions légales sont marquées brouillon**, visiblement, sur la
  page elle-même. Ce que seul le commanditaire peut fournir — parcours, liens, photographie,
  statut juridique, coordonnées de l'hébergeur — est encadré et nommé comme à compléter.
  Rien n'y est inventé, conformément à l'interdit numéro 10.
- **La page méthodologie cite cinq travaux publiés**, chacun vérifié comme répondant :
  Green Algorithms, l'étude d'empreinte de BLOOM, la spécification Software Carbon
  Intensity, l'AFNOR SPEC 2314 et Boavizta. Le site n'annonce **aucun chiffre d'empreinte** :
  il emploie des ordres de grandeur relatifs, et la page explique pourquoi une mesure exacte
  est impossible côté client d'une API.

---

## Lot 11 — CI, gabarits GitHub, documentation de contribution

**Terminé.** `npm run check` reproduit la CI dans le même ordre et passe.

**Décisions prises**

- **Les six contrôles contractuels tournent d'abord, chacun en étape distincte.** Les
  contrôles complémentaires viennent après, pour qu'un échec contractuel reste identifiable
  au premier coup d'œil dans le compte rendu.
- **Un second gabarit d'issue, « signaler une erreur »**, non demandé par le CDC. Une fiche
  fausse nuit plus qu'une fiche absente : le chemin pour la signaler doit être le plus court
  du dépôt.
- **La CI reconstruit trois fois.** Une fois en production pour les liens, le poids et
  l'accessibilité ; une fois avec les pages de contrôle pour les tests de composants et de
  gabarits ; une fois avec le jeu de deux cents fiches pour la recherche. Elle se termine sur
  une construction de production, pour que la sortie soit dans l'état déployable.

**Défauts trouvés en vérifiant, et corrigés**

- **`check-links` prenait l'adresse de contact pour un lien interne mort.** Elle est encodée
  en références numériques pour limiter l'aspiration ; le contrôle doit la décoder comme le
  fait un navigateur.
- **`check-content` s'arrêtait sur une trace de pile devant un frontmatter YAML illisible**,
  au lieu de nommer le fichier et sa ligne. Signalé par un rédacteur de fiche qui avait vu le
  contrôle passer au vert sur un fichier invalide. Corrigé, avec une fixture et un test.

---

## Lot 12 — Performance, accessibilité, déploiement

**En cours.** Mesures et rapport à la fin.

**Défauts trouvés par l'audit d'accessibilité, et corrigés**

- **Un champ caché focalisable au clavier.** Le bouton copier lisait le code dans un
  `textarea` masqué et marqué `aria-hidden` : un utilisateur au clavier y entrait sans le
  voir. Supprimé ; le bouton lit désormais le bloc de code rendu, ce qui retire au passage
  une seconde copie du code dans le HTML de chaque extrait.
- **Les thèmes de coloration syntaxique par défaut échouent au seuil AA** sur notre fond de
  bloc de code. Remplacés par les thèmes à contraste renforcé, et la seule couleur qui
  échouait encore, le gris des commentaires à 4,39:1, est substituée par un gris de notre
  propre palette à 5,23:1. Le code est le contenu le plus important du site.
- **Deux repères de navigation portaient le même nom accessible**, en-tête et pied de page.
- **Le jaune de marque était employé comme couleur de texte** à deux endroits, ce que la
  section 8.3 interdit faute de contraste : le repère de l'en-tête et le bouton de l'accueil.
  Signalé par `check-colour-usage`, corrigé.

**Décision prise**

- **Le poids affiché en pied de page n'apparaît que s'il a été mesuré.** La ligne reste
  masquée sinon. Une ligne visible et vide dirait au lecteur que la page ne pèse rien :
  l'interdit numéro 2 vaut aussi pour le site lui-même.

---

## Lot 14 — Refonte de l'expérience et préparation au lancement

**En cours.** Branche `lot14-experience`, créée depuis `main` à jour plus le commit
de cadrage de la fiche. Rapport détaillé dans `RAPPORT-LOT14.md` à la racine.

### Partie 1 — La fiche

**Terminée.** `npm run check` au vert, captures regardées en clair et en sombre, à
360 et 1440 px.

**Fait**

Les blocs de code passent sur un fond sombre **fixe** : il ne suit pas le thème de la
page, parce qu'un éditeur ne change pas de couleur quand la page change de thème, et
parce que c'est le seul contraste fort de la fiche. La bande d'onglets se lit comme
celle d'un éditeur, l'onglet actif prenant la couleur du fond du code.

La **zone d'essai** est l'élément neuf du lot. Vingt essais interactifs, où l'extrait
du niveau recommandé est chargé dans le navigateur — le vrai fichier, pas une copie —
et s'exécute à chaque frappe, avec surlignage de part et d'autre de ce qui a été
attrapé. Cinq essais figés, dont les sorties sont calculées à la construction du site
en exécutant le vrai code avec le double local des tests. Aucune sortie n'est écrite à
la main. Chaque essai porte au moins un cas qui échoue, celui du point de rupture de
la fiche.

Le bloc risques parle : « Sortie de données : rien ne sort » est devenu « Vos données
ne sortent pas ». Les liens disent où ils mènent, avec la nature du document déduite
de son adresse. Les fiches voisines reprennent le format carte du catalogue. L'appel à
l'action de fin reprend l'aplat jaune des autres pages.

**Décisions prises**

- **La forme interactive exécute l'extrait lui-même**, ce qui renverse la section 5
  des décisions de clarté. Celle-ci visait un bac à sable WebAssembly de plusieurs
  mégaoctets ; elle ne tient plus dès lors qu'on exécute quelques kilooctets de
  JavaScript sans dépendance, qui sont précisément ce que la fiche recommande.
- **Sur les niveaux N2 et N3, ce qui est calculé est la plomberie** : ce que le code
  envoie, ce qu'il refuse avant de dépenser, ce qu'il réessaie, ce qu'il accepte. La
  réponse du modèle est simulée, et chaque essai le dit une fois.
- **La preuve d'exécution devient une pastille dans la barre du bloc de code**, au
  plus près de l'extrait qu'elle qualifie.

**Défauts trouvés en regardant l'écran, et corrigés**

- **L'adresse de contact s'affichait à l'envers** sur toutes les fiches et sur
  l'accueil. Le CSS de portée automatique d'Astro ne marque pas le balisage injecté
  par `set:html`, donc la règle qui remettait l'adresse à l'endroit ne s'appliquait
  jamais.
- **Un niveau sans objet était atténué à 0,55 d'opacité**, ce qui faisait passer son
  texte sous le seuil AA.
- **`check-weight` ne voyait pas le module d'essai**, chargé à la demande donc absent
  des balises `script` : il mesurait 3,8 Ko de JavaScript sur une fiche qui en
  télécharge 8,1.

### Partie 2 — Le design appliqué partout

**Terminée.** Onze pages publiques revues, captures regardées une par une.

Un seul traitement de bouton et de lien d'action pour tout le site, un seul composant
d'appel à l'action, un aplat d'en-tête sur chacune des onze pages, les blocs de code
des pages éditoriales sur le même fond sombre que les fiches.

**Décision principale : la feuille de route publique est retirée.** Le document de lot
la compte parmi les décisions périmées, la nouvelle navigation ne la porte plus, et la
partie 8.4 lui substitue une page des dernières fiches et le flux RSS. Une page qui
annonce cent soixante-quinze fiches inexistantes est une promesse ; ce site n'en fait
pas. Les deux cents intitulés restent dans `content/roadmap.yaml`, où ils servent au
jeu de test à deux cents fiches et aux contributeurs.

**Défaut trouvé** : la page contribuer décrivait depuis le lot 09 le bouton « proposer
une fiche sans coder » que la section 7.8 du CDC demande, sans jamais le poser. Il est
là.

### Partie 3 — Le questionnaire

**Terminée.** Nouvelle page « Par où commencer », cinquième entrée de la navigation.

Huit questions, quatre écrans, deux par écran, le nombre de questions restantes
affiché. L'arbre est déterministe, aucun modèle n'est appelé, et rien ne sort de la
page. Il est piloté par les données des fiches : une fiche nouvelle devient
atteignable sans qu'on y touche.

Les contraintes ne filtrent pas les fiches — elles choisissent le niveau à l'intérieur
de la fiche et expliquent pourquoi. « Vos données ne peuvent pas sortir » sur une
fiche qui recommande un modèle généraliste renvoie au niveau du dessous, en le
nommant.

**Vérification** : 32 400 verdicts par langue, toutes les combinaisons de réponses pour
chacune des vingt-cinq fiches, calculés sur la charge utile réellement livrée par la
page construite. Huit contrôles au navigateur, dont le parcours sans JavaScript.

### Partie 4 — L'accueil

**Terminée.** Trois portes nommées par ce que le visiteur sait déjà, un chiffre compté
et non écrit — vingt-cinq fiches, dont treize sans aucune IA —, la démonstration
raccourcie à douze lignes contre huit avec le reste derrière un dépli, et un bloc sur
l'essai.

### Partie 5 — La page « Comment ça marche »

**Terminée.** La méthodologie et l'explication des quatre niveaux fusionnent. Pour
chaque niveau : ce que c'est, ce que ça coûte, ce que ça garantit, ce qui le fait
céder, et une fiche publiée qui le recommande, tirée des données. Entre deux niveaux,
la condition qui fait passer de l'un à l'autre — la valeur propre du site, qui
n'était écrite nulle part.

« Barreau » disparaît de cette page, ce qui révise la section 2 des décisions de
clarté.

### Partie 6 — Le catalogue

**Terminée.** Pagination à vingt-quatre cartes par page, en chemin et non en paramètre
de requête, avec l'appel à l'action jaune sur chaque page. Toutes les cartes restent
dans le HTML, celles des autres pages masquées, pour qu'un filtre porte sur le
catalogue entier et non sur la page sous les yeux.

**Défaut trouvé en passant** : deux contrôles de recherche étaient périmés depuis la
refonte des cartes du catalogue. Ils n'échouaient pas parce que `test:search` n'est pas
dans la chaîne de `npm run check`, faute de construction du jeu de deux cents fiches.

### Partie 7 — Le contenu

**Terminée.** Les vingt-cinq fiches relues, leurs cent quarante-huit extraits
réexécutés hors de leurs tests, leurs vingt-cinq verdicts contestés.

**Aucun verdict n'est tombé.** Deux ont demandé un examen long et sont laissés en
place avec le doute écrit : `fuzzy-match-company-names`, dont le besoin annoncé
ressemble à l'emploi du niveau du dessus, et `show-similar-articles`, seule fiche
où un niveau gratuit et déterministe n'est pas retenu.

**Vingt-six affirmations étaient fausses.** La famille la plus instructive touche
les fiches N2 et N3 : onze champs présentaient comme une observation ce que le
double local des tests écrit lui-même — « le modèle traduit le nom de la
variable », alors qu'il ne reçoit jamais la variable. Les autres sont des classes
de latence qui surévaluaient le coût d'une décision, une sortie de données mal
déclarée, un niveau qui ne faisait pas ce que son nom disait, et cinq points de
rupture vrais mais invérifiables tels qu'ils étaient écrits.

**Deux extraits réparés.** Le plus grave est l'extrait N0 de
`read-text-from-a-scanned-page` : il comptait les octets des images et des
programmes de police comme du texte, donc répondait « cette page porte déjà du
texte » sur une page scannée — l'inverse de la vérité, sur le cas central de la
fiche.

**Les soixante-quatorze docstrings d'en-tête sont traduites**, servies selon la
langue de la page, et `check-content` compare le corps du code caractère par
caractère après substitution : une traduction qui toucherait au code fait
échouer la construction.

**« Barreau » a disparu**, des fiches comme du reste du dépôt, et le contrôle de
contenu refuse désormais le mot.

**Arbitrage rendu** : la latence annoncée est celle d'une décision sur une
entrée, pas celle de l'entraînement ni du premier chargement d'un modèle.

### Partie 8 — Diffusion et mesure

**Terminée.** Une image de partage et un badge de README par fiche et par
langue, produits à la construction du site par le navigateur des dépendances de
développement — aucune dépendance de production ajoutée. Deux partages, de
simples liens, sans script tiers. Une page des dernières fiches, dont le premier
bloc est le flux RSS, qui existait depuis le lot 09 sans que rien n'y mène.

**La mesure d'audience est active**, sans cookie, servie depuis ce domaine sous
un chemin que l'hébergeur rend : aucune requête ne part vers un tiers, et
`check-third-party` tient sans exception à écrire. La page confidentialité
promettait qu'une mesure, si elle arrivait, serait sans cookie, anonyme,
agrégée, annoncée sur cette page avant d'être mise en place, et que la page
porterait une nouvelle date. La promesse est tenue, et la page le dit ainsi.

**Deux défauts trouvés en regardant l'écran** : le script de mesure n'existant
pas en développement, son absence faisait apparaître une erreur 404 en console
sur chaque page, donc échouer tous les contrôles qui refusent les erreurs de
console ; et le badge manquait aux pages de démonstration du gabarit, dont les
fiches factices n'en ont pas.

### Partie 9 — Référencement, responsive, accessibilité

**Terminée.** Les données structurées sont produites depuis les gabarits, à
partir des données de la page : un article technique par fiche, une page de
collection sur le catalogue et les familles, le site sur l'accueil, un fil
d'Ariane au-delà du premier niveau. Le fil vient d'une seule source — le même
tableau d'étapes rend la navigation qu'on lit et le balisage que les moteurs
lisent —, et aucune date de publication n'est inventée : les fiches portent une
date de révision, le balisage ne déclare donc que `dateModified`.

**Trois contrôles ont changé de périmètre.** `check-seo` est né et parcourt
`dist` : titre manquant ou en double par langue, description idem, canonique
absente ou qui ne désigne pas la page, hreflang manquant, bloc de données
structurées illisible. `check-overflow` ne regardait que les sept galeries
internes ; il couvre les vingt-deux pages publiques des deux langues, et mesure
en plus la taille des cibles tactiles. `check-a11y` ne voyait que six pages et
une seule langue pour la moitié d'entre elles ; il couvre les six gabarits dans
les deux langues, plus la seule fiche qui affiche une image, et ajoute cinq
contrôles structurels qu'axe ne fait pas.

**Le plancher des cibles tactiles est 44 px**, pas les 24 de la norme AA, avec
trois exemptions écrites dans le contrôle : un lien dans une phrase, une case à
cocher dont on mesure l'étiquette, un bloc de code qui ne porte `tabindex` que
pour défiler au clavier. Sept familles de contrôles étaient en dessous.

**Douze marges valaient zéro sans le dire** : `var(--space-5)` et
`var(--space-7)` n'existaient pas dans l'échelle, et CSS ignore en silence une
propriété personnalisée absente. L'échelle a gagné ses deux pas, et
`check-colour-usage` refuse désormais tout token inexistant — c'est la seule
façon que cela ne recommence pas.

**Ce que l'automatisation ne voit pas a été regardé à la main** : l'arbre
d'accessibilité, où les illustrations bégayaient le texte écrit à côté d'elles ;
l'ordre de tabulation, parcouru au clavier sur une fiche, le catalogue et le
questionnaire ; l'annonce des composants qui se mettent à jour, zone d'essai
comprise ; les cent trente libellés de liens du site, lus hors contexte, dont un
seul — « 2 », dans la pagination — ne disait rien.

**Vingt-sept couples de couleurs sont mesurés** dans les deux thèmes, contre
treize avant : les quatre couleurs de réponse sur les deux fonds, le vert de
recommandation en texte et en aplat, le texte et le bouton de l'aplat de marque,
l'anneau de focus au seuil non textuel. Tous dépassent 4,5:1, y compris les onze
auxquels 3:1 suffirait.

### Partie 10 — La dette technique

**Astro 7 est installé, et il n'y a plus de vulnérabilité.** Quinze avis
étaient ouverts, dont un critique, tous dans la chaîne d'Astro 5 : dix sur Astro
lui-même, une injection XML dans le flux, une lecture de fichier arbitraire par
esbuild, quatre CVE de libvips héritées par sharp. `npm audit` en compte zéro.
La seule rupture rencontrée tient en une ligne : Astro 7 ne pose plus le
processeur Markdown unifié par défaut, et une configuration qui déclare un
greffon rehype doit l'installer. Vite passe en 8, Zod en 4, Shiki en 4, sans une
ligne de schéma ni de composant à changer. Le site a même maigri : la fiche la
plus lourde perd 0,9 Ko, le JavaScript de la fiche la plus chargée 0,8 Ko.

**`npm run check` durait quatre minutes et construisait le site trois fois.**
Deux passes désormais : `check:fast`, vingt et une secondes sans navigateur, et
`check:slow`, le reste. La chaîne est décrite une seule fois, dans
package.json ; l'intégration continue appelle les deux passes au lieu de
redonner la liste des contrôles, et sa liste avait divergé — elle ne lançait ni
`check-seo`, ni les suites de la zone d'essai, du questionnaire et du catalogue.

**`test:search` rejoint la chaîne.** Elle vivait dehors depuis six lots, et deux
de ses assertions avaient pourri en silence : elles visaient un balisage que la
refonte avait remplacé. `check-chain` interdit que cela recommence — tout script
`check:*` ou `test:*` doit figurer dans une passe, ou porter une exemption
écrite avec sa raison.

**Un budget pour les pages qui ne sont ni fiche ni accueil.** Aucune page
publique n'a de raison de peser plus qu'une fiche. La plus lourde est le
questionnaire, qui embarque les données de toutes les fiches : 63,4 Ko sur 120 à
vingt-cinq fiches, 92,6 Ko à deux cents. Le budget dira quand sa conception
devra changer, vers trois cent soixante fiches.

**Trois documents disaient faux sur l'hébergement.** Les mentions légales
nomment Vercel depuis le lot 13 ; le cahier des charges annonçait Cloudflare
Pages et le README décrivait deux fichiers de configuration retirés depuis.
C'était vérifiable et important : la mesure d'audience de la partie 8 ne tient
que parce que l'hébergeur sert `/_vercel/insights/` sur ce domaine. Les deux
documents sont corrigés, et les conséquences du retrait sont écrites — la racine
sert la page de repli bilingue, et aucun en-tête de sécurité n'est plus posé par
le dépôt.
