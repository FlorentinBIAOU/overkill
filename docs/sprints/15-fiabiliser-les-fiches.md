# Lot 15 — Fiabiliser les 25 fiches, outiller la production des suivantes

## Rôle

Tu es développeur full-stack senior. Tu interviens sur **Overkill**, un catalogue
technique en ligne sur https://isitoverkill.dev.

Tu travailles sans supervision. Le commanditaire ne répondra à aucune question
pendant l'exécution. Quand tu hésites, tu tranches, tu notes, tu continues.

---

## Pourquoi ce lot

Le catalogue compte 25 fiches. Il en comptera 200, écrites par des agents en
suivant le même patron. **Avant d'industrialiser, il faut que les 25 existantes
soient irréprochables** : elles serviront de modèle, et une fiche qui affirme
sans prouver ne peut pas en être un.

Le commanditaire prépare par ailleurs un paquet installable tiré de ce code. Ce
qui est publié ici doit donc tenir en production, pas seulement à la lecture.

---

## Ce que « irréprochable » veut dire

Trois exigences, cumulatives :

1. **Chaque affirmation de la fiche est démontrée par un test, sourcée, ou
   retirée.** En particulier le point de rupture, qui est aujourd'hui une
   phrase : il devient un test qui échoue le jour où l'affirmation cesse d'être
   vraie.
2. **Le code est vrai, testé, et tient en production.** Pas de cas heureux
   uniquement : entrée vide, entrée énorme, encodage inattendu, valeurs
   limites.
3. **Les chiffres et les faits sont exacts.** Rien d'approximatif, rien
   d'invérifiable.

---

## Avant de commencer

Lis :

- `docs/CDC.md` — le cahier des charges
- `docs/DECISIONS-CLARTE.md` — les décisions de vocabulaire
- `docs/sprints/CHARTE-REDACTION.md` — la charte de rédaction des fiches
- `docs/sprints/CHARTE-EXTRAITS.md` — la charte des extraits de code
- `RAPPORT-LOT14.md` et `RAPPORT-LOT14-ZONE-ESSAI.md` — l'état du travail
- `docs/sprints/JOURNAL.md` — l'historique

Ne consulte aucune source extérieure pour le cadre : tout est dans le dépôt. En
revanche, **la recherche documentaire sur le contenu technique des fiches est
attendue** : vérifier qu'une bibliothèque se comporte comme la fiche le dit,
qu'un seuil est réaliste, qu'une limite existe bien.

---

## Les trois rôles

Ce lot s'exécute avec **trois rôles distincts**, incarnés par des sous-agents.
Trois au maximum en simultané.

### Le testeur

Écrit les tests et les fait tourner. **Il ne touche ni à la fiche ni au code des
extraits.**

Pour chaque fiche, il produit un test par affirmation testable, en commençant
par le point de rupture. Un point de rupture qui dit « ça casse sur l'obfuscation
volontaire » doit avoir un test qui montre l'obfuscation passer au travers — et
qui échouera le jour où le code se mettra à l'attraper.

Il rend la liste des affirmations qu'il n'a pas pu tester, avec la raison.

### Le rédacteur

Corrige ce que les tests infirment, complète ce qui manque, vérifie que le code
tient en production. **Il ne relit pas son propre travail.**

### Le relecteur

Se comporte comme **un développeur de vingt-cinq ans d'expérience, pragmatique,
qui a mis ces choses en production**. Il connaît le coût réel des choix, les
pièges d'exploitation, et il n'est pas impressionné par un code qui se lit bien.

**Il ne modifie rien.** Il rend un avis par fiche : accepté, ou refusé avec les
raisons, précises et actionnables.

Il juge :

- la réalité du cas — est-ce un problème qu'on rencontre vraiment
- la pertinence technique — l'approche est-elle celle qu'on retiendrait
- la solidité du verdict — tient-il face aux chiffres et à l'usage
- la vérité du point de rupture — est-ce bien là que ça casse, et seulement là
- le style — direct, pragmatique, sans tournure scolaire ni remplissage

Une fiche refusée retourne au rédacteur, puis au testeur, puis au relecteur.

**Aucun rôle ne se corrige lui-même. Toute correction repasse par les tests.**

---

## Les trois passes sur les 25 fiches

