# extract-the-latest-reply-from-an-email-thread — relevé

| # | Où | Affirmation (citée) | Statut | Test |
|---|---|---|---|---|
| 1 | N0 breaking_point | « sur un fil où « Oui, il est signé de ce matin. » répond sous la question citée, la coupe ne rend rien » | démontrée | test_point_de_rupture_une_reponse_ecrite_dans_la_citation_nest_pas_au_dessus |
| 2 | N0 breaking_point | « le témoin : le fil ordinaire […] revient entier, signature comprise » | démontrée | test_point_de_rupture_temoin_le_fil_ordinaire_revient_entier |
| 3 | verdict_rationale | « la première laisse « Le 10 octobre 2026 à 13:55, Marie Martin a écrit : » dans la réponse » | démontrée, contre la bibliothèque installée | test_verdict_les_deux_bibliotheques_de_reference_se_contredisent_en_francais |
| 4 | verdict_rationale | « la seconde […] retire aussi la signature, parce que « Bien à vous, » figure dans sa liste de formules de politesse quand « Best, » n’y est pas » | démontrée, contre la bibliothèque installée | idem, et n0.test.js : verdict — la bibliothèque de référence retire en français… |
| 5 | N0 docstring | « les marqueurs sont écrits ici, les français compris » — quatre familles | démontrée | test_les_quatre_familles_de_marqueurs_sont_reconnues |
| 6 | N0 docstring | « la signature n’est pas retirée » | démontrée | test_la_signature_nest_pas_retiree |
| 7 | N0 docstring | l’attribution repliée par Gmail sur trois lignes reste un marqueur | démontrée | test_une_attribution_repliee_sur_trois_lignes_est_reconnue |
| 8 | N0 escalate_when | « le rapport signale qu’il y a plus de texte sous la citation qu’au-dessus » | démontrée, et bornée | test_sous_un_bloc_recopie_rien_ne_distingue_une_reponse_de_lancien_message |
| 9 | N3 breaking_point | « sur un fil Outlook, les lignes de l’ancien message passent la garde » | démontrée | test_point_de_rupture_la_garde_refuse_une_ligne_citee_pas_une_ligne_ancienne |
| 10 | N3 breaking_point | « le témoin : la ligne citée est refusée et rendue dans `dropped` » | démontrée | test_point_de_rupture_temoin_une_ligne_citee_est_bien_ecartee |
| 11 | N3 docstring | « la réponse rendue est faite de lignes du fil, dans leur ordre » | démontrée | test_la_reponse_est_faite_de_lignes_du_fil_dans_leur_ordre, test_un_numero_qui_nest_pas_une_ligne_du_fil_est_ecarte |
| 12 | N3 — adaptateur | l’adaptateur par défaut parle au kit du fournisseur (T2) | démontrée contre le double du harnais | test_ladaptateur_par_defaut_parle_au_vrai_kit (py et js) |
| 13 | Les deux langages | rapport identique sur dix-huit fils | démontrée | test_python_et_javascript_rendent_le_meme_rapport |
| 14 | N0 latency `<1 ms` | classe de latence | mesurée | voir ci-dessous |
| 15 | N1 / N2 unavailable_reason | absence de niveau | non testable : argument de maintenance et de volume | — |

## La mesure de latence

Cinquante mille coupes du fil français de référence, sur la machine de travail :
**0,0099 ms par message en Python, 0,0030 ms en JavaScript**. La classe
affichée est `<1 ms`. Les tests ne gardent que des bornes d’effondrement : dix
mille coupes en moins de vingt secondes, et un fil de deux cent mille lignes
citées en moins de dix.

## Le chiffre qui porte le verdict

Le volume : quelques microsecondes par message contre un aller-retour réseau,
sur une boîte aux lettres qui reçoit des milliers de messages par jour. La
comparaison n’a pas besoin d’être raffinée.

## Divergence entre les bibliothèques de référence, mesurée

Le cœur de cette fiche. Sur le **même** fil français, avec les versions
installées ici :

