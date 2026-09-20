# know-whether-a-pdf-needs-ocr — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « ses 183 caractères la rangent parmi les pages lisibles » | démontrée | test_point_de_rupture_une_couche_texte_illisible_compte_comme_du_texte |
| 2 | N0 breaking_point | « le témoin : une page de contrat ordinaire en rend 224 et reçoit exactement le même verdict » | démontrée | test_point_de_rupture_temoin_une_vraie_page_de_texte_est_rangee_pareil |
| 3 | N0 docstring, scénario | « one file with two kinds of page in it » | démontrée | test_la_decision_est_prise_page_par_page |
| 4 | N0 docstring, verdict_rationale | « a scanned page often carries a header […] which a rule that only asks "is there any text" counts as a readable page » | démontrée | test_un_scan_qui_porte_un_entete_en_vrai_texte_reste_un_scan (les deux règles sur le même document, R4) |
| 5 | N0 docstring | « nothing at all is a page OCR would return empty » | démontrée | test_une_page_sans_texte_et_sans_image_nest_pas_envoyee_a_locr |
| 6 | N0 — réglage par défaut (R7) | ce que le seuil de 120 caractères produit | démontrée | test_le_seuil_est_reglable_et_son_effet_est_visible, test_production_valeurs_aux_limites |
| 7 | N1 breaking_point | « un tableau de montants […] marque −4,10 pour un seuil à −2,69 » | démontrée | test_point_de_rupture_une_page_de_chiffres_nest_pas_de_la_langue |
| 8 | N1 breaking_point | « le témoin : une page de contrat marque −2,39 » | démontrée | test_point_de_rupture_temoin_une_page_de_prose_passe_largement |
| 9 | verdict_rationale | « il attrape la page cassée que N0 laisse passer » | démontrée | test_n1_attrape_la_page_que_n0_avait_rangee_parmi_les_lisibles (T4 : les deux niveaux sur le point de rupture de N0) |
| 10 | N1 docstring | « The threshold comes from […] the lowest score among the training pages, with a margin » | démontrée | test_le_seuil_vient_du_lot_dentrainement_et_de_rien_dautre |
| 11 | N1 docstring | « the reference is your documents, in your language » | démontrée | test_une_autre_langue_sur_le_meme_alphabet_tombe_sous_le_seuil (T3 : une entrée qui viole l’hypothèse du modèle) |
| 12 | N1 — reproductibilité | le modèle ne tire rien au hasard | démontrée | test_le_modele_est_reproductible_et_ne_depend_daucun_tirage |
| 13 | N0 latency `~10 ms`, N1 `<1 ms` | classes de latence | mesurées | voir ci-dessous |
| 14 | N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure, pas de code à exécuter | — |

## Les mesures de latence

Sur la machine de travail, après une passe de chauffe :

- **N0** : deux cents tris du document de trois pages — **1,310 ms en Python,
  2,442 ms en JavaScript**, soit environ 0,5 à 0,8 ms par page. La classe
  affichée est `~10 ms` pour un document. Le test ne garde qu’une borne
  d’effondrement : cent tris en moins de soixante secondes.
- **N1** : vingt mille notations d’une page — **0,0373 ms en Python, 0,0160 ms
  en JavaScript**. La classe affichée est `<1 ms`.

## Les documents d’exemple

Les sept PDF des tests sont fabriqués pour eux, sans bibliothèque d’écriture :
un générateur d’une soixantaine de lignes pose le catalogue, l’arbre de pages,
les flux de contenu et la table de références croisées. Ils vivent dans
`fixtures.py` et `fixtures.mjs`, compressés puis encodés en base64, parce que
les deux niveaux travaillent sur les mêmes pages et que les deux langages
doivent voir exactement les mêmes octets.

## Une divergence d’extraction, contournée dans les données d’exemple

`pypdf` rend l’apostrophe droite du codage standard d’Helvetica telle quelle,
`pdf.js` la rend en apostrophe typographique. Le nombre de caractères est le
même des deux côtés, mais la chaîne ne l’est pas. La page cassée d’exemple a
donc été écrite sans apostrophe, plutôt que d’assortir l’assertion d’une
exception qui aurait masqué le fait.

## Non testable, et pourquoi

N2 et N3 sont fermés par un argument de structure. Qu’un modèle de vision
« sache » lire une page n’est pas testable ici, et ce n’est pas ce que la fiche
lui reproche : elle lui reproche d’exiger l’appel qu’on cherche à éviter.

## Infirmé, et ce que le code fait réellement

Rien.

## Défauts de production

Rien. Les deux extraits rendent une raison sur un fichier illisible et ne
lèvent pas. Un PDF tronqué à quatre endroits différents est traité sans
exception.
