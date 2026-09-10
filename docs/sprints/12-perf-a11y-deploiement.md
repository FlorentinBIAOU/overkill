# Lot 12 — Performance, accessibilité, déploiement

## 1. Objectif

Vérifier que le site tient les budgets chiffrés de la section 12 et le plancher de qualité de
la section 8.7, afficher le poids de la page en pied de page, et rendre le dépôt déployable
sur Cloudflare Pages.

## 2. Dépendances

Tous les lots précédents. Ce lot mesure l'état final, il ne peut pas être anticipé.

## 3. Tâches

1. Écrire le calcul du poids de page : après le build, pour chaque page produite, additionner
   le HTML compressé et les ressources qu'elle référence réellement, puis injecter la valeur
   dans le pied de page de cette page. → `scripts/compute-page-weight.mjs`
2. Brancher l'injection dans le pipeline de build, après Astro et avant Pagefind.
3. Mesurer les six budgets de la section 12 et consigner les valeurs réelles :
   - page de fiche, transféré, hors illustrations, ≤ 120 Ko
   - accueil, transféré, illustrations comprises, ≤ 250 Ko
   - polices, total sur tout le site, ≤ 90 Ko
   - JavaScript sur une page de fiche, ≤ 15 Ko
   - JavaScript sur le catalogue, index exclu, ≤ 25 Ko
   - illustration unitaire, ≤ 8 Ko
4. Corriger tout dépassement en coupant, jamais en relevant le budget. Ordre de coupe retenu :
   coloration syntaxique allégée, puis chargement différé du sommaire, puis réduction du jeu
   de graisses de police.
5. Vérifier le plancher de qualité de la section 8.7, point par point :
   responsive à 360 px, focus visible partout, `prefers-reduced-motion` respecté, navigation
   clavier complète, un seul `h1` par page, hiérarchie sans saut, textes alternatifs présents,
   contrastes AA, site navigable sans JavaScript.
6. Lancer l'audit d'accessibilité automatisé sur les trois pages imposées et corriger toute
   erreur bloquante. → `scripts/check-a11y.mjs`
7. Vérifier à la main ce qu'un audit automatisé ne voit pas : ordre de tabulation réel,
   annonce du changement d'onglet de code, annonce de la confirmation de copie, lisibilité du
   tableau de barreaux au lecteur d'écran.
8. Vérifier l'absence de toute ressource tierce chargée à l'exécution, sur toutes les pages.
   → `scripts/check-third-party.mjs`
9. Écrire la configuration de déploiement Cloudflare Pages : commande de build, répertoire de
   sortie, version de Node, en-têtes de cache et de sécurité.
   → `wrangler.toml` ou `public/_headers`, plus la procédure dans `README.md`
10. Mesurer le temps de build à froid et à chaud.
11. Rédiger `RAPPORT.md` selon le format imposé par la section 15 du CDC, avec les huit
    rubriques obligatoires. → `RAPPORT.md`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3 → 4. La mesure précède la correction.
- **Parallélisable** : le groupe performance {1,2,3,4}, le groupe accessibilité {5,6,7} et la
  tâche 8 sont indépendants.
- **En dernier, obligatoirement** : les tâches 10 et 11. Le rapport consigne des mesures, il
  ne peut pas les précéder.

## 5. Critères d'acceptation

Repris du lot 12 de la section 13 du CDC.

- [ ] Les six budgets de la section 12 sont respectés, avec la valeur mesurée consignée pour
      chacun.
- [ ] Le poids de la page courante est affiché en pied de page et correspond à la mesure.
- [ ] L'audit d'accessibilité ne rapporte aucune erreur bloquante sur l'accueil, une page de
      famille et une page de fiche.
- [ ] Aucun débordement horizontal à 360 px sur aucune page du site.
- [ ] Le focus clavier est visible sur chaque élément interactif, et n'est supprimé nulle part.
- [ ] Avec `prefers-reduced-motion`, aucune animation ne se déclenche.
- [ ] Chaque page a exactement un `h1` et une hiérarchie de titres sans saut.
- [ ] Le site entier reste lisible et navigable avec JavaScript désactivé.
- [ ] Aucune requête vers un domaine tiers n'est émise à l'exécution, sur aucune page.
- [ ] Le dépôt contient la configuration de déploiement et la procédure documentée.
- [ ] `RAPPORT.md` existe et contient les huit rubriques de la section 15.

## 6. Commande de vérification

```
npm run check && node scripts/check-third-party.mjs && node scripts/report-measures.mjs
```

## 7. Risques

| Risque | Repli |
|---|---|
| **Le budget de 120 Ko par page de fiche saute**, à cause du HTML colorisé de six à huit blocs de code. | Ordre de coupe défini en tâche 4. Le budget ne se négocie pas : c'est la fonctionnalité qui cède. En dernier recours, les barreaux N2 et N3 sont repliés et leur code chargé à l'ouverture, ce qui reste conforme au dégradé sans JavaScript si le contenu est présent dans le HTML. |
| Le budget de 90 Ko de polices saute à trois familles. | Repli déjà prévu au lot 01 : sous-ensemblage plus strict, puis graisses statiques, puis abandon d'une famille au profit d'une pile système, signalé comme écart. |
| L'audit automatisé passe alors que le site est réellement pénible au clavier. | La tâche 7 existe pour cela. Un audit automatisé attrape le contraste et les attributs, pas l'expérience. |
| Le déploiement ne peut pas être vérifié : je ne pousse pas, et le domaine n'est pas acheté. | Le critère « site déployé et accessible » du lot 12 dépend d'une action du commanditaire. Je livre la configuration, la procédure et un build de production vérifié en local. L'écart est signalé dans `RAPPORT.md`, rubrique « ce qu'il reste à faire pour la mise en ligne ». |
| Le poids affiché en pied de page devient faux dès qu'une ressource change. | Il est recalculé à chaque build, jamais écrit à la main. S'il ne peut pas être calculé de façon fiable, il vaut mieux ne rien afficher que d'afficher un chiffre faux : l'interdit n° 2 s'applique aussi au site lui-même. |
