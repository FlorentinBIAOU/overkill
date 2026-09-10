# Plan d'exécution — Overkill v1.0

Source de vérité : `docs/CDC.md`. Ce plan en dérive le découpage opérationnel.
Il ne remplace pas le CDC et ne le réinterprète pas : en cas de contradiction, le CDC gagne.

---

## 1. Graphe de dépendances

Dépendances telles qu'établies par la section 13 du CDC. Aucune n'est violée ici.

```
                    ┌──────────────────────────┐
                    │ 01 Fondations            │
                    │ Astro, Tailwind, tokens, │
                    │ polices, layout          │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    │ 02 Schéma de contenu     │
                    │ Zod, collections, valid. │
                    └──┬──────────────────┬────┘
                       │                  │
          ┌────────────┴─────┐      ┌─────┴──────────────────┐
          │ 03 Composants    │      │ 06 Extraits + tests    │
          │ (dép. 1, 2)      │      │ (dép. 2)               │
          └────────┬─────────┘      └─────┬──────────────────┘
                   │                      │
        ┌──────────┴────────┐             │
        │                   │             │
┌───────┴────────┐  ┌───────┴───────┐     │
│ 04 Gabarits    │  │ 08 Illustr.   │     │
│ (dép. 3)       │  │ (dép. 3)      │     │
└───┬────────────┘  └───────────────┘     │
    │                                     │
    │              ┌──────────────────────┴──┐
    │              │ 07 Rédaction 25 fiches  │
    │              │ (dép. 2, 6)             │
    │              └──────────┬──────────────┘
    │                         │
┌───┴──────────────┐          │
│ 05 Recherche     │          │
│ et filtres       │          │
│ (dép. 4)         │          │
└──────────────────┘          │
    │                         │
    └──────────┬──────────────┘
               │
    ┌──────────┴───────────────┐
    │ 09 Pages éditoriales     │
    │ (dép. 4, 7)              │
    └──────────┬───────────────┘
               │
    ┌──────────┴───────────────┐   ┌──────────────────────────┐
    │ 10 Bilinguisme complet   │   │ 11 CI et gabarits GitHub │
    │ (dép. 7, 9)              │   │ (dép. 6, 7)              │
    └──────────┬───────────────┘   └────────────┬─────────────┘
               │                                │
               └───────────────┬────────────────┘
                               │
                  ┌────────────┴─────────────┐
                  │ 12 Perf, a11y, déploiem. │
                  │ (dép. tous)              │
                  └──────────────────────────┘
```

---

## 2. Ordre d'exécution retenu

L'exécution est linéaire au niveau des lots, avec parallélisation **à l'intérieur** d'un lot
et sur deux paires de lots dont les dépendances sont disjointes.

| Vague | Lots | Mode | Justification |
|---|---|---|---|
| A | 01 | seul | Rien ne peut démarrer avant. |
| B | 02 | seul | Débloque simultanément 03 et 06, c'est le goulot du projet. |
| C | 03 **puis** 06 lancé en fond | 06 en sous-agents pendant 03 | 06 ne dépend que de 02 et ne touche que `content/snippets/`. 03 ne touche que `src/components/`. Zéro fichier en commun. |
| D | 04, puis 08 en sous-agents | 08 en fond pendant 04 | 08 ne dépend que de 03 (tokens et palette figés) et n'écrit que dans `src/assets/illustrations/`. |
| E | 07 | sous-agents, 1 fiche = 1 agent | Le lot le plus lourd. Les 25 fiches sont indépendantes une fois le schéma figé (02) et les extraits testés (06). |
| F | 05 | seul | Nécessite 04 rendu, et un volume de fiches réaliste pour être testé. Le jeu de 200 fiches factices sert ici. |
| G | 09 | partiellement en sous-agents | Les pages éditoriales sont indépendantes entre elles, mais partagent le gabarit et le ton. |
| H | 10 et 11 | en parallèle | 10 touche `src/i18n/` et les gabarits, 11 touche `.github/` et `scripts/`. Disjoints. |
| I | 12 | seul | Mesure l'état final, ne peut pas être anticipé. |

**Règle d'arrêt** : aucun lot ne démarre si la commande de vérification du lot précédent
échoue. Un lot rouge se corrige, il ne se contourne pas.

---

## 3. Ce que je parallélise, et pourquoi

### Parallélisé par sous-agents

| Objet | Volume | Pourquoi c'est parallélisable |
|---|---|---|
| **Extraits de code** (lot 06) | ~70 fichiers de code + autant de tests | Un extrait est un fichier isolé sous `content/snippets/<id>/`, avec son test. Aucun import croisé. Le contrat est le schéma d'entrée-sortie, figé au lot 02. |
| **Rédaction des fiches** (lot 07) | 25 fiches × 2 langues | Une fiche est un fichier `.mdx` autonome. Le gabarit de frontmatter est figé au lot 02 et les extraits existent déjà. Chaque agent reçoit le même dossier de consignes rédactionnelles. |
| **Illustrations** (lot 08) | 12 SVG + 4 pictogrammes | Un SVG est un fichier isolé. La cohérence vient d'une charte écrite en amont (palette, épaisseur de trait, grille), pas d'un travail commun. Je repasse derrière pour l'harmonisation. |
| **Intitulés de la feuille de route** (lot 09) | 200 lignes YAML | Découpé par famille, 10 lots de ~20 intitulés. |

