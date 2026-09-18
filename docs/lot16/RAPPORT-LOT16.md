# Lot 16 — rapport de correction des vingt-quatre fiches refusées

Le relecteur avait lu vingt-cinq fiches, en avait accepté une —
`generate-placeholder-images` — et refusé vingt-quatre. Ce lot les reprend une
par une : corriger, retester, relire. Les vingt-quatre sont levées.

À l'arrivée : `npm run check:fast` vert, `node scripts/test-snippets.mjs` vert
sur les **146 extraits** du dépôt, plus aucun marquage `INFIRMÉ`, `DÉFAUT` ou
`xfail` sur une fiche publiée, et les **32 adaptateurs N3** du catalogue
exercés contre le double du harnais. Le catalogue compte **25 fiches publiées**
et plus aucun brouillon, pour **73 niveaux disponibles** (45 exécutés, 28
doublés).

Le détail fiche par fiche est dans `docs/lot16/verifications/<id>.md` : motifs de
refus, ce qui a été fait pour chacun, et la preuve — la commande lancée et ce
qu'elle a répondu. Le journal d'avancement est dans `docs/lot16/ETAPES.md`.

---

## 1. Les vingt-quatre fiches

| Fiche | Motifs du refus | Ce qui a été corrigé | État |
|---|---|---|---|
| `convert-messy-csv-to-clean-data` | virgule lue comme décimale sans journal ; marquages | marque décimale déclarée par l'appelant ou ambiguïté rejetée au journal ; six marquages levés ; adaptateur N3 testé | levée |
| `find-duplicate-records` | enregistrement comparé en bloc ; une seule clé de blocage ; coût de N2 | comparaison champ par champ et pondérée, colonnes triées, plusieurs clés réunies, produits scalaires en une multiplication | levée |
| `generate-test-data` | haché sans finalisation, colonnes anticorrélées | `fmix32` en N0 et N1, jeux figés recalculés, tests d'indépendance et de période | levée |
| `mask-personal-data-in-chat` | seuls les numéros français masqués ; IBAN fantôme ; titre anglais | motif E.164, IBAN en majuscules seules, clôture décodée en N3, titre et `need` ramenés aux coordonnées | levée |
| `extract-dates-from-text` | mois abrégés jamais lus ; convention jour-mois implicite | mois abrégés, convention tirée du document puis de l'appelant puis abstention ; N1 remplacé par `dateparser` / `chrono-node` ; référence obligatoire | levée |
| `parse-address-into-fields` | N1 cassait sur les adresses ordinaires ; géocodeur ignoré | compléments traités en N0, verdict ramené à N0, essai refait, Géoplateforme nommée et sourcée | levée |
| `tag-articles-by-topic` | suite rouge ; bornes de temps serrées ; article multi-thèmes | bornes à marge de dix, latence de N0 corrigée, plancher pour l'article multi-thèmes, cinq marquages levés | levée |
| `fuzzy-match-company-names` | point de rupture sur le sigle alors que l'ordinaire cassait avant | deux pharmacies en tête du point de rupture, abréviations développées, SIREN entré dans le verdict, N2 fermé faute de preuve | levée |
| `add-autocomplete-to-a-search-bar` | « sûr sur un journal encore mince » était faux | préfixe vide retiré du comptage, point de rupture réécrit sur le clic isolé et le biais de position | levée |
| `rank-products-by-relevance` | N1 apprenait sur des produits jamais vus ; une marge négative faisait tomber la page | Click > Skip Above, donnée hors échelle ramenée et signalée, quatre marquages levés | levée |
| `detect-anomalies-in-metrics` | dix à quinze réveils par jour sur une métrique saine | `episodes` (persistance, regroupement), taux dit dans le verdict et borné par un test | levée |
| `forecast-weekly-sales` | verdict contredit par les séries de la fiche ; série « vérité » de la forme du modèle | verdict réécrit sur trois mesures, test comparatif N0/N1, série témoin hors de la forme du modèle | levée |
| `detect-language-of-text` | l'écart de N0 donné pour un signal d'erreur ; N2 fermé sans raison ; plafond inutile en N3 | verdict réécrit sur le message bilingue, N2 ouvert sur CLD3, `MAX_CHARACTERS` supprimé | levée |
| `summarise-a-long-document` | N3 refusait le document long que le verdict promettait ; N2 anglais seulement | plafond dérivé de la fenêtre réelle et devenu paramètre ; langue de N2 dite partout ; adaptateur testé | levée |
| `write-product-descriptions` | non-déterminisme compté comme un prix permanent ; N2 sans modèle nommé | cycle de vie de la copie dit, BARThez nommé et sourcé, quatre marquages levés | levée |
| `moderate-user-comments` | modèle anglais seulement ; N3 payait ce qui est gratuit ; quatre défauts vivants | deux couples modèle-étiquettes publiés, catégorie propre ajoutée à N3, repli de casse, marques non latines, formulaire vide, clôture | levée |
| `extract-fields-from-invoice` | la réforme ignorée ; N2 inexécutable ; marquages | N0 lit le fichier structuré (UBL, CII, Factur-X) avec BR-CO-15, N2 fermé, verdict à N0, fiche publiée | levée |
| `read-text-from-a-scanned-page` | lecteur PDF maison mis en échec par un export de traitement de texte | N0 refondé sur `pypdf` / `pdf.js`, tests sur deux documents réels, point de rupture ramené à deux phrases | levée |
| `search-in-your-own-documents` | clôture décodée trop largement ; cache empoisonné en JavaScript | décodage strict dans les deux langages, copie du cache avant validation | levée |
| `translate-interface-strings` | correspondance exacte notée contre toute la mémoire ; borne de temps serrée | index des clés exactes, borne d'effondrement, quatre marquages levés, adaptateur testé | levée |
| `detect-spam-in-contact-form` | délai de soumission non signé ; marquages ; adaptateur | horodatage signé par le serveur et vérifié, pot de miel masqué en CSS, adaptateur testé | levée |
| `validate-a-form-server-side` | blancs de bord comptés ; parité des motifs marquée | nettoyage avant contrôle, point de rupture sur les caractères de largeur nulle, parité démontrée | levée |
| `route-support-tickets` | quatre marquages ; adaptateur ; plafond qui levait | marquages levés, adaptateur testé, ticket long tronqué plutôt que refusé | levée |
| `show-similar-articles` | neuf marquages ; sources absentes | neuf démonstrations, trois sources vérifiées, écart 128/512 dit comme un piège | levée |

