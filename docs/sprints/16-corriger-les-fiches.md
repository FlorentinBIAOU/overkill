# Lot 16 — Corriger les vingt-quatre fiches refusées

## Rôle

Tu es développeur full-stack senior. Tu interviens sur **Overkill**, catalogue
technique en ligne sur https://isitoverkill.dev.

Tu travailles sans supervision. Le commanditaire ne répondra à aucune question
pendant l'exécution. Quand tu hésites, tu tranches, tu notes, tu continues.

---

## Le contexte

Un relecteur a relu les 25 fiches du catalogue. **Il en a accepté une et refusé
vingt-quatre.** Ses avis sont dans `docs/lot15/avis/<id>.md`, un par fiche, et
la synthèse dans `docs/lot15/AVIS-SYNTHESE.md`.

La sévérité ne vient pas du style : dix-sept refus reposent sur un défaut
**exécuté et reproduit**, cinq sur un fait vérifié à la source. Chaque avis dit
précisément ce qu'il faut changer.

Ta mission est d'appliquer ces avis.

---

## Avant de commencer

Lis, dans cet ordre :

- `docs/lot15/AVIS-SYNTHESE.md` — le diagnostic d'ensemble, les motifs classés,
  et les vingt et une règles à verser dans les chartes. **Lis-le en entier avant
  de toucher à une fiche** : les défauts se répètent, et les règles R1 à R13 et
  T1 à T8 te diront quoi faire dans presque tous les cas.
- `docs/sprints/CHARTE-REDACTION.md` et `docs/sprints/CHARTE-TESTS.md`
- `docs/lot15/corrections/<id>.md` pour la fiche que tu traites
- `docs/lot15/avis/<id>.md` pour la fiche que tu traites

---

## Deux décisions déjà prises par le commanditaire

**L'outil standard entre dans l'échelle.** Le relecteur a raison sur le motif D :
le concurrent réel d'un appel de modèle est souvent une bibliothèque mûre, un
service public ou une donnée structurée, pas du code écrit à la main. Applique la
règle R3 partout où l'avis la soulève. Une fiche dont le niveau N0 dit « utilise
cet outil, voici comment et voici où il s'arrête » est meilleure qu'une fiche qui
réécrit à la main ce qui existe.

Quand tu remplaces du code maison par un outil existant, la fiche garde sa
valeur : elle explique **pourquoi cet outil**, ce qu'il fait vraiment, et où il
cède. C'est le jugement qui intéresse le lecteur, pas la démonstration qu'on
sait écrire un analyseur d'adresses.

**La fiche `extract-fields-from-invoice` est réécrite**, pas mise de côté. La
réforme de la facturation électronique change le besoin : en réception, une
facture arrive en XML structuré, et il n'y a plus rien à extraire. Réécris la
fiche autour de cette réalité — lire le format structuré d'abord, l'extraction
ne concernant plus que les documents hors périmètre. Vérifie l'état de la
réglementation à la source avant d'écrire, et cite-la.

---

## La méthode : une fiche à la fois, trois temps

**Séquentiel. Un seul agent. Aucun sous-agent.**

Pour chaque fiche, dans l'ordre de priorité ci-dessous :

### Temps 1 — Corriger

Applique l'avis, point par point. Un avis dit toujours « ce qu'il faut faire » :
suis-le. Si tu diverges, note pourquoi.

Corrige le code quand le défaut est dans le code. Corrige la fiche quand
l'affirmation est fausse. **Ne masque jamais un défaut par une reformulation.**

### Temps 2 — Retester

Reprends les tests de la fiche :

- Les marquages `INFIRMÉ` et `DÉFAUT` périmés sont réécrits sur la phrase
  actuelle, ou supprimés s'ils ne portent plus sur rien. **Aucun ne subsiste.**
- Les marquages vivants deviennent des tests qui passent, une fois le défaut
  corrigé.
- La fiche à niveau N3 gagne un test qui exécute l'adaptateur.
- Le cas « entrée ordinaire de la population visée » est ajouté (règle T5).
- Le test comparatif du verdict est écrit quand l'avis le demande (règle T4).
- Les bornes de temps ont une marge de dix (règle T7).

`node scripts/test-snippets.mjs <id>` doit passer avant de commiter.

### Temps 3 — Relire

Relis la fiche corrigée **avec l'exigence du relecteur**, en reprenant son avis
point par point : chaque motif de refus est-il levé ? Si un point reste ouvert,
retourne au temps 1.

Écris le résultat dans `docs/lot16/verifications/<id>.md` : les motifs du refus,
ce que tu as fait pour chacun, et la preuve — commande exécutée, sortie obtenue.

