# Lot 18 — corriger les dix-neuf fiches refusées

Dix-neuf fiches refusées au lot 17, dix-neuf fiches corrigées, chacune en trois
temps : corriger, retester, relire l'avis en main. Une fiche par commit,
vingt-trois commits sur `lot18-corriger`, une trace par fiche dans
`docs/lot18/verifications/<id>.md` et une ligne par étape dans
`docs/lot18/ETAPES.md`.

Quatre contrôles ont été écrits avant la première correction et branchés sur
`npm run check` ; un cinquième, existant, a été étendu à la fin du lot. Ce sont
eux qui décident : une fiche n'est corrigée que quand ils passent sur elle.

---

## 1. Les dix-neuf fiches

L'état est celui du dépôt à la fin du lot : `corrigée` signifie que le motif de
refus est levé, que les tests l'affirment, et que `node scripts/test-snippets.mjs <id>`
passe dans les deux langages.

### Groupe A — les onze sorties fausses et silencieuses

| # | Fiche | Le motif | Ce qui a été corrigé | État |
|---|---|---|---|---|
| 5 | `check-a-file-is-really-the-format-it-claims` | `photo.jpeg` rendait `matches_claim: false`, et une liste blanche écrite `jpeg` n'autorisait aucun JPEG | les alias sont appliqués aux trois côtés — nom annoncé, format détecté, liste blanche ; T3 exercée des deux côtés de la table ; commentaire `HEAD` rectifié ; `except` nommé | corrigée |
| 7 | `repair-text-with-broken-encoding` | `ftfy` ne répare pas « ÃŽle-de-France » ni « Å'uvre », l'extrait JavaScript si, et la divergence n'était pas publiée | parité republiée sur mesure : trente-neuf accords sur quarante-sept, huit écarts en trois familles, dans les deux sens ; corpus produit par l'accident et non écrit à la main ; `lossy` rectifié | corrigée |
| 11 | `extract-product-data-from-a-shop-page` | le N3 réintroduisait l'effondrement d'expression régulière que le N0 évite ; `price` en flottant perdait les centimes | balayage linéaire au N3 comme au N0 (71,9 s → 0,001 s) ; plafond de balisage appliqué **avant** le nettoyage ; `price` rendu en chiffres des deux côtés | corrigée |
| 12 | `extract-main-content-from-a-web-page` | une brève de 125 caractères revenait avec « rien n'a été extrait : page construite par son JavaScript » | deux branches, deux raisons : « rien n'est sorti » et « ce qui est sorti est court, en voici la longueur » ; part de liens bornée à un ; test des limites réécrit à l'égalité stricte | corrigée |
| 13 | `extract-tables-from-a-pdf` | sur une facture sans filets, l'en-tête de page devenait des lignes du tableau | une ligne à moins de deux cellules remplies n'est pas une ligne du tableau, et son texte part dans `dropped_lines` : rien de lu n'est perdu ; le nom du niveau dit quel langage lit les filets | corrigée |
| 14 | `convert-a-pdf-to-plain-text` | une page de tableau ressortait transposée, en silence ; la docstring nommait des bibliothèques que le code n'appelle pas | au-delà de deux bandes, lecture dans l'ordre imprimé et `reason` qui le dit ; `min_gutter` réglable ; césures comptées ; docstring rectifiée | corrigée |
| 15 | `extract-fields-from-a-log-line` | le motif syslog livré rejetait toutes les lignes d'un `/var/log/syslog` | priorité facultative dans le motif ; `%{QUOTED}` accepte l'échappement d'Apache ; `loose_pieces` nomme les morceaux qui coupent n'importe où ; l'exemple du point de rupture entre dans le test | corrigée |
| 16 | `extract-the-latest-reply-from-an-email-thread` | toute réponse plus courte que la ligne d'attribution était signalée et routée vers le niveau payant | la hauteur comparée est celle de la citation habillée, pas du texte écrit dessous ; « Oui. » passe ; « Le client a écrit : » ne coupe plus ; valeurs limites assertées | corrigée |
| 19 | `extract-people-and-companies-from-an-article` | « Après Renault », « Selon Le Monde », « Chez Boulanger » étaient rendus comme des noms | liste déclarée de mots d'ouverture de phrase, testée des deux côtés ; le mot mis de côté est compté et rendu | corrigée |
| 21 | `extract-metadata-from-a-file` | une partie de métadonnées illisible rendait « aucune métadonnée » | `unread_parts` nomme le XML mal formé et la partie au-dessus du plafond ; `XMLValidator` aligne le JavaScript sur le Python ; les parties se cherchent dans les dossiers d'ECMA-376 | corrigée |
| 25 | `estimate-the-cost-of-a-model-call` | le coût par appel était arrondi avant d'être multiplié : `decimals=2` rendait « 0,00 » pour cent mille appels | l'arithmétique est portée à neuf décimales de plus que la sortie, le total y est calculé, et seul ce qui est rendu est arrondi ; deux raisons pour deux `null` ; `source` ne dit plus « mixte » sur un compte nul | corrigée |

