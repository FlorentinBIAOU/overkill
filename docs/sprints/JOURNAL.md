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
