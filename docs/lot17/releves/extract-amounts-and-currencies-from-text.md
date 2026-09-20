# extract-amounts-and-currencies-from-text — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « vaut 1,859 en convention française […] et mille fois plus en convention anglaise » | démontrée | test_point_de_rupture_trois_chiffres_derriere_un_separateur_se_lisent_deux_facons |
| 2 | N0 breaking_point | « le témoin : l’espace tranche le groupement, revient sans drapeau » | démontrée | test_point_de_rupture_temoin_une_espace_tranche_le_groupement |
| 3 | verdict_rationale | « sur une ligne de facture française […] il rend le numéro de pièce » | démontrée contre `price-parser` 0.5.1 | test_verdict_loutil_de_reference_rend_le_numero_de_facture_comme_total |
| 4 | verdict_rationale | l’outil de référence attribue la devise d’un entête à un montant d’une autre devise | démontrée contre `price-parser` | test_verdict_loutil_de_reference_attribue_la_devise_dune_entete |
| 5 | verdict_rationale | « rend « 1,859 » mille fois trop grand ou juste selon un paramètre qu’on ne lui passe pas » | démontrée contre `price-parser` | test_verdict_loutil_de_reference_tranche_le_separateur_par_defaut |
| 6 | verdict_rationale | « il lit un prix dans une chaîne » — un texte à trois montants n’en rend qu’un | démontrée | test_verdict_un_texte_a_plusieurs_montants_nen_rend_quun |
| 7 | N0 — la convention | exigée, sans défaut | démontrée | test_la_convention_est_exigee_et_il_ny_a_pas_de_defaut |
| 8 | N0 docstring | « un symbole que plusieurs monnaies partagent n’est pas tranché ici » | démontrée | test_un_symbole_partage_nest_pas_tranche |
| 9 | N0 docstring | « c’est cette marque qui distingue un montant du numéro de facture » | démontrée | test_la_marque_doit_toucher_le_nombre |
| 10 | verdict_rationale | « la valeur rendue est une chaîne de chiffres, jamais un flottant » | démontrée | test_la_valeur_est_les_chiffres_ecrits_jamais_un_flottant |
| 11 | N0 — formes de nombre | les six écritures connues, et ce qui n’est pas un nombre | démontrée | test_les_formes_de_nombre_connues_sont_lues, test_les_espaces_de_groupement_de_lecriture_francaise_sont_lues |
| 12 | N3 breaking_point | « le numéro de pièce passe la garde et revient comme une somme » | démontrée | test_point_de_rupture_la_garde_verifie_dou_vient_un_nombre_pas_ce_quil_designe |
| 13 | N3 breaking_point | « le témoin : un total que le document ne contient pas est écarté » | démontrée | test_point_de_rupture_temoin_un_total_absent_du_document_est_ecarte |
| 14 | N3 docstring | « ce qui survit est lu par la fonction du niveau N0 » | démontrée | test_la_valeur_est_relue_par_le_niveau_n0_pas_par_le_modele |
| 15 | N3 — adaptateur | l’adaptateur par défaut parle au kit du fournisseur (T2) | démontrée contre le double du harnais | test_ladaptateur_par_defaut_parle_au_vrai_kit (py et js) |
| 16 | Les deux langages | rapport identique sur quarante-huit cas (vingt-quatre textes × deux conventions) | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 17 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 18 | N1 unavailable_reason | « les modèles français […] en portent quatre […] et aucune ne désigne une somme » | vérifiée à la source, non testée | — |

## La mesure de latence

Sur la machine de travail : **0,51 ms en Python et 0,15 ms en JavaScript** pour
une facture de 730 caractères ; **14,5 ms et 4,9 ms** pour un document de
20 700 caractères. La classe affichée est `~10 ms`, qui est celle du document,
pas celle de la ligne. Les tests ne gardent que des bornes d’effondrement :
mille lectures d’un devis en moins de vingt secondes, et un texte de six mille
montants en moins de soixante.

## Le chiffre qui porte le verdict

