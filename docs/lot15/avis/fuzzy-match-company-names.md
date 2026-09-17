# fuzzy-match-company-names — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs fuzzy-match-company-names` : vert, 3 py, 3 js.

### Raisons du refus

1. **[vérité du point de rupture, pertinence technique]** `breaking_point` de
   N0 (le sigle) et docstring de `n0.py` / `n0.js` : Jaro-Winkler « rewards a
   shared opening, which suits names that differ at the tail ». Sur des noms de
   sociétés françaises, c'est l'inverse : le nom commence par le métier et se
   distingue à la fin. Exécuté, seuil du test 0,85 :

   | Paire | Même société ? | Score |
   |---|---|---|
   | Pharmacie de la Gare / Pharmacie de la Mairie | non | **0,963** |
   | Transports Martin / Transports Martineau | non | **0,970** |
   | Boulangerie Martin / Boulangerie Dupont | non | **0,897** |
   | Dubois & Fils SARL / Dubois et Fils | oui | 0,957 |
   | Ets Martin / Établissements Martin | oui | **0,682** |

   Deux pharmacies différentes scorent plus haut que la vraie paire Dubois, et
   l'abréviation « Ets », la plus courante des raisons sociales françaises,
   tombe sous le seuil. Le test `test_deux_societes_differentes_d_un_meme_metier_passent_au_dessus_du_seuil`
   le sait déjà ; la fiche ne le dit pas. Le lecteur lit « ça casse sur les
   sigles » et déploie un rapprochement qui fusionne toutes les pharmacies
   d'une ville. Ce n'est pas « là, et seulement là ».

   Ce qu'il faut faire :
   - mettre ce cas **en tête** du `breaking_point` de N0 avec l'exemple des
     deux pharmacies et son témoin ;
   - corriger la docstring : le préfixe commun favorise les noms qui partagent
     leur métier, pas seulement leur marque ;
   - ajouter à la normalisation les abréviations usuelles (`ets` →
     `etablissements`, `sté` → `societe`, `cie`, `&` → `et`) ou retirer les
     mots de métier les plus fréquents au même titre que la forme juridique ;
     tester « Ets Martin » ;
   - dire dans le verdict qu'un score N0 au-dessus du seuil est un candidat
     à relire, jamais une fusion — le test le dit, la fiche doit le dire.

2. **[réalité du cas, verdict]** `scenario` et `verdict_rationale`. Pour des
   sociétés françaises, la première question d'un praticien est : « y a-t-il
   un SIREN, un SIRET ou un numéro de TVA dans les deux fichiers ? ». Si oui,
   il n'y a pas de rapprochement flou à faire. Si un seul fichier l'a, on
   résout l'autre contre le répertoire Sirene, ouvert et gratuit, qui porte la
   dénomination, le **sigle** et les enseignes de chaque unité légale — c'est
   précisément la réponse au point de rupture « SNCF contre sa raison
   sociale » que tous les niveaux de la fiche échouent à traiter. La fiche
   n'évoque ni l'identifiant ni le répertoire.

   Ce qu'il faut faire : ajouter au `scenario` ou au verdict la phrase qui dit
   que le rapprochement par identifiant passe avant tout, et que la paire sigle
   contre raison sociale se résout par une table de sigles, qu'on peut tirer du
   répertoire Sirene pour les sociétés françaises. Vérifier et citer la
   documentation officielle du jeu de données Sirene (champ du sigle de l'unité
   légale) en `sources`. `escalate_when` de N1 doit alors pointer vers cette
   table avant N2.

3. **[preuves, verdict]** N2, `breaking_point` : « Non mesuré. […] Où casse
   l'encodeur réel, et ce qu'il gagne sur les sigles, rien dans cette fiche ne
   le mesure. » L'honnêteté est bienvenue, mais un niveau **disponible** dont
   la seule raison d'être (le sigle, d'après `escalate_when` de N1) n'est pas
   démontrée n'aide pas le lecteur à décider : l'`escalate_when` de N1 l'y
   envoie sans aucune preuve que N2 résout le problème. Les encodeurs de
   phrases généralistes rapprochent mal un sigle peu connu de sa forme
   développée ; c'est justement ce qu'il faudrait mesurer.

   Ce qu'il faut faire, au choix : (a) mesurer le modèle nommé par l'extrait,
   hors intégration continue, sur la paire SNCF et sur trois ou quatre sigles
   moins célèbres, et écrire le résultat avec la méthode (modèle, version,
   commande) ; (b) passer N2 en `available: false` avec pour raison que le
   gain sur les sigles n'est pas établi et qu'une table de sigles le règle de
   façon déterministe (point 2). Dans les deux cas, `escalate_when` de N1 ne
   doit plus promettre ce qui n'est pas démontré.

### Remarques non bloquantes

- `unavailable_reason` N3 : « cinquante millions d'appels » suppose qu'on ne
  préfiltre pas ; la phrase suivante le reconnaît. L'argument de
  rejouabilité, lui, est solide et sourcé.
- `LEGAL_FORMS` : le commentaire sur « spa » est une vraie leçon de terrain.
  Manquent `ets`, `cie`, `scop`, `selarl`, `sel`, `gie`, `association`, courants
  dans les fichiers français.
- `escalate_when` de N0 mêle deux événements (registre entier, ordre des
  mots). Le second est le plus observable ; il pourrait être seul.

### Ce qui est solide

- Retirer la forme juridique au lieu de la comparer est exactement ce qu'on
  fait, et la garde « un nom fait seulement d'une forme juridique la garde »
  évite un piège réel.
- Le point de rupture sur le sigle est démontré avec l'exemple exact, le
  contre-exemple Sanofi et un témoin.
- Le `breaking_point` de N2 ne prête pas au modèle ce que le double produit :
  c'est la bonne discipline, il faut maintenant en tirer la conséquence.
