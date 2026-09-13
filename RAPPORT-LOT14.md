# Lot 14 — Refonte de l'expérience et préparation au lancement

Rapport de fin de lot. Branche `lot14-experience`, créée depuis `main` à jour.

Ce document est écrit au fil du lot : chaque partie y est versée quand elle est
terminée, vérifiée et commitée.

---

## Les verdicts corrigés

*Partie 7.1 — relecture et exécution des 25 fiches. Section à compléter.*

---

## Les codes réparés

*Partie 7.1. Section à compléter.*

---

## Ce qui est fait et vérifié

### Partie 1 — La fiche

| Fait | Preuve |
|---|---|
| Blocs de code sur fond sombre fixe, bande d'onglets d'éditeur, bouton copier | `SEL=".code-tabs" node scripts/shot.mjs /fr/fiches/mask-personal-data-in-chat 1440 light` — capture regardée en clair et en sombre, à 360 et 1440 px |
| Contraste de la coloration syntaxique mesuré contre ce fond | `npm run check:contrast` — les 149 extraits du dépôt passent par Shiki, 8 couleurs émises, la plus faible à 8,66:1 |
| Zone d'essai interactive, 16 fiches | `npm run test:tryout` au navigateur sur chaque fiche qui a un essai ; captures des 20 zones regardées une par une |
| Zone d'essai figée, 4 fiches, sorties calculées au build | même contrôle ; `npm run check:content` exécute chaque cas dans les deux langues |
| Bloc risques en langage clair | capture `SEL=".risks"` regardée ; `npm run check:a11y` au vert |
| Preuve d'exécution réintégrée dans la barre du bloc de code | capture regardée ; forme courte visible, phrase complète au survol et pour les lecteurs d'écran |
| Liens en cartes avec nature et source | capture regardée ; `npm run check:links` au vert |
| Fiches voisines au format carte du catalogue | capture regardée |
| CTA de fin en aplat jaune, grand titre, bouton sombre | capture regardée |
| Marges et espacement repris | captures 360 / 1440, clair et sombre, regardées |
| Aucun débordement horizontal | `node scripts/check-overflow.mjs /fr/fiches/mask-personal-data-in-chat /fr/fiches/summarise-a-long-document` — 4 largeurs, aucun |

### Défauts trouvés en regardant l'écran, et corrigés

1. **L'adresse de contact s'affichait à l'envers** (`moc.liamg@olfuoaib`) sur
   toutes les fiches et sur l'accueil. Le CSS de portée automatique d'Astro ne
   marque pas le balisage injecté par `set:html`, donc la règle qui remettait
   l'adresse à l'endroit ne s'appliquait jamais. Les règles concernées sont
   désormais globales, et le commentaire du composant dit pourquoi.
2. **Un niveau sans objet était atténué à 0,55 d'opacité**, ce qui faisait
   passer son texte sous le seuil AA (`check-a11y`, deux violations
   « serious »). Le pointillé et le trait disent la même chose sans coûter la
   lisibilité.
3. **`check-weight` ne voyait pas le module d'essai**, chargé à la demande donc
   absent des balises `script` : il mesurait 3,8 Ko de JavaScript sur une fiche
   qui en télécharge 8,1. La page nomme son essai dans `data-tryout`, le
   contrôle suit ce lien, et il mesure maintenant la fiche la plus chargée en
   JavaScript et non seulement la plus lourde.
4. **Un tableau de résultats perdait ses dernières colonnes** dans la zone
   d'essai : la grille à deux colonnes laissait le tableau serré dans une
   demie dès qu'une phrase de commentaire occupait la seconde. Passé en flex,
   et un tableau de trois colonnes ou plus prend la largeur entière.
5. **Deux panneaux voisins portaient le même intitulé** « ce qu'il renvoie ».
   Chaque panneau porte désormais le sien : ce qu'il renvoie, ce qu'il en
   conclut, le détail, l'image produite.
6. **Un lien vers un niveau replié ne montrait rien** : le sommaire pointe vers
   des sections rangées dans un `details` fermé.

---

## Les décisions prises seul

### Partie 1

