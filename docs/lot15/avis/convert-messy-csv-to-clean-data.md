# convert-messy-csv-to-clean-data — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs convert-messy-csv-to-clean-data` : vert, 3 py, 3 js.

### Raisons du refus

1. **[pertinence technique, vérité du point de rupture]** N0, `_to_number`.
   Une virgule seule est toujours lue comme séparateur décimal. Exécuté :

   | Valeur du fichier | Rendu | Lecture attendue d'un export anglophone |
   |---|---|---|
   | `1,234` | `1.234` | 1 234 |
   | `12,500` | `12.5` | 12 500 |
   | `1.234` | `1.234` | 1 234 dans un export européen |

   Aucun rejet, aucune ligne au journal : un montant exporté par un outil
   anglophone (tableur, plateforme de paiement, boutique en ligne) est divisé
   par mille en silence. C'est exactement le reproche que le `scenario` fait au
   modèle généraliste — « rien dans le tableau rendu ne distingue une valeur
   lue d'une valeur devinée » — commis par le niveau recommandé, sur la colonne
   où l'erreur coûte le plus. Le `breaking_point` de N0 ne le dit pas : il
   parle des dates.

   Ce qu'il faut faire : traiter le séparateur décimal comme `_to_date` traite
   l'ordre jour-mois — une convention déclarée par l'appelant pour le fichier
   (`decimal=","` ou `"."`) —, et **rejeter au journal** toute valeur ambiguë
   quand la convention n'est pas donnée (un seul séparateur suivi d'exactement
   trois chiffres). Tests, deux langages : `1,234` sans convention va au
   journal ; avec `decimal="."`, il rend 1234 ; avec `decimal=","`, 1.234. Si le
   rédacteur garde le comportement actuel, il doit l'écrire en tête du
   `breaking_point` de N0 avec l'exemple `12,500 → 12.5`, et le démontrer.

2. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs, tous
   **périmés** — les phrases qu'ils contredisent ont été retirées — et
   adaptateur N3 non testé.
   - `n0.test.js`, `INFIRMÉ` : le `why` de l'essai parle des « lignes 41 et 42 ».
   - `n1` (py, js), `INFIRMÉ` : « described on the same scale ».
   - `n1` (py, js), `INFIRMÉ` : « A couple of hundred rows say as much […] as a million do ».
   - `n1.test.py`, `INFIRMÉ (Python)` : `latency « ~10 ms »` (la fiche déclare désormais `<1 ms`).
   - `n3` (py, js), `INFIRMÉ` : « the number of calls made is exactly the length of that journal ».
   - `n3` (py, js), `DÉFAUT` : le client par défaut n'a pas la forme du vrai kit. Décoratif ; **aucun test ne fait tourner `ProviderClient`**.

   Ce qu'il faut faire : réécrire chaque test sur la phrase actuelle ou le
   supprimer s'il ne porte plus sur rien, sans marquage ; tester l'adaptateur
   sur `_harness/fake_sdk.py` / `fake-sdk.mjs`. C'est fait quand le dossier ne
   contient plus aucun marquage.

### Remarques non bloquantes

- `detect_dialect` échantillonne les vingt premières lignes **physiques** : un
  champ entre guillemets qui contient des retours à la ligne (une adresse, un
  commentaire) fausse le compte des séparateurs. Les exports de CRM en sont
  pleins. Une demi-phrase dans la docstring, ou échantillonner des
  enregistrements plutôt que des lignes.
- Le repli en cp1252 quand l'UTF-8 strict échoue est le bon choix pour un
  public européen ; le dire comme un choix (« et pas Latin-1, qui n'a pas le
  signe euro ») aiderait le lecteur qui reçoit des fichiers d'ailleurs.
- `unavailable_reason` de N2 : juste et court.

### Ce qui est solide

- Le `scenario` a la meilleure formule du catalogue sur ce que coûte un
  nettoyage par modèle : la perte de l'inventaire de ce qui n'a pas pu être
  nettoyé.
- Le journal des rejets (ligne, colonne, raison, champs d'origine) est
  exactement ce qu'on veut en production, et le verdict le met au centre.
- Les points de rupture sont bons et vrais : le format de date qui change en
  cours de fichier (et le rejet « par chance » de 12/25), le code postal perdu
  par N1 parce qu'il a raison sur la forme, la date inventée bien formée de N3.
- N3 ne travaille que sur les lignes rejetées : « un fichier de cent mille
  lignes dont trois coincent ne justifie pas cent mille appels » est l'argument
  d'exploitation à retenir.
