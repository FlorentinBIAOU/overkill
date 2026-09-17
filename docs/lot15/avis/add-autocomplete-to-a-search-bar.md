# add-autocomplete-to-a-search-bar — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs add-autocomplete-to-a-search-bar` : vert, 2 py, 2 js.

### Raisons du refus

1. **[pertinence technique, preuves]** `n1.py` et `n1.js`, docstring de `rerank` :
   « the model only moves what it has evidence about, which is what makes it safe
   to ship on a log that is still thin ». C'est faux, et c'est exactement
   l'inverse en exploitation. `learn` compte chaque clic sous le préfixe vide
   (`range(len(typed) + 1)` commence à 0), et `_evidence` redescend jusqu'à ce
   préfixe vide. Conséquence : **un seul clic, fait sous n'importe quelle saisie,
   fait passer un terme devant tous les termes jamais cliqués, sous tous les
   préfixes**. Exécuté :

   ```python
   t = build([("chaussettes", 900), ("chemise", 800), ("chapeau", 700)])
   m = learn([("zzz", "chapeau")])          # un clic, saisie sans rapport
   rerank(m, "ch", suggest(t, "ch"))        # ['chapeau', 'chaussettes', 'chemise']
   ```

   Sur un journal mince, un clic de robot, un clic par erreur ou un clic de
   recette suffit à renverser un classement tiré de milliers de recherches. Le
   test `test_un_journal_vide_ne_change_rien` ne le voit pas : il vérifie le
   journal vide, pas le journal d'un clic.

   Ce qu'il faut faire, au choix :
   - corriger le code pour que la preuve soit **proportionnée** : ne pas compter
     le préfixe vide, ou exiger un nombre minimal de clics avant de déplacer un
     terme, ou combiner clics et fréquence de recherche au lieu de trier sur les
     clics seuls ; puis ajouter le test ci-dessus avec son témoin ;
   - ou garder le code et **retirer « safe to ship on a log that is still
     thin »** (py, js, `doc.fr.yaml`), et écrire la limite : un clic isolé
     déplace un terme en tête de tous les préfixes. Dans ce cas elle doit
     apparaître aussi dans le `breaking_point` de N1, qui ne parle aujourd'hui
     que de la faute de frappe héritée de N0 — ce n'est pas là que N1 casse en
     premier, c'est là que N0 cassait.

   C'est fait quand un test, en Python et en JavaScript, exécute le cas
   « un clic sous "zzz" » et affirme le comportement que la fiche annonce.

2. **[vérité du point de rupture]** Même champ `breaking_point` de N1 : c'est le
   point de rupture de N0 recopié (« il ne l'allonge pas »). Un niveau qui ne
   casse que là où casse le niveau du dessous n'a pas de point de rupture
   propre, et le lecteur ne sait pas quand N1 le trahit. Le point 1 en fournit
   un réel, démontrable : la sensibilité aux clics isolés (ou, si le code est
   corrigé, le biais de position — les suggestions du haut reçoivent les clics
   parce qu'elles sont en haut, et le compteur renforce l'ordre qu'il devait
   corriger). Écrire celui que le code corrigé exhibe, avec son test.

### Remarques non bloquantes

- `breaking_point` N0 : « la faute de frappe sur le premier caractère » est vraie
  mais trop étroite pour qui la lit vite. Une faute à n'importe quelle position
  vide la liste à partir de cette touche (`echarpz` ne rend rien, vérifié) ; le
  premier caractère est le pire cas parce que rien n'est jamais montré. Le dire
  en une demi-phrase évite que le lecteur croie les fautes en milieu de mot
  tolérées.
- Un second point de rupture de N0, plus fréquent que la faute de frappe sur un
  catalogue à termes composés, n'est pas dit : la saisie du deuxième mot.
  `suggest(t, "laine")` ne remonte pas « écharpe en laine ». Ce n'est pas faux
  de le taire, mais c'est la première plainte qu'on reçoit sur une complétion
  par préfixe. Indexer aussi chaque suffixe de mot est l'ajout habituel.
- `escalate_when` de N1 : « se corrige dans la récupération » laisse le lecteur
  sans outil. Le rédacteur a lui-même consulté la documentation Elasticsearch
  qui cite l'option `fuzzy` du suggesteur `completion` : nommer la technique
  (distance d'édition bornée sur le préfixe) et ce lien règle la question.
- `unavailable_reason` N3 : « la même recherche est payée autant de fois qu'elle
  compte de lettres » ignore l'anti-rebond que toute barre de recherche met en
  place, modèle ou pas. L'argument tient sans cette phrase : un appel facturé
  par pause de frappe pour une liste fermée reste injustifiable.
- `learn` ne connaît ni décroissance ni fenêtre : un terme très cliqué il y a
  deux ans garde son avance. Pour un extrait, acceptable ; une phrase dans la
  docstring suffirait.
- Le cache `RANKED` garde la liste triée **entière** par nœud. Garder les `k`
  premiers à la construction est l'approche habituelle et borne la mémoire ; la
  docstring dit honnêtement le prix, donc ce n'est pas trompeur.

### Ce qui est solide

- Le cas est réel et le verdict N0 est le bon : une complétion sur ensemble
  fermé n'a rien à faire d'un modèle.
- La normalisation a été durcie sérieusement (NFKD, `Cf`, espaces, ß, sigma
  final) et la parité Python / JavaScript est testée, pas supposée.
- Parcours par pile explicite, plafond `MAX_TYPED` contre la mémoire
  quadratique : les pièges d'exploitation relevés au tour précédent sont
  réparés et démontrés.
- Le point de rupture de N0 a son exemple exact (« rcharpe ») et son témoin
  (« echarpe »).
