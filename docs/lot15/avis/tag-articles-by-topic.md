# tag-articles-by-topic — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs tag-articles-by-topic` : **rouge**, trois
exécutions de suite sur la machine de travail. Le test en échec est
`n0.test.py::test_un_article_se_traite_en_moins_d_une_milliseconde`.

### Raisons du refus

1. **[preuves, pertinence technique]** Le niveau recommandé et son voisin ne
   passent pas leur propre suite. `test_un_article_se_traite_en_moins_d_une_milliseconde`
   affirme `best < 0.001` sur un article de 500 mots ; mesuré ici, le minimum
   de cinquante appels vaut 1,08 ms et la médiane 1,16 ms. Deux fautes :
   - le test viole la charte des tests (« une borne de temps n'est jamais un
     chiffre de performance publié […] prenez-la dix fois plus large que ce que
     vous observez ») : il épingle une classe de latence avec une marge de
     deux, et devient rouge au premier processus voisin qui chauffe ;
   - l'affirmation qu'il défend est fragile : `latency: "<1 ms"` pour N0 tient
     sur 500 mots par temps calme, et le relevé du testeur note « 1 ms vers
     1 000 mots ». Un article de presse en fait souvent davantage.

   Ce qu'il faut faire : remplacer ce test par une borne d'effondrement large
   (la charte le demande), et soit déclarer `latency: "~10 ms"` pour N0 en
   écrivant sur quelle taille d'article la classe est mesurée (décision 13),
   soit garder `<1 ms` en le justifiant sur l'article nominal du test **et**
   en disant quand elle change. C'est fait quand la suite est verte trois fois
   de suite sur une machine chargée.

2. **[vérité du point de rupture]** N1. La docstring de `n1.py` / `n1.js` le
   dit : « In the test, an article made of the training articles of three
   topics comes back with no tag at all. » Le `need` est d'« attribuer à
   chaque article les thèmes qu'il traite » ; l'article qui en traite
   **plusieurs** — souvent le plus fouillé — ressort **sans aucune étiquette**
   au niveau recommandé. Le `breaking_point` de N1 ne parle que du thème non
   étiqueté, et le verdict n'en dit rien. C'est pourtant le premier défaut
   qu'une rédaction verra sur ses dossiers de fond.

   Ce qu'il faut faire : mettre ce cas dans le `breaking_point` de N1, avec son
   exemple et un témoin (l'article d'un seul thème, étiqueté), et dire dans le
   verdict ce qu'on fait — seuil par thème étalonné sur le corpus, ou garder au
   moins le meilleur thème au-dessus d'un plancher plus bas. Si le code est
   corrigé en ce sens, le test doit montrer l'article à trois thèmes étiqueté.

3. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs, et adaptateur
   N3 non testé.
   - `n0` (py, js), `INFIRMÉ` : « lemmatisation ». Le `name` et la docstring
     disent désormais « retrait des terminaisons » et « not a lemmatiser » :
     **périmé** (la fonction s'appelle encore `lemmatise`, ce qui entretient la
     confusion : la renommer).
   - `n1` (py, js), `INFIRMÉ` : « an article can come back with three tags ».
     **Périmé** : la docstring dit l'inverse (voir point 2).
   - `n1` (py, js), `INFIRMÉ` : « "à distance" says more than "distance" ».
     **Périmé** : le commentaire dit désormais que le mot d'une lettre est jeté.
   - `n2` (py, js), `INFIRMÉ` : « Aucun seuil ne sépare les deux ». **Périmé** :
     le `breaking_point` a été réécrit.
   - `n3` (py, js), `DÉFAUT` : « le client par défaut a la forme du vrai kit ».
     **Périmé** et **décoratif** : le test passe le double du kit directement à
     `tag(…, client=…)`, qui attend un objet doté de `complete` ; il lève pour
     cette raison, donc le marquage strict « passe ». **Aucun test ne fait
     tourner `ProviderClient`**.

   Ce qu'il faut faire : réécrire chaque test sur la phrase actuelle, sans
   marquage ; tester l'adaptateur sur `_harness/fake_sdk.py` / `fake-sdk.mjs`.

### Remarques non bloquantes

- N2, « un service à tenir chaud » dans le verdict : un encodeur de phrases se
  charge dans le processus qui publie l'article ; pour un étiquetage à la
  publication, ce n'est pas un service permanent. La formule vient d'autres
  fiches, elle ne s'applique pas ici telle quelle.
- `unavailable_reason` absente : les quatre niveaux sont disponibles, ce qui
  est cohérent avec le besoin.

### Ce qui est solide

- Le `scenario` a le bon argument : une rédaction qui étiquette depuis des
  années possède le corpus, et louer chaque mois une connaissance qu'on
  possède est absurde.
- Le point de rupture de N0 (le télétravail traité de bout en bout sans être
  nommé) et celui de N1 (le thème jamais étiqueté n'existe pas, et baisser le
  seuil range l'article ailleurs) sont justes et démontrés.
- Le `breaking_point` de N3 (la liste vide est une réponse légitime, donc
  avaler l'erreur ferait disparaître les articles des pages de rubrique sans
  bruit) est une vraie leçon d'exploitation.
