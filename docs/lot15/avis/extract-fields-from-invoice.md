# extract-fields-from-invoice — avis du relecteur

## Tour 1 — REFUSÉE (reste en `status: draft`)

`node scripts/test-snippets.mjs extract-fields-from-invoice` : vert, 4 py, 4 js.
Le vert ne dit rien du niveau recommandé : N2 est testé contre un double, et le
code réel qu'il enveloppe ne tourne pas.

### Raisons du refus

1. **[réalité du cas]** `scenario`, `verdict_rationale`, et l'absence d'un
   niveau qui lit la donnée structurée. Nous sommes en septembre 2026 : depuis
   le 1er septembre 2026, toute entreprise assujettie en France doit pouvoir
   **recevoir** ses factures B2B domestiques sous forme électronique structurée
   (Factur-X, UBL ou CII) via une plateforme agréée ; les grandes entreprises
   et les ETI doivent les émettre ainsi dès cette date, les PME et TPE au
   1er septembre 2027 (impots.gouv.fr, « À partir de quand suis-je concerné par
   la réforme de la facturation électronique ? »). Pour un lecteur français, le
   premier geste d'un pipeline de factures n'est donc plus une expression
   régulière sur le texte d'un PDF : c'est **lire le XML** quand il est là, et
   ne réserver l'extraction qu'à ce qui reste (fournisseurs étrangers, tickets,
   factures hors réforme, arriéré). La fiche relègue Factur-X dans
   `further_reading` avec « quand il n'y a plus rien à extraire », comme une
   curiosité.

   Ce qu'il faut faire : ajouter en N0 (ou avant N0, dans le `scenario` et le
   verdict) la lecture de la donnée structurée — extraire le XML joint au PDF
   Factur-X, ou lire le flux UBL/CII reçu de la plateforme — et récrire le
   `scenario` pour dire ce qui reste à extraire en 2026 et pour qui. Citer la
   page impots.gouv.fr. Les dates doivent être vérifiées sur la source
   officielle au moment de la réécriture, pas reprises de cet avis.

2. **[pertinence technique]** N2, verdict de la fiche. Le rédacteur l'a
   constaté lui-même, je le confirme à la lecture du code : le niveau
   recommandé ne peut pas tourner tel qu'écrit.
   - `pipeline("token-classification", model="microsoft/layoutlmv3-base")`
     appelé avec `{"words": lines, "boxes": ...}` : le pipeline de
     classification de jetons de `transformers` prend du texte, pas des mots et
     des boîtes ; LayoutLMv3 se sert par son processeur, avec l'image de la page.
   - Le pipeline rend des entités **par jeton**, pas une ligne de scores par
     ligne d'entrée : `predict` suppose une forme de sortie que le modèle ne
     produit pas.
   - Le point de contrôle nommé est un encodeur de base, sans étiquettes de
     facture ; le commentaire le dit, mais aucun point de contrôle affiné
     utilisable n'est nommé.
   - Les boîtes sont fabriquées : `x1` vaut toujours 1000, `x0` est
     l'indentation en caractères, `y` le numéro de ligne. Le verdict dit que
     « la mise en page est le signal » ; l'extrait donne au modèle une mise en
     page qui n'existe pas.
   - La licence CC BY-NC-SA du point de contrôle interdit l'usage commercial,
     ce qui écarte ce modèle pour le lecteur type de la fiche.
   - `cost: modéré` et `latency: "~100 ms"` n'ont aucune source (relevé par le
     rédacteur).

   Ce qu'il faut faire : trancher le verdict avant toute republication. Les
   options sérieuses : (a) un N2 réellement exécutable, sur un modèle de
   document sous licence commerciale, avec les vraies boîtes lues du PDF
   (`pdfplumber` rend les mots et leurs coordonnées) et un test qui charge la
   vraie forme de sortie ; (b) un verdict N0 élargi — donnée structurée
   d'abord, puis gabarit par fournisseur avec détection du fournisseur inconnu
   qui part en relecture — ce qui est ce que font la plupart des équipes
   comptables à volume modeste ; (c) N3 assumé pour le résiduel, puisque le
   volume résiduel baisse avec la réforme. Ce sera fait quand l'extrait du
   niveau recommandé aura tourné sur une vraie facture, dans les deux
   langages ou avec une dérogation écrite dans la charte.

3. **[vérité du point de rupture]** `breaking_point` de N2 : « Si […] le modèle
   désigne la ligne de l'acompte […] avec un score de 0,96 ». C'est le double
   qui écrit 0,96, pas le modèle. La phrase est au conditionnel et reste
   honnête sur la mécanique du seuil, mais sur un niveau qui ne tourne pas elle
   décrit un comportement jamais observé. À réécrire une fois le point 2
   tranché, sur une sortie réelle ; d'ici là, dire explicitement que c'est la
   mécanique du seuil qui est démontrée, pas le modèle.

4. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   - `n0` (py, js), `INFIRMÉ` : « trois chiffres exacts par groupe empêchent d'avaler une quantité et un prix unitaire comme un seul nombre » ; « 2 380,50 » l'est.
   - `n1` (py, js), `INFIRMÉ` : annoter la facture corrigerait la lecture. Le `breaking_point` dit désormais l'inverse : **périmé**, à réécrire en démonstration.
   - `n2` (py, js), `INFIRMÉ` : « relever le seuil n'y change rien ». Le `breaking_point` a été corrigé : **périmé**.
   - `n2` (py, js), `DÉFAUT` : le modèle par défaut n'a pas la forme du vrai pipeline. **Vivant** (voir point 2).
   - `n3` (py, js), `DÉFAUT` : le client par défaut n'a pas la forme du vrai kit. **Périmé** : l'adaptateur existe, mais le test passe le double du kit directement à `extract_fields` au lieu de `ProviderClient(sdk=…)`, et **aucun test ne fait tourner l'adaptateur** de cette fiche.

   Ce qu'il faut faire : pour chaque ligne vivante, corriger le code ou la phrase ; pour chaque ligne périmée, réécrire le test sur la phrase actuelle, sans marquage ; ajouter un test de l'adaptateur avec `_harness/fake_sdk.py` / `fake-sdk.mjs`.

### Remarques non bloquantes

- `breaking_point` N0 : l'exemple « Sous-total contient total » est le meilleur
  de la fiche — l'erreur silencieuse bien formée, celle qui coûte en
  comptabilité. À garder tel quel.
- `breaking_point` N1 : l'indemnité forfaitaire de recouvrement est une mention
  obligatoire (source service-public citée), mais elle s'écrit le plus souvent
  en phrase (« Indemnité forfaitaire pour frais de recouvrement : 40 € »), pas
  en montant seul sur sa ligne. L'exemple du test est donc un cas favorable au
  point de rupture ; le vérifier sur deux ou trois gabarits réels.
- Aucune vérification arithmétique n'est proposée à aucun niveau : HT + TVA =
  TTC, somme des lignes = sous-total. C'est la garde de production la moins
  chère qui existe contre l'erreur « bien formée et fausse » que la fiche
  décrit si bien, à N0 comme à N3. Une phrase dans le verdict, ou quelques
  lignes dans l'extrait, la rendraient utile au lecteur.

### Ce qui est solide

- Le `scenario` pose la bonne question — « comment le voyez-vous ? » — et
  l'`escalate_when` de N0 est un événement réellement observable.
- Le `breaking_point` de N3 dit exactement la limite : la forme se vérifie, la
  véracité non.
- La décision de laisser la fiche en brouillon plutôt que de publier un N2 qui
  ne tourne pas était la bonne.
