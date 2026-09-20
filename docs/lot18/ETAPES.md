# Lot 18 — étapes

Une ligne par contrôle écrit et par fiche corrigée, dans l'ordre où elles ont
été commitées.

| # | Objet | Ce qui a été fait |
|---|---|---|
| 1 | `check-longueur-rupture` | R11 (deux phrases, soixante mots) devient un contrôle ; dette de 166 lignes déclarée, décroissante |
| 2 | `check-raisons` | R14 : toute raison rendue par le code (`reason`, `why`, `evidence`, `skipped`, `source`, `strategy`) est citée mot pour mot par un test ; dette de 22 fiches, décroissante |
| 3 | `check-chiffres-tenus` | tout nombre publié dans le frontmatter apparaît dans un test de la fiche ; dette de 9 fiches, décroissante |
| 4 | `check-egress` | un extrait qui ouvre une connexion ne déclare pas `data_egress: none` ; dette d'une fiche, à vider dans ce lot |
| 5 | fiche 5 `check-a-file-is-really-the-format-it-claims` | alias appliqués aux trois côtés : `photo.jpeg` et une liste blanche écrite `jpeg` concordent ; T3 exercée ; commentaire `HEAD` rectifié ; `except` nommé ; R11 |
| 6 | fiche 7 `repair-text-with-broken-encoding` | parité republiée : 39 accords sur 47, huit écarts en trois familles, dans les deux sens ; corpus produit par l'accident et non écrit à la main ; `lossy` rectifié ; table de 256 octets tenue par un test ; R11 |
| 7 | fiche 11 `extract-product-data-from-a-shop-page` | le N3 ne réintroduit plus l'effondrement du N0 (71,9 s → 0,001 s) ; plafond de balisage appliqué avant le nettoyage ; `price` en chiffres, centimes conservés des deux côtés ; `offers` et `gtin_key` nommés ; R11 |
| 8 | fiche 12 `extract-main-content-from-a-web-page` | deux branches, deux raisons : une brève de 125 caractères n'est plus déclarée « construite par son JavaScript » ; test des limites réécrit à l'égalité stricte ; part de liens bornée à un |
| 9 | fiche 13 `extract-tables-from-a-pdf` | sur une facture sans filets, le bloc adresse n'est plus une ligne du tableau : les lignes à moins de deux cellules remplies sont nommées dans `dropped_lines` ; le nom du niveau dit quel langage lit les filets ; R11 |
| 10 | fiche 14 `convert-a-pdf-to-plain-text` | une page de tableau n'est plus transposée en silence : au-delà de deux bandes, lecture dans l'ordre imprimé et `reason` qui le dit ; `pypdf`/`pdftotext` ne sont plus présentés comme appelés ; `min_gutter` réglable ; césures comptées ; R11 |
| 11 | fiche 15 `extract-fields-from-a-log-line` | le motif syslog lit enfin /var/log/syslog (priorité facultative) ; le point de rupture dit les deux morceaux relâchés qu'il relâche vraiment ; `%{QUOTED}` accepte l'échappement d'Apache ; `loose_pieces` nomme les morceaux qui coupent n'importe où ; R11 |
| 12 | fiche 16 `extract-the-latest-reply-from-an-email-thread` | « Oui. » n'est plus signalée comme écrite sous la citation ni routée vers le niveau payant : l'attribution est l'habillage de la citation, pas du texte écrit dessous ; valeurs limites assertées ; « Le client a écrit : » ne coupe plus ; R11 |
| 13 | fiche 19 `extract-people-and-companies-from-an-article` | « Après Renault » rend Renault, « Selon Le Monde » rend Le Monde : une liste déclarée de mots d'ouverture, et le mot mis de côté est compté ; la référence de produit est nommée dans la docstring ; R11 sur les deux points de rupture |
