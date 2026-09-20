# extract-metadata-from-a-file — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « le même contrat auquel on ajoute ses commentaires rend exactement les mêmes champs » | démontrée | test_point_de_rupture_les_deux_parties_lues_ne_sont_pas_toutes_les_metadonnees |
| 2 | N0 breaking_point | « le témoin : le document sans elles rend une liste vide » | démontrée | test_point_de_rupture_temoin_un_document_sans_ces_parties_le_dit |
| 3 | N0 docstring | les seize champs déclarés, lus dans les deux parties | démontrée | test_les_seize_champs_declares_sont_lus_dans_les_deux_parties |
| 4 | verdict_rationale | « seules les deux parties de métadonnées sont décompressées, sous un plafond déclaré » | démontrée | test_une_partie_qui_promet_plus_que_le_plafond_nest_pas_decompressee |
| 5 | verdict_rationale | « l’analyseur XML de JavaScript laisse « &#232; » tel quel » — écart fermé | démontrée des deux côtés | test_les_seize_champs…, et le test de parité |
| 6 | N0 — refus nommés | ce qui n’est pas un ZIP, et le ZIP qui n’est pas un document | démontrées | test_ce_qui_nest_pas_un_document_est_nomme |
| 7 | N0 — robustesse | un XML cassé n’empêche pas de lire le reste | démontrée | test_une_partie_illisible_nempeche_pas_de_lire_les_autres |
| 8 | Les deux langages | rapport identique sur huit documents | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 9 | N0 latency `~10 ms` | classe de latence | mesurée | borne d’effondrement : mille lectures en moins de vingt secondes |
| 10 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## Le chiffre qui porte le verdict

Aucun chiffre de performance : le verdict tient à ce que le document contient.
Sur le contrat du test, onze champs sont lus, dont trois noms de personnes, une
entreprise et le chemin d’un modèle interne — tout cela dans un fichier qu’on
s’apprêtait à envoyer.

## Ce que la recherche a établi

| Outil | Version | Licence | Publié | Retenu |
|---|---|---|---|---|
| `zipfile`, `xml.etree` | bibliothèque standard | — | — | retenus côté Python : rien à installer |
| `fflate` | 0.8.3 | MIT | 16 mai 2026 | retenu côté JavaScript ; aucune dépendance, et un filtre qui évite de décompresser le reste |
| `fast-xml-parser` | 5.2.5 | MIT | — | déjà dépendance du site |
| `jszip` | 3.10.2 | MIT ou GPL-3.0 | 8 septembre 2026 | écarté : quatre dépendances, et une double licence à faire lire |
| `adm-zip` | 0.6.1 | MIT | 11 septembre 2026 | écarté : il travaille sur des fichiers, pas sur des octets en mémoire |
| `python-docx` | — | — | — | écarté : il ouvre le document pour l’écrire, là où deux fichiers XML suffisent à le lire |

## Décidé seul

- **La fiche lit les documents OOXML, et pas les images.** Le sujet aurait pu
  être l’EXIF d’une photographie, où la surprise est la position GPS.
  L’alternative a été écartée pour une raison mesurable : il aurait fallu
  ajouter `Pillow` d’un côté et un lecteur EXIF de l’autre, et les deux rendent
  les nombres rationnels et les dates dans des formes différentes — deux
  extraits qui ne diraient pas la même chose du même fichier. Le document
  bureautique se lit avec la bibliothèque standard d’un côté et deux paquets
  sans dépendance de l’autre, et le sujet — ce qu’un contrat révèle de qui l’a
  écrit — est le même.
- **Les parties non lues sont nommées.** C’est la règle de la fiche. Sans elle,
  un document dont les auteurs sont dans ses commentaires répondrait « aucun
  auteur », ce qui est la pire des réponses possibles pour cette question-là.
- **Le plafond de décompression est déclaré.** Une entrée de ZIP annonce sa
  taille décompressée ; au-delà du plafond, elle n’est pas lue. C’est la
  précaution minimale contre une archive fabriquée.
- **Les valeurs sont rendues telles qu’elles sont écrites.** `revision` reste
  la chaîne « 7 », `editing_minutes` la chaîne « 413 », `created` la chaîne
  W3CDTF du fichier. Les convertir demanderait de choisir un fuseau et un type
  numérique, c’est-à-dire de décider à la place de l’appelant.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure : les noms des
champs sont fixés par une norme publiée. Rien dans cette fiche ne prétend
retirer les métadonnées ; elle les montre, et l’`escalate_when` dit que le
retrait est un autre travail.

## Infirmé, et ce que le code fait réellement

Un point corrigé en cours de route, trouvé par la comparaison et non par le
raisonnement : `fast-xml-parser` ne décode pas les références numériques de
caractères sans son option `htmlEntities`, si bien que l’entreprise revenait
« Cabinet Lumi&#232;re » en JavaScript et « Cabinet Lumière » en Python. Le
même fichier donnait deux auteurs différents selon le langage.

## Défauts de production

Le reste : une entrée qui n’est pas des octets rend un rapport avec sa raison,
un fichier qui n’est pas un ZIP est nommé comme tel, un ZIP qui n’est pas un
document aussi, un XML cassé n’empêche pas de lire l’autre partie, et un champ
vide n’est pas un champ — il est absent du rapport plutôt que rendu vide.
