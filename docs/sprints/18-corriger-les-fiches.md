# Lot 18 — Corriger les dix-neuf fiches refusées du lot 17

## Rôle

Tu es développeur full-stack senior, pragmatique, qui a mis ces outils en
production. Tu interviens sur **Overkill**, catalogue technique en ligne sur
https://isitoverkill.dev. Tu travailles sans supervision : quand tu hésites, tu
tranches, tu notes, tu continues.

---

## Le contexte

Un relecteur indépendant a relu les 25 fiches ajoutées au lot 17. Il en a
accepté 6 et refusé 19. Ses avis sont dans `docs/lot17/avis/<id>.md`, un par
fiche, et la synthèse dans `docs/lot17/AVIS-SYNTHESE.md`.

La sévérité ne vient pas du style. Chaque refus porte sur une affirmation
fausse, une sortie fausse sur une entrée ordinaire, un écart à la norme
invoquée, ou une démonstration qui ne démontre rien. Onze fiches rendent une
sortie fausse et silencieuse : c'est exactement ce que le site reproche aux
modèles, et c'est la priorité.

Ta mission est d'appliquer ces avis, une fiche à la fois.

---

## Avant de commencer

Place-toi sur `lot17-ecrire-25-fiches` (les 25 fiches et leurs avis y sont).
Crée ta branche de travail depuis elle : `git checkout -b lot18-corriger`.

Lis :

- `docs/lot17/AVIS-SYNTHESE.md` — le diagnostic, les motifs classés, et les
  trois contrôles proposés en § 3
- `docs/lot17/avis/<id>.md` pour la fiche que tu traites
- `docs/sprints/CHARTE-REDACTION.md` et `docs/sprints/CHARTE-TESTS.md`

---

## Les trois contrôles à écrire EN PREMIER

Le relecteur a montré qu'une règle sans contrôle dérive : R11 est enfreinte 25
fois sur 25. Avant de corriger la moindre fiche, écris les contrôles qui
empêcheront le problème de revenir, et branche-les dans `npm run check`.

**1. `check-longueur-rupture`** — échoue si un `breaking_point` d'une fiche
publiée dépasse la limite de R11 (deux phrases / soixante mots). C'est le
contrôle le plus simple et il verrouille une dérive déjà mesurée.

**2. Le contrôle des chaînes de sortie** — le trou principal identifié par le
relecteur : les chartes vérifient ce que la page affiche, jamais ce que le code
répond à l'exécution. Les chaînes `reason` / `why` qu'un extrait renvoie à
l'appelant ne sont vérifiées par personne, et six fiches sont refusées pour une
telle chaîne fausse alors que la décision était juste. Écris le contrôle qui
rend ces chaînes testables (le relecteur en décrit la forme en § 3 de la
synthèse — suis-la ; si elle est irréalisable telle quelle, fais au plus proche
et note l'écart).

**3. Le troisième contrôle proposé en § 3** de la synthèse, selon ce qu'elle
décrit.

Si l'un des trois se révèle infaisable proprement, ne le bâcle pas : écris
pourquoi dans le rapport et passe au suivant.

---

## La méthode : une fiche à la fois, trois temps

**Séquentiel. Un seul agent. Aucun sous-agent.**

Pour chaque fiche, dans l'ordre de priorité ci-dessous :

### 1. Corriger

Applique l'avis, point par point. Un avis dit toujours « ce qu'il faut faire » :
suis-le. Si tu diverges, note pourquoi dans la vérification.

Corrige le code quand le défaut est dans le code, la fiche quand l'affirmation
est fausse, le chiffre quand il ne correspond pas à ce que le dépôt produit
(rejoue la mesure, publie la vraie valeur). **Ne masque jamais un défaut par une
reformulation.** Une sortie fausse et silencieuse se corrige, ou, si c'est une
vraie limite de l'approche, se dit en premier dans le point de rupture — jamais
en dernier, jamais tue.

### 2. Retester

- Réécris les tests infirmés sur le comportement corrigé ; aucun marquage
  `INFIRMÉ`, `DÉFAUT` ou `xfail` ne subsiste.
- Ajoute le cas d'entrée ordinaire qui a fait tomber la fiche à la relecture
  (`photo.jpeg`, « Après Renault », la brève de 125 caractères…) : il doit
  désormais passer.
- Un chiffre publié est asserté par un test à sa vraie valeur, pas dans une
  fourchette large qui laisserait passer n'importe quoi.
- Parité Python/JavaScript vérifiée sur les mêmes entrées ; toute divergence est
  écrite dans la fiche.

`node scripts/test-snippets.mjs <id>` passe avant de commiter.

### 3. Relire

Relis la fiche corrigée avec l'avis en main : chaque motif de refus est-il
levé ? Sinon, retour au temps 1. Écris le résultat dans
`docs/lot18/verifications/<id>.md` : les motifs, ce que tu as fait, la preuve
(commande lancée, sortie obtenue).

**Puis commit.** Un commit par fiche : une coupure ne coûte qu'une fiche. Une
ligne dans `docs/lot18/ETAPES.md`.

---

## L'ordre de traitement

**Groupe A — sorties fausses et silencieuses (11 fiches), le plus grave :**
5, 7, 11, 12, 13, 14, 15, 16, 19, 21, 25.

**Groupe B — chiffre faux, écart à la norme, démonstration creuse (8) :**
2, 4, 6, 9, 10, 18, 22, 23.

Termine un groupe avant le suivant. À la fin de chaque groupe, `npm run check`
complet au vert (lance-le en une fois dans un terminal stable ; s'il cale par
manque de mémoire, `check:fast` puis `check:slow`).

---

## Interdits

1. **Aucun défaut masqué par une reformulation.** On corrige, ou on le dit en
   premier.
2. **Aucun chiffre publié qui ne soit produit par le dépôt** et asserté à sa
   vraie valeur.
3. **Aucune norme invoquée comme autorité sans être respectée** ni vérifiée à la
   source.
4. **Aucune fiche publiée dont le code n'a pas été exécuté.** En cas de doute,
   `status: draft` avec la raison.
5. **Ne touche pas au design ni aux gabarits.**
6. **Un extrait reste lisible.** Si une correction le fait doubler, tu as choisi
   la mauvaise : préfère l'outil standard, ou documente la limite.

---

## Git

- Branche `lot18-corriger`, poussée.
- Un commit par fiche, plus un par contrôle.
- Messages en français, format conventionnel. **Aucune mention de Claude, de
  Claude Code ou d'un modèle d'IA** nulle part.

---

## Rapport de fin — `docs/lot18/RAPPORT-LOT18.md`

- Le tableau des 19 fiches : motifs, ce qui a été corrigé, état.
- Les trois contrôles : ce qu'ils vérifient, combien de fiches ils rattrapent,
  ceux qui n'ont pas pu être écrits et pourquoi.
- Les chiffres corrigés : ce que la fiche disait, ce que le dépôt produit.
- Les avis dont tu t'es écarté, avec la raison.
- Ce qui reste ouvert.

Commence par les trois contrôles, puis le groupe A.
