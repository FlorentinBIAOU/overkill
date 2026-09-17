# detect-anomalies-in-metrics — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs detect-anomalies-in-metrics` : vert, 2 py, 2 js.

### Raisons du refus

1. **[solidité du verdict, réalité du cas]** `need` : « Être réveillé quand une
   métrique de production sort de son comportement habituel, **et pas le reste
   du temps** ». Avec les réglages par défaut de N0 (`window=24`,
   `threshold=3.5`), une métrique **saine** échantillonnée à la minute sonne
   environ **dix à quinze fois par jour**. Le test
   `test_constat_taux_de_fausses_alertes_sur_bruit_gaussien` le mesure (entre
   0,5 % et 1 % des points) ; je l'ai reproduit sur sept jours de bruit gaussien
   (95 points signalés, 14 par jour) et sur un cycle journalier bruité (15 par
   jour). Sur une métrique de comptage autour de dix par minute : 20 par jour.
   Multipliez par le nombre de métriques d'un service. Aucune astreinte ne
   garde un tel détecteur branché sur un pager plus d'une semaine.

   Et `anomalies` est présentée comme « the subset a pager should see » : une
   marche franche est signalée pendant « une douzaine de minutes » (le
   `breaking_point` le dit), soit douze pages pour un seul incident, faute de
   règle de persistance ou de regroupement.

   La fiche mesure le chiffre dans un test et ne le dit nulle part au lecteur.
   Le verdict (« la moitié du diagnostic livrée avec l'alerte ») est vrai pour
   une alerte réelle, et silencieux sur les dix fausses de la journée.

   Ce qu'il faut faire :
   - dans l'extrait, ajouter la règle que tout le monde ajoute : n'alerter
     qu'après `k` points consécutifs hors limite (ou `k` sur `n`), et ne pas
     re-signaler un épisode déjà ouvert ; ou, a minima, une fenêtre par défaut
     plus longue et un seuil plus haut, choisis **par la mesure** du test de
     bruit ;
   - dans la fiche, dire le taux de fausses alertes mesuré aux réglages par
     défaut (c'est un chiffre mesuré sur la machine de test, la charte des
     extraits l'autorise dans un test ; dans la fiche, le dire en ordre de
     grandeur : « plusieurs par jour par métrique »), et comment le faire
     baisser ;
   - un test, deux langages, qui borne le nombre d'**épisodes** signalés sur
     une journée de bruit avec les réglages recommandés, et qui vérifie qu'une
     marche franche produit **un** épisode.

   C'est fait quand un lecteur qui branche l'extrait avec ses défauts sur un
   pager sait, en lisant la fiche, combien de fois il sera réveillé pour rien.

2. **[preuves, solidité du verdict]** L'argument pour N1 n'est pas démontré par
   un exemple où N0 échoue. Le verdict et la docstring de N1 donnent le cas du
   trafic de nuit avec un nombre d'erreurs de jour, « la minute dont chaque
   valeur est connue et dont seule la combinaison ne l'est pas ». Le test
   marqué `INFIRMÉ` dans `n0.test.py` / `n0.test.js` montre que, dans la série
   même des tests N1, **N0 sonne aussi** pour ces minutes (erreurs aux minutes
   90 et 91, trafic à la 91) : la fenêtre glissante juge contre la nuit qui
   précède, et les erreurs de jour en sortent. La docstring a été adoucie (« only
   if one of its values leaves that series' own window »), mais aucun test ne
   montre la minute où c'est **faux** pour N0 et vrai pour N1.

   Ce qu'il faut faire : construire, dans les tests N1, une série où chaque
   métrique reste dans sa propre fenêtre glissante et où seule la combinaison
   est inhabituelle — par exemple une montée lente et simultanée du trafic
   de nuit, sans montée des erreurs quand elles auraient dû suivre — et
   affirmer : N0 ne signale rien, N1 signale la minute. Sans cet exemple,
   l'`escalate_when` de N0 promet un gain que la fiche ne prouve pas.

3. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs, que la charte
   interdit à la fin du lot :
   - `n0` (py, js), `INFIRMÉ` : « le seuil de 3,5 garde son sens sur une fenêtre de 24 ». La phrase a été retirée de la docstring : **périmé**, et c'est le constat du point 1 qui doit le remplacer.
   - `n0` (py, js), `INFIRMÉ` : « N0 ne sonne pas pour les minutes que N1 signale ». **Périmé** comme marquage, **vivant** comme problème : voir point 2.
   - `n0` (py, js), `DÉFAUT` : une métrique de comptage presque toujours nulle sonne à chaque unité. La décision 11 du lot a ajouté `min_spread` ; le test doit devenir la démonstration de la limite au défaut et de sa levée avec le paramètre, comme la décision le prévoit, sans marquage.
   - `n0.test.js`, `INFIRMÉ` : l'essai dit « la même hausse » (1 440 contre 1 400) ; et `INFIRMÉ` : « aucun écart d'une minute à la suivante n'approche l'écart toléré ». Les libellés de l'essai ont été corrigés : **périmés**.
   - `n1` (py, js), `INFIRMÉ` : « la taille de la forêt est la seule vraie molette ». La docstring dit désormais que c'est le seuil : **périmé**.

   Ce qu'il faut faire : réécrire chaque test sur la phrase actuelle, sans
   marquage. C'est fait quand `grep -rn "xfail\|INFIRMÉ\|DÉFAUT"` ne rend plus
   rien dans le dossier.

### Remarques non bloquantes

- La page du livre SRE de Google que la fiche cite recommande d'alerter sur
  les symptômes vus par l'utilisateur plutôt que sur l'inhabituel. La fiche
  gagnerait une phrase : ce détecteur sert mieux un tableau de bord ou un
  signal non urgent qu'un pager, sauf réglage mesuré. Le citer pour ce qu'il
  dit renforcerait le verdict au lieu de le contredire.
- Aucune saisonnalité : un lundi matin sonne contre la nuit du dimanche si la
  montée est rapide. Le `breaking_point` porte sur la dérive lente, qui est
  bien le cas le plus traître ; la montée quotidienne rapide mérite une demi-
  phrase.
- Les raisons d'indisponibilité de N2 (« à trois heures du matin, la question
  est de savoir pourquoi le téléphone a sonné ») et de N3 (une alerte qu'on ne
  peut pas rejouer) sont les meilleurs arguments d'exploitation du catalogue.

### Ce qui est solide

- Le constat du `scenario` sur la moyenne et l'écart type (le pic élargit la
  bande qui devait l'attraper) est exact et c'est le piège que tout le monde
  rencontre.
- Un verdict qui porte ses nombres (mesuré, habituel, écart, écart toléré) est
  exactement ce qu'on veut lire à trois heures du matin.
- Le point de rupture de N0 (dérive lente, jamais signalée, série qui finit au
  triple) est démontré, avec le témoin de la marche franche : c'est le modèle
  d'un point de rupture « là, et seulement là ».
- La graine fixée de la forêt d'isolement, justifiée par la rejouabilité d'une
  alerte, est le bon réflexe.
