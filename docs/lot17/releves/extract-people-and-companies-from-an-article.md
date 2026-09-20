# extract-people-and-companies-from-an-article — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « dans « Le colis a été livré par Boulanger », le nom revient `unknown` » | démontrée | test_point_de_rupture_un_nom_sans_marqueur_nest_pas_type |
| 2 | N0 breaking_point | « le témoin tranche dans les deux sens : « la société » devant […] et « M. » devant » | démontrée | test_point_de_rupture_temoin_un_marqueur_tranche_dans_les_deux_sens |
| 3 | N0 docstring | les trois familles de marqueurs — civilité, forme juridique, amorce | démontrée | test_les_trois_familles_de_marqueurs_sont_reconnues |
| 4 | verdict_rationale | « « et » n’est pas admis à l’intérieur d’un nom » — et pourquoi | démontrée dans les deux sens | test_et_ne_tient_pas_un_nom_ensemble_et_la_fiche_le_dit |
| 5 | N0 docstring | « un mot capitalisé seul en tête de phrase n’est pas rendu », et il est compté | démontrée | test_un_mot_capitalise_en_tete_de_phrase_est_compte_pas_rendu |
| 6 | N0 — particules | « Jean de La Fontaine » et « Jean d’Artagnan » tiennent ensemble | démontrée | test_une_particule_tient_un_nom_ensemble, test_les_trois_familles… |
| 7 | N2 breaking_point | « « Lyon » rendu comme une entreprise entre dans la liste comme une entreprise » | démontrée | test_point_de_rupture_le_modele_type_tout_et_ne_rend_aucun_doute |
| 8 | N2 breaking_point | « le témoin : sur ce même nom, le niveau N0 répond `unknown` » | démontrée | test_point_de_rupture_temoin_le_niveau_n0_repond_unknown_sur_le_meme_nom |
| 9 | N2 docstring | « `MISC` est écarté plutôt que deviné, et compté » | démontrée | test_une_etiquette_non_cartographiee_est_ecartee_et_comptee |
| 10 | N2 docstring | ce que le code vérifie : le nom figure dans le texte envoyé | démontrée | test_un_nom_absent_du_texte_envoye_est_ecarte |
| 11 | N2 — exploitation | le plafond coupe, le lot part en une fois, la panne est nommée | démontrées | test_le_texte_est_coupe_au_budget…, test_le_lot_est_envoye_en_une_fois, test_une_panne_du_modele_est_nommee |
| 12 | Les deux langages | rapport identique du niveau N0 sur seize textes | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 13 | N0 latency `~10 ms` | classe de latence | mesurée | voir ci-dessous |
| 14 | N2 latency `~100 ms` | classe de latence | **non mesurée** : le modèle n’est pas installé | voir ci-dessous |
| 15 | N1 unavailable_reason | « il demande un corpus annoté entité par entité » | vérifiée à la source, non testée | — |

## La mesure de latence

Niveau N0, sur la machine de travail, pour un texte de 2 660 caractères :
**0,66 ms en Python et 0,11 ms en JavaScript**. La classe affichée est
`~10 ms`, qui est celle d’un article entier.

Niveau N2 : la classe `~100 ms` est celle d’un petit pipeline de
reconnaissance d’entités sur processeur, par document. **Elle n’est pas
mesurée ici** : le modèle n’est pas installé, et la suite de tests n’exécute
que le code autour de lui, contre le double du harnais. Ce qui est mesuré, et
borné dans le test, est ce code-là : cinq cents lectures en moins de dix
secondes.

## Le chiffre qui porte le verdict

Aucun chiffre : le verdict tient à ce que chaque niveau peut affirmer. Le
niveau N0 type quatre noms sur cinq en `unknown` sur le paragraphe du test ;
le niveau N2 les type tous. L’essai figé de la fiche affiche les deux réponses
côte à côte, à chaque cas, et c’est la comparaison elle-même qui est calculée.

## Ce que la recherche a établi

