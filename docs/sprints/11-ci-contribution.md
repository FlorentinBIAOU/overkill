# Lot 11 — CI, gabarits GitHub, documentation de contribution

## 1. Objectif

Rendre le dépôt contributif : six contrôles automatiques qui bloquent le déploiement en cas
d'échec, des gabarits qui forcent le contributeur à prouver ce qu'il avance, et une
documentation qui permet à quelqu'un d'extérieur d'ouvrir une pull request recevable.

## 2. Dépendances

- **Lot 06** fournit : le harnais de test des extraits et la commande qui les exécute tous.
- **Lot 07** fournit : le contenu réel sur lequel les contrôles ont un sens.

## 3. Tâches

1. Écrire `.github/workflows/ci.yml`, les six contrôles de la section 11.2 dans l'ordre imposé,
   chacun en étape distincte pour que l'échec soit lisible :
   `check-content`, `test-snippets`, `build`, `check-links`, `check-weight`, `check-a11y`.
   Un échec bloque le déploiement.
2. Écrire `scripts/check-links.mjs` : parcours du site construit, échec sur tout lien interne
   mort, avertissement sur les liens externes injoignables, sans faire échouer la CI pour un
   site tiers indisponible. → `scripts/check-links.mjs`
3. Compléter `scripts/check-weight.mjs` avec les six budgets de la section 12, exprimés en
   poids transféré, mesuré après compression. → `scripts/check-weight.mjs`
4. Écrire `scripts/check-a11y.mjs` : audit automatisé sur l'accueil, une page de famille et
   une page de fiche, avec échec sur toute erreur bloquante.
   → `scripts/check-a11y.mjs`
5. Mettre en cache les dépendances npm et pip dans le workflow, pour que la CI reste rapide.
6. Écrire `.github/PULL_REQUEST_TEMPLATE.md` : cases à cocher obligatoires confirmant que le
   code a été exécuté, la commande employée, les deux langues renseignées, la source des
   chiffres.
7. Écrire `.github/ISSUE_TEMPLATE/propose-entry.yml` : besoin en une phrase, famille pressentie,
   ce que la personne a vu faire, ce qu'elle pense qui suffirait. Champs obligatoires.
8. Écrire `CONTRIBUTING.md` : la règle de vérité du code en tête, la structure imposée, le
   processus, ce qui est refusé, et comment lancer les contrôles en local.
9. Écrire `LICENSE` (MIT, pour le code) et `LICENSE-CONTENT` (CC BY 4.0, pour le contenu).
10. Compléter `README.md` : ce qu'est Overkill, installer, construire, vérifier, contribuer,
    et où lire le rapport de fin de mission.
11. Écrire les scripts npm de confort : `npm run check` enchaîne les six contrôles en local,
    dans le même ordre que la CI.
12. **Éprouver la CI** : créer une branche de test portant une fiche volontairement invalide,
    vérifier que la CI la refuse et à quelle étape, puis supprimer la branche.

## 4. Parallélisable

- **Parallélisable** : les groupes {2, 3, 4} (les scripts de contrôle), {6, 7} (les gabarits
  GitHub) et {8, 9, 10} (la documentation) sont indépendants.
- **Séquentiel obligatoire** : 1 après 2, 3, 4 ; 12 en dernier, c'est la preuve du lot.
- Ce lot tourne en parallèle du lot 10, ils ne partagent aucun fichier.

## 5. Critères d'acceptation

Repris du lot 11 de la section 13 du CDC.

- [ ] Les six contrôles existent, tournent dans l'ordre de la section 11.2, et sont visibles
      séparément dans le compte rendu de la CI.
- [ ] Une pull request de test portant une fiche invalide est **refusée**, à l'étape
      `check-content`, avec un message qui nomme le champ fautif.
- [ ] Une pull request de test portant un extrait dont le test échoue est refusée à l'étape
      `test-snippets`.
- [ ] Une pull request de test introduisant un lien interne mort est refusée à `check-links`.
- [ ] Un lien externe injoignable produit un avertissement et non un échec.
- [ ] `npm run check` reproduit localement la totalité de la CI.
- [ ] Le gabarit de pull request contient les quatre confirmations de la section 11.3.
- [ ] Le gabarit d'issue contient les quatre champs de la section 11.3, tous obligatoires.
- [ ] `LICENSE` et `LICENSE-CONTENT` existent et sont référencés dans la page crédits.

## 6. Commande de vérification

```
npm run check
```

Et, pour la CI elle-même, l'observation du compte rendu de la branche de test :
elle doit être rouge à l'étape attendue.

## 7. Risques

| Risque | Repli |
|---|---|
| La CI ne peut pas être observée sans pousser, or je ne pousse pas. | Le workflow est validé localement avec `act` si disponible, sinon par exécution manuelle de chaque étape dans l'ordre, à l'identique. La branche de test est créée en local et la vérification réelle en CI reste à faire par le commanditaire. Signalé dans `RAPPORT.md`. |
| L'audit d'accessibilité automatisé exige un navigateur en CI. | Playwright avec Chromium est installé par le workflow. En local, si l'installation échoue, l'audit tourne sur le HTML statique avec un analyseur qui n'a pas besoin de navigateur, et la limite est signalée. |
| `check-links` fait échouer la CI parce qu'un site tiers est momentanément indisponible. | Explicitement traité : les liens externes produisent un avertissement, jamais un échec. Seuls les liens internes bloquent. |
| Les tests Python allongent la CI de plusieurs minutes. | Cache pip, liste de dépendances courte et épinglée, aucun téléchargement de modèle. |
| `check-weight` mesure le poids sur disque et non le poids transféré. | Le budget de la section 12 parle de transféré. Le script compresse en gzip avant de mesurer, ce qui est ce que sert un hébergeur statique. La méthode est documentée dans le script. |