| | `email_reply_parser` 0.5.12 (Python) | `email-reply-parser` 2.3.9 (JavaScript) |
|---|---|---|
| en-tête « Le … a écrit : » | **laissé dans la réponse** | coupé |
| signature « Bien à vous, / Jean Dupont » | gardée | **retirée** |
| la même signature en anglais (« Best, / Jean ») | gardée | gardée |
| fil Outlook français | correct | correct |

La cause du second écart est lisible dans la source de la bibliothèque
JavaScript, `src/regex.js` : sa liste de signatures contient
`/^Bien . vous,?!?$/mi` et `/^\w{0,20}\s?cordialement,?!?$/mi` pour le
français, là où l’anglais n’a que `Cheers,`, `Best wishes,` et `Regards,`. Une
formule française courante ouvre donc une signature, et « Best, » non. Ce n’est
pas un défaut de la bibliothèque prise seule ; c’en est un pour une fiche qui
montre les deux langages côte à côte.

D’où la décision : écrire les marqueurs dans l’extrait, les français compris,
et ne pas toucher à la signature. C’est l’exception prévue par R6 — l’outil de
référence ne sert pas la langue du lecteur — et non une réécriture de ce qu’une
bibliothèque mûre fait déjà.

## Décidé seul

- **La signature n’est pas retirée.** L’intitulé de la feuille de route
  mentionnait « et la signature qui l’accompagnent » ; une autre entrée de la
  feuille de route, `strip-quotes-and-signatures-from-emails`, porte déjà ce
  sujet. Le `need` de la feuille de route a été aligné sur ce que la fiche fait
  réellement. L’alternative écartée : reprendre la liste de formules de
  politesse de la bibliothèque JavaScript, qui est courte, propre à quelques
  langues, et qui ferait disparaître un message dont le corps est un nom.
- **La détection du texte écrit sous la citation ne vaut que sous une citation
  préfixée.** Sous le trait d’Outlook, l’ancien message n’est pas préfixé non
  plus : le mesurer ferait crier tous les fils normaux. Le test le dit, et la
  fiche aussi — sous un bloc recopié, une réponse écrite dessous est perdue
  sans que personne le sache.
- **Le niveau N3 rend des numéros de ligne, pas du texte.** La garde devient
  alors vérifiable en entier : ce qui revient est fait de lignes du message
  envoyé, ou est écarté. L’alternative écartée : demander le texte et le
  chercher dans le fil, comme dans la fiche des pages marchandes, ce qui
  laisse passer une reformulation partielle.

## Non testable, et pourquoi

N1 et N2 sont fermés par un argument de maintenance (`talon` 1.4.4, publié le
24 août 2017) et de volume. La réponse d’un vrai fournisseur au niveau N3 n’est
pas vérifiée : le test exerce la requête envoyée, le décodage, la garde et les
pannes contre le double du harnais.

## Infirmé, et ce que le code fait réellement

Rien d’infirmé. Un point corrigé en cours de route : la première version
cherchait la fin de l’attribution dans une fenêtre de trois lignes jointes, ce
qui ne pouvait pas correspondre quand l’attribution tenait sur une seule ligne
suivie de lignes citées. La fenêtre est maintenant essayée à une, deux puis
trois lignes.

## Défauts de production

Deux différences entre les langages ont été levées dans l’extrait plutôt que
subies :

- `str.splitlines()` coupe sur le saut de page et sur U+2028, `String.split`
  non : le découpage se fait sur `\r\n|\r|\n` des deux côtés.
- La marque d’ordre des octets est une espace pour `String.trim` et pas pour
  `str.strip`, et les séparateurs C1 sont l’inverse. Les uns et les autres sont
  retirés avant la coupe, par la même expression dans les deux langages.

Le reste : une entrée qui n’est pas du texte rend un rapport avec sa raison, un
fil vide rend une réponse vide sans raison, et un lot dont un élément est nul
n’empêche pas de lire les autres.
