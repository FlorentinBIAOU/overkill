# Lot 16 — points d'étape

Une ligne par fiche terminée : fiche, motifs levés, ce qui reste.

## Groupe 1 — sorties fausses et silencieuses

- **convert-messy-csv-to-clean-data** — marque décimale déclarée par l'appelant
  et ambiguïté au journal ; six marquages retirés ; adaptateur N3 testé ; cas
  d'entrée ordinaire ajouté. Reste : rien.
- **find-duplicate-records** — comparaison champ par champ et pesée, colonnes
  triées (N0, N1, N2), plusieurs clés de blocage réunies, coût de N2 dit juste
  et produits scalaires en une multiplication, un marquage retiré. Reste : rien.
- **generate-test-data** — finalisation `fmix32` du haché en N0 et N1, jeux
  figés et proportions du point de rupture de N1 recalculés, tests
  d'indépendance et de période ajoutés. Reste : rien.
- **mask-personal-data-in-chat** — motif international E.164 ajouté, IBAN lu en
  majuscules seules, clôture de code décodée en N3, titre anglais et `need`
  ramenés aux coordonnées, N1 dit qu'il bloque au lieu de masquer, deux
  marquages retirés. Reste : rien.
- **extract-dates-from-text** — mois abrégés lus, convention jour-mois tirée du
  document puis de l'appelant puis abstention (N0), N1 remplacé par un analyseur
  éprouvé (dateparser / chrono-node), référence obligatoire et égale à la date
  du document en N1 et N3, deux marquages retirés. Reste : rien.
- **parse-address-into-fields** — dictionnaire de compléments dans N0, verdict
  ramené à N0, essai refait sur N0, régression de N1 écrite dans son point de
  rupture, géocodeur de la Géoplateforme nommé et sourcé, plafond de N2 expliqué,
  adaptateur N3 testé. Reste : rien.
- **tag-articles-by-topic** — suite remise au vert (bornes de temps à marge de
  dix, latence de N0 déclarée `~10 ms`), plancher dans `tag` pour l'article
  multi-thèmes, cinq marquages retirés, `lemmatise` renommé, adaptateur N3
  testé. Reste : rien.
- **fuzzy-match-company-names** — deux pharmacies en tête du point de rupture de
  N0, abréviations du registre développées, diacritiques latins seuls, forme
  juridique retirée aux seules places où elle s'écrit, SIREN et répertoire Sirene
  entrés dans le scénario et le verdict, N2 passé en indisponible faute de
  preuve, deux marquages retirés. Reste : rien.
- **add-autocomplete-to-a-search-bar** — préfixe vide retiré du comptage des
  clics, point de rupture de N1 réécrit sur le clic isolé et le biais de
  position, « ẞ » replié, un marquage retiré. Reste : rien.
- **rank-products-by-relevance** — N1 n'apparie plus qu'un clic aux produits
  montrés au-dessus (Click > Skip Above), une donnée de gestion hors échelle est
  ramenée et signalée au lieu de faire tomber la page, pondérations et signaux
  contrôlés à l'identique dans les deux langages, quatre marquages retirés.
  Reste : rien.
- **detect-anomalies-in-metrics** — `episodes` ajouté (persistance et
  regroupement), taux de fausses alertes dit dans le verdict et borné par un
  test, série construite où N0 se tait et N1 parle, six marquages retirés.
  Reste : rien.
