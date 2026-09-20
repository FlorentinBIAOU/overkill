# validate-a-phone-number-and-its-country-code — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « “+229 97 12 34 56” … la bibliothèque le refuse aujourd’hui » | démontrée | test_point_de_rupture_un_numero_beninois_dhier_est_refuse_aujourdhui |
| 2 | N0 breaking_point | « le témoin : “+229 01 97 12 34 56”, la forme actuelle, passe » | démontrée | test_point_de_rupture_temoin_la_forme_actuelle_passe |
| 3 | N0 docstring, scénario, verdict | « the region is either written in the number … or the number is refused » | démontrée | test_la_region_nest_jamais_devinee |
| 4 | scénario, verdict_rationale | « 0470 12 34 56 est une ligne fixe en France et un mobile en Belgique » | démontrée | test_les_memes_chiffres_donnent_deux_pays_et_deux_natures_de_ligne |
| 5 | N0 docstring | « in France a number starting 01 is a fixed line, and it is valid » | démontrée | test_la_nature_de_la_ligne_dit_quun_sms_narrivera_pas |
| 6 | N0 commentaire | « `is_possible_number` only checks the length » | démontrée | test_la_raison_separe_la_longueur_du_prefixe |
| 7 | N0 commentaire | « libphonenumber reads them as the keys of a telephone keypad » | démontrée | test_production_un_mot_colle_au_numero_est_refuse_et_non_lu_en_chiffres |
| 8 | N0 commentaire | « the narrow no-break space is not in it » | démontrée | test_production_encodages_inattendus |
| 9 | N0 docstring | « Nothing raises » | démontrée | test_aucune_entree_ne_leve |
| 10 | Les deux langages | la fiche montre deux extraits, elle affirme la même chose des deux | démontrée | test_python_et_javascript_rendent_le_meme_rapport (42 numéros × 4 régions) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Vingt mille contrôles de « 06 12 34 56 78 » en région FR, après une première
passe de chauffe : **0,0344 ms par contrôle en Python, 0,0117 ms en
JavaScript**. La classe affichée est `<1 ms`. Le test ne garde qu’une borne
d’effondrement — dix mille contrôles en moins de vingt secondes, soit une marge
de cinquante sur la mesure (T7).

## Deux divergences entre les deux bibliothèques, fermées dans l’extrait

1. **L’espace fine insécable (U+202F).** `phonenumbers` et `libphonenumber-js`
   arrêtent tous deux la lecture dessus, alors qu’une saisie française en met.
   L’extrait nivelle les espaces de toutes largeurs sur l’espace ordinaire
   avant d’appeler. Défaut réparable, donc réparé (R5) plutôt que présenté
   comme une limite.
2. **Les lettres.** `phonenumbers` les lit comme les touches d’un clavier
   téléphonique — « poste 42 » devient des chiffres et le numéro sort faux —,
   `libphonenumber-js` lève. L’extrait refuse tout caractère qui n’est ni un
   chiffre décimal Unicode ni une ponctuation de numéro, avant d’appeler : les
   deux langages répondent alors la même chose, et le clavier téléphonique ne
   fabrique plus de numéro que personne n’a tapé.

La marque d’ordre des octets en fin de chaîne a demandé un troisième
alignement : `String.prototype.trim` la retire, `str.strip` non. L’extrait ne
rogne que l’espace ordinaire, après nivellement.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure. Un préfixe
ouvert après la version installée de la bibliothèque ne peut pas être
démontré par un test qui n’a pas la version suivante : ce que le test montre,
c’est le cas symétrique et daté du Bénin.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. L’extrait ne lève sur aucune entrée.