---

## 2. Ce qui a changé dans le code, et pourquoi

Les corrections de fond, hors réécriture de tests. Chacune répare un
comportement, pas une phrase.

**Sorties fausses et silencieuses.** `convert-messy-csv` refusait de lire
`12,500` et rendait `12.5` sans rien dire : la marque décimale se déclare
désormais, et l'ambiguïté part au journal. `generate-test-data` tirait des
colonnes anticorrélées faute de finaliser son haché : `fmix32` est ajouté dans
les deux langages, et deux tests mesurent l'indépendance. `mask-personal-data`
laissait passer `+32 470 12 34 56` et prenait une phrase pour un IBAN.
`extract-dates` ne lisait aucun mois abrégé. `rank-products` faisait tomber une
page entière sur une seule marge négative.

**Décisions apprises sur les mauvaises données.** `add-autocomplete` laissait un
clic isolé commander tous les préfixes ; `rank-products` apprenait à partir de
produits que personne n'avait vus — remplacé par *Click > Skip Above*, où un
clic ne se compare qu'à ce qui était affiché au-dessus.

**Réveils.** `detect-anomalies` promettait de ne réveiller que sur un incident
et sonnait dix fois par jour : `episodes` exige une persistance et regroupe, et
le taux mesuré est écrit dans le verdict.

