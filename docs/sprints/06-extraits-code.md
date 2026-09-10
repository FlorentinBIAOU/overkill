# Lot 06 — Extraits de code et leurs tests

## 1. Objectif

Fournir, pour chacun des barreaux disponibles des 25 fiches, un extrait Python et un extrait
JavaScript qui s'exécutent réellement et qui sont couverts par un test qui passe, afin que
l'interdit n° 1 du CDC soit tenu et démontrable.

## 2. Dépendances

- **Lot 02** fournit : le schéma, donc le contrat de nommage `content/snippets/<entry-id>/n<k>.{py,js}`
  et le champ `verification` par extrait.

Ce lot ne dépend **pas** des lots 03, 04, 05. Il est lancé en parallèle du lot 03.

## 3. Tâches

1. Poser le harnais de test Python : `venv`, `requirements-snippets.txt`, configuration pytest,
   convention `n<k>.test.py`. → `content/snippets/requirements-snippets.txt`, `pytest.ini`
2. Poser le harnais de test JavaScript : `node:test`, convention `n<k>.test.js`, aucun
   exécuteur tiers. → `package.json`
3. Écrire la charte des extraits, remise à chaque sous-agent : longueur maximale d'environ
   40 lignes, aucune dépendance non listée, aucun accès réseau, aucune écriture de fichier
   hors répertoire temporaire, entrées d'exemple en dur dans le test et jamais dans l'extrait,
   commentaires en anglais, code lisible avant d'être malin.
   → `docs/sprints/CHARTE-EXTRAITS.md`
4. Écrire le double local pour les extraits N3 : un transport injectable qui vérifie la forme
   de la requête envoyée à une API de LLM et renvoie une réponse figée, en Python et en
   JavaScript. Aucun appel réseau, aucune clé d'API.
   → `content/snippets/_harness/fake_llm.py`, `content/snippets/_harness/fake-llm.mjs`
5. Écrire le double local pour les extraits N2 dont le modèle ne peut pas être téléchargé en
   CI : une interface d'inférence explicite, l'extrait s'en sert, le test injecte une
   implémentation déterministe. L'extrait publié montre le vrai chargement du modèle.
   → `content/snippets/_harness/fake_model.py`, `content/snippets/_harness/fake-model.mjs`
6. Établir la matrice des extraits à produire : pour chacune des 25 fiches, quels barreaux
   sont disponibles, et quel niveau de vérification est atteignable pour chacun.
   → `docs/sprints/MATRICE-EXTRAITS.md`
7. Produire les extraits, par sous-agents, un agent par fiche, soit 25 agents.
   Chaque agent reçoit : la charte, la matrice pour sa fiche, les doubles locaux, et la
   consigne stricte de ne rendre que du code qu'il a exécuté.
8. Relire chaque extrait rendu. Un extrait qui ne tourne pas, ou qui triche en testant autre
   chose que lui-même, est réécrit. Cette relecture ne se délègue pas.
9. Écrire `scripts/test-snippets.mjs`, qui découvre et exécute tous les tests Python et
   JavaScript, et rend un compte rendu par fiche.
   → `scripts/test-snippets.mjs`
10. Renseigner le niveau de `verification` réellement atteint par chaque extrait, dans la
    matrice, pour alimenter le frontmatter au lot 07.

## 4. Parallélisable

- **Séquentiel obligatoire** : 1, 2, 3, 4, 5, 6 avant 7. Les harnais et la matrice sont le
  contrat des sous-agents.
- **Massivement parallélisable** : la tâche 7, 25 agents indépendants. Un extrait ne partage
  rien avec un autre, hors les doubles locaux, qui sont figés avant le lancement.
- **Séquentiel obligatoire** : 8 après 7, 9 et 10 après 8.

## 5. Critères d'acceptation

Repris du lot 6 de la section 13 du CDC.

- [ ] Chaque barreau `available: true` des 25 fiches a un extrait Python **et** un extrait
      JavaScript, présents sur le disque aux chemins déclarés.
- [ ] Chaque extrait a un fichier de test à côté de lui.
- [ ] `scripts/test-snippets.mjs` exécute la totalité des tests et ne rapporte aucun échec.
- [ ] Aucun test ne touche le réseau. Vérifié en coupant l'accès réseau pendant l'exécution.
- [ ] Chaque extrait porte un niveau de `verification` renseigné honnêtement, et la matrice
      recense combien d'extraits sont dans chaque niveau.
- [ ] Aucun extrait n'est marqué `executed` alors que son test injecte un double.

## 6. Commande de vérification

```
node scripts/test-snippets.mjs
```

Et, pour prouver l'absence d'accès réseau :

```
unshare -rn node scripts/test-snippets.mjs
```

## 7. Risques

| Risque | Repli |
|---|---|
| **Un extrait N2 exige un modèle de plusieurs centaines de Mo, non téléchargeable en CI.** | Niveau `stubbed` : l'extrait publié montre le vrai chargement, le test injecte une inférence déterministe. Le niveau est affiché sur la fiche. Si même cela est impossible, la fiche passe en `draft`, conformément à l'interdit n° 1. |
| **Un extrait N3 exige une clé d'API et de l'argent.** | Décision D4 du plan : transport injectable. Le test vérifie la construction de la requête et le décodage de la réponse, ce qui est la part du code qui contient réellement des bugs. |
| Les sous-agents rendent du code plausible mais non exécuté. | La tâche 8 existe pour cela, et la commande de vérification tranche : ce qui ne passe pas n'entre pas. C'est le seul garde-fou qui compte. |
| Les dépendances Python s'accumulent et rendent la CI lente et fragile. | Liste unique et courte, épinglée. Priorité à la bibliothèque standard. Une dépendance nouvelle doit être justifiée par le contenu de la fiche. |
| Un extrait est brillant mais illisible pour un développeur junior, l'une des quatre cibles. | La charte impose la lisibilité avant l'astuce. Relecture en tâche 8 avec cette cible en tête. |
| Le nombre réel d'extraits dépasse largement l'estimation. | C'est probable : environ 3 barreaux disponibles par fiche, 2 langages, 2 fichiers par extrait, soit de l'ordre de 300 fichiers. Le lot est dimensionné en conséquence, et la parallélisation est ce qui le rend tenable. |
