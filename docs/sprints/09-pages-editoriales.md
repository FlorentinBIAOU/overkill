# Lot 09 — Pages éditoriales, légales, contribuer, accompagnement, feuille de route

## 1. Objectif

Faire exister toutes les pages de l'arborescence de la section 7.1, dans les deux langues,
avec du contenu réellement écrit, y compris l'accueil qui doit vendre l'idée en trente
secondes.

## 2. Dépendances

- **Lot 04** fournit : les quatre gabarits, dont le gabarit éditorial.
- **Lot 07** fournit : les 25 fiches et les dix familles, sans lesquelles l'accueil, la
  page de famille et la feuille de route n'ont rien à montrer.

## 3. Tâches

1. **Accueil** — le hero en aplat de marque avec la phrase de mission en display-xl,
   sans illustration décorative. → `src/pages/{en,fr}/index.astro`
2. **La démonstration de l'accueil** — l'élément le plus important du site : « ce qu'on vous
   propose » contre « ce qui suffit », deux blocs de code côte à côte tirés d'une fiche réelle,
   les ordres de grandeur en dessous. Le code vient de `content/snippets/`, jamais recopié.
   → `src/components/home/Demonstration.astro`
3. La grille des dix familles sur l'accueil, chacune avec son illustration et sa question type.
   → `src/components/home/FamilyGrid.astro`
4. La bande « comment lire une fiche », les quatre barreaux expliqués visuellement.
   → `src/components/home/RungExplainer.astro`
5. Les trois fiches mises en avant, choisies pour la diversité de leurs verdicts, dont une
   qui recommande N3. Sélection explicite, pas aléatoire.
   → `src/components/home/Featured.astro`
6. Le pied de page éditorial de l'accueil : contribution, accompagnement, poids de la page.
7. **Méthodologie** — les quatre barreaux définis, la détermination d'un verdict, l'expression
   des coûts et la raison de l'absence de prix absolus, l'estimation de l'empreinte avec la
   méthodologie **citée nommément**, la raison pour laquelle la couleur des barreaux
   n'exprime pas de jugement, la limite explicite sur le réglementaire, et comment signaler
   une erreur. → `content/pages/methodology.{en,fr}.mdx`
8. **À propos** — deux sections distinctes, le projet et l'auteur. Rédigée à la première
   personne, ton direct et professionnel. Marquée comme brouillon en attente de relecture par
   le commanditaire. → `content/pages/about.{en,fr}.mdx`
9. **Contribuer** — ce qui fait une bonne fiche avec la règle de vérité du code mise en avant,
   la structure imposée avec lien vers le gabarit, le processus de pull request, le bouton
   d'issue pré-remplie, et ce qui est refusé.
   → `content/pages/contribute.{en,fr}.mdx`
10. **Accompagnement** — la formulation imposée, les trois prestations, le `mailto` obfusqué
    avec objet pré-rempli. → `content/pages/help.{en,fr}.mdx`
11. **Mentions légales** — éditeur, statut, contact, directeur de publication, hébergeur avec
    coordonnées, référence au dépôt. Les champs que seul le commanditaire peut renseigner sont
    marqués explicitement comme à compléter, jamais inventés.
    → `content/pages/legal.{en,fr}.mdx`
12. **Confidentialité** — l'absence totale de cookie, de traceur et de mesure d'audience,
    présentée comme un argument et non comme une formalité. Le seul traitement possible est
    l'email volontaire, avec finalité et durée de conservation.
    → `content/pages/privacy.{en,fr}.mdx`
13. **Crédits** — CC BY 4.0 pour le contenu, MIT pour le code, les trois polices et leurs
    licences, les méthodologies citées, les contributeurs.
    → `content/pages/credits.{en,fr}.mdx`
14. **Feuille de route** — produire les 200 intitulés, incluant les 25, répartis sur les dix
    familles, chacun avec `id`, titre bilingue, famille et ligne de besoin. Puis la page qui
    les groupe par famille avec leur état et un compteur global.
    → `content/roadmap.yaml`, `src/pages/{en,fr}/feuille-de-route.astro`
