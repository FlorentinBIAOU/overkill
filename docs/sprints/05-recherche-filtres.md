# Lot 05 — Recherche et filtres

## 1. Objectif

Rendre le catalogue utilisable comme un réflexe : recherche instantanée sans serveur et
filtres combinables dont l'état est partageable par l'URL, le tout dégradant proprement
sans JavaScript.

## 2. Dépendances

- **Lot 04** fournit : le gabarit de catalogue, la liste dense rendue au build,
  le composant `EntryCard`, l'état vide.

## 3. Tâches

1. Générer le jeu de test de 200 fiches, non commité, derrière un drapeau de développement
   `OVERKILL_FIXTURES=1`, à partir des 200 intitulés de la feuille de route.
   → `scripts/generate-fixture-entries.mjs`
2. Intégrer Pagefind : construction de l'index après le build Astro, dans le script `build`.
   → `package.json`, `scripts/build-index.mjs`
3. Baliser les zones indexables du HTML de fiche : titre, besoin, scénario, noms des approches,
   famille. Exclure le reste, notamment le code, qui pollue la pertinence.
   → `src/layouts/EntryLayout.astro`
4. Cloisonner l'index par langue avec l'attribut de langue de Pagefind, pour qu'une recherche
   en français ne remonte que des fiches françaises. → configuration Pagefind
5. Écrire le module de recherche : focus au chargement, déclenchement à partir de deux
   caractères, résultats instantanés, insensibilité aux accents et à la casse par
   normalisation `NFD`, tolérance aux fautes légères via la recherche approchée de Pagefind.
   → `src/scripts/search.js`
6. Écrire le module de filtres : famille, verdict, sortie de données, déterminisme.
   Combinables. Ils opèrent sur les éléments **déjà présents dans le DOM**, par attributs de
   données, sans refaire de requête. → `src/scripts/filters.js`
7. Synchroniser l'état dans l'URL en paramètres de requête, avec `history.replaceState`,
   et relire l'URL au chargement pour restaurer l'état. → `src/scripts/url-state.js`
8. Rendre les filtres en `<form method="get">` avec un bouton de soumission visible sans
   JavaScript, de sorte que le filtrage fonctionne en dégradé par rechargement de page,
   filtré au build. → `src/layouts/CatalogLayout.astro`
9. Compteur de résultats et état vide utile proposant de contribuer la fiche manquante,
   avec le lien d'issue pré-remplie. → `src/components/EmptyState.astro`
10. Contrôle du poids : le JavaScript du catalogue, index de recherche exclu, doit rester
    sous 25 Ko. → `scripts/check-weight.mjs`
11. Vérifier le comportement à 200 fiches : temps de rendu, temps de frappe, poids de l'index.

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 11 (le jeu de test conditionne la vérification),
  2 → 3 → 4 → 5 (chaîne Pagefind), 6 → 7.
- **Parallélisable** : le groupe recherche {2,3,4,5} et le groupe filtres {6,7,8} sont
  indépendants jusqu'à leur réunion dans le gabarit.
- Les tâches 9 et 10 sont indépendantes.

## 5. Critères d'acceptation

Repris du lot 5 de la section 13 du CDC.

- [ ] Avec 200 fiches de test, la saisie de deux caractères produit des résultats
      immédiatement, sans attente perceptible.
- [ ] `« modération »` et `« moderation »` renvoient les mêmes résultats.
- [ ] Une faute légère, `« regexp »` pour `« regex »`, renvoie tout de même la fiche.
- [ ] Une recherche sur `/fr/catalogue` ne renvoie aucune fiche anglaise, et réciproquement.
- [ ] Les quatre filtres se combinent, et le compteur reflète la combinaison.
- [ ] L'URL contient l'état des filtres ; collée dans un autre onglet, elle restitue le même
      écran.
- [ ] JavaScript désactivé : la liste complète des 200 fiches est présente dans le HTML, et
      le formulaire de filtres fonctionne par rechargement.
- [ ] Le JavaScript du catalogue, index exclu, pèse 25 Ko ou moins.

## 6. Commande de vérification

```
OVERKILL_FIXTURES=1 npm run build && node scripts/check-weight.mjs --page=catalogue && npx playwright test tests/search.spec.ts
```

## 7. Risques

| Risque | Repli |
|---|---|
| Pagefind indexe le code des fiches et noie la pertinence. | Marquage explicite des zones indexables et exclusion des blocs de code. Vérifié en cherchant un terme qui n'existe que dans un extrait. |
| Le cloisonnement par langue de Pagefind ne fonctionne pas comme espéré. | Repli : deux index séparés, un par langue, chargés selon la locale de la page. Coût : un peu de poids, aucune régression fonctionnelle. |
| Le filtrage sans JavaScript exige 200 pages pré-filtrées. | Non. Le formulaire soumet en `GET` vers la même page, et le filtrage initial se fait au rendu de la page à partir des paramètres d'URL. Aucune explosion combinatoire. |
| Le JavaScript dépasse 25 Ko une fois recherche et filtres réunis. | Le budget ne se négocie pas. On coupe : la tolérance aux fautes devient optionnelle, chargée à la demande, ou les filtres passent entièrement en rendu serveur. |
| Le jeu de 200 fiches se retrouve commité par accident. | Généré dans un répertoire ignoré par Git, et le script échoue s'il détecte que la sortie est suivie. |
