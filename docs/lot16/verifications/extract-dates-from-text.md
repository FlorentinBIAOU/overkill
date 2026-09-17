# extract-dates-from-text — vérification du lot 16

Avis d'origine : `docs/lot15/avis/extract-dates-from-text.md` (REFUSÉE).

## Motif 1 — les mois abrégés jamais trouvés

**Le refus.** Le `breaking_point` de N0 annonçait les dates relatives, laissant
croire que les dates écrites en lettres étaient trouvées. Cinq entrées
ordinaires d'une facture rendaient `[]`.

**Ce qui a été fait.** L'option que l'avis désigne comme la bonne : les
abréviations entrent dans `MONTHS`, le point final de l'abréviation et la
virgule qui suit souvent le mois deviennent facultatifs dans `TEXTUAL` et
`MONTH_FIRST`. La date sans année reste hors de portée, et le `breaking_point`
le dit désormais en toutes lettres.

**La preuve.** Test `les mois abrégés d'une facture sont lus`, en Python et en
JavaScript, une assertion par ligne du tableau de l'avis :

| Entrée | Avant | Après |
|---|---|---|
| `Échéance le 3 janv. 2024` | `[]` | 3 janvier 2024 |
| `le 03 sept. 2024` | `[]` | 3 septembre 2024 |
| `Due Mar 3, 2024` | `[]` | 3 mars 2024 |
| `3 April, 2024` | `[]` | 3 avril 2024 |
| `le 5 mars` (sans année) | `[]` | `[]`, et le `breaking_point` le dit |

Avec témoin : `le 3 truc 2024` reste un mot, et `rendez-vous le 5 mars 2024` est
lu.

## Motif 2 — N1 lisait le même document selon deux conventions

**Le refus.** Le classifieur tranchait date par date, sur quarante caractères de
contexte, en ignorant la preuve interne du document : `Order 25/03/2024 shipped.
Delivery 03/04/2024.` sortait en 25 mars puis 4 mars. Et ce classifieur était
une détection de langue déguisée.

**Ce qui a été fait.** Les deux moitiés de ce que l'avis demande, remises
chacune à sa place.

1. **La résolution au niveau du document entre dans N0**, bâtie sur ses propres
   motifs, dans l'ordre que l'avis prescrit : preuve interne
   (`document_convention` / `documentConvention` — une date dont un champ dépasse
   douze fixe la convention du document, un document qui se contredit ne fixe
   rien), puis l'indice de l'appelant (`day_first`), puis **abstention** — la
   date revient avec `None` au lieu d'un jour.
