## Ce que fait cette pull request

<!-- Une ou deux phrases. Quelle fiche, quel correctif, quel ajout. -->

---

## Si elle ajoute ou modifie une fiche

**La règle qui prime sur tout : aucune fiche n'est publiée si son code n'a pas
été exécuté et vérifié.** Ces cases ne sont pas une formalité.

- [ ] **J'ai exécuté le code de chaque niveau**, et ses tests passent.
- [ ] Commande employée, collée telle quelle :

      ```
      
      ```

- [ ] **Les deux langues sont renseignées**, français et anglais, chacune écrite
      dans sa langue et non traduite mot à mot depuis l'autre.
- [ ] **Chaque niveau disponible a un test qui démontre son point de rupture.**
      Ce que la fiche affirme sur les limites de l'approche est vrai, pas
      plausible.
- [ ] **Aucun chiffre inventé** : pas de prix absolu, pas de gramme de CO₂, pas
      de pourcentage de performance qui ne vienne d'un banc d'essai que j'ai
      réellement fait tourner.
- [ ] **Source des chiffres**, s'il y en a :

      <!-- Lien ou référence. « Aucun chiffre avancé » est une réponse valable. -->

- [ ] **Aucun conseil juridique.** Le bloc réglementaire est factuel et daté.
- [ ] Les liens de `further_reading` répondent. Vérifié.

En cas de doute sur un point, la fiche est en `status: draft`. Un brouillon
assumé est utile ; une fiche plausible mais fausse ne l'est pas.

---

## Contrôles

- [ ] `npm run check` passe en local.

<!--
  Cette commande enchaîne exactement les contrôles de l'intégration continue,
  dans le même ordre. Si elle passe chez vous, elle passera en CI.
-->

---

## Ce qui est refusé

Contenu non vérifié, promotion d'un outil, chiffres sans source, conseil
juridique, jugement de valeur sur l'IA, texte de remplissage. Voir
[CONTRIBUTING.md](../CONTRIBUTING.md).
