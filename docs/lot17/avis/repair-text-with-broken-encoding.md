# repair-text-with-broken-encoding — avis du relecteur

# Tour 1 — REFUSÉE

L'idée est juste, et le point de rupture est l'un des meilleurs du lot : le
ticket de bogue qui *cite* le texte cassé et que la réparation abîme. Le refus
porte sur l'affirmation de parité, qui est fausse dès qu'on sort de la liste de
quarante et une chaînes choisie par le test — et fausse sur des mots français
parmi les plus ordinaires qui soient.

## Raisons du refus

1. **« The two agree on thirty-nine of this entry's forty-one strings; the two
   they part on are the same rule » est faux.** Il existe une seconde classe de
   divergence, de sens inverse, que la fiche ne nomme nulle part : `ftfy`
   **refuse de réparer** plusieurs mojibakes que l'extrait JavaScript répare
   correctement. J'ai fabriqué le mojibake de quarante-quatre mots français
   courants (encoder en UTF-8, relire en Windows-1252) et passé les deux
   extraits dessus :

   | Attendu | Mojibake | Python (`ftfy`) | JavaScript |
   |---|---|---|---|
   | `Île-de-France` | `ÃŽle-de-France` | **inchangé** | `Île-de-France` |
   | `Îles Canaries` | `ÃŽles Canaries` | **inchangé** | `Îles Canaries` |
   | `Île Maurice` | `ÃŽle Maurice` | **inchangé** | `Île Maurice` |
   | `Îlot` | `ÃŽlot` | **inchangé** | `Îlot` |
   | `Œuvre` | `Å'uvre` | **inchangé** | `Œuvre` |

   Cinq mots sur quarante-quatre, tous de la même famille : une majuscule
   accentuée (`Î`, `Œ`) en tête d'une chaîne courte. C'est exactement la forme
   d'une cellule de tableur ou d'une colonne `region` d'un import — le cas que
   le scénario de la fiche décrit. `ftfy.fix_encoding("ÃŽle-de-France")` rend
   la chaîne telle quelle ; `ftfy.fix_encoding("RÃ©gion ÃŽle-de-France")`, avec
   du contexte autour, la répare. L'heuristique dépend du reste de la chaîne,
   et la fiche ne le dit pas.

   Conséquence directe sur la fiche : la phrase « It repairs one more real case
   and rewrites one more correct sentence, and the JavaScript side does
   neither » donne à croire que l'extrait Python domine l'extrait JavaScript.
   Sur cette classe-là, c'est l'inverse, et c'est le langage sans bibliothèque
   qui a raison. Il faut soit publier le décompte réel des deux sens de
   divergence, soit documenter l'heuristique de `ftfy` et ce qu'elle décline.

2. **Le jeu de quarante et une chaînes est construit pour que le décompte
   tombe juste.** `n0.test.py:15-38` : `CASSES` porte treize mojibakes, aucun
   ne commence par `ÃŽ`, `ÃŒ` ni `Å'` ; `CORRECTES` porte vingt chaînes déjà
   correctes, parmi lesquelles **« Île-de-France » sous sa forme saine** — la
   forme cassée du même mot, celle qui fait diverger les deux extraits, est
   absente. Le test asserte ensuite
   `ecarts == [A_TILDE_ESPACE, "Ã tout de suite"]`, à l'égalité stricte, sur
   ce jeu-là. L'assertion est rigoureuse ; l'échantillon est complaisant.
   Ajouter aux `CASSES` le mojibake de `Île-de-France`, `Œuvre` et
   `Îles Canaries`, et republier le décompte qui en sortira.

3. **Un cas où `ftfy` détruit la donnée, non signalé.** Le mojibake de
   `Ïambe` est `Ã\x8fambe` ; `repair_encoding` rend `�ambe` — le caractère
   de remplacement, c'est-à-dire une perte irréversible produite **par la
   réparation elle-même**, et non par un décodeur en amont. Le rapport le
   marque bien `lossy: True`, ce qui sauve l'appelant attentif, mais la
   docstring dit exactement le contraire de ce qui se passe : « `lossy` says
   the text **already** carries replacement characters. Those are bytes a
   decoder threw away **before this function ever saw the string** ». Ici
   l'octet est jeté par la fonction. Soit la docstring distingue les deux
   origines, soit le code refuse d'écrire un `U+FFFD` que l'entrée ne portait
   pas. L'extrait JavaScript, lui, laisse la chaîne intacte.

## Remarques non bloquantes

1. **`ROUNDS = 4` côté JavaScript n'a pas d'équivalent déclaré côté Python.**
   Le commentaire dit « Two is common — a file repaired once and re-imported —
   and four is already generous ». `ftfy` a sa propre limite interne, non
   nommée dans la fiche. Le double mojibake `ÃƒÂ©tÃƒÂ©` est dans le jeu de
   test et passe des deux côtés ; un triple ne l'est pas. Un mot dans la
   docstring Python sur ce que `ftfy` fait de plusieurs tours fermerait la
   question.

2. **R11 — `breaking_point` de 76 mots, deux phrases.** Voir la synthèse.

## Ce qui est solide

- Le point de rupture est excellent et parfaitement choisi : le ticket de
  bogue qui cite `« Ã© »` pour signaler le problème, et que la réparation
  transforme en `« é »`, effaçant l'exemple. C'est un cas réel, il est
  démontré, et il justifie à lui seul le drapeau `changed`.
- Rendre `changed` plutôt que réécrire en place, avec la raison écrite — « une
  réparation que personne n'a notée ne se distingue pas d'une donnée qui a
  toujours été ainsi » — est le bon réflexe d'exploitation, et c'est
  directement la règle R2.
- Appeler `fix_encoding` et non `fix_text`, avec la démonstration de ce que la
  fonction large casse (`L'été à Nice` et son apostrophe typographique) : c'est
  R3 bien appliquée, choisir l'outil standard *et* la bonne porte d'entrée.
- La liste des vingt chaînes déjà correctes est bien construite — tildes
  portugais, lettres nordiques, cyrillique, `Ãs vezes` qui ressemble à du
  mojibake et n'en est pas. C'est le témoin qu'il fallait.
- L'`escalate_when` est juste et honnête : le caractère de remplacement veut
  dire que l'octet est parti, et la seule réponse est de réimporter la source.
  Aucune fiche ne gagne à promettre mieux.
- L'extrait JavaScript de trente lignes est lisible, travaille par segments —
  ce qui laisse intact ce qui n'est pas cassé — et se révèle, sur la classe
  ci-dessus, plus complet que la bibliothèque de référence. C'est un résultat
  qui mérite d'être publié plutôt que corrigé.
