# validate-an-email-address-without-sending-a-message — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « “jean@gmial.com” passe, et le domaine est une faute de frappe sur gmail.com » | démontrée | test_point_de_rupture_une_faute_de_frappe_sur_le_domaine_passe |
| 2 | N0 breaking_point | « le témoin : “jean@@exemple.fr”, “jean@-exemple.fr” et “jean@exemple..fr” sont bien refusés » | démontrée | test_point_de_rupture_temoin_la_forme_est_bien_controlee |
| 3 | N0 docstring, verdict_rationale | « four times […] fourteen times » (les trois définitions comparées) | démontrée | test_les_trois_definitions_ne_disent_pas_la_meme_chose (32 adresses, `email-validator` en Python et `validator.js` appelé par node) |
| 4 | N0 docstring, verdict_rationale | « a sixty-five-character local part, which `email-validator` accepts » | démontrée | test_email_validator_accepte_une_partie_locale_de_soixante_cinq_caracteres |
| 5 | N0 docstring | « The local part is left in its case […] only the domain is not » | démontrée | test_seul_le_domaine_est_mis_en_minuscules |
| 6 | N0 docstring, verdict_rationale | « `routable` is false for jean@localhost » | démontrée | test_un_domaine_sans_point_est_valide_et_non_routable |
| 7 | N0 escalate_when | « l’adresse internationalisée — “jéan@exemple.fr” — que la définition HTML écarte » | démontrée | test_une_adresse_accentuee_est_refusee_comme_par_le_navigateur |
| 8 | N0 commentaire | « The HTML value sanitisation algorithm strips leading and trailing whitespace » | démontrée | test_les_blancs_de_bord_sont_retires_comme_le_fait_le_navigateur |
| 9 | N0 docstring | « Nothing raises » | démontrée | test_aucune_entree_ne_leve |
| 10 | Les deux langages | la fiche montre deux extraits, elle affirme la même chose des deux | démontrée | test_python_et_javascript_rendent_le_meme_rapport (53 entrées) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N0 — production | l’expression régulière ne s’effondre pas sur une entrée d’un mégaoctet | démontrée | test_production_entree_tres_grande_et_terminaison_rapide (trois formes, dont une suite de points) |
| 13 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Deux cent mille contrôles de « jean.dupont@exemple.fr » sur la machine de
travail : **0,00092 ms par contrôle en Python, 0,00037 ms en JavaScript**. La
classe affichée est `<1 ms`, avec trois ordres de grandeur de marge. Le test ne
garde qu’une borne d’effondrement — cent mille contrôles en moins de dix
secondes (T7).

## Décision d’écriture : la définition du standard plutôt qu’une bibliothèque

R3 demande de nommer l’outil standard et de le mettre dans l’échelle ou de
l’écarter avec une raison mesurée. Les deux outils existent — `email-validator`
2.3.0 en Python, `validator.js` 13.15.35 en JavaScript — et la raison de ne pas
s’appuyer sur eux est mesurée dans le test : ils rendent quatre verdicts
différents l’un de l’autre sur trente-deux adresses, et quatorze qui s’écartent
de la définition que le navigateur vient d’appliquer au champ. Les deux sont
nommés dans la fiche et dans les liens.

L’extrait transcrit l’expression régulière publiée par le standard HTML — une
ligne, recopiée caractère par caractère — et y ajoute les deux longueurs de la
RFC 5321, parce qu’`email-validator` ne contrôle pas la partie locale.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait ne lève sur aucune entrée, et l’expression régulière du
standard ne s’effondre sur aucune des trois formes hostiles essayées.