**Plafonds.** Trois fiches levaient là où il ne fallait pas.
`detect-language-of-text` refusait un courriel de huit mille caractères alors
qu'il n'en envoie que six cents : plafond supprimé. `summarise-a-long-document`
refusait le document long qui est son besoin même : le plafond devient celui de
l'appelant, et son défaut est dérivé de la fenêtre réelle du modèle.
`route-support-tickets` refusait un ticket long : il le tronque et le route,
parce qu'un routeur qui lève laisse le ticket nulle part.

**Sécurité.** `detect-spam` recevait le délai de soumission en argument sans
dire d'où il vient : le serveur l'émet, le signe (HMAC-SHA256) et le revérifie,
et six formes de jeton trafiqué comptent pour « trop rapide ».
`validate-a-form` comptait les espaces de bord, si bien qu'un champ obligatoire
rempli de deux espaces passait pour rempli.

**Exploitation.** `search-in-your-own-documents` écrivait un vecteur dans le
cache avant de le valider : un `NaN` passager rendait une page introuvable
jusqu'au redémarrage. `translate-interface-strings` notait une chaîne inchangée
contre toute la mémoire : deux cents chaînes passaient de 1,8 s à 0,7 ms.
`read-text-from-a-scanned-page` chargeait son propre lecteur de flux PDF, cent
quatre-vingts lignes qui échouaient sur l'export d'un traitement de texte.
`moderate-user-comments` notait 0,71 un formulaire vide, et son repli de casse
laissait passer les capitales de compatibilité.

**Décodage des réponses de modèle.** Quatre fiches lisaient une clôture de code
trop largement — prose après le bloc, clôture jamais refermée — et acceptaient
ce qu'elles auraient dû redemander. La forme stricte est maintenant la même
partout : une seule clôture qui enveloppe toute la réponse.

---

## 3. Les outils standard entrés dans l'échelle

La décision du commanditaire — « l'outil standard entre dans l'échelle » — a
déplacé six niveaux.

| Fiche | Outil entré | Ce qu'il remplace |
|---|---|---|
| `extract-dates-from-text` | `dateparser` 1.2.2 / `chrono-node` 2.9.0 | un analyseur de dates maison en N1 |
| `read-text-from-a-scanned-page` | `pypdf` 6.1.3 / `pdfjs-dist` 5.4.149 | un lecteur de flux PDF de 180 lignes écrit à la main |
| `extract-fields-from-invoice` | le fichier structuré UBL/CII/Factur-X, lu avec `xml.etree` / `fast-xml-parser` 5.2.5 | l'extraction par expressions régulières comme premier geste |
| `detect-language-of-text` | CLD3 (`gcld3` / `cld3-asm`) en N2 | un renvoi direct vers un modèle généraliste |
| `parse-address-into-fields` | le géocodeur de la Géoplateforme, nommé et sourcé | l'idée qu'il n'y a rien entre la règle et le modèle |
| `fuzzy-match-company-names` | le SIREN et le répertoire Sirene | le rapprochement par similarité de nom seule |