### Groupe B — les huit autres

| # | Fiche | Le motif | Ce qui a été corrigé | État |
|---|---|---|---|---|
| 2 | `check-bank-details-before-a-transfer` | « 0,6 % » et « 6 887 » : deux chiffres publiés que le dépôt ne produit pas | les trois chiffres republiés à leur valeur mesurée et assertés à l'égalité ; le test de la clé RIB porte enfin un numéro qui passe la clé ISO ; Monaco reçoit la clé que la fiche lui promettait | corrigée |
| 4 | `validate-an-email-address-without-sending-a-message` | l'algorithme de nettoyage du standard HTML appliqué à moitié ; l'essai affirmait une résolution DNS qu'il ne fait pas | l'algorithme appliqué en entier — saut de ligne retiré, tabulation verticale conservée — et l'expression du standard comparée à sa source par un test ; le libellé de l'essai dit ce qu'il sait | corrigée |
| 6 | `know-whether-a-pdf-needs-ocr` | le témoin de N1 était une page d'entraînement ; la marge par défaut refusait trois pages françaises ordinaires sur quatre | le témoin est hors du lot d'entraînement ; le corpus est écrit en français accentué ; la marge est calibrée sur quatre pages retenues et déclarée réglable ; `fit([])` refuse au lieu d'approuver tout | corrigée |
| 9 | `validate-an-api-payload-against-its-contract` | la clé du cache sérialisait le document OpenAPI à chaque requête : classe de latence fausse | le cache est indexé sur l'identité du document, pas sur son contenu ; la précédence des gabarits suit une règle écrite ; `error_count` documenté | corrigée |
| 10 | `check-a-password-against-a-policy` | `data_egress: none` sur un niveau qui appelle un service tiers ; panne du service jamais écrite ni testée | `data_egress: third-party` ; une panne revient en `blocklist-unavailable` au lieu de lever dans un chemin d'inscription ; plafond de longueur porté de 64 à 256 selon NIST SP 800-63B-4 | corrigée |
| 18 | `extract-key-terms-from-a-document` | sur une petite collection, le classement de N1 était une liste alphabétique de termes à égalité | départage par longueur du terme puis rang d'apparition ; `tied_at_cut` dit combien de termes restent à égalité ; un second corpus de documents courts entre dans le test comparatif | corrigée |
| 22 | `extract-a-table-from-a-web-page` | « mille, le maximum que la norme autorise » est faux pour `rowspan` (65 534) ; `rowspan="0"` décalait la grille | les deux plafonds de la norme au lieu d'un seul ; `rowspan="0"` couvre la fin du groupe ; une cellule après `</tr>` ouvre une ligne ; `capped` et `padded` disent ce que la grille doit au remplissage | corrigée |
| 23 | `extract-tracking-numbers-from-an-email` | « cette famille ne porte rien à vérifier » est faux pour UPS ; l'exemple du point de rupture manquait au test | la clé UPS est calculée et vérifiée sur l'exemple canonique du transporteur ; une raison par famille ; le numéro de téléphone cité par le point de rupture entre dans le message de test | corrigée |

---

## 2. Les contrôles

Le lot demandait trois contrôles. Cinq ont été écrits ou étendus : les trois
demandés, plus les deux autres que le § 3 de la synthèse propose et qui
tenaient dans la même journée. Chacun est branché sur `check:fast` et porte un
fichier de tests dans `tests/`.

Quatre d'entre eux portent un **fichier de dette** : l'état des cinquante
fiches publiées au jour où le contrôle est né. Un contrôle à dette échoue sur
toute violation **nouvelle**, et aussi sur toute ligne de dette **périmée** —
celle d'une fiche qui respecte désormais la règle. La liste ne peut donc que
diminuer, et aucune correction ne peut être oubliée dans le fichier.

