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
