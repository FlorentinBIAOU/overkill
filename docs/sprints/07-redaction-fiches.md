# Lot 07 — Rédaction des 25 fiches

## 1. Objectif

Produire les 25 fiches du contenu de lancement, complètes dans les deux langues, chaque
barreau documenté intégralement, chaque verdict assumé et justifié, sans un mot de
remplissage.

## 2. Dépendances

- **Lot 02** fournit : le schéma qui rejette toute fiche incomplète, et le gabarit de fiche.
- **Lot 06** fournit : les extraits testés, leurs chemins, et le niveau de vérification
  réellement atteint par chacun.

## 3. Tâches

1. Écrire le dossier de consignes rédactionnelles remis à chaque sous-agent : le vocabulaire
   de coût de la section 4.5 et rien d'autre, les cinq classes de latence, la formulation
   imposée du réglementaire, l'interdiction des prix absolus et des gCO₂e non sourcés,
   l'interdiction du texte de remplissage, le ton, la longueur cible de chaque champ.
   → `docs/sprints/CHARTE-REDACTION.md`
2. Écrire les deux fiches de référence, entièrement à la main, dans les deux langues :
   `mask-personal-data-in-chat` (verdict N0) et `write-product-descriptions` (verdict N3).
   Elles servent d'étalon aux sous-agents et prouvent que le positionnement de la section 1.3
   tient. → `content/entries/*.mdx`
3. Répartir les 23 fiches restantes en sous-agents, un agent par fiche. Chaque agent reçoit :
   la charte, les deux fiches de référence, la matrice des extraits de sa fiche, et
   l'interdiction formelle d'inventer un chiffre.
4. Relire chaque fiche rendue, en français et en anglais. Contrôles : cohérence du verdict
   avec le contenu, absence de chiffre non sourcé, absence de conseil juridique, absence de
   paragraphe creux, exactitude technique des points de rupture.
5. Passer en `status: draft` toute fiche dont un extrait n'atteint pas un niveau de
   vérification suffisant, ou dont un point reste douteux après relecture.
6. Renseigner les barreaux absents avec une raison courte et réelle, jamais une formule.
7. Vérifier chaque verdict contre celui attendu en section 6.1 du CDC. Tout écart est
   documenté au journal avec sa justification, et remonté dans `RAPPORT.md`.
8. Renseigner `further_reading` et `sources` avec des liens réellement consultés.
   Aucun lien inventé.
9. Écrire les dix fichiers de famille : titre, description de deux à quatre phrases, question
   type, ordre d'affichage, référence à l'illustration. → `content/families/*.mdx`
10. Passer la validation de contenu et corriger jusqu'à ce qu'elle soit verte.

## 4. Parallélisable

- **Séquentiel obligatoire** : 1 → 2 → 3. La charte et les fiches de référence sont le
  contrat des sous-agents.
- **Massivement parallélisable** : la tâche 3, 23 agents indépendants. Une fiche est un
  fichier autonome, aucun import croisé.
- **Parallélisable** : la tâche 9, les dix familles, en un seul agent ou à la main, pendant
  la tâche 3.
- **Séquentiel obligatoire** : 4, 5, 6, 7 après 3. La relecture ne se délègue pas :
  c'est elle qui porte les interdits n° 2, 3 et 10.

## 5. Critères d'acceptation

Repris du lot 7 de la section 13 du CDC.

- [ ] Les 25 fiches passent `check-content` sans erreur.
- [ ] Aucun barreau `available: true` n'a de champ manquant parmi les sept de la section 4.2.
- [ ] Aucun barreau `available: false` n'est sans `unavailable_reason`.
- [ ] Chaque `verdict_rationale` fait deux à trois phrases et argumente réellement.
- [ ] Chaque champ bilingue a ses deux langues, et l'anglais n'est pas une traduction
      automatique du français : les deux versions se lisent comme écrites dans leur langue.
- [ ] Aucune occurrence d'un prix absolu, d'un gCO₂e, ou d'un pourcentage de performance non
      sourcé, vérifié par un contrôle automatique sur des motifs interdits.
- [ ] Aucune fiche `published` ne référence un extrait dont le test échoue.
- [ ] Au moins une fiche recommande franchement N3, conformément à la section 1.3.
- [ ] Les dix familles sont couvertes, et chaque fiche appartient à une seule famille.

## 6. Commande de vérification

```
node scripts/check-content.mjs && node scripts/check-figures.mjs && node scripts/test-snippets.mjs && npm run build
```

`check-figures.mjs` est ajouté par ce lot : il cherche dans tout `content/` les motifs
interdits par l'interdit n° 2 — symboles monétaires suivis d'un nombre, `gCO2e`, `gCO₂e`,
pourcentages de performance sans référence à une source — et échoue s'il en trouve.

## 7. Risques

| Risque | Repli |
|---|---|
| **Les sous-agents produisent du texte plausible et creux.** C'est le risque principal du projet. | Fiches de référence écrites à la main comme étalon, relecture systématique en tâche 4, contrôle automatique des motifs interdits, et passage en `draft` sans hésiter. Une fiche en brouillon est honnête, une fiche creuse détruit le site. |
| Un chiffre inventé passe la relecture. | `check-figures.mjs` attrape les formes chiffrées. Ce qu'il n'attrape pas, la charte l'interdit en amont : à défaut de source, on emploie le vocabulaire d'ordre de grandeur ou on n'affirme rien. |
| Un verdict attendu en section 6.1 ne résiste pas à l'écriture de la fiche. | Le CDC l'autorise explicitement : on change le verdict et on le signale. Le catalogue doit refléter la réalité, pas la liste. |
| L'anglais sonne comme du français traduit, alors que l'anglais est la version canonique. | Rédaction directe dans les deux langues plutôt que traduction, et relecture séparée de l'anglais. |
| 25 fiches × 4 barreaux × 2 langues, le volume écrase la qualité. | Priorité assumée : mieux vaut 20 fiches publiées et 5 en brouillon que 25 fiches tièdes. Le compte est signalé dans `RAPPORT.md`. |
| Une fiche glisse vers le conseil juridique. | Formulation imposée par la section 4.5, reprise mot pour mot dans la charte, plus l'encadré permanent de pied de page. |