| Outil | Version | Licence | Publié | Retenu |
|---|---|---|---|---|
| spaCy (bibliothèque) | 3.8.16 | MIT | 24 août 2026 | retenu en N2, côté Python |
| `fr_core_news_sm` | 3.8.0 | **LGPL-LR** | — | le modèle, dont la licence n’est pas celle de la bibliothèque |
| `en_core_web_sm` | 3.8.0 | MIT | — | dix-huit étiquettes, contre quatre en français |
| `@huggingface/transformers` | 4.3.0 | Apache-2.0 | 16 septembre 2026 | retenu en N2, côté JavaScript |
| `compromise` | 14.17.0 | MIT | 10 septembre 2026 | écarté : « a common-sense baseline for english grammar » ; `fr-compromise` en est à 0.3.1 |
| `wink-ner` | 2.1.0 | MIT | 17 janvier 2020 | écarté : « language agnostic » veut dire ici qu’on lui fournit la liste des entités |
| `sklearn-crfsuite` | 0.5.0 | MIT | 18 juin 2024 | ferme le niveau N1 : il réclame un corpus annoté |
| `stanza`, `flair` | 1.14.0, 0.15.1 | Apache-2.0, MIT | 2026, 2025 | non retenus : même rôle que spaCy, modèles plus lourds |

La langue a décidé plus que la bibliothèque : **le même travail est desservi
par dix-huit étiquettes en anglais et par quatre en français**, et la
quatrième, `MISC`, ne veut rien dire de précis. C’est la mesure qui a fixé la
forme du niveau N2 : traduire ce qui se traduit, compter le reste.

## Décidé seul

- **Le verdict est N2, et c’est le premier de ce lot à recommander un modèle.**
  L’alternative écartée : rester à N0 et laisser le lecteur avec une liste
  d’`unknown`. Elle serait malhonnête, puisque l’énoncé demande le type. Le
  modèle retenu est local, gratuit et déterministe : la frugalité n’est pas
  l’absence de modèle, c’est l’absence d’appel facturé et de sortie de données.
- **« et » et « and » sont retirés des particules.** Les garder fusionne
  « Alex Ferguson et Acme » en une entité, ce qui invente ; les retirer coupe
  « Marks and Spencer » en deux, ce qui perd. Inventer est pire, et les deux
  effets sont dans le même test.
- **La civilité est retirée du nom rendu.** « Mme Marie Martin » revient
  « Marie Martin », avec `evidence: "mme"` : la preuve n’est pas le nom.
- **Un mot capitalisé seul en tête de phrase n’est pas rendu, mais il est
  compté.** L’alternative écartée : le rendre, et noyer la liste sous les
  premiers mots de chaque phrase.
- **Une portion rendue par le modèle mais absente du texte envoyé est
  écartée.** C’est la même garde que les niveaux N3 de ce lot, appliquée à un
  modèle local.

## Non testable, et pourquoi

Le niveau N1 est fermé sur la nature de l’outil — un champ aléatoire
conditionnel réclame un corpus annoté — et non sur un test. La qualité du
modèle du niveau N2 n’est pas mesurée : il n’est pas installé, et la fiche ne
lui attribue aucun chiffre de performance.

## Infirmé, et ce que le code fait réellement

Trois corrections en cours de route, toutes sur la tokenisation :

- la civilité « Dr » ou « Sir », qui porte une majuscule et pas de point,
  entrait dans le nom ;
- « L’enseigne Marks » : l’apostrophe étant dans le mot, l’article français
  entrait dans le nom. L’apostrophe est devenue un séparateur, et un
  séparateur qui **joint** deux mots d’un même nom — « Jean d’Artagnan » ;
- une lettre capitale seule — le « A » de « de A à Z » — était rendue comme un
  nom inconnu.

## Défauts de production

Le reste : une entrée qui n’est pas du texte rend un rapport avec sa raison, un
texte vide rend une liste vide, un lot dont un élément n’est pas du texte ne
fait pas tomber les autres, et un nom en alphabet grec est trouvé comme un nom
latin — sans être typé, faute de marqueur grec dans la liste déclarée.
