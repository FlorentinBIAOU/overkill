# validate-an-imported-file-against-a-schema — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « refuse 1 363 des 10 000 montants de 0,00 à 99,99 » | démontrée | test_point_de_rupture_un_multiple_dun_centime_refuse_des_montants_justes |
| 2 | N0 breaking_point | « le témoin : les mêmes 10 000 valeurs, écrites en centimes entiers, passent toutes » | démontrée | test_point_de_rupture_temoin_le_meme_montant_en_centimes_entiers_passe |
| 3 | N0 docstring, verdict_rationale | « `jsonschema` accepte « 12/01/2026 » […] tandis qu’`ajv` refuse de compiler » | démontrée | test_le_format_est_inerte_tant_quon_ne_lallume_pas (les deux réglages, dans chaque langage) |
| 4 | N0 docstring | « every error is collected » | démontrée | test_toutes_les_erreurs_sont_rendues_pas_seulement_la_premiere |
| 5 | N0 docstring | « the path and the rule are what your code should branch on » | démontrée | test_chaque_erreur_porte_un_chemin_et_le_nom_dune_regle |
| 6 | N0 commentaire | « record 10 comes after record 2 » | démontrée | test_les_erreurs_sont_rangees_par_place_dans_le_document |
| 7 | N0 docstring | « capped, and the report says how many were left out » | démontrée | test_au_dela_du_plafond_le_compte_est_rendu_et_le_drapeau_leve |
| 8 | N0 commentaire | « Compiling a schema costs far more than checking one document against it » | démontrée | test_le_schema_compile_est_garde_et_le_cache_est_plafonne |
| 9 | N0 commentaire | « a rule the standard does not define […] would otherwise only surface as an exception » | démontrée | test_un_schema_inutilisable_est_une_raison_pas_une_exception |
| 10 | Les deux langages | chemin, règle, compte et validité identiques ; le message diffère | démontrée | test_python_et_javascript_rendent_le_meme_rapport_sauf_le_texte_du_message (16 couples document-schéma) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence, et ce que le cache change

Vingt mille validations d’un enregistrement contre le même schéma, après une
passe de chauffe :

| | sans cache de schéma | avec cache |
|---|---|---|
| Python | 0,487 ms | **0,0089 ms** |
| JavaScript | 5,819 ms | **0,0009 ms** |

Soit un facteur cinquante-cinq en Python et six mille en JavaScript. La classe
affichée est `<1 ms`. Sans le cache, la classe aurait été `~10 ms` côté
JavaScript, sur le chemin le plus chaud d’un import — c’est exactement le
défaut de production que le lot 15 avait relevé ailleurs, et il est fermé ici.
Le cache est plafonné à trente-deux schémas, et le test vérifie les deux
choses : le gain de temps et la borne.

## Trois réglages qui ne sont pas les réglages par défaut

1. **Les formats sont assertés.** `jsonschema` laisse `"format": "date"`
   inerte : « 12/01/2026 » et « 2026-02-30 » passent. `ajv`, lui, refuse de
   compiler le schéma tant que les formats ne sont pas enregistrés. Les deux
   réactions sont épinglées par un test.
2. **Toutes les erreurs sont collectées.** `ajv` s’arrête à la première sans
   `allErrors`.
3. **Le dialecte.** `ajv` par défaut est en draft-07 et refuse tout schéma qui
   déclare 2020-12 ; il faut importer `ajv/dist/2020`. La parité entre les deux
   extraits a été trouvée en échec sur ce point avant d’être corrigée.

## Ce que le message d’erreur n’est pas

Le texte du message appartient à la bibliothèque et diffère entre les deux
— « '1 250,00' is not of type 'number' » contre « must be number ». Le test de
parité compare le chemin, la règle, le compte et la validité, et pas le
message ; la docstring le dit.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Un schéma inutilisable rend une raison, un document de dix mille
enregistrements est validé en une passe, et le cache est borné.
