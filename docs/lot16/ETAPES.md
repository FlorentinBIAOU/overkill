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

**Point d'étape groupe 1 — onze fiches sur onze.** `npm run check:fast` au vert
(chaîne, contenu, schéma, harnais, routes, couleurs, illustrations, figures,
polices, contrastes, français, construction, liens, référencement, poids).
Deux dépendances sont entrées dans le dépôt pour l'échelle de
`extract-dates-from-text` : `dateparser==1.2.2` (Python) et `chrono-node` 2.9.0
(JavaScript, en `devDependencies`). Le niveau N2 de `fuzzy-match-company-names`
est passé en indisponible et ses extraits supprimés ; le manifeste est
régénéré.

## Groupe 2 — verdict contredit, modèle inadapté, réforme

- **forecast-weekly-sales** — verdict réécrit sur les trois mesures (croissance,
  changement de niveau, pic de Noël), test comparatif N0/N1 ajouté dans les deux
  langages, série témoin hors de la forme du modèle, saison fractionnaire,
  lissage exponentiel nommé et mesuré en sources. Reste : le lissage exponentiel
  n'est pas devenu un niveau — raison écrite dans la vérification.
- **detect-language-of-text** — verdict réécrit sur le message bilingue, l'échec
  commun aux deux niveaux sur « chat » dit en toutes lettres, `escalate_when` de
  N0 porté sur la longueur des textes et non sur l'écart ; **N2 ouvert** sur
  CLD3 (`gcld3` / `cld3-asm`, doublés, plancher de 140 octets et plafond de 700
  lus dans l'en-tête de la bibliothèque, licence Apache 2.0 et dépôt archivé dits
  dans le périmètre réglementaire) ; `MAX_CHARACTERS` supprimé de N3 dans les
  deux langages, remplacé par un test de cent mille caractères qui vérifie que
  seul l'extrait part ; réessai de N3 qui ne rattrape plus les erreurs de
  programmation. Reste : aucun test ne mesure la justesse de CLD3, et les deux
  fichiers le disent en tête.
- **summarise-a-long-document** — plafond de N3 relevé à la fenêtre réelle du
  modèle d'exemple (1 047 576 jetons, vérifiée chez le fournisseur) et devenu un
  paramètre refusé avant l'appel, avec le test du rapport de cinquante pages en
  un appel ; N2 dit enfin qu'il ne résume que l'anglais, fiche du modèle à
  l'appui, et le verdict en tire la conséquence pour un lecteur francophone ;
  trois marquages `INFIRMÉ` périmés remplacés par la démonstration de la
  nouvelle docstring, adaptateur N3 exercé contre le double du harnais.
  Reste : aucun modèle de résumé multilingue n'est proposé en N2 — celui qui
  couvre le français est sous licence non commerciale, et c'est dit.
- **write-product-descriptions** — le non-déterminisme n'est plus donné pour un
  prix permanent : la copie se génère une fois, se stocke et se versionne, et
  c'est la régénération qui relance la relecture ; N2 nomme enfin son point de
  départ (BARThez, français, Apache 2.0, 165 M de paramètres, lu sur sa fiche) et
  dit que l'affinage n'est pas dans le fichier ; deux marquages périmés réécrits
  sur le chiffre actuel, adaptateur N3 exercé contre le double du harnais,
  température comprise. Reste : la taille du corpus de préentraînement publiée
  par le modèle n'est pas reprise, `check-figures` refusant une taille en octets
  sans mesure faite ici.
- **moderate-user-comments** — N2 publie deux couples modèle-étiquettes et dit
  que celui de la page ne note que l'anglais, le multilingue vérifié sur sa fiche
  (quatorze langues, une seule étiquette, licence openrail++) ; N3 gagne la
  catégorie que personne d'autre n'a — la divulgation d'un domicile — et dit
  qu'ailleurs le point d'accès de modération du fournisseur est gratuit ; quatre
  marquages vivants réparés : ordre NFKD/repli de casse, marques non latines
  gardées dans les mots, commentaire d'espaces qui notait 0,71 en JavaScript,
  clôture ```json décodée. Reste : le couple multilingue perd le détail des
  nuisances, et c'est dit dans le point de rupture.
- **extract-fields-from-invoice** — fiche réécrite autour de la réforme :
  N0 lit le fichier structuré (UBL, CII, Factur-X) avec la règle BR-CO-15 de la
  norme, et ne tombe dans l'extraction par libellés que pour le résidu, en disant
  par quelle porte la réponse est passée ; dates, obligations et formats vérifiés
  mot pour mot sur impots.gouv.fr et cités ; N2 fermé (point de contrôle non
  affiné, licence non commerciale, rien d'équivalent en JavaScript) et ses quatre
  fichiers supprimés ; verdict passé de N2 à N0 et la fiche sort du brouillon ;
  N3 demande les trois montants et recalcule la même règle sur ce que le modèle
  écrit ; cinq marquages levés et l'adaptateur N3 exercé. `fast-xml-parser`
  5.2.5 entre en dépendance de développement, Node n'ayant pas d'analyseur XML.
  Reste : l'exemple de l'indemnité forfaitaire n'a pas été vérifié sur des
  gabarits réels, faute de factures réelles.
