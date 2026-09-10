# Lot 02 — Schéma de contenu et validation

## 1. Objectif

Rendre impossible la publication d'une fiche incomplète, incohérente ou dont le code
n'existe pas, en faisant échouer le build sur toute violation du schéma de la section 5.

## 2. Dépendances

- **Lot 01** fournit : le projet Astro qui construit, l'arborescence `content/`,
  la configuration où déclarer les collections.

## 3. Tâches

1. Écrire les énumérations contractuelles dans un module partagé : les dix `family`,
   les quatre `level`, le vocabulaire de coût de la section 4.5 (`nul`, `négligeable`,
   `faible`, `modéré`, `élevé`), les cinq classes de latence, les valeurs de `data_egress`,
   `testability`, `vendor_lock`, `footprint`, les deux `status`.
   → `src/content/schema/enums.ts`
2. Écrire l'aide bilingue `bilingual()` qui exige `fr` et `en` non vides, et la refuser
   si l'une des deux manque. → `src/content/schema/bilingual.ts`
3. Écrire le schéma Zod d'un barreau : union discriminée sur `available`.
   - `available: true` exige `name`, `cost`, `latency`, `risks` complet (six champs),
     `code` avec au moins un chemin, `breaking_point`, `escalate_when`.
   - `available: false` exige `unavailable_reason` et interdit les champs de contenu.
   → `src/content/schema/rung.ts`
4. Écrire le schéma Zod d'une fiche, avec les affinements de la section 5.2 :
   `id` en kebab-case, `verdict` désignant un barreau disponible, `updated` non postérieure
   à la date du jour, tous les champs bilingues remplis, les quatre barreaux N0 à N3 présents
   et dans l'ordre. → `src/content/schema/entry.ts`
5. Écrire le schéma de famille et le schéma de page éditoriale.
   → `src/content/schema/family.ts`, `src/content/schema/page.ts`
6. Déclarer les collections dans `src/content.config.ts` avec le chargeur `glob` pointant
   sur `content/entries`, `content/families`, `content/pages`, et un chargeur `file` pour
   `content/roadmap.yaml`. → `src/content.config.ts`
7. Écrire `scripts/check-content.mjs`, qui va au-delà de ce que Zod peut faire seul :
   - unicité des `id` et égalité `id` / nom de fichier
   - **existence sur le disque** de chaque fichier de code référencé
   - pour `status: published`, existence d'un fichier de test à côté de chaque extrait
   - cohérence `verdict` / barreau disponible
   - `updated` valide et non future
   → `scripts/check-content.mjs`
8. Écrire les fixtures de validation : une fiche valide minimale et **six** fiches invalides,
   une par règle critique (verdict sur barreau absent, coût hors vocabulaire, latence hors
   classes, langue manquante, barreau indisponible sans raison, fichier de code inexistant).
   → `tests/fixtures/schema/`
9. Écrire le test qui charge chaque fixture et assert le résultat attendu.
   → `tests/schema.test.mjs`
10. Écrire le gabarit de fiche commenté, qui servira au lot 07 et à la page contribuer.
    → `content/entries/_TEMPLATE.mdx.txt`
11. Ajouter le champ d'extension `verification` sur chaque bloc `code` : `executed`,
    `stubbed`, `unverified`. Le schéma le rend obligatoire. Décision D3 du plan.
    → `src/content/schema/rung.ts`

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3 → 4 → 6. Chaque schéma consomme le précédent.
- **Parallélisable** : les tâches 5, 7, 8 et 10 une fois la tâche 4 écrite.
- Lot court et fortement couplé : pas de sous-agent.

## 5. Critères d'acceptation

Repris du lot 2 de la section 13 du CDC.

- [ ] La fiche valide de test est acceptée par le schéma et apparaît dans la collection.
- [ ] Chacune des six fiches invalides de test est **rejetée**, avec un message d'erreur qui
      nomme le champ fautif.
- [ ] Une fiche référençant `snippets/x/n0.py` alors que le fichier n'existe pas fait
      échouer `check-content`.
- [ ] Une fiche dont le `verdict` vaut `N2` alors que N2 est `available: false` est rejetée.
- [ ] Une fiche dont `title.en` est absent est rejetée.
- [ ] Une fiche dont `updated` est postérieure à aujourd'hui est rejetée.
- [ ] `npm run build` continue de passer.

## 6. Commande de vérification

```
node --test tests/schema.test.mjs && node scripts/check-content.mjs && npm run build
```

## 7. Risques

| Risque | Repli |
|---|---|
| Les fixtures invalides, placées dans `content/entries/`, cassent le build de tout le site. | Les fixtures vivent sous `tests/fixtures/`, hors de la collection. Le test les charge et les valide à la main contre le schéma exporté. |
| Zod ne peut pas vérifier l'existence d'un fichier sur le disque au moment du chargement de la collection. | C'est le rôle de `check-content.mjs`, exécuté avant le build dans la CI. Zod couvre la forme, le script couvre le monde réel. |
| Le chargeur `glob` d'Astro 5 refuse une `base` hors de `src/`. | Vérifié en premier. Si c'est bloquant, un lien symbolique `src/content → ../content` ou un chargeur maison. L'arborescence de la section 10.2 reste celle qui fait foi. |
| L'ajout du champ `verification` est une extension du schéma de la section 5.1. | Extension additive, aucun champ du CDC n'est modifié. Signalée en écart dans `RAPPORT.md`. |
