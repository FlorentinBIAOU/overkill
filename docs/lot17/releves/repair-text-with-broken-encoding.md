# repair-text-with-broken-encoding — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « la phrase d’un ticket […] ressort en « on voit « é » au lieu de « é » » » | démontrée | test_point_de_rupture_le_texte_qui_parle_de_lencodage_est_repare_aussi |
| 2 | N0 breaking_point | « vingt chaînes déjà correctes […] ressortent inchangées » | démontrée | test_point_de_rupture_temoin_vingt_chaines_correctes_ressortent_inchangees |
| 3 | N0 docstring | « that is a byte identity, not a judgement » | démontrée | test_les_cas_ordinaires_dun_import_sont_repares (treize formes cassées) |
| 4 | N0 docstring | « two rounds of the same accident » | démontrée | test_deux_tours_du_meme_accident_sont_defaits |
| 5 | N0 commentaire | « Working run by run […] lets a text where only some fields are broken come back with the rest untouched » | démontrée | test_un_texte_a_moitie_casse_ressort_avec_lautre_moitie_intacte |
| 6 | N0 docstring, verdict_rationale | « `fix_text` […] also straightens quotation marks » | démontrée | test_fix_text_abime_lapostrophe_typographique_fix_encoding_non (les deux fonctions sur la même entrée) |
| 7 | N0 escalate_when | « le caractère de remplacement […] l’octet a été jeté » | démontrée | test_le_drapeau_lossy_dit_que_des_octets_ont_deja_ete_perdus |
| 8 | N0 docstring, verdict_rationale | « a repair that nobody recorded is indistinguishable from data that was always like that » | démontrée | test_rien_nest_repare_en_silence |
| 9 | N0 docstring | « The two agree on thirty-nine of this entry’s forty-one strings » | démontrée | test_les_deux_extraits_saccordent_sauf_sur_la_regle_de_lespace |
| 10 | N0 docstring | la règle du « Ã » suivi d’une espace, propre à `ftfy` | démontrée | test_ftfy_lit_un_a_tilde_suivi_dune_espace_comme_un_a_accent_grave (Python), test « un a-tilde suivi d’une espace n’est pas lu comme un a accent grave » (JavaScript) |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## La mesure de latence

Cinquante mille réparations de « Rue des FrÃ¨res-LumiÃ¨re » sur la machine de
travail : **0,0118 ms en Python, 0,0039 ms en JavaScript**. La classe affichée
est `<1 ms`. Le test ne garde qu’une borne d’effondrement — dix mille
réparations en moins de vingt secondes (T7).

## Le langage sans outil de référence, et ce qui a été fait

`ftfy` n’a pas de portage JavaScript. Le registre npm a été consulté : les
paquets voisins détectent l’encodage (`chardet`) ou le convertissent
(`encoding-japanese`), ce qui est un autre travail. L’extrait JavaScript écrit
donc la transformation principale — aller-retour windows-1252 / UTF-8, appliqué
suite par suite plutôt que sur la chaîne entière — en une trentaine de lignes.

Le test compare les deux extraits sur les quarante et une chaînes de la fiche :
ils s’accordent sur trente-neuf. Les deux écarts relèvent de la même règle
d’`ftfy`, dite dans les deux docstrings : un « Ã » suivi d’une espace ordinaire
est lu comme le « à » dont l’espace insécable a été perdue. Elle répare un cas
réel de plus — « Ã tout de suite » — et elle réécrit une phrase correcte de
plus — « Le caractère Ã se prononce a-tilde ». Les deux comportements sont
épinglés par un test dans chaque langage.

## Un choix d’écriture mesuré

`ftfy.fix_text`, la fonction large, redresse aussi les guillemets : sur
quarante-quatre chaînes déjà correctes, elle en change une —
« L’été à Nice » devient « L'été à Nice ». L’extrait appelle donc
`fix_encoding`, la fonction étroite, qui n’en change aucune. Le test épingle
les deux comportements.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure. Qu’un modèle
« invente » une réparation n’est pas testable ici ; ce que la fiche lui
reproche est vérifiable, en revanche : l’aller-retour d’octets se rejoue dans
l’autre sens, une sortie de modèle non.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Les deux extraits rendent une raison sur une entrée qui n’est pas du
texte, et ne lèvent pas.
