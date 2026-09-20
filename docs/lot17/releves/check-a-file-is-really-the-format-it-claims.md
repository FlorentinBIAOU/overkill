# check-a-file-is-really-the-format-it-claims — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « un CSV, un JSON, un SVG et une note en clair […] non reconnus — donc non autorisés » | démontrée | test_point_de_rupture_un_fichier_texte_na_pas_de_signature_a_lire |
| 2 | N0 breaking_point | « le témoin : sur un PNG, un JPEG, un GIF, un PDF, un ZIP, un DOCX, un XLSX et un ODT, le bon type revient » | démontrée | test_point_de_rupture_temoin_les_formats_binaires_sont_bien_reconnus |
| 3 | N0 docstring, scénario, verdict | « they are a claim, not a fact » (le nom de fichier ne décide jamais) | démontrée | test_le_nom_du_fichier_ne_decide_jamais |
| 4 | N0 docstring, verdict | « Twelve lines of `zipfile` read the archive the same way » | démontrée | test_les_conteneurs_zip_sont_distingues_en_ouvrant_larchive, test_un_docx_nest_pas_autorise_par_une_liste_qui_nautorise_que_zip |
| 5 | N0 docstring | « an unrecognised file is never allowed by default » | démontrée | test_un_fichier_non_reconnu_nest_jamais_autorise |
| 6 | N0 commentaire | « a hundred null bytes come back from `puremagic` as a Compucon-Singer embroidery design » | démontrée | test_python_et_javascript_rendent_le_meme_rapport (le cas « nuls » sort non reconnu des deux côtés grâce à la liste KNOWN) |
| 7 | N0 commentaire | « `puremagic` calls a PNG on its eight-byte signature, `file-type` wants the sixteen » | démontrée | test_production_valeurs_aux_limites |
| 8 | Essai, why | « un polyglotte passe comme son format d’ouverture » | démontrée | test_un_fichier_a_deux_signatures_est_lu_comme_sa_premiere |
| 9 | Les deux langages | la fiche montre deux extraits, elle affirme la même chose des deux | démontrée | test_python_et_javascript_rendent_le_meme_rapport (20 fichiers) |
| 10 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 11 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Vingt mille lectures d’un PNG de quarante-huit octets sur la machine de
travail : **0,207 ms par fichier en Python, 0,0158 ms en JavaScript**. La
classe affichée est `<1 ms`. Le test ne garde qu’une borne d’effondrement — dix
mille lectures en moins de vingt secondes, soit une marge de dix sur la mesure
Python (T7).

## Trois divergences entre les deux bibliothèques, fermées dans l’extrait

1. **Les conteneurs ZIP.** `file-type` ouvre l’archive et distingue
   .docx / .xlsx / .odt / .zip ; `puremagic` rend six candidats au même score
   (0,4), dont le premier est `.docx` quelle que soit l’archive — un ZIP
   ordinaire, un XLSX et un ODT ressortaient tous « docx ». Douze lignes de
   `zipfile` lisent `mimetype` et `[Content_Types].xml` côté Python.
2. **Les faux positifs de la table.** Cent octets nuls sont reconnus par
   `puremagic` comme un « Compucon-Singer embroidery design », avec la même
   confiance (0,8) qu’un vrai PNG. L’extrait ne répond que pour une liste
   déclarée de formats que porte réellement un téléversement web ; hors de
   cette liste, il refuse.
3. **Le nombre d’octets nécessaires.** `puremagic` reconnaît un PNG sur huit
   octets, `file-type` sur seize. L’extrait refuse en dessous de seize plutôt
   que de répondre différemment selon le langage.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait ne lève sur aucune entrée, et le temps ne dépend pas de la
taille du fichier : seuls les 4 096 premiers octets sont lus.