Il n’y en a pas : le verdict tient à ce que l’outil rend, pas à ce qu’il coûte.
Sur la ligne de facture du test, `price-parser` rend 2026 et l’extrait de la
fiche rend le total. C’est la seule comparaison qui compte.

## Ce que la recherche a établi

| Outil | Version | Licence | Publié | Retenu |
|---|---|---|---|---|
| `price-parser` (PyPI) | 0.5.1 | BSD 3-Clause | 19 mars 2026 | nommé, mesuré, pas appelé : il lit **un** prix dans **une** chaîne |
| `price-parser` (npm) | 3.4.0 | ISC | 29 novembre 2018 | écarté : huit ans sans publication |
| `parse-price` (npm) | 1.1.8 | MIT | 28 mars 2018 | écarté : même raison |
| `dinero.js` | 2.0.2 | MIT | 13 mars 2026 | écarté : il calcule et met en forme, il ne lit pas un texte |
| `babel` | 2.18.0 | BSD 3-Clause | 1er février 2026 | non retenu : il donne les conventions CLDR, mais parse une chaîne qu’on lui a déjà isolée |
| `fr_core_news_sm` | 3.8.0 | LGPL-LR | — | ferme le niveau N1 : quatre étiquettes, aucune pour une somme |
| `en_core_web_sm` | 3.8.0 | MIT | — | dix-huit étiquettes dont MONEY — en anglais seulement |

## Décidé seul

- **La convention est un paramètre obligatoire, pas un réglage avec défaut.**
  L’alternative écartée : déduire la convention du texte, par exemple d’après
  la langue détectée ou d’après les autres nombres du document. C’est une
  déduction qui marche presque toujours, et « presque » sur un montant est ce
  que cette fiche refuse.
- **Un montant doit porter sa marque à côté de lui.** L’alternative écartée :
  chercher la devise dans tout le texte, comme `price-parser` le fait, ce qui
  attribue l’euro d’un entête à un montant en dollars. Le prix de ce choix est
  que les montants d’un tableau dont la devise est en entête ne sont pas
  trouvés ; le rapport les compte, et le niveau N3 est là pour eux.
- **La valeur rendue est une chaîne de chiffres.** Ni `float`, ni `Decimal` :
  `Decimal` n’a pas d’équivalent en JavaScript, et rendre un `float` d’un côté
  et une chaîne de l’autre ferait deux extraits qui ne disent pas la même
  chose. La chaîne est exacte des deux côtés, et l’appelant la donne au type
  décimal de son langage.
- **Les symboles partagés ne sont pas tranchés.** « $ » rend six candidats,
  pas un pays deviné.

## Non testable, et pourquoi

Le niveau N1 est fermé sur une vérification faite à la source — la liste des
étiquettes des modèles spaCy — et non sur un test : installer un modèle par
langue pour démontrer une absence d’étiquette coûterait plus que la
vérification elle-même. La réponse d’un vrai fournisseur au niveau N3 n’est pas
vérifiée : le test exerce la requête, le décodage, la garde et les pannes
contre le double du harnais.

## Infirmé, et ce que le code fait réellement

Rien d’infirmé. Deux corrections en cours de route : la première version
cherchait la marque n’importe où dans les vingt-quatre caractères voisins, ce
qui reproduisait exactement le défaut mesuré chez `price-parser` — l’entête
attribué au mauvais montant ; la seconde version exige que la marque touche le
nombre, à une espace près.

## Défauts de production

Une divergence entre les langages levée dans l’extrait : `\d` reconnaît tous
les chiffres Unicode en Python et seulement les dix en JavaScript. Les deux
extraits écrivent la classe `[0-9]`, ce qui fait que « ١٢٣ € » n’est pas rendu
comme un montant — plutôt que rendu en Python et ignoré en JavaScript.

Le reste : une entrée qui n’est pas du texte rend un rapport avec sa raison,
une convention inconnue rend la liste de celles qui existent, un nombre dont la
forme n’est pas lisible est ignoré sans faire tomber les autres, et un
pourcentage n’est pas un montant.
