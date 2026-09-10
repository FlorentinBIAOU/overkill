# Lot 01 — Fondations

## 1. Objectif

Disposer d'un dépôt Astro qui construit, avec les tokens de design, les trois polices
auto-hébergées et un layout de base, pour que tout lot suivant ait un socle stable.

## 2. Dépendances

Aucune. C'est le premier lot.

## 3. Tâches

1. Initialiser `package.json` et installer Astro 5.18.x, `@astrojs/mdx` 4.x, `@astrojs/sitemap`,
   `@tailwindcss/vite` 4.x et `tailwindcss` 4.x. → `package.json`, `package-lock.json`
2. Écrire `astro.config.mjs` : sortie statique, `site` provisoire, i18n natif avec
   `defaultLocale: 'en'`, `locales: ['en','fr']`, `prefixDefaultLocale: true`, intégrations
   MDX et sitemap, plugin Vite Tailwind. → `astro.config.mjs`
3. Écrire `tsconfig.json` étendant `astro/tsconfigs/strict`. → `tsconfig.json`
4. Créer l'arborescence vide imposée par la section 10.2 du CDC :
   `content/{entries,families,pages,snippets}/`, `src/{components,layouts,pages,styles,assets/illustrations,i18n}/`,
   `tests/`, `scripts/`, `.github/workflows/`, `.github/ISSUE_TEMPLATE/`.
5. Télécharger et sous-ensembler les trois polices en woff2, latin uniquement :
   Bricolage Grotesque (variable, graisses 700–800), Inter (400, 600), JetBrains Mono (400).
   → `src/assets/fonts/*.woff2`
6. Écrire les déclarations `@font-face` avec `font-display: swap` et `unicode-range` latin.
   → `src/styles/fonts.css`
7. Écrire `src/styles/tokens.css` : les dix couleurs de la section 8.3 en variables CSS,
   l'échelle typographique de la section 8.4, l'échelle d'espacement de 4 px, les trois
   rayons hiérarchisés, plus le bloc mode sombre avec des valeurs alternatives déclarées
   au même endroit. → `src/styles/tokens.css`
8. Écrire `src/styles/global.css` : import des tokens et des polices, réinitialisation
   minimale, réglages de base du corps de texte (mesure 68 caractères, alignement à gauche),
   style de focus visible non supprimable, garde `prefers-reduced-motion`. → `src/styles/global.css`
9. Écrire `src/layouts/Base.astro` : `<html lang>` correct, métadonnées, `<slot />`,
   squelette d'en-tête et de pied de page sans contenu définitif. → `src/layouts/Base.astro`
10. Écrire une page de contrôle typographique et colorimétrique rendant chaque token et
    chaque niveau de l'échelle, en clair et en sombre. → `src/pages/_dev/tokens.astro`
11. Écrire `scripts/check-fonts.mjs` : additionne le poids des woff2 et échoue au-delà de 90 Ko.
    → `scripts/check-fonts.mjs`
12. Écrire `README.md` minimal : ce qu'est le projet, comment installer, comment construire.
    → `README.md`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 4 (l'arborescence dépend de la configuration),
  puis 7 → 8 → 9 → 10 (chaîne de dépendance CSS).
- **Parallélisable** : la tâche 5 (polices) avec les tâches 1 à 4. Les tâches 11 et 12
  sont indépendantes de tout le reste du lot.
- En pratique le lot est trop court pour justifier un sous-agent.

## 5. Critères d'acceptation

Repris du lot 1 de la section 13 du CDC.

- [ ] `npm run build` se termine sans erreur ni avertissement bloquant.
- [ ] La page `/_dev/tokens` affiche les dix couleurs de la section 8.3 avec les valeurs
      hexadécimales exactes du CDC, vérifiables à l'œil et dans le CSS produit.
- [ ] Les sept niveaux de l'échelle typographique de la section 8.4 sont rendus avec la
      bonne police, la bonne graisse et le bon interligne.
- [ ] La somme des fichiers woff2 est inférieure ou égale à 90 Ko.
- [ ] Le mode sombre s'active et redéfinit les tokens sans inversion mécanique.
- [ ] Un `Tab` sur un élément interactif produit un anneau de focus visible.

## 6. Commande de vérification

```
npm run build && node scripts/check-fonts.mjs
```

## 7. Risques

| Risque | Repli |
|---|---|
| Les polices complètes dépassent 90 Ko à trois familles. | Sous-ensembler plus agressivement : latin de base sans étendu, et ne garder que les graisses réellement employées. Si le budget reste dépassé, remplacer Inter par une pile système et le noter comme écart. |
| Bricolage Grotesque en variable pèse lourd à lui seul. | Instancier deux graisses statiques (700 et 800) plutôt que l'axe variable complet. |
| Tailwind 4 et les tokens en variables CSS se marchent dessus. | Les tokens restent la source unique dans `tokens.css` ; Tailwind ne fait que les consommer via `@theme inline`. Aucune couleur codée en dur dans les classes. |
| `prefixDefaultLocale: true` complique la racine `/`. | Traité au lot 10 avec un fichier `_redirects` Cloudflare et un repli sans JavaScript. |
