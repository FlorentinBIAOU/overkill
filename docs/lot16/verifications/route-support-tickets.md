# route-support-tickets — vérification du lot 16

Avis d'origine : `docs/lot15/avis/route-support-tickets.md` (REFUSÉE). Le fond
de la fiche était jugé bon ; le refus portait sur les preuves.

## Motif 1 — quatre marquages périmés

Chacun est devenu la démonstration de la phrase que la fiche porte aujourd'hui.

- **N0 (py, js), « facture déclenche aussi facturation »** → `« facturation » ne
  dérive pas de « facture », et a sa propre entrée` : le préfixe s'arrête à
  « factur-e », le mot a son entrée dans les règles, le ticket est bien routé, et
  un témoin montre que le préfixe couvre ses propres dérivés.
- **N1 (py, js), « ne recoupe aucun mot de l'archive »** → `point de rupture : le
  ticket inconnu ne partage que le mot « le »`, qui est exactement ce que le
  point de rupture affirme : la liste des termes communs au ticket et au
  vocabulaire appris vaut `["le"]`, ni plus ni moins.
- **`n1.test.py`, « avec le C par défaut, aucun ticket ne franchit le
  plancher »** → `avec le C par défaut, deux des trois tickets restent sous le
  plancher`, le chiffre que le commentaire donne, avec le témoin : avec le C de
  l'extrait, les trois le franchissent.
- **N2 (py, js), « les voisins montrés à l'agent disent quel ticket a décidé »**
  → `les voisins rendus sont un score et une équipe, pas le ticket qui a décidé`.
  La phrase a disparu de l'extrait ; le test dit maintenant ce que `neighbours`
  rend vraiment, et ce qu'il ne rend pas.

## Motif 2 — l'adaptateur N3 n'était jamais exécuté

Trois tests par langage contre `_harness/fake_sdk.py` et `fake-sdk.mjs` (règle
T2) : la requête complète (`chat.completions`, modèle, invite exacte avec la
liste des équipes et la file par défaut, température nulle), un `content` nul
qui lève `RoutingUnavailable` après trois appels, une panne du kit retentée.

**La preuve.** `node scripts/test-snippets.mjs route-support-tickets` :
**8 extraits, 4 py, 4 js, aucun échec** ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche — et `check-adaptateur` est
vert sur les trente-deux adaptateurs du catalogue.

## Remarques non bloquantes de l'avis

- **N3 levait sur un ticket de plus de quatre mille caractères.** C'est la pire
  sortie pour un routeur : le ticket n'arrive nulle part. L'extrait **tronque**
  désormais et route quand même, dans les deux langages, avec le commentaire qui
  le dit : « a router that throws leaves the ticket nowhere, and the team is
  usually decided by the first paragraph anyway ». Deux tests par langage : un
  ticket long est routé, ce qui part est le début coupé au plafond et pas un
  caractère de plus, un ticket à la limite exacte part en entier, et la coupe
  compte des points de code — jamais la moitié d'un emoji.
- **L'archive n'est pas un jeu étiqueté propre.** Entré dans le verdict, dans les
  deux langues : l'équipe qui ferme n'est pas toujours celle qui aurait dû
  recevoir, et la parade — n'entraîner que sur les tickets jamais réaffectés, ou
  sur la première équipe qui a répondu, et réentraîner quand l'organigramme
  change.
- **`C=10` choisi pour faire passer le test.** Le commentaire le dit maintenant
  dans les deux langages : « Three tickets is a demonstration, not a
  calibration: on a real archive this value is chosen by cross-validation, and
  it moves when the archive does. »
- **La frontière à gauche de N0** : les trois exemples sont nommés dans le
  commentaire et démontrés dans le test — « panne » attrape « panneau »,
  « retard » attrape « retardataire », « devis » attrape « devise ». Les deux
  exemples que l'avis proposait, « suivi » pour « suivant », ont été vérifiés et
  écartés : « suivant » ne commence pas par « suivi ».
- **Le point de rupture de N2, trop long** : ramené à deux phrases, celle qui
  pose le problème et celle qui le retourne.

## État

**Levée.** `test-snippets` vert (8 extraits) ; `check-marquages` et
`check-adaptateur` ne signalent plus cette fiche ; `check-content`,
`check-figures`, `check-french` verts (`réentraînez` ajouté au lexique).
