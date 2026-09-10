# Lot 10 — Bilinguisme complet

## 1. Objectif

Faire que le site soit réellement bilingue et non traduit à moitié : interface, navigation,
messages d'erreur, états vides, métadonnées de référencement, et une racine qui envoie
chacun dans sa langue sans JavaScript.

## 2. Dépendances

- **Lot 07** fournit : les 25 fiches et les dix familles dans les deux langues.
- **Lot 09** fournit : toutes les pages éditoriales dans les deux langues.

## 3. Tâches

1. Centraliser toutes les chaînes d'interface dans deux dictionnaires typés, avec une clé
   manquante détectée au build. → `src/i18n/en.ts`, `src/i18n/fr.ts`, `src/i18n/index.ts`
2. Traduire les libellés du bloc risques, les six champs et leurs valeurs, ainsi que les noms
   des quatre barreaux en anglais et en français, conformément à la section 4.1.
3. Traduire les libellés de filtres, les états vides, le compteur de résultats, les messages
   de recherche sans résultat et la page 404.
4. Écrire l'aide de route localisée : à partir d'un chemin et d'une locale, produire l'URL
   correspondante, de sorte que le sélecteur de langue conserve la page courante, y compris
   sur une fiche et sur une page de famille. → `src/i18n/routes.ts`
5. Déclarer les métadonnées de référencement : `hreflang` dans les deux sens sur chaque page,
   `x-default` vers l'anglais, balise canonique pointant vers la version de la langue courante,
   l'anglais étant la version canonique du site. → `src/layouts/Base.astro`
6. Traiter la racine `/` : un fichier `_redirects` Cloudflare négociant sur `Accept-Language`,
   plus une page HTML de repli sans JavaScript qui pointe vers les deux langues et effectue
   une redirection par `<meta refresh>` vers l'anglais. → `public/_redirects`, `src/pages/index.astro`
7. Mémoriser la préférence de langue en `localStorage`, **uniquement** après un choix explicite
   au sélecteur, jamais par détection. Aucune écriture au premier chargement.
   → `src/scripts/lang-pref.js`
8. Écrire le contrôle de complétude : toute clé présente dans un dictionnaire et absente de
   l'autre fait échouer le build ; toute chaîne d'interface écrite en dur dans un composant
   est signalée. → `scripts/check-i18n.mjs`
9. Vérifier qu'aucune fiche n'est publiée avec une langue incomplète, règle déjà portée par le
   schéma du lot 02, et le confirmer sur le contenu réel.
10. Relire l'anglais du site entier, interface comprise, comme version canonique.

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3, puis 8 après 1.
- **Parallélisable** : le groupe {4, 5, 6, 7} est indépendant du groupe {2, 3}.
- La tâche 10 vient en dernier et ne se délègue pas.
- Ce lot tourne en parallèle du lot 11, ils ne partagent aucun fichier.

## 5. Critères d'acceptation

Repris du lot 10 de la section 13 du CDC.

- [ ] Aucune chaîne d'interface n'est écrite en dur dans un composant.
- [ ] `check-i18n` échoue si une clé manque dans l'un des deux dictionnaires.
- [ ] Les états vides, les messages de recherche infructueuse, les libellés de filtres et la
      page 404 sont traduits dans les deux langues.
- [ ] Le sélecteur de langue, depuis `/fr/fiches/<id>`, mène à `/en/fiches/<id>` et non à
      l'accueil.
- [ ] Chaque page porte `hreflang` vers les deux langues plus `x-default` vers l'anglais,
      et une balise canonique vers elle-même.
- [ ] La racine `/` mène à la bonne langue avec JavaScript activé comme désactivé.
- [ ] Aucune écriture en `localStorage` ne se produit avant un choix explicite de l'utilisateur.
- [ ] Aucune fiche publiée n'a de champ vide dans l'une des deux langues.

## 6. Commande de vérification

```
node scripts/check-i18n.mjs && npm run build && node scripts/check-hreflang.mjs && node scripts/check-links.mjs
```

## 7. Risques

| Risque | Repli |
|---|---|
| La racine `/` en sortie statique ne peut pas négocier sur `Accept-Language` sans serveur. | Le fichier `_redirects` de Cloudflare Pages le permet. Hors Cloudflare, la page de repli sert de porte d'entrée bilingue et redirige vers l'anglais, ce qui est cohérent avec l'anglais comme version canonique. |
| `prefixDefaultLocale: true` produit des URL en double ou une redirection en boucle. | Vérifié sur le site construit, en suivant les redirections. Repli : redirection par `<meta refresh>` uniquement. |
| L'écriture en `localStorage` sans choix explicite ressemblerait à un traceur. | Interdit par la section 9.3 et par l'interdit n° 5. Le contrôle vérifie qu'aucune écriture n'a lieu au chargement. |
| Des chaînes d'interface traînent en dur dans le JavaScript des lots 03 et 05. | La tâche 8 les signale. Elles sont sorties dans les dictionnaires et passées au module par attributs de données. |
| Traduire l'interface fait grossir le JavaScript et menace les budgets. | Les chaînes sont rendues au build dans le HTML, pas embarquées dans le JavaScript. Aucun dictionnaire n'est envoyé au navigateur. |