**Puis commit.** Un commit par fiche terminée : une coupure ne doit coûter
qu'une fiche.

---

## L'ordre de traitement

Le plus grave d'abord. Le motif B, une sortie fausse et silencieuse sur une
entrée ordinaire, est celui qui menace la crédibilité du site : c'est exactement
ce que le catalogue reproche aux modèles.

**Groupe 1 — sorties fausses et silencieuses (11 fiches)**
`convert-messy-csv-to-clean-data`, `find-duplicate-records`,
`generate-test-data`, `mask-personal-data-in-chat`, `extract-dates-from-text`,
`parse-address-into-fields`, `tag-articles-by-topic`,
`fuzzy-match-company-names`, `add-autocomplete-to-a-search-bar`,
`rank-products-by-relevance`, `detect-anomalies-in-metrics`

**Groupe 2 — verdict contredit, modèle inadapté, réforme (7 fiches)**
`forecast-weekly-sales`, `detect-language-of-text`, `summarise-a-long-document`,
`write-product-descriptions`, `moderate-user-comments`,
`extract-fields-from-invoice`, `read-text-from-a-scanned-page`

**Groupe 3 — défauts de production et de preuve (6 fiches)**
`search-in-your-own-documents`, `translate-interface-strings`,
`detect-spam-in-contact-form`, `validate-a-form-server-side`,
`route-support-tickets`, `show-similar-articles`

Termine un groupe avant d'entamer le suivant. À la fin de chaque groupe :
`npm run check:fast` au vert, et un point d'étape dans
`docs/lot16/ETAPES.md`.

---

## Les deux contrôles à ajouter

Le relecteur les propose, ils empêcheront le problème de revenir sur les
175 fiches suivantes. Écris-les **au début du groupe 3**, quand tu sauras ce
qu'ils doivent accepter :

**`check-marquages`** — échoue si un test d'une fiche `published` porte
`xfail`, `INFIRMÉ` ou `DÉFAUT`.

**`check-adaptateur`** — échoue si une fiche à niveau N3 n'a pas de test qui
exécute l'adaptateur : `ProviderClient(` dans `n3.test.py`, `providerClient(`
dans `n3.test.js`.

Branche-les dans `npm run check`.

---

## Les chartes

**À la fin du lot**, verse dans `docs/sprints/CHARTE-REDACTION.md` les règles R1
à R13 de la synthèse, et dans `docs/sprints/CHARTE-TESTS.md` les règles T1 à T8,
avec les exemples réels qui les ont fait naître.

Ces chartes guideront l'écriture des 175 fiches suivantes. Elles doivent
permettre d'écrire la fiche 26 sans avoir lu les avis.

---

## Interdits

1. **Aucun défaut masqué par une reformulation.** On corrige ou on dit.
2. **Aucun marquage `INFIRMÉ` ou `DÉFAUT` ne subsiste** sur une fiche publiée.
3. **Aucun chiffre inventé.** Pas de prix absolu, pas d'empreinte chiffrée sans
   méthodologie citée, pas de mesure non réalisée.
4. **Aucune fiche publiée dont le code n'a pas été exécuté.** En cas de doute,
   `status: draft` avec la raison.
5. **Ne touche pas au design ni aux gabarits.** Ce lot porte sur le contenu, le
   code et les tests.
6. **Un extrait reste lisible en trente secondes.** Si une correction le fait
   passer de quarante à cent cinquante lignes, tu as choisi la mauvaise
   correction : préfère l'outil existant, ou documente la limite.

---

## Règles Git

- **Branche dédiée**, créée depuis `main` à jour. Tu peux la pousser.
- **Un commit par fiche terminée.**
- Messages en français, format conventionnel. **Aucune mention de Claude, de
  Claude Code ou d'un modèle d'IA** nulle part.

---

## Si la session est coupée

Tu travailles fiche par fiche et tu commites à chaque fois : une reprise se fait
en lisant `docs/lot16/ETAPES.md` et l'historique. Tiens ce fichier à jour après
chaque fiche, en une ligne : fiche, motifs levés, ce qui reste.

---

## Rapport de fin

Produis `RAPPORT-LOT16.md` :

- **Le tableau des 24 fiches** : motifs du refus, ce qui a été corrigé, état
- **Ce que tu as changé dans le code** et pourquoi, fiche par fiche
- **Les outils standard entrés dans l'échelle**, et ce qu'ils remplacent
- **La fiche facture** : ce que la réforme change, ce que tu as écrit, tes
  sources
- **Les avis sur lesquels tu as divergé**, avec la raison
- **Ce qui reste ouvert** et pourquoi
- **Ce que les chartes ont gagné**

---

Commence par le groupe 1, fiche par fiche.