**La branche part de `design/fiche` et non de `main` nu.** `design/fiche` était
`main` plus un commit de cadrage qui contenait déjà le début de la refonte de la
fiche — la réponse en toutes lettres dans le bandeau, la disparition du tableau
à sept colonnes. Repartir de `main` aurait jeté ce travail pour le réécrire à
l'identique. La branche `lot14-experience` contient donc `main` plus ce commit.
*Écarté :* repartir de `main` nu.

**Les essais vivent dans `content/tryouts/`, pas dans `src/`.** Un essai décrit
ce qu'on donne à un extrait et ce qu'on en attend : c'est du contenu, au même
titre qu'une fiche, et un contributeur doit pouvoir en écrire un sans ouvrir le
code du site. *Écarté :* un bloc `tryout` dans le frontmatter de chaque fiche —
le YAML n'accueille pas la construction d'un index ou l'entraînement d'un
modèle, et il aurait fallu un langage d'expression pour dire quelle fonction
appeler.

**La forme interactive exécute l'extrait de la fiche dans le navigateur**, ce
qui renverse la décision de `docs/DECISIONS-CLARTE.md` section 5. Cette
décision visait un bac à sable WebAssembly de plusieurs mégaoctets ; elle ne
tient plus dès lors qu'on exécute l'extrait lui-même, quelques kilooctets de
JavaScript sans dépendance, qui sont précisément ce que la fiche recommande.
Refuser de le faire tourner aurait été un aveu. Le document est mis à jour.
*Écarté :* la zone d'essai entièrement figée.

**Sans JavaScript, la zone affiche le premier exemple, calculé à la
construction du site**, et une ligne dit que la saisie libre et les autres
exemples demandent JavaScript. La zone dit donc déjà quelque chose de vrai
avant le premier octet de script. *Écarté :* rendre les six cas au build pour
les lecteurs sans JavaScript — cela doublait le contenu de la page et ajoutait
du bruit pour les lecteurs d'écran.

**Sur les niveaux N2 et N3, ce qui est calculé est la plomberie** : ce que le
code envoie, ce qu'il refuse avant de dépenser, ce qu'il réessaie, ce qu'il
accepte. La réponse du modèle est simulée par le double local des tests, et
chaque essai le dit une fois, dans son propre `note`. C'est le même partage que
la mention « testé, service simulé ». *Écarté :* ne pas mettre de zone d'essai
sur ces fiches — le cas le plus utile du catalogue est justement là, le résumé
fluide et faux que le code accepte sans broncher.

**La preuve d'exécution devient une pastille dans la barre du bloc de code**,
forme courte visible, phrase complète au survol et pour les lecteurs d'écran.
*Écarté :* une note sous le code, qui recréait le bloc explicatif que le lot
demande de retirer.

**La nature d'un lien est déduite de son hôte**, avec un `kind` facultatif dans
le frontmatter pour corriger une déduction fausse. Le repli est « page web »,
qui est vrai de n'importe quelle adresse. *Écarté :* rendre `kind` obligatoire —
cinquante liens à saisir, et un champ que les contributeurs rempliraient au
hasard.

**Le vert de la recommandation passe par un rôle nommé, `--recommended`.** Le
contrôle de couleur réserve `--go` au composant du badge ; la carte du niveau
recommandé en a besoin aussi. Nommer le rôle rend chaque emploi lisible et
laisse la règle serrée. *Écarté :* ajouter `EntryLayout.astro` à la liste
d'exceptions du contrôle, ce qui aurait blanchi un fichier entier.

**Un seul thème de coloration syntaxique est rendu**, puisque le fond du code
ne suit plus le thème de la page. Chaque jeton portait deux couleurs dans le
HTML, une par thème ; il n'en porte plus qu'une.

---

## Ce que j'ai volontairement laissé de côté

*Section à compléter au fil du lot.*

---

## Les mesures

*Section à compléter à la fin du lot.*

---

## Astro 7

*Partie 10. Section à compléter.*

---

## Les documents mis à jour

*Section à compléter au fil du lot.*

---

## Ce qui cassera en premier à 200 fiches

*Section à compléter à la fin du lot.*
