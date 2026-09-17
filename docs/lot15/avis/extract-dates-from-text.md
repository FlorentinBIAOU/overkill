# extract-dates-from-text — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs extract-dates-from-text` : vert, 3 py, 3 js.

### Raisons du refus

1. **[vérité du point de rupture]** `breaking_point` de N0. Il annonce les
   dates relatives et l'année sur deux chiffres non paddée ; le lecteur en
   déduit que les dates absolues écrites en lettres sont trouvées. Elles ne le
   sont pas dès que le mois est **abrégé**, ce qui est la forme courante sur
   une facture, un bon de livraison ou un courriel. Exécuté sur `n0.py` :

   | Entrée | Sortie |
   |---|---|
   | `Échéance le 3 janv. 2024` | `[]` |
   | `le 03 sept. 2024` | `[]` |
   | `Due Mar 3, 2024` | `[]` |
   | `3 April, 2024` | `[]` |
   | `le 5 mars` (sans année) | `[]` |

   L'échec est aussi silencieux que sur les dates relatives, et bien plus
   fréquent. Le `scenario` dit que ces motifs « se peuvent énumérer » : c'est
   vrai, mais l'extrait ne les énumère pas.

   Ce qu'il faut faire : soit ajouter à `MONTHS` les abréviations usuelles
   (`janv`, `févr`, `avr`, `juil`, `sept`, `déc`, `jan`, `feb`, `mar`, `apr`,
   `jun`, `jul`, `aug`, `sep`, `oct`, `nov`, `dec`…) avec point final
   facultatif, et la virgule facultative après le mois dans `TEXTUAL` ; soit
   écrire dans le `breaking_point` que les mois abrégés et les dates sans année
   ne sont pas trouvés. Dans les deux cas, un test par ligne du tableau
   ci-dessus, en Python et en JavaScript, qui affirme le comportement annoncé.
   La première option est la bonne : elle coûte une ligne de dictionnaire.

2. **[pertinence technique]** N1 entier. Le niveau tranche l'ambiguïté jour-mois
   **date par date**, sur quarante caractères de contexte, et ignore la preuve
   que le document donne lui-même. Exécuté avec le modèle du test :

   ```
   extract_dates(MODEL, "Order 25/03/2024 shipped. Delivery 03/04/2024.")
   → [('25/03/2024', 2024-03-25), ('03/04/2024', 2024-03-04)]
   ```

   Le même document est lu jour-mois pour la première date (25 > 12) et
   mois-jour pour la seconde. Aucun praticien ne livre ça : la première chose
   qu'on écrit, c'est « si une date du document a un premier champ supérieur à
   12, la convention du document est jour-mois », puis la locale de
   l'expéditeur ou la langue du document. C'est déterministe, testable
   unitairement, et ça résout la grande majorité des documents. Le classifieur
   entraîné ici apprend essentiellement « prose française / prose anglaise »
   (voir les seize phrases de `n1.test.py`) : c'est une détection de langue
   déguisée, avec les défauts de la fiche `detect-language-of-text` en prime.
   Et la fiche reconnaît elle-même que N1 perd l'ISO, les mois en lettres et
   l'année courte que N0 trouvait : c'est une régression présentée comme une
   montée.

   Ce qu'il faut faire : remplacer N1 par une résolution **au niveau du
   document** — preuve interne (un champ > 12 fixe la convention pour tout le
   document), puis indice externe fourni par l'appelant (locale, pays de
   l'expéditeur), puis abstention explicite (rendre l'ambiguïté, pas une date)
   — bâtie sur les motifs de N0 au lieu d'une règle plus étroite. Le
   `breaking_point` devient alors le document sans aucune preuve interne ni
   indice. Si le rédacteur tient au classifieur, il doit au minimum : (a) le
   faire tourner sur les candidats de N0, pas sur une règle plus étroite ;
   (b) appliquer la preuve interne du document avant le modèle ; (c) ajouter le
   test ci-dessus, qui doit rendre le 3 avril. C'est fait quand ce document
   produit deux dates lues selon la même convention.

3. **[solidité du verdict]** `verdict_rationale` (« à N3 seulement si les
   échéances de vos textes s'écrivent en relation avec aujourd'hui ») et
   `escalate_when` de N1. Deux erreurs.

   - Les dates relatives ne demandent pas un modèle généraliste. Des
     analyseurs déterministes existent pour ça. Vérifié avec `dateparser`
     (Python), `search_dates(texte, languages=['fr','en'],
     settings={'RELATIVE_BASE': datetime(2024,3,12)})` : « dans 15 jours » →
     27 mars 2024, « à partir de demain » → 13 mars 2024. Il n'est pas parfait
     (« jeudi prochain » est réduit à « jeudi », et « 3 janv. 2024 » est mal lu),
     mais c'est une étape locale, gratuite et testable avant l'appel facturé.
     `chrono-node` joue le même rôle en JavaScript (à vérifier par le rédacteur
     sur sa documentation, locale française comprise).
   - « En relation avec aujourd'hui » est faux dans l'usage : « jeudi
     prochain » dans un courriel reçu il y a trois semaines se résout par
     rapport à **la date du courriel**, pas à la date du traitement. N3 prend
     `today or date.today()` et le prompt dit « against today » : sur un
     arriéré ou un retraitement, toutes les dates relatives sortent décalées,
     sans erreur.

   Ce qu'il faut faire : ajouter un niveau (N1 ou N2) d'analyse déterministe des
   dates relatives, ou au minimum écrire dans `N2.unavailable_reason` ou dans
   le verdict pourquoi ces analyseurs ne conviennent pas — avec une mesure, pas
   une opinion. Renommer le paramètre `today` de N3 en `reference` (ou
   `document_date`), sans valeur par défaut silencieuse, et dire dans le
   verdict que la référence est la date du document. Test : un appel sans
   référence lève, ou la docstring dit explicitement le risque, et un test
   vérifie que la référence passée est celle envoyée dans le prompt.

### Remarques non bloquantes

- N3, `MAX_CHARACTERS = 8000` : trois pages. Un contrat, qui est exactement le
  document où l'on cherche des échéances, lève `ValueError`. Découper en
  morceaux avec recouvrement serait la réponse de production ; au moins le dire.
- N0, `_full_year` : la règle de pivot de MySQL est sourcée, mais une date de
  naissance « 12/03/65 » devient 2065. Pour des échéances c'est juste ; une
  phrase suffit.
- `unavailable_reason` N2 : l'argument sur la reconnaissance d'entités
  (étiquette le passage, ne rend pas le jour) est exact et bien dit.

### Ce qui est solide

- Le constat du `scenario` est le bon : la difficulté n'est pas de trouver les
  chiffres, c'est 31/02 et 03/04. La validation calendaire par la bibliothèque
  standard est exactement ce qu'on fait.
- Le garde-fou contre « version 2.1.24 » et « 10.1.1.24 » est une vraie leçon
  d'exploitation, démontrée.
- Le `breaking_point` de N3 ne prête rien au modèle : il dit ce que l'extrait
  vérifie (le calendrier) et ce qu'il ne peut pas vérifier (une date absente du
  document), et il refuse de rendre une liste vide sur une réponse illisible.
