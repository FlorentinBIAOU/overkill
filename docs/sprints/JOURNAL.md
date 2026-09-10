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