Deux niveaux ont été **fermés** faute d'outil publiable :
`fuzzy-match-company-names` N2 (aucune mesure ne soutenait le gain annoncé) et
`extract-fields-from-invoice` N2 (point de contrôle non affiné, licence non
commerciale, rien d'équivalent en JavaScript). Un extrait qui ne tourne pas n'a
pas sa place sur l'échelle.

---

## 4. La fiche facture, réécrite autour de la réforme

C'était la seconde décision du commanditaire, et la plus lourde.

**Ce que la réforme change.** Depuis le 1er septembre 2026, toute entreprise
établie en France doit pouvoir **recevoir** ses factures sous format
électronique structuré, par une plateforme agréée. Le premier geste d'un
traitement de factures n'est donc plus une expression régulière sur le texte
d'un PDF : c'est de lire le XML quand il est là. Ce qui reste à extraire est un
résidu — fournisseurs hors de France, tickets de caisse, arriéré, factures
d'avant la réforme — et ce résidu se réduit.

**Ce qui a été écrit.** Le niveau N0 a deux portes et une règle : il lit le
fichier structuré quand on lui en donne un, le texte de la page sinon, et il
**dit par quelle porte la réponse est passée**. Sur la porte structurée, il lit
les deux syntaxes du socle par le couple (parent, enfant) des noms locaux, ce
qui évite une page de déclarations d'espaces de noms, et il vérifie la règle
BR-CO-15 de la norme — total TTC = total HT + TVA — avec trois états : vrai,
faux, et indécidable quand la facture ne porte pas les trois montants. Le niveau
N3 demande désormais les trois montants lui aussi, et recalcule la même règle
sur ce que le modèle écrit. Le verdict passe de N2 à N0, et la fiche sort du
brouillon.

**Les sources, vérifiées à la source et citées dans la fiche.**

- Foire aux questions « Je découvre la facturation électronique » d'impots.gouv.fr,
  version du 01/09/2026, question 5.1 : « Depuis le 1er septembre 2026, toutes
  les entreprises, quelles que soient leur taille et leur forme juridique, ont
  l'obligation de recevoir des factures sous format électronique, par
  l'intermédiaire d'une plateforme agréée » ; les grandes entreprises et les ETI
  doivent également les émettre, les petites, moyennes et micro-entreprises « au
  plus tard le 1er septembre 2027 ».
- Dossier de spécifications externes de la facturation électronique v3.2
  (30/04/2026), section 2 : « le respect du socle minimum de formats reposant
  sur des standards sémantiques et syntaxiques respectant la norme européenne
  EN16931 pour faciliter les échanges : UBL, CII et Factur-X ».
- Annexe 1 du même dossier, pour les chemins CII de BT-1, BT-2, BT-109 et
  BT-110, repris en commentaire de l'extrait.
- Annexe 7 « Règles de gestion » v1.9, règle BR-CO-15 : « Montant total de la
  facture TVA comprise (BT-112) = Montant total de la facture hors TVA (BT-109)
  + Montant total de TVA de la facture (BT-110) » ; la même annexe note qu'« en
  profil extended, la règle BR-CO-15 ne s'applique pas », ce que la docstring
  répercute.

---

## 5. Les avis dont ce lot s'écarte, et pourquoi

Quatre divergences, toutes écrites dans la vérification de la fiche concernée.

**`forecast-weekly-sales`.** L'avis proposait de remplacer les moindres carrés
de N1 par un lissage exponentiel. Mesuré, `statsmodels` le confirme : 1 %
d'erreur sur les deux séries, contre +28 % pour N1 sur l'une. Le niveau n'a
pourtant pas changé, pour une raison de forme : chaque niveau de ce site
s'écrit dans les deux langages, et il n'existe pas d'équivalent de
`ExponentialSmoothing` en JavaScript ; une réimplémentation par recherche sur
grille, essayée, tombe à −13 %. La fiche garde donc les moindres carrés, publie
les trois mesures, et envoie le lecteur au lissage exponentiel dans le verdict
et dans les sources.

**`summarise-a-long-document`.** L'avis demandait des points de rupture de N0 et
N1 en deux phrases. Ils en font quatre, et n'ont pas été raccourcis davantage :
chacune porte un fait mesuré — la phrase la moins bien notée des onze, tombée la
première même quand on en demande huit ; la phrase retenue pour ses quatre
signes alors qu'elle annonce une commande de porte-blocs. Les fondre retirerait
la mesure, pas des mots.

**`extract-fields-from-invoice`.** L'avis suggérait de vérifier l'exemple de
l'indemnité forfaitaire de recouvrement « sur deux ou trois gabarits réels ».
Cela demande des factures réelles que ce lot n'a pas. La fiche n'affirme pas que
la mention est toujours seule sur sa ligne ; le test montre ce que le
classifieur fait quand elle l'est.

**`route-support-tickets`.** L'avis proposait « suivi » attrape « suivant »
comme exemple de la frontière à gauche. Vérifié : « suivant » ne commence pas
par « suivi ». Trois exemples exacts les remplacent — « panne » attrape
« panneau », « retard » attrape « retardataire », « devis » attrape « devise ».

---

## 6. Ce qui reste ouvert

- **`detect-language-of-text` N2** : aucun test ne mesure la justesse de CLD3,
  qui n'est pas installé. Les deux fichiers le disent en tête, et la fiche ne
  l'affirme nulle part.
- **`summarise-a-long-document` N2** : il n'existe pas, dans les deux langages,
  de modèle de résumé multilingue sous licence commerciale. Le seul équivalent
  courant, mT5 affiné sur XL-Sum, est sous licence non commerciale, et c'est dit.
- **`write-product-descriptions` N2** : la taille du corpus de préentraînement
  de BARThez, publiée par son auteur, n'est pas reprise — `check-figures` refuse
  une taille en octets sans mesure faite ici. La phrase se tient sans elle.
- **`extract-fields-from-invoice` N2** : fermé. Il se rouvrira le jour où un
  point de contrôle de compréhension de document affiné sur des factures sera
  publié sous licence commerciale et lisible dans les deux langages.
- **`fuzzy-match-company-names` N2** : fermé de la même façon, faute de mesure
  qui soutienne le gain.
- **Les extraits qui dépassent quarante lignes** : les adaptateurs N3 imposés
  portent plusieurs fichiers au-delà de la limite de la charte des extraits.
  C'est signalé depuis le lot précédent ; la charte devrait dire si l'adaptateur
  commun compte dans la limite.

---

## 7. Ce que les chartes ont gagné

Les vingt et une règles tirées de la relecture vivaient dans une synthèse que
personne ne lit en écrivant une fiche. Elles sont désormais dans les chartes,
chacune avec le cas réel qui l'a fait naître.

**`docs/sprints/CHARTE-REDACTION.md`** reçoit treize règles, R1 à R13 :
l'extrait passé sur l'entrée ordinaire du lecteur avant d'écrire le point de
rupture ; la sortie fausse et silencieuse qui se corrige ou se dit en premier ;
l'outil standard nommé avant d'en écrire un ; le verdict confronté aux données
de la fiche ; le défaut réparable qui n'est pas une limite ; le modèle nommé qui
doit servir la langue du lecteur ; les réglages par défaut jugés en conditions
d'exploitation ; le plafond qui dégrade au lieu de lever ; le cycle de vie réel
de la sortie ; le contrôle de sécurité qui dit d'où vient sa valeur ; le point
de rupture en deux phrases ; les sources qui portent tout ce qui a été vérifié ;
le titre anglais qui décrit le même besoin. Les sections « point de rupture » et
« sources » du champ par champ sont réécrites en conséquence.

**`docs/sprints/CHARTE-TESTS.md`** reçoit huit règles, T1 à T8, et deux d'entre
elles ne se relisent plus : elles se vérifient.

- `scripts/check-marquages.mjs` échoue si un test d'une fiche `published` porte
  `xfail`, `INFIRMÉ` ou `DÉFAUT`. Un brouillon a le droit d'en porter.
- `scripts/check-adaptateur.mjs` échoue si un extrait N3 publié dont
  l'adaptateur est nommé n'est construit par aucun test.

Les deux sont enchaînés dans `npm run check:fast`, donc dans `npm run check`, et
`check-chain` vérifie qu'aucune étape n'est orpheline. Le tableau des cas de
production obligatoires gagne la ligne qui manquait — l'entrée ordinaire de la
population visée — et la consigne sur les bornes de temps devient « marge de
dix, sans exception ».
