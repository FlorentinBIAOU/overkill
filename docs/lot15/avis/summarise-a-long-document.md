# summarise-a-long-document — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs summarise-a-long-document` : vert, 4 py, 4 js.

### Raisons du refus

1. **[solidité du verdict]** `verdict_rationale` : N3 est « le seul niveau qui
   écrive une phrase que personne n'a écrite **sans vous coûter […] une découpe
   en plusieurs passes** ». Or `n3.py` / `n3.js` lèvent `ValueError` au-delà de
   `MAX_CHARACTERS = 40000`, soit une quinzaine de pages. Le `need` est
   justement « un document trop long pour être lu en entier » : un rapport de
   cinquante pages, un contrat avec annexes, un compte rendu d'assemblée
   dépassent ce plafond. Pour eux, N3 tel qu'écrit refuse, et le lecteur doit
   écrire la découpe en plusieurs passes que le verdict dit lui épargner — avec
   le défaut que le `breaking_point` de N2 reproche à juste titre aux passes
   successives (on résume des notes, plus le document).

   Ce qu'il faut faire : soit retirer du verdict l'argument de la découpe et
   écrire que N3 ne l'évite que sous le plafond, en disant ce qu'on fait
   au-dessus ; soit relever le plafond à ce que la fenêtre du modèle d'exemple
   accepte réellement (à vérifier sur la page du fournisseur et à citer en
   `sources`), en gardant un plafond de coût explicite et nommé comme tel. Un
   test, deux langages, doit affirmer le comportement annoncé sur un document
   au-dessus du plafond.

2. **[pertinence technique]** N2, `MODEL_NAME = "sshleifer/distilbart-cnn-12-6"`
   (et sa conversion `Xenova/…` en JavaScript). Ce modèle est distillé de BART
   affiné sur CNN/DailyMail : des dépêches de presse **en anglais**. Le site est
   d'abord francophone, les exemples de la fiche sont en français (Rouen, Lyon),
   et rien ne dit au lecteur que N2 ne résume pas un document français. Branché
   sur une note interne française, il rendra un texte sans valeur, sans erreur.
   Le `breaking_point` de N2 ne peut pas le montrer puisque les résumés y sont
   écrits par le double.

   Ce qu'il faut faire : écrire dans le `name` ou le `breaking_point` de N2 que
   le modèle nommé ne résume que l'anglais, en citant sa fiche ; ou nommer un
   modèle de résumé qui couvre le français, vérifié sur sa fiche (langues,
   licence), et ajuster `cost` et `latency` si la taille change. Le verdict
   doit en tenir compte : pour un lecteur français, N2 n'est pas une option
   tant que le modèle n'est pas changé.

3. **[preuves]** Marquages `INFIRMÉ` encore actifs, et adaptateur N3 non testé.
   - `n1.test.js`, `INFIRMÉ` : « la régression logistique is a dozen lines ».
     **Périmé** : la phrase a été retirée.
   - `n1` (py, js), `INFIRMÉ` : « the model will find that out and N0 never
     will ». **Périmé** : la phrase n'est plus dans `n1.py` ni `n1.js`.
   - `n3` : **aucun test ne fait tourner `ProviderClient` / `providerClient`**
     sur `_harness/fake_sdk.py` / `fake-sdk.mjs`.

   Ce qu'il faut faire : réécrire ou supprimer les tests périmés, sans
   marquage ; ajouter le test de l'adaptateur. C'est fait quand le dossier ne
   contient plus aucun marquage.

### Remarques non bloquantes

- Le `breaking_point` de N0 et celui de N1 font chacun plus de cinq phrases.
  Les exemples sont excellents (Rouen fournit Lyon, Rouen ferme ; le rayon mal
  compté contre la commande de porte-blocs) ; ils se liraient mieux en deux
  phrases chacun.
- Le `scenario` est le seul du catalogue qui assume d'entrée un verdict N3 :
  c'est un bon contrepoids au reste du site, et la charte le demande (« assumez-
  le sans vous excuser »).
- N2 `cost: modéré` et `latency: ">1 s"` : cohérents avec un modèle de
  plusieurs centaines de millions de paramètres sur processeur, mais non
  sourcés dans la fiche.

### Ce qui est solide

- Le verdict N3 est juste sur le fond : résumer, c'est reformuler, et la fiche
  dit le prix à voix haute — sortie de données, non-déterminisme, et surtout
  des tests qui ne vérifient que la forme.
- Le `breaking_point` de N0 est le meilleur exemple du catalogue d'un échec
  extractif : deux prémisses éloignées dont aucune phrase n'énonce la
  conclusion. Il est démontré et il est vrai.
- Les points de rupture de N2 et N3 disent précisément ce que le double
  simule et ce que le test établit — ce que la plomberie laisse passer, pas ce
  qu'un modèle écrirait. C'est la discipline que la charte demande.
- La conclusion du verdict (« la réponse n'est pas un meilleur prompt : c'est
  quelqu'un qui relit la source ») est celle d'un praticien.