### Volontairement séquentiel

- **Lots 01, 02, 03** : ils fixent les contrats que tout le reste consomme. Les paralléliser
  reviendrait à figer des contrats instables.
- **Lot 04** : les quatre gabarits partagent le layout, les composants et la grille.
  Deux agents dessus produiraient deux systèmes de mise en page.
- **Lot 05** : recherche et filtres sont un seul mécanisme, l'URL est l'état partagé.
- **Lot 12** : c'est une mesure, elle est globale par nature.

### Contrôle qualité des sous-agents

Aucun livrable de sous-agent n'est accepté sur parole :

- extraits → la commande de test du lot 06 les exécute tous
- fiches → la validation du schéma du lot 02 les rejette si elles sont incomplètes
- illustrations → contrôle de poids et rendu visuel avant intégration
- rédaction → relecture manuelle de chaque fiche, l'interdit n° 10 ne se délègue pas

---

## 4. Estimation du volume de travail

Unité : « point », un point valant à peu près une heure de travail humain équivalent.
L'estimation sert à repérer les lots à risque, pas à tenir un calendrier.

| Lot | Titre | Points | Fichiers créés (ordre de grandeur) | Risque |
|---|---|---|---|---|
| 01 | Fondations | 4 | 15 | faible |
| 02 | Schéma de contenu et validation | 5 | 8 | moyen |
| 03 | Système de composants | 8 | 20 | moyen |
| 04 | Gabarits de pages | 8 | 15 | moyen |
| 05 | Recherche et filtres | 6 | 6 | élevé |
| 06 | Extraits de code et tests | 20 | 140 | **élevé** |
| 07 | Rédaction des 25 fiches | 25 | 25 | **élevé** |
| 08 | Illustrations | 8 | 16 | moyen |
| 09 | Pages éditoriales et légales | 12 | 30 | moyen |
| 10 | Bilinguisme complet | 5 | 6 | moyen |
| 11 | CI et gabarits GitHub | 5 | 10 | faible |
| 12 | Performance, accessibilité, déploiement | 7 | 6 | élevé |
| | **Total** | **113** | **~300** | |

**Les trois lots qui décident du sort du projet** : 06, 07 et 12.

- 06 parce que l'interdit n° 1 y est mis à l'épreuve : un extrait N2 ou N3 qui ne peut pas
  s'exécuter hors ligne oblige soit à un dispositif de test honnête, soit à passer la fiche
  en brouillon.
- 07 parce que 25 fiches × 2 langues × 4 barreaux, c'est là que la tentation du texte de
  remplissage est la plus forte, et c'est exactement l'interdit n° 10.
- 12 parce que les budgets de la section 12 sont chiffrés et non négociables. S'ils ne
  passent pas, on coupe des fonctionnalités, on ne relève pas le budget.

---

## 5. Décisions structurantes prises avant l'exécution

Consignées ici pour que le lecteur du journal comprenne les choix de départ.
Chacune sera reprise dans `RAPPORT.md`.

| # | Sujet | Décision | Alternative écartée |
|---|---|---|---|
| D1 | Versions | Astro 5.18.x, Tailwind 4.x, Pagefind 1.5.x, Zod via Astro | Astro 7 : le CDC dit Astro 5, c'est contractuel. |
| D2 | Emplacement du contenu | `content/` à la racine, branché via l'API Content Layer d'Astro 5 (`glob({ base: './content/...' })`) | `src/content/`, plus idiomatique mais contraire à l'arborescence imposée en 10.2. |
| D3 | Preuve d'exécution du code | Trois niveaux de vérification déclarés par extrait : exécution réelle, exécution avec double local d'un service externe, non vérifiable. Le niveau est affiché sur la fiche. | Prétendre que tout est exécuté à l'identique. Contraire à l'interdit n° 1. |
| D4 | Extraits N3 | Le code appelant une API de LLM est réel, mais son test injecte un transport local qui vérifie la forme de la requête et décode une réponse figée. Aucun appel réseau, aucune clé. | Appeler réellement un fournisseur : coûte de l'argent, casse la CI, viole l'esprit de l'interdit n° 9. |
| D5 | Gestionnaire Python | `venv` + `requirements-snippets.txt` à la racine des extraits, installé par la CI. | Poetry ou uv : dépendance supplémentaire pour un gain nul à cette échelle. |
| D6 | Poids de page affiché | Calculé après build par un script qui lit le HTML produit et ses ressources, injecté dans le pied de page à la construction. | Mesure côté client : ce serait un traceur, interdit n° 5. |
| D7 | Racine `/` | Page HTML minimale sans JavaScript qui redirige selon `Accept-Language` via un en-tête `_redirects` Cloudflare, avec repli `<meta refresh>` vers l'anglais. | Redirection JavaScript seule : casse le critère « navigable sans JavaScript ». |

---

## 6. Journal

L'avancement réel, les écarts et les contournements sont consignés dans
`docs/sprints/JOURNAL.md`, mis à jour à la fin de chaque lot.
