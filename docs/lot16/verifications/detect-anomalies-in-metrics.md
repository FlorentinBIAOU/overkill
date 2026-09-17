# detect-anomalies-in-metrics — vérification du lot 16

Avis d'origine : `docs/lot15/avis/detect-anomalies-in-metrics.md` (REFUSÉE).

## Motif 1 — dix à quinze réveils par jour sur une métrique saine

**Le refus.** Le `need` promet d'être réveillé « et pas le reste du temps ».
Aux réglages par défaut, une métrique saine échantillonnée à la minute signale
0,5 à 1 % de ses points, soit une dizaine par jour, et une marche franche en
signale une douzaine pour un seul incident. La fiche mesurait le chiffre dans un
test et ne le disait nulle part.

**Ce qui a été fait.** Les trois points de l'avis.

1. **La règle que tout le monde ajoute entre dans l'extrait.** `episodes` /
   `episodes` : une série de points hors limite doit tenir `consecutive`
   minutes (trois par défaut) pour compter, et un épisode ouvert n'est rendu
   qu'une fois. `anomalies` reste, point par point, pour un tableau de bord, et
   sa docstring le dit.
2. **La fiche dit le taux.** Le `verdict_rationale`, dans les deux langues :
   « ne branchez pas `anomalies` sur un téléphone : aux réglages par défaut, une
   métrique saine échantillonnée à la minute y met une dizaine de points par
   jour, le test le mesure, et une marche franche en met une douzaine pour un
   seul incident ». Et ce qu'il faut lire à la place, avec le chiffre après :
   au plus un épisode sur une semaine de bruit.
3. **Les tests bornent les épisodes.** Dans les deux langages :
   - `une journée de bruit ne produit aucun épisode aux réglages recommandés` —
     sept jours de bruit gaussien : entre 35 et 175 points au tableau de bord,
     au plus un épisode au téléphone, et le témoin à `consecutive = 1` où tous
     les points signalés sont couverts ;
   - `une marche franche ne fait qu'un épisode` — un seul épisode, qui couvre
     les douze points, avec le point qui l'a ouvert et le pire de la série.

Mesure (Python, sept jours de bruit à la minute) : 10,4 points signalés par
jour ; 0 épisode à trois points consécutifs, 0,43 par jour à deux.

## Motif 2 — l'argument pour N1 n'était démontré par aucun exemple

**Le refus.** Le verdict donnait le cas du trafic de nuit à erreurs de jour, et
le test marqué montrait que N0 sonne **aussi** pour ces minutes. Aucun test ne
montrait la minute où N0 se tait et N1 parle.

**Ce qui a été fait.** La série que l'avis demande est construite, à l'identique
dans les quatre fichiers de test : le trafic monte et redescend en boucle, les
erreurs et la latence le suivent, et à une seule minute le trafic est au sommet
quand les erreurs sont au plancher. Chaque valeur est dans la plage connue de sa
métrique, et sa fenêtre glissante l'accepte.

- `n0.test` : `une minute hors norme par sa seule combinaison ne sonne dans
  aucune série` — les trois séries, prises une à une, ne signalent **rien du
  tout**.
- `n1.test` : `n1 signale la minute que n0 ne voit dans aucune série` — la forêt
  signale la minute (score 0,749, contre 0,683 pour le reste de la série).

## Motif 3 — six marquages

| Marquage | État | Traitement |
|---|---|---|
| `n0` py/js `INFIRMÉ` « le seuil de 3,5 garde son sens » | périmé | Réécrit en démonstration du commentaire actuel de `NORMAL_SCALE` : le bruit gaussien franchit 3,5 écarts absolus médians dix fois plus souvent que 3,5 écarts types |
| `n0` py/js `INFIRMÉ` « N0 ne sonne pas pour les minutes de N1 » | périmé comme marquage, vivant comme problème | Remplacé par la série construite au motif 2 |
| `n0` py/js `DÉFAUT` métrique de comptage nulle | à transformer en démonstration | Réécrit : les deux erreurs isolées sonnent au défaut, `min_spread=1` les fait taire, et le témoin — une vraie rafale — sonne encore |
| `n0.test.js` `INFIRMÉ` « la même hausse » (1 440 contre 1 400) | périmé | Réécrit : les deux nombres sont affirmés tels quels |
| `n0.test.js` `INFIRMÉ` « aucun écart n'approche l'écart toléré » | périmé | Réécrit sur la phrase actuelle du `why` : l'écart atteint 73 % de la limite sans la franchir |
| `n1` py/js `INFIRMÉ` « la taille de la forêt est la seule molette » | périmé | Réécrit sur la phrase actuelle : la molette est le seuil |

Cinq noms de test portaient encore un préfixe `defaut` ou `constat` sans
marquage : renommés.

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/detect-anomalies-in-metrics/
(aucune sortie)
$ node scripts/test-snippets.mjs detect-anomalies-in-metrics
  ok        detect-anomalies-in-metrics        2 py, 2 js
```

## Remarques non bloquantes de l'avis

- **Le livre SRE.** Le verdict le cite pour ce qu'il dit : alerter sur les
  symptômes que voit l'utilisateur plutôt que sur l'inhabituel, et ce détecteur
  sert mieux un tableau de bord qu'un réveil.
- **Aucune saisonnalité.** Une demi-phrase ajoutée au `breaking_point` de N0 :
  une montée quotidienne rapide, un lundi matin après une nuit de dimanche,
  sonne pour la même raison.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts, aucun marquage.