2. **Le classifieur disparaît.** N1 devient l'outil standard : `dateparser` en
   Python, `chrono-node` en JavaScript (règle R3, et la décision du
   commanditaire sur l'outil standard).

**La preuve.** Le document de l'avis est lu selon une seule convention :

```
extract_dates("Order 25/03/2024 shipped. Delivery 03/04/2024.")
→ [('25/03/2024', 2024-03-25), ('03/04/2024', 2024-04-03)]
```

Tests, deux langages : `le document tranche d'abord, puis l'appelant, puis
l'abstention` (les trois étages, plus le document contradictoire), et côté N1
`point de rupture : la preuve interne du document est ignorée` — qui montre que
la bibliothèque, elle, lit encore les deux dates de deux façons, avec N0 en
témoin.

## Motif 3 — les dates relatives n'exigent pas un modèle, et « aujourd'hui » est faux

**Le refus.** Deux erreurs : le verdict envoyait à N3 pour les dates relatives,
que des analyseurs déterministes lisent ; et `today or date.today()` résolvait
les dates relatives contre le jour du traitement.

**Ce qui a été fait.**

- **Un niveau d'analyse déterministe est ajouté** : N1 est `dateparser` 1.2.2 /
  `chrono-node` 2.9.0, déclarés dans `requirements-snippets.txt` et dans
  `package.json`. `cost: nul`, `data_egress: none`, `deterministic: true`,
  `vendor_lock: library`. Le verdict dit maintenant d'ajouter N1 avant de penser
  à N3.
- **La référence perd sa valeur par défaut**, en N1 et en N3. Le paramètre
  s'appelle `reference`, il est obligatoire (argument nommé sans valeur par
  défaut en Python, contrôlé à l'entrée en JavaScript), et l'invite de N3 dit
  « against the date of the document » et non plus « against today ». Les
  docstrings et le verdict disent que la référence est la date du document.

**La preuve.** Mesures exécutées ici, reprises en `sources` de la fiche :

| Entrée (référence : 12 mars 2024) | dateparser 1.2.2 | chrono-node 2.9.0 |
|---|---|---|
| `dans 15 jours` | 27 mars | 27 mars |
| `à partir de demain` | 13 mars | 13 mars |
| `jeudi prochain` | 14 mars (« jeudi ») | 21 mars |
| `dans quinze jours` | rien | rien |
| `le 03/04/2024` | 4 mars | 3 avril |
| `3 janv. 2024` | 3 janvier 2025 | rien |

Ces divergences ne sont pas cachées : elles sont l'objet de la docstring de N1
(« un extrait qui confie le travail à une bibliothèque hérite de la
bibliothèque, pas d'une spécification »), du `breaking_point` de N1, et de
quatre tests. Le `breaking_point` ne retient que ce qui est vrai des deux
bibliothèques.

Tests de la référence : `la référence est obligatoire, et c'est la date du
document`, en N1 et en N3, dans les deux langages — l'appel sans référence lève,
aucun appel n'est payé, et la référence passée est celle qui part dans l'invite.

## Motif 4 — deux marquages vivants

| Marquage | Défaut | Correction |
|---|---|---|
| `n0` py/js `DÉFAUT` | une longue suite de marques combinantes relue une fois par marque (20 000 marques : 9 s) | Le regard arrière de `MONTH_FIRST` exclut aussi les marques combinantes |
| `n3` py/js `DÉFAUT` | une réponse tout entière dans une seule clôture ```` ```json ```` non décodée, trois appels payés puis une erreur | `_unfenced` / `unfenced`, comme les extraits déjà corrigés |

Les deux tests sont réécrits en démonstration, avec témoin (une date derrière la
suite de marques est toujours lue ; toute autre clôture lève).

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/extract-dates-from-text/
(aucune sortie)
$ node scripts/test-snippets.mjs extract-dates-from-text
  ok        extract-dates-from-text            3 py, 3 js
```

## Remarques non bloquantes de l'avis

- **Le plafond de N3.** Dit dans la docstring et sa traduction : il lève au lieu
  de tronquer, parce qu'un contrat coupé en deux reviendrait avec une liste
  d'échéances qui a l'air complète ; ce qu'un appelant fait au-dessus, c'est
  découper avec recouvrement, et l'extrait ne le fait pas, à dessein. Test
  `le plafond lève au lieu de tronquer` : aucun appel n'est payé.
- **Le pivot des années courtes.** Dit dans `_full_year` : juste pour une
  échéance, faux pour une date de naissance, `12/03/65` sort en 2065. Testé.

## Divergence assumée

La page méthodologie décrit N1 comme « un modèle entraîné sur vos exemples ».
Ici, N1 est une bibliothèque installée. La décision du commanditaire — « l'outil
standard entre dans l'échelle » — l'emporte : la bibliothèque est bien le
niveau au-dessus de la bibliothèque standard en poids (une dépendance à
installer, des données de locale à tenir) et en dessous d'un modèle
auto-hébergé. Le `vendor_lock: library` est le même que celui de N1 sur
`find-duplicate-records`, qui est déjà une bibliothèque.

## Dépendances ajoutées

- `dateparser==1.2.2` dans `content/snippets/requirements-snippets.txt` ;
- `chrono-node` 2.9.0 en `devDependencies` de `package.json` (2.9.0 et non
  2.10.1, dont le champ `engines` réclame Node 22.19 quand le dépôt en déclare
  22.12).

Ni l'une ni l'autre ne télécharge de modèle, ce que la tête de
`requirements-snippets.txt` exige.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts (`dateparser` ajouté au lexique du projet), aucun marquage.
