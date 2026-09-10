# Lot 03 — Système de composants

## 1. Objectif

Disposer de la bibliothèque de composants d'interface du site, tous rendus au build,
testés au clavier et en mode sombre, pour que les gabarits de pages n'aient plus qu'à
les assembler.

## 2. Dépendances

- **Lot 01** fournit : tokens, polices, layout de base, échelle typographique.
- **Lot 02** fournit : les types TypeScript issus du schéma, que les composants consomment
  comme contrat de propriétés.

## 3. Tâches

1. `CodeBlock.astro` — coloration Shiki au build, deux thèmes clair et sombre, pas de
   numéros de ligne, bouton copier. Le contenu vient d'un fichier lu sur le disque, jamais
   d'une chaîne recopiée. → `src/components/CodeBlock.astro`
2. `CodeTabs.astro` — onglets Python et JavaScript autour de `CodeBlock`. Rendu HTML complet
   des deux panneaux, le JavaScript ne fait que basculer la visibilité. Sans JavaScript, les
   deux blocs restent lisibles l'un sous l'autre. → `src/components/CodeTabs.astro`
3. Le module de comportement des onglets et de la copie, en JavaScript natif, en module,
   avec rôles `tablist` / `tab` / `tabpanel` et navigation par flèches.
   → `src/scripts/code-tabs.js`
4. `VerdictBadge.astro` — badge « recommandé », vert `--go`, rayon 999 px, avec le niveau.
   Le vert n'apparaît nulle part ailleurs. → `src/components/VerdictBadge.astro`
5. `RungBadge.astro` — pastille N0 à N3 sur la rampe `--rung-*`, texte `--ink` sur rung-0 et
   rung-1, texte `--paper` sur rung-2 et rung-3, conformément à la section 8.3.
   → `src/components/RungBadge.astro`
6. `RungTable.astro` — le tableau récapitulatif de la section 7.5 : barreau, approche, coût,
   latence, données, déterminisme, verdict. Rayon 4 px, séparation par filets, aucune ombre.
   Défilement horizontal contenu sous 600 px. → `src/components/RungTable.astro`
7. `RungSection.astro` — un barreau détaillé et ancrable : nom, code en onglets, coût,
   latence, bloc risques à six champs, point de rupture, déclencheur de montée.
   → `src/components/RungSection.astro`
8. `RiskBlock.astro` — les six champs de la section 4.2 rendus en liste de définitions,
   avec les libellés bilingues. → `src/components/RiskBlock.astro`
9. `EntryCard.astro` — la ligne dense du catalogue : titre, famille, badge de verdict,
   mini-échelle des barreaux disponibles. Un seul composant, réutilisé par le catalogue et
   les pages de famille. → `src/components/EntryCard.astro`
10. `RungScale.astro` — la mini-échelle de quatre pastilles montrant les barreaux disponibles.
    → `src/components/RungScale.astro`
11. `TocSticky.astro` — sommaire latéral collant au-delà de 900 px, replié en liste simple
    en dessous. → `src/components/TocSticky.astro`
12. `Callout.astro` — encadré éditorial, employé pour le scénario et pour l'avertissement
    réglementaire permanent. → `src/components/Callout.astro`
13. `HelpBlock.astro` — le bloc d'accompagnement de la section 7.9, avec le `mailto` obfusqué
    et l'objet pré-rempli reprenant le titre de la fiche.
    → `src/components/HelpBlock.astro`
14. Les quatre pictogrammes de barreau, en SVG inline, employés par `RungTable`.
    → `src/components/icons/rung-*.astro`
15. Page de démonstration montrant tous les composants dans tous leurs états : normal,
    survol, focus, actif, désactivé, vide ; en clair et en sombre ; à 360, 600, 900 et 1200 px.
    → `src/pages/_dev/components.astro`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3 (les onglets enveloppent le bloc de code),
  et 5 → 6 → 10 (le tableau et l'échelle consomment la pastille).
- **Parallélisable** : les groupes {1,2,3}, {4,5}, {8}, {11,12,13} sont indépendants.
- La tâche 15 vient obligatoirement en dernier, elle consomme tout le reste.
- Pas de sous-agent : le lot définit le vocabulaire visuel, il doit rester d'une seule main.

## 5. Critères d'acceptation

Repris du lot 3 de la section 13 du CDC.

- [ ] `/_dev/components` affiche chaque composant dans ses états normal, survol, focus,
      actif et vide.
- [ ] Chaque composant est rendu correctement en mode sombre, avec des tokens redéfinis et
      non une inversion.
- [ ] La navigation au clavier atteint chaque élément interactif, dans un ordre logique,
      avec un focus toujours visible.
- [ ] Les onglets de code répondent aux flèches gauche et droite et annoncent l'onglet actif.
- [ ] Le bouton copier confirme la copie, et la confirmation est annoncée aux lecteurs d'écran.
- [ ] Avec JavaScript désactivé, les deux langages de code restent lisibles.
- [ ] Aucun des neuf traitements interdits de la section 8.2 n'apparaît sur la page de
      démonstration.
- [ ] Tous les couples texte-fond de la rampe atteignent 4,5:1, vérifié par calcul.

## 6. Commande de vérification

```
npm run build && node scripts/check-contrast.mjs && npx playwright test tests/components.spec.ts
```

## 7. Risques

| Risque | Repli |
|---|---|
| Shiki alourdit le HTML produit et met en péril le budget de 120 Ko par fiche. | Un seul thème double via variables CSS plutôt que deux rendus. Si nécessaire, réduire le jeu de langages chargés à Python et JavaScript uniquement. |
| Playwright pèse lourd à installer pour un seul lot. | Si l'installation est indisponible, se rabattre sur un contrôle statique du HTML produit plus un contrôle visuel manuel, et le noter au journal. |
| Le contraste du jaune de marque échoue sur du texte. | C'est déjà interdit par la section 8.3 : le jaune ne porte que du très gros texte `--ink`. Le script de contraste vérifie la règle plutôt que de chercher à la contourner. |
| Le sommaire collant casse sur petits écrans. | Point de rupture unique à 900 px : au-dessous, sommaire en liste simple non collante. |
