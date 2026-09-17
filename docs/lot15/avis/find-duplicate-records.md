# find-duplicate-records — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs find-duplicate-records` : vert, 3 py, 3 js.

### Raisons du refus

1. **[pertinence technique]** `n0.py` / `n0.js`, `record_text` et
   `similarity`. La fiche compare **l'enregistrement entier concaténé**, dans
   l'ordre des clés du dictionnaire, par distance d'édition. Deux défauts de
   production, sur le cas même que vise la fiche — rapprocher deux sources :

   ```python
   a = {"name": "Jean Dupont", "postcode": "75011", "email": "jean.dupont@example.fr", "phone": "0612345678"}
   b = {"name": "Jean Dupont", "postcode": "75011", "email": None, "phone": None}
   c = {"postcode": "75011", "name": "Jean Dupont", "phone": "0612345678", "email": "jean.dupont@example.fr"}
   find_duplicates([a, b])                 # []  (score 0.333)
   find_duplicates([a, c])                 # []  mêmes données, colonnes dans un autre ordre
   ```

   Une source sans courriel ni téléphone, ou un export dont les colonnes ne
   sont pas dans le même ordre, et **aucun doublon n'est trouvé**, sans
   erreur. C'est le cas normal d'un rapprochement entre un CRM et un fichier
   d'inscriptions. Le rapprochement de fiches se fait champ par champ, et un
   champ vide d'un côté n'est pas une différence (c'est tout le modèle
   Fellegi-Sunter, que Splink, cité par la fiche, implémente).

   Ce qu'il faut faire : comparer par champ nommé — similarité du nom, égalité
   du code postal, égalité du courriel normalisé quand les deux en ont un —
   ignorer un champ absent d'un côté, et combiner (moyenne des champs présents
   suffit pour un extrait). Ajouter les deux tests ci-dessus, qui doivent
   rendre la paire, en Python et en JavaScript, avec un témoin : deux
   personnes différentes au même code postal ne sortent pas. Même défaut dans
   `record_text` de N1 et N2 : l'ordre des colonnes y change les n-grammes aux
   frontières, à vérifier et corriger de la même façon.

2. **[pertinence technique, preuves]** `n2.py` / `n2.js`, docstring d'en-tête :
   « What this rung really costs is not the comparison, it is the deployment ».
   La comparaison est une double boucle Python sur toutes les paires, produit
   scalaire recalculé en Python pur. Mesuré avec un encodeur factice de
   dimension 384 (celle du modèle nommé) : **mille fiches, 16,6 secondes** sur
   la machine de travail, hors encodage. Dix mille fiches font cent fois plus
   de paires. La comparaison est ici le coût dominant, pas le déploiement.

   Ce qu'il faut faire : soit une multiplication matricielle (`numpy`, déjà
   tiré par `sentence-transformers`) ou `sentence_transformers.util` pour la
   recherche de voisins, et un bloc ou un index approché au-delà de quelques
   dizaines de milliers de fiches ; soit retirer la phrase et écrire que la
   comparaison est quadratique en Python pur. Dans les deux cas, le test
   « mille fiches dans une borne large » doit refléter la borne réelle. Le
   verdict (« N1 et N2 comparent toutes les paires du fichier ») le dit déjà :
   la docstring le contredit.

3. **[solidité du verdict]** `escalate_when` de N0 et `verdict_rationale`
   (« Montez à N1 le jour où vos doublons se cachent précisément dans le champ
   dont la clé est faite »). La réponse de production à une clé de blocage qui
   rate des doublons n'est pas de supprimer le blocage (N1, quadratique) : c'est
   d'**ajouter une seconde règle de blocage** et de prendre l'union des paires
   — nom et code postal, *ou* courriel, *ou* téléphone, *ou* clé phonétique du
   nom. C'est exactement ce que décrit la page Splink citée en
   `further_reading`. Le lecteur qui suit la fiche remplace un algorithme qui
   tient à l'échelle par un algorithme qui ne tient pas, pour un problème qui
   se règle en une ligne.

   Ce qu'il faut faire : faire accepter plusieurs clés à `find_duplicates`
   (une liste de fonctions, union des groupes, paires dédoublonnées), avec un
   test où le code postal faux est rattrapé par la seconde clé ; ou, a minima,
   écrire dans `escalate_when` et le verdict que la première réponse est une
   seconde règle de blocage, et que N1 ne vient qu'après, quand aucune clé
   partagée n'existe. Le `breaking_point` reste vrai pour une clé unique ; il
   doit le dire (« avec une seule clé »).

4. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   - `n0.test.py` / `n0.test.js`, `INFIRMÉ` : « la docstring dit que ce niveau ne compare jamais toutes les paires ». **Périmé** : la docstring dit désormais « all of them when every record lands in the same group ». Le test prouve la fausseté d'une phrase qui n'existe plus.

   Ce qu'il faut faire : réécrire le test pour démontrer la phrase actuelle (un seul bloc : toutes les paires sont comparées), sans marquage.

### Remarques non bloquantes

- `blocking_key` prend le dernier mot comme nom de famille : « Dupont Jean »
  donne `jea`. La fiche le dit dans le `breaking_point`, c'est honnête ; une
  clé sur le mot le plus long ou sur les initiales triées serait plus robuste
  pour le même prix.
- N1, `latency: "~10 ms"` : vrai sur l'entrée nominale du test (décision 13),
  mais vingt mille fiches prennent 27 secondes (mesuré). La fiche devrait dire
  en toutes lettres que la classe change avec la taille, comme la décision 13
  l'exige.
- `breaking_point` N2 : l'aveu « ces vecteurs sont ceux d'un double local »
  est exact et bienvenu. Mais un point de rupture entièrement fabriqué par un
  double démontre la mécanique du seuil, pas le comportement du modèle ; si le
  modèle nommé est téléchargeable, une mesure réelle sur ces trois lignes
  vaudrait mieux que le conditionnel.

### Ce qui est solide

- Le `scenario` est la bonne leçon : la difficulté du rapprochement est le
  choix des paires, et « dix mille fiches font cinquante millions de paires »
  est exact.
- Le point de rupture de N0 (code postal faux, score 0,96, paire jamais
  comparée) est démontré avec l'exemple et un témoin : c'est le modèle à suivre.
- Le `breaking_point` de N1 (SNCF / SNEF) est un vrai piège d'exploitation.
- `unavailable_reason` de N3 est un argument de structure, pas de préférence.
