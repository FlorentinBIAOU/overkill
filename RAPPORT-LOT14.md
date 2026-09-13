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

### Partie 2 — Le design appliqué partout

| Fait | Preuve |
|---|---|
| Un seul traitement de bouton et de lien d'action pour tout le site, dans `global.css` | l'accueil, le catalogue, les familles, les fiches, le 404 et les pages éditoriales posaient chacun le leur ; captures des onze pages regardées |
| Un seul composant d'appel à l'action, `CtaBand` | employé par le catalogue, les familles, l'index des familles, la méthodologie, contribuer et les crédits |
| Les pages éditoriales reçoivent l'appel à l'action qui leur correspond, ou aucun | captures regardées page par page |
| Les liens en cartes, employables depuis un fichier MDX | crédits et à propos : les méthodologies citées et les liens de l'auteur étaient du texte nu |
| Un aplat d'en-tête sur chacune des onze pages publiques | mentions légales, confidentialité et crédits n'en avaient pas |
| Les blocs de code des pages éditoriales sur le même fond sombre que les fiches | capture de la page contribuer regardée |
| Les fiches mises en avant sur l'accueil au format carte du catalogue | capture regardée |
| Accessibilité, clair et sombre | `node scripts/check-a11y.mjs /fr/credits /fr/contribuer /fr/familles /fr/a-propos /fr/404` — aucune violation sérieuse ni critique |
| Aucun débordement horizontal, onze pages, quatre largeurs | `node scripts/check-overflow.mjs` sur les onze pages publiques |
| `npm run check` au vert | de bout en bout, trois constructions comprises |

### Défauts trouvés en regardant l'écran, et corrigés

7. **La page contribuer décrivait un bouton qui n'existait pas.** La section 7.8
   du CDC demande « le bouton proposer une fiche sans coder, qui ouvre une issue
   GitHub pré-remplie » : la page en parlait au futur depuis le lot 09 sans
   jamais le poser. Il est là, dans l'appel à l'action de fin de page.
8. **Le tableau des polices de la page crédits débordait à 360 px** et poussait
   la page entière. Tout tableau du Markdown est désormais enveloppé dans un
   conteneur qui défile, par un greffon de rendu : le contenu large défile dans
   son conteneur, jamais la page.
9. **Un appel à l'action commençait au bord de la page** sur les pages
   éditoriales, dont tout le texte est centré dans une colonne de lecture. Il
   s'aligne maintenant sur cette colonne.
10. **Les listes de liens se mettaient sur deux colonnes selon la largeur de
    l'écran**, y compris dans une colonne de lecture de 680 px où elles
    devenaient illisibles. Le calcul porte désormais sur la place réellement
    disponible.

### Défauts trouvés en regardant l'écran, et corrigés — partie 3

11. **Le message honnête s'affichait en vert**, la couleur que ce site réserve
    à la recommandation. « Le catalogue ne couvre pas encore ce besoin » n'est
    pas une réponse de niveau : il ne prend pas la teinte d'un niveau.
12. **La justification de la fiche était étiquetée « pourquoi »** même quand
    les contraintes avaient déplacé la réponse vers un autre niveau — le texte
    argumentait alors exactement le contraire de ce qui s'affichait au-dessus.
    Elle est maintenant étiquetée pour ce qu'elle est : « pourquoi la fiche
    recommande N3 par défaut ».
13. **Le message pré-rempli écrivait ses espaces en « + »**, ce qu'un client de
    messagerie n'interprète pas : le brouillon se serait ouvert criblé de plus.
14. **Le verdict ne disait rien quand rien ne bloquait.** Quelqu'un qui venait
    de répondre à six questions de contrainte voyait une réponse qui n'en
    parlait pas. Il dit maintenant ce qui tient, et sur quoi.


### Partie 3 — Le questionnaire

| Fait | Preuve |
|---|---|
| Page « Par où commencer », cinquième entrée de la navigation | captures en clair et en sombre, à 360 et 1280 px |
| Huit questions, quatre écrans, deux par écran, questions restantes affichées | `npm run test:guide` — le compte suit les réponses, contrôlé au navigateur |
| Les questions suivantes dépendent des précédentes | la liste des tâches n'affiche que celles de la famille choisie ; « je ne sais pas » sur la famille retire la question et le compte passe de huit à sept |
| « Je ne sais pas » partout, et prise en compte | elle n'écarte aucune option et fait dire au verdict ce que l'option implique sur ce point |
| Arbre déterministe, aucun appel de modèle, rien ne sort de la page | `npm run check:third-party` ; le calcul est dans `src/lib/guide-verdict.mjs`, sans réseau |
| Arbre piloté par les données des fiches | familles, tâches, niveaux, sortie de données, déterminisme et testabilité viennent du contenu ; `src/lib/guide.ts` ne fait que les extraire |
| Chaque parcours aboutit à une fiche existante ou au message honnête | `npm run test:guide` — 32 400 verdicts par langue, toutes les combinaisons de réponses pour chacune des 25 fiches, sur la charge utile réellement livrée |
| Verdict explicatif, jamais une réponse seule | trois formes capturées et regardées : fiche désignée, famille sans tâche, aucune tâche |
| Le message pré-rempli avant l'issue GitHub | contrôlé au navigateur : la première des deux voies est un `mailto:` qui porte les réponses |
| Utilisable sans JavaScript | contrôle au navigateur avec JavaScript désactivé : les quatre écrans sont lisibles et la page renvoie aux dix familles |
| Poids | 19,0 Ko transférés, dont 3,1 Ko de JavaScript |
| Accessibilité et débordement | `check-a11y` et `check-overflow` sur les deux langues, au vert |


