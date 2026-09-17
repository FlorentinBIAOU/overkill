# write-product-descriptions — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs write-product-descriptions` : vert, 3 py, 3 js.

### Raisons du refus

1. **[solidité du verdict]** `verdict_rationale` (« une copie tirée à
   température non nulle donc jamais relue une bonne fois ») et fin du
   `breaking_point` de N3 (« rien ne fait de la copie relue hier celle qu'un
   nouvel appel écrit aujourd'hui »). Le non-déterminisme est présenté comme un
   prix permanent de N3. Il ne l'est pas dans l'usage : une description se
   génère **une fois** par article, se stocke dans le catalogue, se relit, et
   c'est le texte stocké qui est publié ; personne ne rappelle le modèle à
   chaque affichage de page. La relecture vaut donc « une bonne fois » pour la
   copie stockée, exactement comme pour un texte écrit par un rédacteur. Le
   vrai prix, que la fiche dit ailleurs, est ailleurs : la relecture de
   chaque article contre son dossier, et la régénération qui recommence cette
   relecture quand le dossier change.

   Ce qu'il faut faire : retirer « donc jamais relue une bonne fois » du
   verdict et la dernière phrase du `breaking_point` de N3, ou les réécrire
   sur le cas où elles sont vraies (régénérer à chaque mise à jour du dossier
   produit relance la relecture). Même correction en anglais. Dire en une
   phrase dans le verdict que la copie générée se stocke et se versionne.

2. **[pertinence technique]** N2, `LocalCopywriter(checkpoint="./models/catalogue-copy")`.
   Le client par défaut pointe vers un répertoire qui n'existe pas, et la fiche
   ne nomme **aucun** modèle de départ : ni le point de contrôle à affiner
   (langue française comprise), ni sa licence, ni ce que l'affinage demande.
   C'est le travail même du niveau, et la charte des extraits exige qu'un
   extrait « fasse vraiment le travail annoncé par le nom de l'approche » ; le
   lot a refusé pour la même raison un client N3 qui appelait une méthode
   inexistante. `cost: modéré` et `latency: "~1 s"` n'ont pas de base sans
   modèle nommé.

   Ce qu'il faut faire : nommer le point de contrôle de départ (un modèle de
   séquence à séquence qui écrit le français, vérifié sur sa fiche : langues,
   licence commerciale, taille), dire dans la docstring que l'affinage n'est
   pas dans l'extrait et ce qu'il demande (un corpus « dossier → description
   publiée », ordre de grandeur de taille sans chiffre inventé), et justifier
   `cost` et `latency` sur ce modèle. Si le rédacteur ne peut pas nommer un
   modèle qui tienne, passer N2 en `available: false` avec cette raison.

3. **[preuves]** Marquages encore actifs, et adaptateur N3 non testé.
   - `n0` (py, js), `INFIRMÉ` : « le vingt-et-unième gabarit s'écrit à la main
     par quelqu'un qui en a déjà écrit vingt ». **Périmé** : le verdict dit
     désormais « la dix-septième formulation […] seize ».
   - `n3` (py, js), `DÉFAUT` : « le client par défaut a la forme du vrai kit ».
     Décoratif ; **aucun test ne fait tourner `ProviderClient`**.

   Ce qu'il faut faire : réécrire le test `n0` sur le chiffre actuel, sans
   marquage ; tester l'adaptateur sur `_harness/fake_sdk.py` / `fake-sdk.mjs`,
   température comprise (l'extrait en passe une non nulle : vérifier qu'elle
   arrive au kit).

### Remarques non bloquantes

- Le verdict parle de « douze motifs de phrase » puis de « la dix-septième
  formulation […] seize » : deux comptes différents à une phrase d'écart. Le
  lecteur ne sait pas lequel retenir. Garder un seul chiffre, celui que le test
  démontre, ou dire ce qui distingue une formulation d'un motif.
- Pour deux cents articles, l'API de traitement par lots du fournisseur
  d'exemple est moins chère et adaptée à une génération hors ligne ; une
  phrase aiderait le lecteur qui retient N3, sans chiffre de prix.
- Le contrôle d'ancrage « terme à terme » ne vaut que la liste de termes, et la
  fiche le dit avec un test qui le montre sur un vocabulaire vide. C'est
  honnête ; dire qui tient cette liste (le juriste ou le responsable qualité,
  pas le développeur) la rendrait utilisable.

### Ce qui est solide

- Le verdict N3 est assumé et argumenté sur une mesure : douze motifs pour deux
  cents produits au niveau N0. C'est le rare verdict N3 du catalogue qui repose
  sur un chiffre démontré plutôt que sur une opinion.
- Le `scenario` pose le bon risque — ce que la phrase affirme engage le
  vendeur — et les deux points de rupture de N2 et N3 (« entièrement étanche »,
  « garanti à vie ») sont exactement les phrases qui coûtent en litige.
- Le contrôle d'ancrage qui refuse « étanches » quand le dossier dit « non
  étanche » montre un vrai soin des cas limites.
- La dernière phrase du verdict (« si votre catalogue tient sur trente
  références […], aucun niveau n'est la réponse ») est celle d'un praticien.
