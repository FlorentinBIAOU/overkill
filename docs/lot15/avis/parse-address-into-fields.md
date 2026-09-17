# parse-address-into-fields — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs parse-address-into-fields` : vert, 4 py, 4 js.

### Raisons du refus

1. **[solidité du verdict, pertinence technique]** Le niveau recommandé, N1,
   casse sur les adresses françaises les plus ordinaires, que N0 lit juste.
   Modèle entraîné sur les dix-huit adresses de `n1.test.py`, exécuté :

   | Adresse | N1 | N0 |
   |---|---|---|
   | `15 rue Victor Hugo 92100 Boulogne-Billancourt` | rue `rue`, complément `Victor Hugo Boulogne`, ville `Billancourt` | juste |
   | `10 bd Saint-Michel 75005 Paris` | rue `bd`, complément `Saint Michel` | juste (`boulevard Saint-Michel`) |
   | `Lieu-dit Les Granges 24200 Sarlat-la-Canéda` | rue `dit la`, ville `Canéda` | juste |
   | `3 rue de la République, CEDEX 5, 69002 Lyon` | numéro `3 5` | `CEDEX 5` collé à la rue |
   | `Résidence du Parc, 3 rue de la Paix, 75002 Paris` | rue `rue du de la Paix` | numéro vide, tout en rue |
   | `8 rue des Lilas Bât C Apt 12, 75011 Paris` | juste | complément collé à la rue |

   Une rue qui porte un nom de personne, une ville à trait d'union, une
   abréviation de type de voie : c'est la majorité des adresses françaises, pas
   une marge. Le tokeniseur `[^\W_]+` coupe aux traits d'union et le
   reconstruit sans eux ; dix-huit exemples ne couvrent ni les prénoms dans les
   noms de rue ni les abréviations. La fiche vend N1 pour **un** gain (le
   complément) et tait une régression sur le cas nominal.

   Ce qu'il faut faire : changer le verdict. Le complément que N1 était censé
   régler a des mots-clés en nombre fini — bâtiment, bât, escalier, esc,
   appartement, apt, appt, étage, porte, résidence, rés, lieu-dit, BP, CEDEX —
   et se traite comme le type de voie de N0 : un dictionnaire et une ancre.
   Recommandation : N0 enrichi d'un dictionnaire de compléments (la norme
   postale citée par le `scenario` en donne la liste ; citer la norme ou la
   page de La Poste qui la reprend), et `breaking_point` de N0 réécrit sur ce
   qui reste. Si N1 est gardé, son `breaking_point` doit commencer par le
   tableau ci-dessus, et chaque ligne doit être un test. C'est fait quand
   « 15 rue Victor Hugo 92100 Boulogne-Billancourt » ressort juste au niveau
   recommandé, dans les deux langages.

2. **[réalité du cas]** `scenario`, verdict et échelle des niveaux. Pour une
   adresse française saisie dans un formulaire, ce qu'on fait en production
   est d'appeler le service de géocodage public — la Géoplateforme, successeur
   de l'API Base Adresse Nationale, que la fiche cite en `further_reading`
   sans en tirer la conséquence. Il est gratuit, rend numéro, voie, code
   postal et commune **vérifiés contre le référentiel national**, et règle ce
   qu'aucun niveau de la fiche ne règle : « 8 rue des Lilas, 75011 Lyon », le
   code postal d'une autre ville, que le `breaking_point` de N2 cite comme
   échec. Le vrai besoin derrière « découper une adresse » est presque
   toujours « avoir une adresse livrable ».

   Ce qu'il faut faire : faire apparaître ce service dans l'échelle — soit en
   niveau (sortie de données vers un service public : à dire dans
   `regulatory`), soit dans le verdict comme l'étape qui suit le découpage
   pour valider — et dire en une phrase qu'un découpage sans validation rend
   des champs propres et faux. Vérifier sur la documentation officielle le nom
   actuel du service, ses conditions d'usage et ses limites de débit, et les
   citer.

### Remarques non bloquantes

- `escalate_when` de N1 envoie vers libpostal pour les adresses étrangères :
  c'est la bonne direction, et libpostal lit aussi les adresses françaises. Il
  mériterait d'être présenté comme l'alternative à N1 pour tout le monde, pas
  seulement pour l'étranger ; son coût réel est un modèle de l'ordre du
  gigaoctet à charger, que la fiche pourrait dire sans chiffre (« un modèle
  volumineux à tenir en mémoire »).
- `latency: "<1 ms"` pour libpostal : à vérifier, le chargement initial est
  long ; la classe vaut par appel une fois chargé, le dire.
- N3 : le `breaking_point` (valeur copiée de l'adresse mais dans le mauvais
  champ, « rue de Lille / Lille ») est un excellent exemple de garde qui
  prouve la provenance et pas la place.

### Ce qui est solide

- Le `scenario` pose la bonne question : « ce qui, dans vos adresses à vous,
  casse la règle ».
- N0 est un bon extrait : ancre sur le code postal, dictionnaire de voies avec
  abréviations, et il lit juste les cas nominaux ci-dessus. Il ne lui manque
  que le dictionnaire de compléments.
- Les points de rupture étrangers (Berlin, Bristol) sont démontrés et exacts.