15. **404** — page utile, avec son illustration, proposant le catalogue et la contribution.
16. **RSS et sitemap** — `rss.xml` par langue, `sitemap.xml` global.
17. L'encadré permanent de pied de page réglementaire : information générale, pas un avis
    juridique, faites valider par un professionnel. Présent sur toute page portant du contenu
    réglementaire. → `src/components/LegalNotice.astro`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3 → 4 → 5 → 6, l'accueil est une composition unique.
- **Parallélisable par sous-agents** : les tâches 11, 12, 13 (pages légales, factuelles et
  indépendantes) et la tâche 14 pour la production des 200 intitulés, découpée en dix lots
  d'une famille chacun.
- **Non délégable** : les tâches 7, 8, 9, 10. La méthodologie porte la crédibilité du site,
  l'à-propos est un actif de réputation du commanditaire, contribuer et accompagnement portent
  le ton. Je les écris.
- Les tâches 15, 16, 17 sont indépendantes.

## 5. Critères d'acceptation

Repris du lot 9 de la section 13 du CDC.

- [ ] Les quinze routes de la section 7.1 existent en `/en/` et en `/fr/`.
- [ ] Aucune page ne contient de texte de remplissage. Ce qui n'est pas écrit est marqué
      comme brouillon, visiblement, sur la page elle-même.
- [ ] Sur l'accueil, la démonstration est compréhensible sans lire une phrase d'explication.
- [ ] Le code de la démonstration est importé d'un fichier réel de `content/snippets/`.
- [ ] La page méthodologie cite nommément au moins une méthodologie publiée d'estimation
      d'empreinte, avec son lien.
- [ ] Aucune page ne formule de conseil juridique. L'encadré permanent est présent.
- [ ] Les mentions légales ne contiennent aucune information inventée sur l'éditeur.
- [ ] `content/roadmap.yaml` contient exactement 200 intitulés, dont les 25 fiches produites,
      répartis sur les dix familles, chacun avec ses quatre champs.
- [ ] La page feuille de route affiche l'état de chacun et un compteur global juste.
- [ ] Le `mailto` est obfusqué au rendu, cliquable, et lisible sans JavaScript.
- [ ] Aucune ressource tierce n'est chargée à l'exécution sur aucune page.

## 6. Commande de vérification

```
npm run build && node scripts/check-content.mjs && node scripts/check-roadmap.mjs && node scripts/check-links.mjs && node scripts/check-figures.mjs
```

## 7. Risques

| Risque | Repli |
|---|---|
| **La page à propos parle d'une personne réelle.** Toute invention biographique serait grave. | Rédaction à partir des seuls éléments du CDC : ingénieur IA et data, nom, liens. Rien d'autre. Marquée brouillon sur la page et signalée dans `RAPPORT.md` comme relecture obligatoire avant mise en ligne. |
| Les mentions légales exigent un statut juridique et un hébergeur non tranchés. | Annexe B du CDC : c'est un point ouvert. Les champs sont présents avec un marqueur « à compléter par l'éditeur » visible, jamais une valeur inventée. |
| La méthodologie d'empreinte citée n'existe pas ou n'est pas vérifiable. | Ne citer qu'une méthodologie publiée, consultée, avec son lien. À défaut, la page dit qu'aucune estimation chiffrée n'est fournie en v1 et pourquoi. L'interdit n° 2 prime sur l'envie d'avoir un chiffre. |
| 200 intitulés produits en série virent au remplissage. | Découpage par famille, exigence d'une ligne de besoin réelle pour chacun, relecture et déduplication. Un intitulé creux est supprimé, pas complété. |
| L'obfuscation du `mailto` casse la lisibilité sans JavaScript. | Technique retenue : l'adresse est écrite à l'envers dans le HTML et remise à l'endroit en CSS, avec l'attribut `href` construit par entités HTML. Fonctionne sans JavaScript, lisible, cliquable. Vérifié. |
| L'accueil se transforme en page de vente et trahit le positionnement de la section 1.3. | La démonstration montre un cas où la règle suffit, et les trois fiches mises en avant incluent obligatoirement une recommandation N3. |