| Contrôle | Ce qu'il vérifie | Ce qu'il a attrapé | Dette au départ → aujourd'hui |
|---|---|---|---|
| `check-longueur-rupture` | R11 : un `breaking_point` publié tient en deux phrases et soixante mots | 166 points de rupture en dépassement le jour de sa naissance, dont les trente et un du lot 17 ; vingt-cinq ont été réécrits pendant ce lot, sur douze fiches | 166 lignes / 41 fiches → **141 / 29** |
| `check-raisons` | R14 : toute chaîne rendue à l'appelant (`reason`, `why`, `evidence`, `skipped`, `source`, `strategy`) est citée mot pour mot par un test de la fiche | 22 fiches rendaient au moins une raison qu'aucun test ne lisait, dont cinq des six du § 3.1 — la sixième, la fiche 3, est acceptée et reste en dette | 22 fiches → **6** |
| `check-chiffres-tenus` | tout nombre publié dans le frontmatter d'une fiche apparaît dans un de ses tests | 9 fiches publiaient un nombre que rien ne tenait, dont les quatre du § 2.2 | 9 fiches → **4** |
| `check-egress` | un niveau qui ouvre une connexion ne déclare pas `data_egress: none` | la fiche 10, et elle seule ; deux classes d'adresses inertes sont documentées et exclues — espaces de noms XML, domaines réservés par la RFC 2606 | 1 fiche → **0** |
| `check-figures` (étendu) | un facteur de performance est un chiffre de performance, dans ses quatre écritures : `×55`, « 55 fois plus rapide », « divise par 55 », « divise par cinquante-cinq » | la fiche 8, acceptée, qui publiait « ×55 » et « ×6 000 » ; son verdict dit désormais son ordre de grandeur | sans dette — le dépôt est au vert |

### Ce qui n'a pas pu devenir un contrôle, et pourquoi

Deux propositions du § 3 ne sont pas automatisables et sont devenues des règles
de charte, avec la mention de ce qu'un contrôle ne saura pas vérifier :

- **§ 3.2, T3 étendue** — « quand le code porte un seuil, une table, une liste
  ou un plafond, le test porte une entrée de chaque côté, et une entrée qui n'y
  figure pas ». Un contrôle peut trouver les constantes ; il ne peut pas savoir
  si une donnée de test a été écrite avant ou après le code, et c'est là
  qu'est le défaut. La règle est dans `CHARTE-TESTS.md`, étendue comme proposé.
- **§ 3.3, les « dix entrées ordinaires »** — la seule trace possible de R1.
  Rien ne distingue une entrée copiée d'un vrai journal d'une entrée fabriquée
  pour la fiche : un contrôle ne verrait que dix chaînes de caractères. La
  section est donc obligatoire dans le relevé, et c'est la relecture qui la
  juge.

Les autres règles ajoutées aux chartes pendant ce lot : R14 dans
`CHARTE-REDACTION.md` avec sa contrepartie dans le périmètre de
`CHARTE-TESTS.md` ; la règle des nombres à côté de R12 ; la règle du facteur de
performance ; « un défaut trouvé sur un niveau est cherché sur tous les niveaux
de la même fiche » dans `CHARTE-TESTS.md` ; « un montant ne s'arrondit qu'une
fois, après la dernière agrégation » dans `CHARTE-EXTRAITS.md`.

---

## 3. Les chiffres corrigés

Chacun a été remesuré dans le dépôt, publié à la valeur mesurée, et asserté à
l'égalité stricte dans un test — jamais dans une fourchette.

| Fiche | La fiche disait | Le dépôt produit |
|---|---|---|
| 2 | « 0,6 % », « 6 887 essais », « cinq cents IBAN » | 31 refus sur 6 882 essais, soit **0,45 %** en Python ; 32 sur 6 892, **0,46 %** en JavaScript |
| 2 | « environ vingt mille » fautes d'un chiffre | **20 700** essais, zéro passe |
| 2 | transpositions voisines, effectif non publié | **1 973** essais en Python, **2 000** en JavaScript, zéro passe |
| 6 | seuil et scores mesurés sur des pages du lot d'entraînement | seuil **−2,98** ; témoin hors lot **−2,83** ; page anglaise **−3,25** ; tableau de montants **−4,10** ; page cassée **−4,14** |
| 9 | « divise le temps par neuf cents » | la mesure comparait deux choses différentes ; le facteur disparaît de la page. Mesuré sur un document de 127 Ko : **0,763 ms → 0,013 ms** par appel, et le rapport au poids du document passe de **14,0 à 1,03** |
| 11 | le N3 nettoyait un balisage hostile en **71,9 s** | **0,001 s**, par le même balayage linéaire que le N0 |
| 25 | cent mille appels à 36 rendaient **0,00** à deux décimales | **36,00** à deux décimales, **36,0000** à quatre, **36,000000** à six |
| 25 | seuil de bascule annoncé « environ 111 000 » | **111 112** |
| 23 | la clé UPS n'était pas calculée | somme pondérée **96** sur l'exemple canonique `1Z999AA10123456784`, d'où la clé **4** |
| 10 | plafond de longueur à **64** caractères | **256**, ce que demande NIST SP 800-63B-4 |
| 22 | « mille, le maximum que la norme autorise » | **1 000** pour `colspan`, **65 534** pour `rowspan` |
| 8 | « ×55 » et « ×6 000 » | deux ordres de grandeur en Python, davantage en JavaScript — le facteur n'est tenu par aucun test et dépend de la machine |

