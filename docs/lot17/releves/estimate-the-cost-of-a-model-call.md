# estimate-the-cost-of-a-model-call — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « les mêmes 4 800 caractères […] font 1 200 jetons, et à deux caractères et demi, 1 920 » | démontrée | test_point_de_rupture_une_estimation_depend_du_rapport_quon_a_declare |
| 2 | N0 breaking_point | « le témoin : le rapport dit toujours si les jetons ont été comptés ou estimés » | démontrée | test_point_de_rupture_temoin_le_rapport_dit_toujours_sil_a_compte_ou_estime |
| 3 | verdict_rationale | « un test relit le fichier pour vérifier qu’aucun symbole monétaire ni aucun code de devise n’y figure » | démontrée, sur le fichier lui-même | test_lextrait_ne_porte_aucun_prix (py et js) |
| 4 | verdict_rationale | « tous les montants rendus sont dans l’unité que l’appelant leur a donnée » | démontrée | test_le_resultat_est_dans_lunite_des_prix_donnes |
| 5 | verdict_rationale | « il ne passe par aucun flottant » | démontrée | test_le_calcul_est_exact_et_ne_passe_par_aucun_flottant |
| 6 | N0 docstring | « `break_even_items` est le nombre d’appels à partir duquel la facture atteint le coût unique » | démontrée aux deux bords | test_le_seuil_de_bascule_est_le_premier_appel_qui_depasse |
| 7 | N0 docstring | « une part de jeton est facturée comme un jeton » | démontrée | test_une_fraction_de_jeton_est_facturee_comme_un_jeton |
| 8 | N0 docstring | « l’unité est un paramètre, parce que c’est une convention » | démontrée | test_lunite_de_prix_est_un_parametre |
| 9 | N0 — refus nommés | chaque entrée impossible rend sa raison | démontrées, cinq cas | test_chaque_entree_impossible_est_nommee |
| 10 | Les deux langages | rapport identique sur quatorze jeux de paramètres | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 11 | N0 latency `<1 ms` | classe de latence | mesurée | borne : cent mille estimations en moins de vingt secondes |
| 12 | N1 / N2 / N3 unavailable_reason | absence de niveau | non testable : argument de structure | — |

## Le chiffre qui porte le verdict

Il n'y en a aucun, et c'est le sujet. **Cette fiche est la seule du lot à ne
contenir délibérément aucun chiffre de tarif**, et c'est vérifié par un test
qui relit le fichier source à la recherche d'un symbole monétaire, d'un code
ISO de devise ou d'un dollar suivi d'un chiffre. Les exemples de la fiche et de
l'essai emploient des prix que l'appelant donne, et tous les montants rendus
sont dans son unité.

Ce que la fiche mesure, en revanche, c'est l'écart entre deux estimations
également défendables : 4 800 caractères font 1 200 jetons à quatre caractères
par jeton et 1 920 à deux et demi. Sur le travail entier de l'essai, la facture
passe de 3,60 à 4,68 dans l'unité de l'appelant — un tiers de plus, sans qu'une
ligne du texte ait changé.

## Ce que la recherche a établi

| Outil | Version | Licence | Publié | Retenu |
|---|---|---|---|---|
| `tiktoken` (PyPI) | 0.14.0 | MIT | 17 août 2026 | nommé : c'est lui qui compte exactement, côté Python |
| `gpt-tokenizer` (npm) | 4.0.0 | MIT | 16 août 2026 | nommé : tables livrées avec le paquet, donc comptage hors ligne |
| `js-tiktoken` (npm) | 1.0.21 | MIT | 9 août 2025 | nommé : l'autre portage JavaScript |

Une condition d'exploitation vérifiée à la source et qui mérite d'être dite :
**`tiktoken` télécharge ses tables d'encodage au premier usage**, depuis une
adresse https, et les met en cache dans le dossier que désigne
`TIKTOKEN_CACHE_DIR` — c'est écrit dans `tiktoken/load.py` et dans
`tiktoken_ext/openai_public.py`. Côté JavaScript, `gpt-tokenizer` embarque les
siennes. C'est la raison pour laquelle aucun tokeniseur n'est une dépendance de
cette fiche : la suite de tests tourne hors ligne, et un extrait qui exigerait
un téléchargement au premier appel ne serait pas exécutable dans les mêmes
conditions des deux côtés.

## Décidé seul

- **Aucun prix n'est écrit, et c'est testé.** L'alternative écartée : donner un
  tarif d'exemple « pour fixer les idées ». C'est précisément l'interdit de la
  mission, et c'est aussi ce qui rend une fiche fausse six mois plus tard.
- **Le comptage des jetons n'est pas fait ici.** L'extrait accepte un nombre
  compté ou un couple caractères/rapport, et dit lequel a servi. Embarquer un
  tokeniseur aurait ajouté une dépendance lourde d'un côté, téléchargeante de
  l'autre, pour un résultat que l'appelant obtient mieux avec l'outil de son
  fournisseur.
- **Le seuil de bascule est le premier appel qui atteint le coût de
  l'alternative**, arrondi vers le haut. C'est la définition la plus utile :
  au-dessous, l'appel est moins cher ; à partir de là, il ne l'est plus.
- **Un appel gratuit n'a pas de seuil**, et le champ vaut `null` plutôt que
  l'infini ou zéro.
- **Les montants sont des chaînes de chiffres**, comme dans la fiche sur la
  somme d'une colonne : les deux fiches se lisent ensemble, et leurs sorties
  s'additionnent sans conversion.

## Non testable, et pourquoi

Les trois niveaux fermés le sont par un argument de structure. L'exactitude
d'un nombre de jetons compté par un tokeniseur n'est pas vérifiée ici : aucun
tokeniseur n'est installé, et l'extrait ne prétend pas compter — il prend le
compte qu'on lui donne et dit qu'il vient de là.

## Infirmé, et ce que le code fait réellement

Rien d'infirmé. Un ajustement en cours de route : le test qui relit le fichier
à la recherche d'un prix cherchait le caractère « $ » tout court, et trouvait
la fin d'une expression régulière en JavaScript. Il cherche désormais un tarif
— un symbole monétaire, un code ISO, ou un dollar suivi d'un chiffre.

## Défauts de production

Le reste : chaque entrée impossible rend une raison nommée plutôt qu'une
exception, un nombre d'appels négatif ou fractionnaire est refusé, une unité de
prix nulle aussi, et un montant d'un milliard d'appels à un milliard de jetons
est rendu exactement — c'est un nombre qu'aucun flottant ne représenterait.
