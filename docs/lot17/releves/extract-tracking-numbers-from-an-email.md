# extract-tracking-numbers-from-an-email — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « demander la famille « dix chiffres » rend aussi le numéro de commande et le numéro de téléphone du même message » | démontrée | test_point_de_rupture_une_famille_sans_chiffre_de_controle_attrape_tout |
| 2 | N0 breaking_point | « le témoin : le numéro postal revient vérifié, et le même avec un chiffre recopié de travers revient refusé » | démontrée | test_point_de_rupture_temoin_ce_qui_porte_un_controle_est_verifie |
| 3 | verdict_rationale, R10 | « l’extrait reproduit l’exemple que la norme donne elle-même » | démontrée contre la norme | test_lexemple_de_la_norme_est_reproduit |
| 4 | verdict_rationale | « sur les soixante-douze substitutions d’un chiffre […] aucune ne passe » | **mesurée** | test_le_controle_attrape_toute_substitution_dun_chiffre |
| 5 | verdict_rationale | « et les sept transpositions de deux chiffres voisins » | **mesurée** | test_le_controle_attrape_toute_transposition_de_deux_chiffres_voisins |
| 6 | N0 docstring | l’autre face du même chiffre : un seul chiffre de contrôle sur dix convient | mesurée | test_un_numero_tire_au_hasard_passe_une_fois_sur_dix |
| 7 | verdict_rationale | « les indicatifs de service que la norme réserve […] ne sont pas des numéros » | démontrée | test_les_indicatifs_reserves_par_la_norme_ne_sont_pas_des_numeros |
| 8 | N0 docstring | « elles ne sont pas cherchées si l’appelant ne le demande pas » | démontrée | test_les_familles_sans_controle_ne_sont_pas_cherchees_par_defaut |
| 9 | N0 — le rapport | chaque résultat dit sa famille, son transporteur possible et ce qu’il vaut | démontrée | test_chaque_resultat_dit_ce_quil_vaut |
| 10 | Les deux langages | rapport identique sur vingt cas (dix textes × deux jeux de familles) | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure et de volume | — |

## La mesure de latence

Sur la machine de travail, pour une confirmation d'expédition de 176
caractères : **0,0069 ms en Python et 0,0010 ms en JavaScript**. La classe
affichée est `<1 ms`. Les tests ne gardent que des bornes d'effondrement : dix
mille lectures en moins de vingt secondes, et un message de trois millions et
demi de caractères en moins de soixante.

## Le chiffre qui porte le verdict

Le chiffre de contrôle lui-même, et ce qu'il attrape. Sur le numéro de série
que la norme donne en exemple :

| Altération | Cas possibles | Non détectées |
|---|---|---|
| un chiffre remplacé par un autre | 72 | **0** |
| deux chiffres voisins échangés | 7 | **0** |
| un chiffre de contrôle tiré au hasard | 10 | 9 refusés, 1 accepté |

C'est exactement ce que la norme annonce — « to support the detection of
substitution and transposition errors which can occur during data capture » —
et c'est ce qui sépare ce niveau d'une expression régulière.

## Ce que la recherche a établi

La norme elle-même, et rien d'autre : **UPU S10-12, édition 2018**, lue dans le
document publié par l'Union postale universelle. Section 5.4 pour le chiffre de
contrôle, avec son exemple ; section 5.2 pour les indicatifs de service
réservés. Aucune bibliothèque n'a été retenue : le calcul tient en trois lignes
et les paquets qui le font — `tracking-number` et ses équivalents — apportent
surtout des tables de transporteurs qui changent plus vite qu'eux.

Ce qui a été laissé de côté, et pourquoi :

- **le chiffre de contrôle d'UPS** : la forme `1Z` + seize caractères est
  reconnue, mais son calcul n'a pas été trouvé dans une source publiée par
  UPS ; l'extrait ne l'invente pas et rend `checked: false` en le disant ;
- **DHL Express** : même raison. La famille « dix chiffres » est déclarée,
  nommée, et laissée hors de la recherche par défaut ;
- **le code pays** du numéro S10 n'est pas vérifié contre la liste ISO 3166 :
  il faudrait embarquer la liste, et une lettre fausse y est déjà attrapée par
  la forme.

## Décidé seul

- **Les familles sans contrôle ne sont pas cherchées par défaut.** C'est la
  décision qui fait la fiche. L'alternative écartée : tout rendre et laisser
  l'appelant trier — mais un rapport où le numéro de téléphone du pied de page
  apparaît comme une référence de colis est un rapport qu'on cesse de lire.
- **Un indicatif de service réservé fait disparaître le candidat**, il ne le
  rend pas « non vérifié ». La norme dit que ces combinaisons ne peuvent pas
  être attribuées : ce n'est pas un numéro douteux, ce n'est pas un numéro.
- **La casse est significative.** La norme écrit les lettres en majuscules ;
  accepter « rb123456785gb » reviendrait à décider à la place de l'appelant
  qu'un texte en minuscules est le même identifiant.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure et de volume. Ce
que la fiche ne fait pas est dit dans l'`escalate_when` : elle ne dit pas où
est le colis, elle dit quel numéro est lisible et lequel ne l'est pas.

## Infirmé, et ce que le code fait réellement

Rien d'infirmé : l'algorithme a été écrit d'après la norme, et l'exemple de la
norme est passé du premier coup.

## Défauts de production

Le reste : une entrée qui n'est pas du texte rend un rapport avec sa raison,
une famille inconnue est nommée, un numéro collé à d'autres caractères n'est
pas un numéro, un numéro abîmé n'empêche pas de lire les suivants, et les
chiffres arabes ne sont pas des chiffres pour la norme — la classe `[0-9]` est
écrite en toutes lettres des deux côtés.