Séquentielles. Une passe se termine par `npm run check` au vert et un commit.

### Passe 1 — Le testeur

Pour chaque fiche, dans l'ordre du catalogue :

- Un test par affirmation testable de la fiche
- **Le point de rupture en premier** : il doit être démontré, pas affirmé
- Les cas de production : entrée vide, entrée très grande, encodage inattendu,
  valeurs aux limites, entrée malveillante quand c'est pertinent
- Les tests portent des noms qui disent ce qu'ils prouvent, en français

Livrable : les tests, et un relevé des affirmations non testables avec la raison.

### Passe 2 — Le rédacteur

- Corrige ce que les tests infirment. Si une affirmation est fausse, elle est
  corrigée ou retirée, jamais atténuée pour sauver la face.
- Vérifie que le code tient en production et complète ce qui manque.
- Vérifie les chiffres et les faits. Recherche documentaire attendue.

### Passe 3 — Le relecteur

Relit les 25 fiches et rend un avis par fiche. Les refusées repartent en
passe 2, puis 1, puis 3. Boucle jusqu'à ce que les 25 soient acceptées, ou
qu'une fiche soit déclarée irrécupérable et passée en `status: draft` avec la
raison.

---

## Les règles à poser pour la suite

### Le fournisseur des niveaux N3

Les 25 fiches nomment toutes le même fournisseur pour leurs exemples de modèle
généraliste. Ce n'est ni une recommandation ni un partenariat, et le site ne
peut pas laisser croire le contraire.

Ajoute dans la page méthodologie, dans les deux langues, une phrase qui dit
qu'un fournisseur sert d'exemple, que le raisonnement vaut pour les autres, et
que le client s'échange. Ajoute un commentaire en ce sens dans les extraits N3.

Porte la même règle dans `docs/sprints/CHARTE-REDACTION.md`.

### La charte, enrichie de ce que ce lot a appris

Les trois passes vont révéler ce qui distingue une fiche solide d'une fiche
plausible. **Verse-le dans la charte**, avec des exemples tirés des corrections
réelles de ce lot.

La charte doit permettre à un agent d'écrire la fiche 26 sans que le relecteur
ait à redire ce qu'il a déjà dit vingt-cinq fois.

### La charte des tests

Écris `docs/sprints/CHARTE-TESTS.md` : ce qu'un test de fiche doit couvrir, dans
quel ordre, comment on démontre un point de rupture, quels cas de production
sont obligatoires. C'est ce document qui guidera le testeur sur les 175 fiches
suivantes.

---

## Interdits

1. **Aucune affirmation non démontrée** ne subsiste dans une fiche acceptée.
2. **Aucun chiffre inventé.** Pas de prix absolu, pas d'empreinte chiffrée sans
   méthodologie citée, pas de benchmark non réalisé.
3. **Aucune atténuation pour sauver une affirmation fausse.** On corrige ou on
   retire.
4. **Aucun rôle ne valide son propre travail.**
5. **Aucune fiche publiée dont le code n'a pas été exécuté.** En cas de doute,
   `status: draft`.
6. **Ne touche pas au design.** Ce lot porte sur le contenu, le code et les
   tests. Le rendu a été traité aux lots 14 et suivants.

---

## Règles Git

- **Branche dédiée**, créée depuis `main` à jour. Tu peux la pousser.
- Un commit par fiche validée, pas par passe : une coupure ne doit coûter
  qu'une fiche.
- Messages en français, format conventionnel. **Aucune mention de Claude, de
  Claude Code ou d'un modèle d'IA** nulle part.

---

## Rapport de fin

Produis `RAPPORT-LOT15.md` :

- **Un tableau des 25 fiches** : nombre de tests ajoutés, affirmations
  corrigées, affirmations retirées, avis du relecteur, nombre de tours
- **Ce que le relecteur a refusé et pourquoi.** Section attendue en premier.
- **Les affirmations non testables**, avec la raison
- **Ce qui a été trouvé de faux** : ce que disait la fiche, ce qui a été
  vérifié, ce qu'elle dit désormais
- **Ce que ce lot a appris**, versé dans la charte
- **Les décisions prises seul**, avec l'alternative écartée
- **Ce qui reste fragile** quand les mêmes rôles écriront 175 fiches de plus

---

Commence par la passe 1.