---

## 4. Les avis dont je me suis écarté

Quatre, chacun écrit dans la vérification de sa fiche.

1. **Fiche 5 — le plafond de taille d'archive (R8) n'a pas été ajouté.** Il a
   été écrit, puis retiré : au-dessus du plafond, Python rendrait `zip` là où
   JavaScript continue de rendre `docx`, puisqu'il ne lit jamais au-delà de
   l'en-tête. La fiche vend « les deux langages répondent la même chose » ;
   échanger cette garantie contre une borne mémoire aurait ouvert un défaut
   pour en fermer un autre. La borne est dite à l'appelant, dans le
   commentaire, avec ce qu'il doit faire.

2. **Fiche 7 — l'exemple « Ïambe » de l'avis n'est pas reproductible tel
   quel** sur `ftfy` 6.3.1 : la chaîne écrite dans l'avis ne produit pas la
   destruction annoncée. La famille qu'elle illustre, elle, existe : elle est
   publiée avec un exemple mesuré dans le dépôt, et les huit écarts sont listés
   dans les deux sens.

3. **Fiche 13 — les lignes écartées sont listées, pas comptées.** L'avis
   propose de les compter. La première version comptait, et faisait disparaître
   la seconde moitié d'une désignation repliée : une règle écrite pour empêcher
   une donnée fausse en faisait perdre une vraie. `dropped_lines` porte le
   texte de chaque ligne écartée.

4. **Fiche 14 — le second signal proposé pour reconnaître un tableau a été
   retiré.** L'avis propose « plus de deux bandes **ou** des bandes faites de
   lignes courtes ». Le second a été écrit, mesuré, retiré : le nombre de mots
   d'une ligne dépend du découpage de l'extracteur, et le test de parité a
   divergé aussitôt sur une page à deux colonnes de prose. Le compte de bandes
   vient de la géométrie et vaut des deux côtés. Le résidu — un tableau de
   deux colonnes exactement est toujours lu comme deux colonnes — est la
   **première** phrase du point de rupture.

Un cinquième écart est de forme : **fiche 12**, la raison du cas vide garde
« may be built by its own JavaScript », qui est une cause supposée et que R14,
écrite par ce même lot, décourage. Elle est conservée parce que l'avis la
prescrit mot pour mot, parce que le verbe reste au conditionnel, et parce
qu'elle ne s'applique plus qu'au cas où rien n'est sorti.

---

## 5. Ce qui reste ouvert

- **Fiche 13, `if ruled: … continue`.** Un encadré décoratif autour d'un titre
  produit un tableau d'une cellule en `strategy: lines`, et le vrai tableau
  sans filets de la même page n'est alors jamais lu. Corriger demanderait de
  décider quand une lecture tracée est « assez bonne » pour dispenser de
  l'autre — un second seuil sur une page dont on ne sait rien, c'est-à-dire le
  genre de verdict que cette fiche existe pour refuser. Le cas est connu, non
  traité, et il n'est pas silencieux : il est dans la vérification de la fiche.
- **Fiche 8, remarque 1 de son avis.** « 1 234,56 » est rangé parmi les dix
  mille montants de 0,00 à 99,99, où il n'est pas. La valeur est bien refusée ;
  c'est la phrase qui la situe mal. La fiche est acceptée et hors du périmètre
  de ce lot ; seul son facteur de performance a été touché, parce qu'un
  contrôle de ce lot le refusait.
- **Les dettes restantes**, qui ne concernent que des fiches hors du périmètre
  des dix-neuf — dont la fiche 3, acceptée, dont le § 3.1 relève pourtant une
  raison qui accuse le numéro là où le code refuse le code région :
  141 points de rupture sur 29 fiches dépassent encore R11 ; 6 fiches rendent
  une raison qu'aucun test ne lit ; 4 fiches publient un nombre que rien ne
  tient. Les trois fichiers ne peuvent que décroître.
- **Le relevé « dix entrées ordinaires »** n'existe encore pour aucune fiche du
  catalogue : la règle a été écrite pendant ce lot, elle vaut pour les fiches à
  venir, et les dix-neuf corrections ont fait le travail équivalent sans en
  produire la section.
