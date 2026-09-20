# extract-amounts-and-currencies-from-text — avis du relecteur

## Tour 1 — ACCEPTÉE

C'est la meilleure fiche du lot à ce stade, et la seule que j'ai essayé de
mettre en défaut sans y arriver.

J'ai passé quinze lignes de documents français ordinaires aux deux extraits —
ligne de facture avec numéro de pièce et date, prix du gazole à 1,859 €, loyer
en EUR, montants collés au symbole, espace fine insécable, mélange de
conventions dans la même phrase, IBAN, pourcentages, chiffres arabo-indiens,
un million avec ses trois groupes. **Les deux langages rendent exactement le
même rapport sur les quinze**, et chaque lecture est juste : `1,859` marqué
`ambiguous` et rendu `1.859` en convention française, `1 859,00` non marqué
parce que l'espace tranche le groupement, `$1,000.00` rendu `1000.00` avec ses
six devises candidates et sans drapeau, `١٢٣ €` refusé.

J'ai aussi rejoué les trois mesures qui portent le verdict, contre
`price-parser` installé :

| Entrée | `price-parser` | l'extrait |
|---|---|---|
| `Facture n° 2026-118 du 10 octobre 2026 — total 1 250,00 €` | `2026` | `1250.00 EUR` |
| `Montants en euros. Total : $1,250.00` | devise `euro` | candidats `USD…`, devise nulle |
| `1,859 € le litre` | `1859` (défaut) / `1.859` (paramètre) | `1.859`, marqué `ambiguous` |

Les trois sont exactes. C'est R3 et R4 appliquées ensemble comme elles
devraient l'être partout : l'outil de référence est nommé, appelé pour de bon
dans le test, et écarté sur ce qu'il fait réellement.

### Remarques non bloquantes

1. **« il rend le numéro de pièce » est un raccourci.** Sur la ligne du test,
   `price-parser` rend `2026`, qui est à la fois le début du numéro de pièce
   (`2026-118`) et l'année de la date. Le test asserte `== 2026`, ce qui est
   juste ; la phrase de la fiche choisit l'une des deux lectures sans le dire.
   Écrire « il rend 2026 — l'année, ou le début du numéro de pièce, mais pas le
   total » serait exact et plus frappant.

2. **`kr` est le seul marqueur sans garde de frontière.** Dans `MARK`, les
   codes ISO et les mots sont encadrés par `(?<![^\W_])…(?![^\W_])`, les
   symboles ne le sont pas — ce qui est juste pour `€` ou `$`, mais `kr` est
   une suite de lettres. « 50 kr » est bien lu ; « 50 krach » le serait aussi.
   Le cas est improbable en français, et l'asymétrie mérite une ligne de
   commentaire plutôt qu'un correctif.

3. **R11 — `breaking_point` de 103 mots et trois phrases** pour N0. C'est le
   plus long du lot avec la fiche 24, et la règle en demande deux. Le contenu
   est bon ; c'est la longueur qui ne l'est pas. Voir la synthèse.

### Ce qui est solide

- **La convention sans défaut.** C'est la décision la plus importante du lot et
  elle est tenue jusqu'au bout : pas de repli sur la locale, pas de détection,
  un refus nommé si l'appelant ne déclare rien. La justification est la bonne —
  « un défaut est exactement la supposition silencieuse que ce site existe pour
  refuser » — et elle est démontrée sur l'outil de référence, dont le défaut
  décide à mille près.
- **Le drapeau `ambiguous` dit ce qu'il dit, et pas plus** : « la lecture
  dépend de la déclaration, il ne dit pas laquelle est juste ». Cette phrase
  vaut mieux que la plupart des points de rupture du lot.
- **La valeur est une chaîne de chiffres, jamais un flottant**, et `read_number`
  rend les décimales telles qu'elles ont été écrites. La fiche 11 fait
  l'inverse sur le même sujet ; c'est celle-ci qui a raison.
- **`unmarked` est un compte, pas un silence.** Les nombres sans marque sont
  comptés et rendus à l'appelant, et c'est ce compte qui déclenche
  l'`escalate_when`. La chaîne N0 → constat → N3 est la mieux articulée du
  catalogue.
- **`NUMBER` écrit les chiffres en toutes lettres plutôt que `\d`,** avec la
  raison : `\d` reconnaît tous les chiffres Unicode en Python et seulement les
  dix en JavaScript. Le commentaire termine par « et « ١٢٣ » n'est pas une
  valeur qu'on tend à un comptable », ce qui est à la fois juste et testé.
- **La garde de N3 est vérifiable et son point de rupture est honnête** : elle
  contrôle que les chiffres sont dans le document, pas que le nombre était un
  montant, donc le numéro de pièce passe. Peu de fiches disent ce que leur
  propre garde laisse passer.
