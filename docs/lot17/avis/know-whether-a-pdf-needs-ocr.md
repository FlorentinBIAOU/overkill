# know-whether-a-pdf-needs-ocr — avis du relecteur

## Tour 1 — REFUSÉE

Le niveau N0 est excellent et je n'ai rien à lui reprocher : deux nombres lus
dans le fichier, une décision par page et non par document, un seuil dont la
fiche montre ce qu'il change, et l'asymétrie du coût de l'erreur dite à voix
haute. Le refus porte entièrement sur le niveau N1, dont la démonstration
tourne en rond et dont le réglage par défaut ne tient pas sur une page
française ordinaire.

### Raisons du refus

1. **Le témoin du point de rupture de N1 est une page d'entraînement, et il ne
   peut donc pas échouer.** `breaking_point` de N1 : « Le témoin est dans le
   même test : une page de contrat marque −2,39. » Ce témoin est
   `CORPUS[0]` (`n1.test.py:33`), c'est-à-dire la première des six pages
   passées à `fit`. Or le seuil est `min(scores des pages d'entraînement) −
   MARGIN` : toute page d'entraînement passe son propre seuil **par
   construction**, ce que le test `test_le_seuil_vient_du_lot_dentrainement_et_
   de_rien_dautre` affirme d'ailleurs lui-même une ligne plus bas
   (`assert all(is_readable(page, MODELE)["readable"] for page in CORPUS)`).
   Le témoin ne démontre pas que N1 accepte de la prose française ; il
   démontre que `min() − 0,3` est inférieur à `min()`. Il faut une page
   française lisible **qui ne soit pas dans `CORPUS`**, et c'est elle qui doit
   porter le chiffre du `breaking_point`.

   J'ai fait le travail à la place du test, en validation croisée
   (ajuster sur cinq pages, noter la sixième) : les six passent, avec des
   scores de −2,44 à −2,60 pour des seuils de −2,70 à −2,73. Le modèle
   généralise donc bien **à l'intérieur du corpus**, et c'est ce résultat-là,
   pas un score circulaire, qui vaut d'être publié.

2. **Le réglage par défaut `MARGIN = 0.3` refuse des pages françaises
   ordinaires, et le commentaire qui le justifie ne mesure que le lot
   d'entraînement.** `n1.py:37-39` : « Three tenths of a nat per pair:
   measured on the pages of this entry, a readable page sits within a tenth of
   the training set. » Cette phrase est vraie des pages d'entraînement et de
   rien d'autre. Sur quatre pages françaises neuves, de la prose
   administrative ordinaire, notées contre le modèle de la fiche :

   | Page | Score | Verdict |
   |---|---|---|
   | « Le présent avenant a pour objet de préciser les modalités… » | −2,55 | lisible |
   | « Conformément à l'article 1231-1 du code civil… » | −2,72 | **refusée** |
   | « Madame, Monsieur, nous accusons réception de votre courrier… » | −2,83 | **refusée** |
   | « Facture n° 2026-0412. Prestations de conseil réalisées… » | −2,76 | **refusée** |

   Trois sur quatre, pour un seuil à −2,69. Ce ne sont ni des tableaux, ni des
   bordereaux, ni des formulaires à champs courts : l'`escalate_when` de N1 ne
   les couvre pas, et le `breaking_point` non plus — « il sépare les lettres du
   bruit » décrit mal un modèle qui refuse une lettre commerciale. C'est
   exactement la règle R7 : un seuil par défaut se juge sur ce qu'il produit un
   jour ordinaire, pas sur l'exemple qui l'illustre. Soit la marge est
   calibrée sur des pages retenues hors du lot et le chiffre change, soit la
   fiche dit que `MARGIN` doit être réglé par l'appelant sur ses propres pages
   de validation, et le point de rupture nomme ce faux refus.

3. **Le corpus qui tient lieu de « vos propres pages lisibles » ne contient pas
   un seul accent.** `fixtures.py:87-108` : « societe », « siege »,
   « immatriculee », « duree », « reglement », « penalites »,
   « Confidentialite », « execution »… Six pages de contrat français sans un
   `é`. Or `ALPHABET` (`n1.py:31`) déclare `àâäçéèêëîïôöùûüÿœæ`, qui ne
   reçoivent donc que le lissage add-one. Conséquence mesurée : les mêmes
   quatre pages ci-dessus, désaccentuées, gagnent entre 0,04 et 0,16 nat, et
   deux d'entre elles repassent au-dessus du seuil. Autrement dit, le modèle
   de la fiche pénalise le français écrit correctement. C'est la règle T5 et
   la règle R1 dans le même trou : l'entrée ordinaire de la population visée,
   pour un fonds documentaire francophone, porte des accents. Réécrire
   `CORPUS` en français accentué, republier les cinq scores de la fiche
   (−4,10 ; −2,69 ; −2,39 ; −4,14 ; −3,17) qui bougeront tous, et garder le
   test NFD, qui reste pertinent.

### Remarques non bloquantes

1. **`fit([])` rend un seuil `-inf` qui déclare tout lisible.**
   `test_production_valeurs_aux_limites` le constate et s'en contente :
   `assert is_readable("le contrat", fit([]))["readable"] is True`. Un modèle
   ajusté sur rien qui approuve tout est le pire des deux défauts possibles
   dans cette fiche, puisque l'erreur coûteuse est de déclarer lisible une
   page qui ne l'est pas. `fit([])` devrait lever, ou rendre un modèle qui
   refuse tout, et le test devrait affirmer ce choix plutôt que l'observer.

2. **Le tableau de montants comme point de rupture de N1 est juste, et
   sous-vendu.** « 12/01/2026 1 250,00 4 300,50 » n'est pas seulement un cas
   d'école : dans un fonds documentaire réel, les pages d'annexe financière
   sont une fraction importante du volume, et elles partiront toutes à l'OCR.
   Le coût de ce faux refus mériterait une phrase dans le
   `verdict_rationale`, puisque c'est lui qui décide si on monte à N1.

3. **R11 — deux points de rupture de 64 et 58 mots, deux phrases chacun.**
   Parmi les mieux tenus du lot. Voir la synthèse.

### Ce qui est solide

- Le niveau N0 est le meilleur travail des six premières fiches. Décider page
  par page plutôt que document par document, avec le contrat exporté d'un
  traitement de texte et sa page de signature scannée comme exemple, c'est une
  observation de terrain, pas une construction.
- Le seuil de 120 caractères est justifié par ce qu'il change, pas par son
  existence : la page scannée qui porte un en-tête de 28 caractères serait
  déclarée lisible par la règle « y a-t-il du texte ». Chiffres assertés à
  l'unité dans le test (183, 224, 28, 120).
- La fermeture de N2 est le meilleur argument du lot jusqu'ici : un
  classifieur d'images de page exige de rendre la page en image, c'est-à-dire
  de payer l'étape la plus lourde pour savoir s'il faut la payer. Et N3 se
  contredit en une phrase. Les deux raisons sont des raisons, pas des
  formules.
- Le test comparatif entre N0 et N1 sur le point de rupture de N0 existe
  (`test_n1_attrape_la_page_que_n0_avait_rangee_parmi_les_lisibles`) : R4 est
  correctement transposée à un verdict qui est le bas de l'échelle.
- Le test de la page anglaise est un vrai test T3 : une entrée qui viole
  l'hypothèse du modèle, avec la contre-épreuve — elle remonte au-dessus du
  seuil dès que l'anglais entre dans le lot. C'est ce test-là qu'il faut
  imiter pour corriger le point 1 ci-dessus.
