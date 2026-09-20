# validate-an-api-payload-against-its-contract — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « une facture déclarant 1 000 hors taxes, 200 de TVA et 999 de total est parfaitement conforme » | démontrée | test_point_de_rupture_une_facture_qui_ne_tombe_pas_juste_est_valide |
| 2 | N0 breaking_point | « le témoin : le même montant écrit « 1 000,00 » est refusé » | démontrée | test_point_de_rupture_temoin_une_faute_de_forme_est_bien_attrapee |
| 3 | N0 docstring, verdict_rationale | « `/factures/resume` is the summary endpoint and not an invoice whose identifier happens to be « resume » » | démontrée | test_un_chemin_exact_gagne_sur_un_chemin_gabarite |
| 4 | N0 docstring | « every `$ref` […] resolves on its own, however deep » | démontrée | test_une_reference_interne_se_resout_meme_imbriquee |
| 5 | N0 docstring, verdict_rationale | « `ajv` honours it, `jsonschema` ignores it and refuses a null the contract allows » | démontrée | test_nullable_de_la_version_3_0_est_traduit_avant_validation (les deux comportements bruts, dans chaque langage) |
| 6 | N0 docstring | « `additionalProperties` failures at the same place are collapsed into one » | démontrée | test_les_proprietes_en_trop_ne_comptent_quune_fois (JavaScript), test_production_entree_tres_grande_et_terminaison_rapide (Python) |
| 7 | N0 commentaire | « No body declared: anything sent is outside the contract » | démontrée | test_une_operation_sans_corps_declare_refuse_un_corps |
| 8 | N0 — production | un document inutilisable est une raison | démontrée | test_un_document_inutilisable_est_une_raison_pas_une_exception |
| 9 | N0 commentaire, verdict_rationale | « compiling a document costs more than checking one body against it — far more in JavaScript » | démontrée | test_le_document_compile_est_garde_et_le_cache_est_plafonne |
| 10 | Les deux langages | opération, chemins, règles, compte et validité identiques | démontrée | test_python_et_javascript_rendent_le_meme_rapport (17 requêtes) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence, et ce que le cache change

Vingt mille validations de la même facture contre le même document, après une
passe de chauffe :

| | sans cache | avec cache |
|---|---|---|
| Python | 0,079 ms | **0,0676 ms** |
| JavaScript | 6,505 ms | **0,0069 ms** |

L’écart entre les deux langages est la conséquence de deux modèles
d’exécution : `ajv` engendre du code à la compilation, `jsonschema`
interprète. Le cache divise le temps par neuf cents côté JavaScript et par
1,2 côté Python — où la clé de cache, une sérialisation du document, coûte
presque autant que ce qu’elle économise. Il est gardé des deux côtés pour que
les deux extraits aient la même forme et la même sémantique, et la docstring
dit l’asymétrie. Sans lui, la classe de latence aurait été `~10 ms` en
JavaScript, sur le chemin d’une requête HTTP.

## Trois façons de se tromper en silence, fermées dans l’extrait

1. **La précédence des chemins.** Sans la règle du segment concret,
   « /factures/resume » est validé contre le schéma d’une facture — et une
   requête sans corps passe.
2. **`nullable: true`.** `ajv` l’honore, `jsonschema` l’ignore : sur le même
   document OpenAPI 3.0, les deux extraits répondaient l’inverse l’un de
   l’autre avant la traduction. Le test montre le comportement brut de chaque
   bibliothèque à côté de celui de l’extrait.
3. **Le décompte des propriétés en trop.** `ajv` en rend une par propriété,
   `jsonschema` une seule pour toutes. Seule cette règle-là est ramenée à un
   échec par endroit ; les autres, `required` compris, sont laissées telles
   quelles, parce que les deux bibliothèques les comptent pareil.

## Le périmètre, dit plutôt que sous-entendu

L’extrait valide le corps JSON, pas les paramètres de chemin et de requête.
Ceux-là arrivent en texte sur le fil — « ?page=2 » est la chaîne « 2 » —, et
les valider contre un schéma qui dit `integer` demande une conversion que les
deux bibliothèques ne font pas de la même façon. C’est un autre travail, et la
fiche ne prétend pas le faire.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Un chemin inconnu, une méthode non déclarée, un document illisible et un
corps de dix mille champs rendent chacun une réponse nommée.
