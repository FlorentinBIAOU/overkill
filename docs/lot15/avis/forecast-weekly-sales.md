# forecast-weekly-sales — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs forecast-weekly-sales` : vert, 2 py, 2 js.

### Raisons du refus

1. **[solidité du verdict]** `verdict_rationale` : « N1 […] estime la pente que
   N0 ignore, ce qui est exactement ce qui rate quand l'activité bouge ». Les
   séries du test de N1 disent le contraire sur le mouvement le plus courant
   qu'un commerce subit — un changement de niveau. Exécuté avec les séries de
   `n1.test.py` :

   | Série | Vérité | N0 | N1 |
   |---|---|---|---|
   | `HISTORY` (croissance régulière) | 1 464 | 1 254 (−14 %) | 1 482 (+1 %) |
   | `REGIME_CHANGE` (concurrent, −30 % sur 20 semaines) | 1 025 | 995 (−3 %) | 1 310 (+28 %) |

   Quand un concurrent ouvre, N0 se recale en quatre semaines et N1 se trompe
   de près d'un tiers, en lisant encore une croissance. Le verdict ne le dit
   nulle part : il présente N1 comme la réponse au mouvement de l'activité,
   alors qu'il ne répond qu'à un seul mouvement, la tendance régulière, et
   qu'il aggrave l'autre. Le `scenario` promet « la croissance annuelle lue dans
   vos propres ventes » : sur la série du concurrent, ce coefficient vaut plus
   de 80 pains par an sur un commerce qui en a perdu 30 %.

   Ce qu'il faut faire, au choix :
   - **Changer l'approche de N1** pour celle qu'un prévisionniste retiendrait
     sur une série unique hebdomadaire : un lissage exponentiel avec tendance
     et saisonnalité (Holt-Winters, *Forecasting: Principles and Practice*,
     chapitre 8, déjà cité par la fiche pour d'autres sections). Il estime une
     pente **et** pondère les semaines récentes, donc il traite les deux cas du
     tableau. `statsmodels` le fournit en Python ; en JavaScript, la récurrence
     tient en une vingtaine de lignes.
   - **Ou garder les moindres carrés et récrire le verdict** : N1 gagne sur une
     tendance régulière, N0 gagne sur un changement de niveau ; donner le
     tableau ci-dessus (ou ses deux lignes en phrase) ; et dire comment choisir
     — comparer les deux sur les dernières semaines tenues à l'écart de
     l'ajustement. Dans ce cas, l'`escalate_when` de N0 (« toujours sous le
     réalisé pendant que vous grandissez, toujours au-dessus pendant que vous
     reculez ») doit être restreint à la croissance : N1 ne corrige pas le recul
     par palier, il l'empire.

   C'est fait quand un test, deux langages, compare N0 et N1 sur
   `REGIME_CHANGE` et que la fiche dit ce que ce test montre.

2. **[preuves]** `n1.test.py` / `n1.test.js`, `growing_shop` : la série
   « vérité » est construite **exactement dans la forme du modèle N1** — une
   constante, une droite, une sinusoïde annuelle et sa seconde harmonique (les
   deux paires de `harmonics=2`), plus une ondulation de 20. Le test « prévoit à
   deux pour cent près » démontre que les moindres carrés retrouvent les
   coefficients d'une série qu'ils décrivent par construction ; il ne démontre
   rien sur des ventes. Le verdict s'appuie sur ce test (« un test qui relit la
   pente dans la série »).

   Ce qu'il faut faire : ajouter une série de témoin qui **n'est pas** de la
   forme du modèle — un pic de Noël étroit sur deux ou trois semaines, une
   semaine fermée en août, du bruit multiplicatif — et publier ce que N0 et N1
   y font. Si l'écart en faveur de N1 disparaît, le verdict doit le dire.
   Sinon, retirer du verdict l'appui sur « un test qui relit la pente ».

### Remarques non bloquantes

- `season_length = 52` : une année compte 52,18 semaines, et l'année ISO en
  compte 53 tous les cinq ou six ans. Sur trois ans, le pic de Noël glisse d'une
  semaine environ. N1 accepte une période non entière (`calendar_features` ne
  fait que de la trigonométrie) : passer `365.25 / 7` par défaut est gratuit et
  c'est ce que recommande FPP3 pour les données hebdomadaires. N0, qui indexe
  par `week % season_length`, ne le peut pas : le dire en une phrase.
- La docstring de N1 le reconnaît : deux paires d'harmoniques n'atteignent pas
  la hauteur d'un pic de quelques semaines. Pour un commerce, c'est la semaine
  de Noël qu'on sous-prévoit, celle où la rupture de stock coûte le plus. Le
  dire dans le `breaking_point`, ou donner une valeur de `harmonics` adaptée.
- Aucune des deux prévisions ne rend d'intervalle. Celui qui commande le stock
  a besoin d'un ordre de grandeur de l'erreur autant que du point ; une phrase
  suffit.
- `unavailable_reason` N3 : bon argument (rejouer, expliquer), et la phrase du
  `scenario` sur le non-déterminisme par défaut est sourcée.

### Ce qui est solide

- Le cas est réel, et refuser N3 pour une prévision qu'on ne peut ni rejouer ni
  expliquer est exactement l'argument qu'on tient devant un acheteur.
- Les gardes de production sont justes : refus d'un historique trop court,
  d'une semaine manquante (NaN), d'une fenêtre nulle, semaine fermée à
  coefficient nul.
- Montrer le coefficient de croissance au commerçant avant la prévision est un
  vrai réflexe de terrain — à condition qu'il ne lise pas une croissance sur un
  commerce qui recule (point 1).
