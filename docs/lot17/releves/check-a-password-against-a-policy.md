# check-a-password-against-a-policy — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « « Clementine-2019-Martin » […] n’est dans aucune liste, et passe » | démontrée | test_point_de_rupture_le_controle_ne_connait_que_ce_qui_a_deja_fuite |
| 2 | N0 breaking_point | « le témoin : « correct horse battery staple », assez long lui aussi, est refusé » | démontrée | test_point_de_rupture_temoin_un_mot_de_passe_assez_long_mais_fuite_est_refuse |
| 3 | N0 docstring, verdict_rationale, risks | « the password is never sent […] the whole privacy argument is in two lines » | démontrée | test_le_mot_de_passe_ne_sort_jamais_seuls_cinq_caracteres_de_son_hache (l’adresse demandée est lue, et ni le mot de passe, ni son empreinte, ni son suffixe n’y figurent) |
| 4 | N0 commentaire | « a request that will change nothing is a request not to make » | démontrée | test_la_liste_nest_interrogee_que_si_la_reponse_peut_encore_changer |
| 5 | N0 docstring, verdict_rationale | « What this file deliberately does not do is count capitals, digits and symbols » | démontrée | test_aucune_regle_de_composition_nest_imposee |
| 6 | N0 docstring | « a password typed with a composed « é » […] are the same password » | démontrée | test_deux_ecritures_du_meme_mot_de_passe_sont_le_meme_mot_de_passe |
| 7 | N0 docstring | « the site’s name, the account’s local part » | démontrée | test_un_mot_du_contexte_est_refuse |
| 8 | N0 docstring | « eight when it is only one factor among several » | démontrée | test_le_plancher_descend_quand_il_y_a_un_second_facteur |
| 9 | Les deux langages | rapport identique | démontrée | test_python_et_javascript_rendent_le_meme_rapport (23 mots de passe, dont deux formes Unicode et deux cas de casse) |
| 10 | N0 latency `~100 ms` | classe de latence | non mesurable ici, justifiée ci-dessous | test_production_le_controle_tient_la_classe_de_latence_annoncee (part locale seulement) |
| 11 | N1 unavailable_reason | « ses dictionnaires sont ceux de l’anglais dans le portage Python » | non testable ici : vérifié à la source (PyPI, dépôt zxcvbn-ts) | — |
| 12 | N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## La latence, et pourquoi elle n’est pas mesurée

La classe affichée, `~100 ms`, est celle d’un aller-retour HTTPS vers un
service public. Le test n’a pas de réseau — c’est la règle du dépôt — et il ne
mesure donc que la part locale : dix mille contrôles complets contre le double,
hachage, normalisation et comparaison compris, en moins de soixante secondes.
La classe n’est pas une mesure de cette fiche, c’est l’ordre de grandeur d’une
requête réseau, et le relevé le dit plutôt que de laisser croire le contraire.

## Ce que le double simule, et ce que le test établit

Le double sert une plage de huit cents suffixes, bourrage compris, pour les
cinq caractères demandés. Ce qu’il établit : que l’extrait construit la bonne
adresse, qu’il ne met rien d’autre dedans, qu’il compare le suffixe localement,
qu’il rend le compte, et qu’il n’appelle pas du tout le service quand la
longueur a déjà tranché. Ce qu’il n’établit pas : que tel mot de passe est ou
n’est pas dans la vraie liste. Les comptes affichés dans l’essai sont ceux du
double.

## Un choix d’écriture, pour la parité

La comparaison au contexte se fait en minuscules et non en pliage de casse :
`str.casefold()` transforme « ß » en « ss », `String.prototype.toLowerCase` ne
le fait pas, et JavaScript n’a pas de pliage. Le test de parité passe
« STRASSE ist eine Straße hier » et « İstanbul est une grande ville » aux deux
extraits.

## Non testable, et pourquoi

Le niveau N1 est fermé sur un fait de bibliothèque — les dictionnaires de
zxcvbn — vérifié à la source plutôt qu’exécuté : le portage Python 4.5.0 ne
publie que des dictionnaires anglais, et c’est le portage TypeScript
`@zxcvbn-ts` qui publie un paquet de langue française.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait n’interroge pas le service quand la réponse ne peut plus
changer, et il rend une raison nommée sur toute entrée qui n’est pas du texte.