### Défauts trouvés en regardant l'écran, et corrigés — parties 1 et 2

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


### Partie 2

**La feuille de route publique est retirée.** Le document de lot la compte
parmi les décisions périmées, la nouvelle navigation ne la porte plus, et la
partie 8.4 lui substitue une page des dernières fiches et le flux RSS. Une page
qui annonce cent soixante-quinze fiches inexistantes est une promesse, et ce
site n'en fait pas. Les deux cents intitulés restent dans `content/roadmap.yaml`
— ils servent au jeu de test à deux cents fiches et aux contributeurs. Les
liens qui y menaient, sur l'accueil, le 404 et la page contribuer, renvoient
désormais au catalogue ou aux familles. `docs/CDC.md` est mis à jour aux
sections 6.2, 7.1, 7.4 et 7.11. *Écarté :* la garder en la vidant de ses
promesses, ce qui aurait laissé une page sans lecteur.

**Les pages légales n'ont pas d'appel à l'action.** Toutes les autres pages en
portent un. Une page de mentions légales n'a rien à proposer, et un appel à
l'action creux y serait pire que son absence. Ce n'est pas un retrait de
traitement : elles ont le même aplat d'en-tête, la même colonne, les mêmes
liens et les mêmes tableaux que les autres.

**Le sous-titre visible des pages éditoriales est leur description.** Elle
existait déjà, exacte et écrite pour ces pages, et elle ne servait qu'au
référencement. *Écarté :* écrire un second texte pour l'en-tête, qui aurait
été un doublon à maintenir.

**Les liens en cartes passent par un composant employable depuis MDX.** Les
pages éditoriales sont écrites en MDX et n'ont pas accès au dictionnaire
d'interface ; `<Links lang="fr" links={[…]} />` le leur donne sans qu'un
rédacteur ait à connaître le reste. *Écarté :* transformer les listes de liens
du Markdown par un greffon de rendu — impossible d'y deviner la nature d'un
lien sans son adresse, et cela aurait transformé aussi les listes qui doivent
rester des listes.


### Partie 3

**Le questionnaire a besoin de JavaScript pour enchaîner ses écrans.** Sans
lui, les quatre écrans restent lisibles et la page renvoie aux dix familles,
qui rangent le catalogue par ce qu'on veut faire. *Écarté :* pré-calculer un
arbre de pages statiques — huit questions à trois ou onze réponses font
cinquante mille pages, pour un outil qu'on parcourt une fois.

**Les contraintes choisissent un niveau, elles ne filtrent pas les fiches.**
Écarter une fiche parce que son option recommandée envoie des données chez un
tiers aurait caché le besoin au lieu de répondre. Le questionnaire garde la
fiche, et déplace la réponse vers le niveau qui satisfait la contrainte, en le
nommant. C'est ce qui produit un verdict explicatif plutôt qu'un tri.

**Le verdict garde le niveau de la fiche quand il satisfait la contrainte**,
même si un niveau plus bas la satisfait aussi. Descendre « parce que c'est plus
frugal » reviendrait à recommander une option dont la fiche a établi qu'elle ne
fait pas le travail. La frugalité est déjà dans le verdict de la fiche ; le
questionnaire ne la surenchérit pas.

**Les cartes du verdict sont clonées depuis un gabarit rendu par le site.** Le
verdict n'écrit pas de carte à la main : `EntryCard` est rendu au build dans un
`<template>`, que le module clone. Le format reste celui du catalogue sans
duplication de balisage, et un gabarit ne s'affiche pas sans JavaScript.
*Écarté :* reconstruire la carte en JavaScript, qui aurait fait diverger les
deux formats au premier changement.

**La charge utile ne porte que ce que le verdict calcule.** Le titre et le
besoin d'une fiche sont déjà dans la page — en option de question et en carte ;
les renvoyer en JSON, c'était payer deux fois les mêmes octets. Reste la
justification, les niveaux et leurs attributs : 10,6 Ko transférés sur les 19
de la page.

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
