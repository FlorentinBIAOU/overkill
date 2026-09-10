# Lot 04 — Gabarits de pages

## 1. Objectif

Rendre les quatre gabarits du site — fiche, famille, catalogue, éditorial — avec des données
factices, dans les deux registres de la section 8.1, responsive jusqu'à 360 px.

## 2. Dépendances

- **Lot 03** fournit : tous les composants d'interface, testés dans leurs états.
- **Lot 02** (transitivement) fournit : les types de contenu que les gabarits consomment.

## 3. Tâches

1. Écrire les données factices : trois fiches complètes, deux familles, couvrant les quatre
   barreaux, un barreau indisponible, un verdict N3. → `tests/fixtures/pages/`
2. `EntryLayout.astro` — registre documentaire. En-tête avec titre, besoin, famille, badge de
   verdict, date de révision ; scénario en encadré ; `RungTable` ; les barreaux en
   `RungSection` ancrables ; `TocSticky` au-delà de 900 px ; verdict argumenté ;
   pour aller plus loin ; sources ; métadonnées ; `HelpBlock` ; fiches voisines.
   → `src/layouts/EntryLayout.astro`
3. `FamilyLayout.astro` — bandeau avec illustration et description, question type en très gros,
   liste des fiches de la famille via `EntryCard`, intitulés de feuille de route de la famille
   en grisé avec lien de proposition. → `src/layouts/FamilyLayout.astro`
4. `CatalogLayout.astro` — barre de recherche en haut, rangée de filtres, compteur de résultats,
   liste dense rendue **intégralement au build**, état vide. Le JavaScript viendra au lot 05.
   → `src/layouts/CatalogLayout.astro`
5. `EditorialLayout.astro` — registre éditorial : aplats pleine largeur, titres démesurés,
   respiration généreuse, colonne de lecture à 680 px.
   → `src/layouts/EditorialLayout.astro`
6. Le sélection des fiches voisines : deux ou trois fiches de la même famille, à défaut de
   verdict identique. Déterministe, calculée au build. → `src/lib/neighbours.ts`
7. Les routes dynamiques provisoires branchées sur les données factices, pour rendre les
   quatre gabarits. → `src/pages/en/fiches/[id].astro` et équivalents
8. La grille : 12 colonnes, contenu à 1200 px, lecture à 680 px, points de rupture à 900 et
   600 px, échelle d'espacement de 4 px. → `src/styles/layout.css`
9. Le pied de page commun avec l'emplacement du poids de page, rempli au lot 12.
   → `src/components/SiteFooter.astro`
10. L'en-tête commun : logo, navigation principale, sélecteur de langue conservant la page
    courante, bascule de thème. → `src/components/SiteHeader.astro`
11. Contrôle de rendu réel : capture des quatre gabarits à 360, 600, 900 et 1440 px, en clair
    et en sombre, et correction de ce qui casse. → `tests/pages.spec.ts`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 avant tout le reste ; 8 avant 2, 3, 4, 5 ; 11 en dernier.
- **Parallélisable** : les quatre gabarits 2, 3, 4, 5 une fois la grille écrite. En pratique
  ils partagent tellement de décisions de composition que je les traite d'affilée, de la
  même main, comme prévu au plan.
- Les tâches 9 et 10 sont indépendantes et peuvent se faire pendant.

## 5. Critères d'acceptation

Repris du lot 4 de la section 13 du CDC.

- [ ] Les quatre gabarits rendent sans erreur avec les données factices.
- [ ] Aucun débordement horizontal à 360 px sur aucun des quatre.
- [ ] Sur la fiche, le verdict apparaît deux fois : en badge d'en-tête et dans le tableau.
- [ ] Le tableau récapitulatif est lisible à 360 px, par défilement horizontal contenu.
- [ ] Le sommaire latéral est collant au-delà de 900 px, en liste simple en dessous.
- [ ] La liste du catalogue est complète dans le HTML produit, JavaScript désactivé.
- [ ] Le registre éditorial et le registre documentaire partagent couleurs, polices, rayons
      et espacements ; la différence tient à la densité, pas au système.
- [ ] Un seul `h1` par page, aucun saut de niveau de titre.

## 6. Commande de vérification

```
npm run build && node scripts/check-headings.mjs && npx playwright test tests/pages.spec.ts
```

## 7. Risques

| Risque | Repli |
|---|---|
| Le tableau à sept colonnes est illisible à 360 px. | Défilement horizontal dans un conteneur dédié, jamais de débordement de la page. Si cela reste mauvais, bascule en liste de définitions sous 600 px, en gardant le tableau au-dessus. |
| Le registre éditorial dérive vers un système visuel séparé. | Contrainte auto-imposée : aucun token nouveau dans ce lot. Tout vient de `tokens.css`. |
| Les gabarits se figent sur des données factices trop régulières et cassent au lot 07. | Les fiches factices incluent volontairement les cas ingrats : barreau absent, verdict N3, titre très long, liste de sources vide. |
| Le très grand display déborde et casse la mise en page à 360 px. | `clamp()` déjà imposé par la section 8.4, plus `overflow-wrap` et un contrôle de rendu à 360 px. |
