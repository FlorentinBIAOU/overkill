# Lot 08 — Illustrations

## 1. Objectif

Produire les douze illustrations et les quatre pictogrammes du site, en SVG écrit à la main,
cohérents entre eux, dans le budget de 8 Ko l'unité.

## 2. Dépendances

- **Lot 03** fournit : les tokens de couleur figés, la rampe `--rung-*`, et l'emplacement des
  pictogrammes dans le tableau de barreaux.

## 3. Tâches

1. Écrire la charte d'illustration remise à chaque sous-agent : `viewBox` de 400 × 400,
   grille de construction de 8 unités, épaisseur de trait unique, jeu de formes autorisées,
   palette limitée à `--ink`, `--brand`, `--paper`, `--paper-2` plus un accent chaud tiré de
   la rampe, interdiction des dégradés, des trames et des détails fins, obligation de
   `role="img"` et d'un `<title>` bilingue.
   → `docs/sprints/CHARTE-ILLUSTRATIONS.md`
2. Écrire l'illustration de référence pour la famille `detect-filter`, à la main, comme
   étalon de style. → `src/assets/illustrations/family-detect-filter.svg`
3. Formuler, pour chacune des dix familles, l'**idée** avant la forme : ce que le verbe
   veut dire concrètement. « Chercher » n'est pas une loupe, c'est un tri dans une masse.
   → consigné dans la charte
4. Produire les neuf illustrations de famille restantes, par sous-agents, trois agents de
   trois illustrations, groupés par proximité de motif pour favoriser la cohérence interne.
5. Produire l'illustration de hero de l'accueil, format large.
   → `src/assets/illustrations/hero.svg`
6. Produire l'illustration de l'état vide du catalogue.
   → `src/assets/illustrations/empty-state.svg`
7. Produire l'illustration de la page 404. → `src/assets/illustrations/not-found.svg`
8. Produire les quatre pictogrammes de barreau, très simples, lisibles à 24 px.
   → `src/components/icons/rung-{0,1,2,3}.astro`
9. Passer d'harmonisation : mettre les douze côte à côte, corriger les épaisseurs de trait,
   les proportions et les densités qui divergent. Cette passe ne se délègue pas.
10. Optimiser : retirer les métadonnées d'éditeur, arrondir les coordonnées à une décimale,
    fusionner les tracés, vérifier le poids. → `scripts/optimise-svg.mjs`
11. Contrôle de rendu réel : afficher les douze à 80 px et à 400 px, en clair et en sombre,
    et corriger ce qui devient illisible. → `src/pages/_dev/illustrations.astro`
12. Écrire le contrôle de budget d'illustration. → `scripts/check-weight.mjs`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3 avant 4. L'étalon de style est le contrat.
- **Parallélisable** : la tâche 4, trois agents ; les tâches 5, 6, 7 entre elles ; la tâche 8
  indépendamment.
- **Séquentiel obligatoire** : 9, 10, 11 après tout le reste. L'harmonisation est la seule
  chose qui empêche douze illustrations indépendantes de ressembler à douze illustrations
  indépendantes.

## 5. Critères d'acceptation

Repris du lot 8 de la section 13 du CDC.

- [ ] Douze illustrations et quatre pictogrammes existent aux chemins prévus.
- [ ] Chaque fichier pèse 8 Ko ou moins après optimisation.
- [ ] Chaque illustration porte `role="img"` et un `<title>` dans les deux langues.
- [ ] Aucune n'emploie de dégradé, de trame, de filtre ni de détail fin.
- [ ] Les couleurs employées appartiennent toutes aux tokens, aucune valeur en dur hors palette.
- [ ] Les douze sont lisibles à 80 px et tiennent à 400 px.
- [ ] Mises côte à côte, elles se lisent comme une seule série : même épaisseur de trait,
      même densité, même vocabulaire de formes.
- [ ] Chaque illustration de famille exprime le verbe de sa famille, pas un symbole générique.
- [ ] Aucune ne reprend un style de marque existante ni une œuvre identifiable.

## 6. Commande de vérification

```
node scripts/optimise-svg.mjs --check && node scripts/check-weight.mjs --illustrations && npm run build
```

## 7. Risques

| Risque | Repli |
|---|---|
| **Douze illustrations produites en parallèle ne forment pas une série.** | Charte stricte, étalon écrit d'abord, groupement des agents par trois, et passe d'harmonisation obligatoire en fin de lot. Si la série ne tient toujours pas, je reprends les divergentes à la main. |
| Une illustration tombe dans le symbole générique : loupe pour chercher, ampoule pour générer. | La tâche 3 impose de formuler l'idée avant la forme, et la relecture rejette tout symbole de banque d'images. |
| Le budget de 8 Ko saute sur une illustration détaillée. | Le budget ne se négocie pas. On simplifie le tracé, ce qui va d'ailleurs dans le sens du style demandé. |
| Le mode sombre rend une illustration invisible. | Les couleurs sont référencées par `currentColor` et par variables CSS quand c'est possible, jamais figées en hexadécimal, et le contrôle de la tâche 11 se fait dans les deux thèmes. |
| Le `<title>` bilingue dans un SVG unique impose de choisir une langue au rendu. | Deux `<title>` ne sont pas valides. Décision : le SVG porte un `<title>` neutre, et le texte alternatif localisé est fourni par le composant Astro qui l'inclut, à partir des chaînes d'interface. Consigné au journal. |
