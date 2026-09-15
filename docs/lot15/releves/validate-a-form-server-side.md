# validate-a-form-server-side — relevé du testeur

Passe 1 du lot 15. Tests : `content/snippets/validate-a-form-server-side/n0.test.{py,js}`.
Un test nommé ci-dessous existe dans les deux langages (`test_…` en Python,
`'…'` en JavaScript), sauf mention « py seul » ou « js seul ». L'essai
(`content/tryouts/live/validate-a-form-server-side.js`) est testé dans
`n0.test.js`.

`node scripts/test-snippets.mjs validate-a-form-server-side` : vert. 18 tests
existaient (9 par langage) ; tous renommés en français, assertions gardées,
complétées de témoins et de valeurs aux bornes. 30 tests ajoutés (48 au total :
23 py, 25 js).

Marquages : 3 `DÉFAUT` en Python, 3 `DÉFAUT` en JavaScript. Aucune affirmation
infirmée.

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « Le test soumet `ada@no-such-mailbox.example` : la forme est correcte, le schéma accepte, et personne ne lit le courrier envoyé là » | démontrée ; témoin : la même adresse sans `@` est refusée ; essai, cas 4 (accepté, rien de surligné) | test_point_de_rupture_une_adresse_bien_formee_qui_n_existe_pas ; 'point de rupture : l’essai accepte la boîte qui n’existe pas' (js seul) |
| 2 | N0 breaking_point | « Il soumet aussi un pseudonyme fait de deux espaces : `min` compte des caractères, une espace en est un, et le profil s’affiche vide » | démontrée ; témoins : une espace seule et une lettre seule sont refusées | test_point_de_rupture_un_pseudonyme_fait_de_deux_espaces_satisfait_la_longueur_minimale |
| 3 | N0 breaking_point ; escalate_when ; essai `why` | « Le savoir demande une vérification externe — un message de confirmation, une interrogation du domaine — c’est-à-dire un autre besoin » ; « des comptes créés qui ne confirment jamais, des courriers qui reviennent » | non testable : hors du code, observation d'exploitation | — |
| 4 | N0 name | « Schéma déclaratif, un message d’erreur par champ » | démontrée (#6, #7) | — |
| 5 | N0 docstring ; risks ; scenario | « Deterministic, standard library only » / « no dependency » ; `deterministic: true`, `vendor_lock: none`, `data_egress: none`, `testability: unit` ; « la même saisie reçoive deux fois la même réponse » | démontrée (vingt appels identiques ; import {re} ; aucun import JS ; garde réseau) | test_n0_est_deterministe_et_n_emploie_que_la_bibliotheque_standard |
| 6 | N0 docstring | « the answer is a mapping of field name to message, never a boolean » | démontrée (quatre champs fautifs, quatre messages nommés) ; essai, cas 2 | test_une_erreur_par_champ_fautif_qui_nomme_le_champ |
| 7 | N0 docstring | « one message per field: checks stop at the first broken rule » | démontrée : le type avant les bornes, les bornes avant le motif | test_les_verifications_s_arretent_a_la_premiere_regle_enfreinte |
| 8 | N0 docstring | « the schema is data, not code. It can be written next to the form, read by someone who does not write Python » | démontrée : le schéma passe par JSON sans perte | test_le_schema_est_une_donnee |
| 9 | N0 docstring | « and compared with the JavaScript one that guards the same form in the browser » | DÉFAUT #20 : la comparaison n'est pas sûre, le même schéma ne rend pas le même verdict dans les deux langages | test_defaut_un_meme_motif_a_le_meme_sens_cote_navigateur_et_cote_serveur |
| 10 | N0 docstring | « a validator worth having fits in forty lines » | démontrée : 29 lignes de code en Python (hors docstrings et commentaires), 28 en JavaScript | test_un_validateur_tient_en_quarante_lignes |
| 11 | N0 docstring | « every refusal can be explained to the person who typed the form » | démontrée pour la forme du refus (champ et règle) ; que l'explication convainque : non testable | — |
| 12 | N0 commentaire py | « `bool` is excluded from `integer` on purpose: in Python a boolean *is* an int, and a checkbox is not an age » | démontrée (et 36.5, NaN refusés) | test_un_booleen_n_est_pas_un_entier |
| 13 | N0 commentaire js | « `Number.isInteger` rejects NaN, Infinity and 1.5 in one go, which is what a form needs » | démontrée (36.5, NaN, Infinity, `true`) | 'un décimal, NaN, l’infini et un booléen ne sont pas des entiers' (js seul) |
| 14 | N0 `check` ; commentaire | « For a string the bounds read as a length; for a number, as a value » | démontrée, bornes incluses (17, 18, 130, 131 ; 2 et 30 caractères) ; voir DÉFAUT #19 sur ce que « characters » compte | test_une_valeur_hors_bornes_et_les_bornes_incluses |
| 15 | N0 commentaire js ; `re.fullmatch` py | « Anchored, so a pattern matches the whole field and not a fragment of it » | démontrée (« see https://example.com » refusé ; alternative `a|ab` entière) | test_le_motif_couvre_tout_le_champ |
| 16 | N0 `validate` | « A missing key, an explicit None and an empty string are the same thing here, because that is what a browser posts for a field the user left alone » | démontrée (et `undefined` en JS) ; essai, cas 3 | test_cle_absente_none_et_chaine_vide_sont_la_meme_chose |
| 17 | N0 regulatory | « Les messages renvoyés nomment le champ et la règle enfreinte, jamais la valeur saisie : ce qui atterrit dans vos journaux d’erreur reste ce que vous y mettez » | démontrée : une valeur marquée n'apparaît dans aucun message, sur huit refus de quatre règles différentes | test_les_messages_ne_contiennent_jamais_la_valeur_saisie |
| 18 | N0 latency | `<1 ms` | démontrée (mesuré 0,002 ms py, 0,004 ms js) | test_une_validation_prend_moins_d_une_milliseconde |
| 19 | N0 production, encodage | « must be at least N characters » sur un texte décomposé (NFD) ou un emoji | DÉFAUT : voir détail | test_defaut_les_bornes_comptent_des_caracteres_percus |
| 20 | N0 production | le même motif en Python et en JavaScript | DÉFAUT : voir détail | test_defaut_un_meme_motif_a_le_meme_sens_cote_navigateur_et_cote_serveur |
| 21 | N0 production, malveillante | champ absent du schéma (« is_admin ») | DÉFAUT : voir détail | test_defaut_un_champ_hors_schema_est_signale |
| 22 | N0 production | schéma vide ; valeur liste, objet, nombre, booléen dans un champ texte | démontrée : « must be of type string » | test_production_schema_vide_et_valeurs_d_un_autre_type |
| 23 | N0 production, très grande, malveillante | un million de caractères par champ, adresse « a@a.a.a.…! » de 1 Mo, entier 10^100 | démontrée : < 2 s, quatre refus ; aucun retour arrière catastrophique sur les motifs du test | test_production_une_saisie_enorme_termine_vite |
| 24 | N0 production, encodage | espaces de bord, domaine en majuscules, U+00A0 dans l'adresse, BOM et emoji dans le pseudonyme | démontrée (refus ou acceptation stables). Précision : le motif d'exemple refuse « ada@EXAMPLE.COM » et « ␠ada@example.com␠ » | test_production_encodage_espaces_insecables_et_casse |
| 25 | N0 production | motif sur un champ entier | précision : py `TypeError`, js convertit l'entier en texte et accepte | test_production_un_motif_sur_un_entier_fait_lever_en_python (py) / 'production : un motif sur un entier convertit l’entier en texte' (js) |
| 26 | Essai, cas 1 à 3 | « Une inscription bien remplie » ; « Quatre champs fautifs, quatre messages » ; « Un champ laissé vide, un âge écrit en lettres » | démontrée : verdicts et messages exacts | 'l’essai rend ses trois premiers cas comme il les annonce' (js seul) |
| 27 | Essai, commentaire et `note` | « une valeur entièrement numérique devient un nombre » ; « Les messages de la troisième colonne sont ceux que l’extrait produit lui-même » | démontrée (« age: 16 » → « must be at least 18 », « trente-quatre » → « must be of type integer ») | idem |
| 28 | N1 unavailable_reason | « Il n’y a rien à apprendre. L’âge minimal, la longueur d’un pseudonyme, le format d’adresse accepté : ce sont des décisions écrites et opposables » ; « Un classifieur entraîné sur les saisies passées apprendrait ce qui a été accepté hier, erreurs comprises, et ne saurait toujours pas dire quel champ reprendre » | non testable : argument de conception, pas de code N1 | — |
| 29 | N2 unavailable_reason | « Un modèle auto-hébergé ne rend pas une règle plus juste : il rend son verdict plus cher à obtenir, plus lent à rendre, et impossible à relire dans le schéma » | non testable : pas de code N2 | — |
| 30 | N3 unavailable_reason | « Deux envois identiques doivent recevoir la même réponse, et cette réponse doit se lire dans une règle qu’on peut produire » | démontrée pour N0 (#5, #6) ; « Un modèle qui accepte parfois et refuse parfois la même saisie » et « le confier à un modèle qui lit ce texte comme une consigne » : non testable, pas de code N3 | — |
| 31 | scenario | « On voit des formulaires entiers confiés à un modèle généraliste » ; « Les règles étaient pourtant écrites avant que quiconque tape quoi que ce soit » | non testable : constat d'usage | — |
| 32 | verdict_rationale | « Une règle de formulaire est écrite avant d’être appliquée : elle se lit, elle se teste unitairement, et elle se montre à qui la conteste » | démontrée pour « se teste unitairement » (cette suite) et « se lit » (#8, #10) ; le reste : jugement | — |

## Non testable, et pourquoi

- **#3, #31** : vérification externe, observations d'usage ou d'exploitation.
- **#11 (partie)**, **#32 (partie)** : appréciation.
- **#28, #29, #30 (partie)** : niveaux sans code ; ce sont des arguments de conception. Aucun chiffre à vérifier.

## Infirmé, et ce que le code fait réellement

Rien d'infirmé : chaque affirmation vérifiable de la fiche tient sur le code.

## Défauts de production

- **#19 — Bornes en « characters ».** Le message dit « must be at least 2 characters », le code compte `len(value)` (points de code) en Python et `value.length` (unités UTF-16) en JavaScript. Conséquences :
  - un pseudonyme de 16 « é » est accepté s'il arrive composé (NFC, 16 points de code) et refusé à `max: 30` s'il arrive décomposé (NFD, 32 points de code), dans les deux langages : la même saisie visible reçoit deux réponses selon le clavier ou le système qui l'envoie ;
  - « 🙂 » seul est refusé par Python (1 point de code < 2) et accepté par JavaScript (2 unités UTF-16) : le navigateur accepte ce que le serveur refuse.
  La fiche dit « la même saisie reçoive deux fois la même réponse » ; ici non, entre formes Unicode et entre les deux extraits.
- **#20 — Un même motif, deux sens.** Le schéma est présenté comme partageable entre le navigateur (JavaScript) et le serveur (Python). Or `re.fullmatch` et `new RegExp('^(?:…)$')` sans drapeau `u` n'ont pas les mêmes classes : `\d{5}` accepte « ١٢٣٤٥ » (chiffres arabes) en Python et le refuse en JavaScript ; `\w+` accepte « Zoé » en Python et le refuse en JavaScript. Une syntaxe propre à Python (`(?P<nom>…)`) fait lever `SyntaxError` en JavaScript. Le formulaire refusé côté navigateur passe côté serveur, ou l'inverse, avec le même schéma. Le test vérifie la lecture ASCII de `\d` et la lecture Unicode de `\w` : chaque langage échoue sur l'une des deux.
- **#21 — Champ hors schéma.** `validate({**VALID, "is_admin": True}, SCHEMA)` rend `{}`. La fonction ne vérifie que les champs du schéma et ne rend pas de saisie nettoyée : l'appelant qui enregistre `data` après une validation vide enregistre aussi les champs que le formulaire ne portait pas (assignation de masse). La fiche cite l'aide-mémoire OWASP sur la validation des entrées, qui recommande la liste d'autorisation ; le besoin de la fiche est « avant de les enregistrer ». Un validateur devrait signaler les champs inconnus ou rendre les seuls champs du schéma.

## Précisions pour le rédacteur (démontré, mais à resserrer)

- **#24** : le motif d'adresse des tests et de l'essai refuse un domaine en majuscules et une adresse entourée d'espaces ; aucune normalisation n'est faite avant la règle. C'est la donnée d'exemple, pas l'extrait, mais c'est celle que le lecteur copie.
- **#25** : un motif posé sur un champ `integer` fait lever `TypeError` en Python et passe en JavaScript.
- **#14** : en Python, `36.0` (un JSON `36.0`) est refusé comme non entier ; en JavaScript `36.0` est l'entier 36.

## Pour la charte

- **Longueurs de texte** : toute règle ou tout message qui dit « characters » devrait être testé sur NFC/NFD et sur un emoji dans les deux langages ; c'est le cas le plus fréquent de divergence entre extraits.
- **Expressions régulières partagées** : quand une fiche présente une donnée (schéma, motif) comme commune aux deux langages, la charte pourrait exiger un test qui passe la même donnée aux deux extraits sur des entrées non ASCII.
- **Liste d'autorisation** : pour une fiche de validation d'entrée, la charte pourrait nommer l'entrée malveillante obligatoire « champ supplémentaire non déclaré ».
