# route-support-tickets — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs route-support-tickets` : vert, 4 py, 4 js.

### Raisons du refus

Le fond de la fiche est bon, et le verdict tiendra. Le refus porte sur les
preuves, et il se lève sans toucher au texte.

1. **[preuves]** Marquages `INFIRMÉ` / `DÉFAUT` encore actifs (`xfail(strict=True)` en Python, `assert.rejects` en JavaScript). La charte des tests et la mission sont nettes : une fiche publiée n'en garde aucun à la fin du lot. Un marquage strict passe dès que le corps du test lève, **pour n'importe quelle raison** : un marquage oublié ne prouve plus rien et peut masquer une régression.

   - `n0` (py, js), `INFIRMÉ` : « facture déclenche aussi facturation ». **Périmé** : le commentaire dit désormais que « facturation » a sa propre entrée.
   - `n1` (py, js), `INFIRMÉ` : « Votre entrepôt accepte-t-il les visites scolaires le mercredi » ne recoupe aucun mot de l'archive. **Périmé** : le `breaking_point` dit désormais qu'il ne partage que « le ».
   - `n1.test.py`, `INFIRMÉ` : avec le `C` par défaut « no ticket ever clears a useful floor ». **Périmé** : le commentaire dit désormais « two of the three unseen tickets stay under the 0.5 floor ».
   - `n2` (py, js), `INFIRMÉ` : « the neighbours are shown to the agent as the reason for the routing ». **Périmé** : la phrase n'est plus dans `n2.py`.

   Ce qu'il faut faire : réécrire chacun de ces tests pour démontrer la phrase
   **actuelle**, sans marquage (le `breaking_point` de N1 cite « le » : le test
   doit affirmer que c'est le seul mot partagé). C'est fait quand
   `grep -rn "xfail\|INFIRMÉ\|DÉFAUT"` ne rend plus rien dans le dossier de la
   fiche.

2. **[preuves]** N3 : **aucun test ne fait tourner l'adaptateur**
   `ProviderClient` / `providerClient`. Tous injectent un client qui a déjà une
   méthode `complete`. C'est exactement l'angle mort qui a laissé les
   trente-deux extraits N3 appeler une méthode inexistante avant ce lot.
   Ce qu'il faut faire : un test par langage qui construit l'adaptateur sur
   `_harness/fake_sdk.py` / `fake-sdk.mjs`, vérifie `model`, `messages`,
   `temperature` envoyés, la lecture de `choices[0].message.content`, et le
   cas `content` nul, comme le font déjà `detect-language-of-text` ou
   `mask-personal-data-in-chat`.

### Remarques non bloquantes

- **L'archive n'est pas un jeu étiqueté propre, et le verdict repose dessus.**
  « Chacun rattaché à l'équipe qui l'a fermé » : dans un vrai outil de support,
  l'équipe qui ferme n'est souvent pas celle qui aurait dû recevoir le ticket
  — escalade vers le niveau 2, réaffectation après un premier aller-retour,
  équipes fusionnées ou renommées depuis. Un classifieur entraîné sur l'équipe
  de clôture apprend aussi ces détours. Le verdict gagnerait une phrase : filtrer
  l'archive sur les tickets jamais réaffectés, ou prendre la première équipe
  qui a répondu, et la réentraîner quand l'organigramme change. Ce n'est pas
  faux tel qu'écrit, mais c'est le premier piège qu'on rencontre en
  production.
- **`C=10` choisi pour faire passer le test.** Le commentaire de `train` le dit
  franchement (« with C=10 all three clear it ») : c'est honnête, mais un
  lecteur recopiera `C=10`. Dire que la valeur se choisit par validation
  croisée sur l'archive, pas sur trois tickets, évite qu'un réglage de
  démonstration devienne un réglage de production.
- **N0, frontière à gauche seulement.** Le commentaire en assume le prix ;
  l'exemple concret aiderait : « suivi » attrape « suivant », « retard »
  attrape « retardataire ». Une ligne.
- **N3, `MAX_CHARACTERS = 4000` qui lève.** Un ticket de support contient
  souvent un fil de courriels cité ou un journal collé : 4 000 caractères ne
  sont pas une anomalie. Pour un routeur, l'exception est la pire sortie — le
  ticket n'arrive nulle part si l'appelant ne l'attrape pas. Envoyer le début
  du ticket, ou le router vers la file par défaut, tiendrait la promesse que
  N0 et N1 font si bien (« Always one, and always a real queue »).
- `breaking_point` de N2 : le point est juste et bien trouvé (l'archive est la
  politique de routage, y compris ce que personne n'y a choisi), mais il est
  long. Deux phrases suffiraient.

### Ce qui est solide

- **Le cas est réel et écrit comme on le rencontre.** Le ticket qui appartient
  à deux équipes ou à aucune est exactement là où le routage se joue, et chaque
  niveau dit ce qu'il en fait.
- **Le verdict N1 est celui qu'on retient.** Les outils de support du marché
  font ce routage par classifieur sur l'historique ; l'archive est à un export
  de distance ; `rank` rend l'équipe suivante et sa probabilité, ce qui rend
  visible l'ambiguïté que N0 tranchait en silence.
- **La file par défaut conservée à chaque niveau**, et le seuil de confiance
  qui y renvoie au lieu de laisser la classe la plus probable décider, sont le
  réflexe qu'on veut voir copié.
- **Les points de rupture sont démontrés avec leurs exemples exacts et des
  témoins**, et ils sont vrais : le ticket bilingue en sujet pour N0, le
  vocabulaire hors archive pour N1, la dépendance à la composition de l'archive
  pour N2, et pour N3 la liste fermée qui n'arrête que l'invention, pas
  l'injection d'un client qui dicte sa file — un piège que peu de fiches
  voient.
- `escalate_when` de N0 (« la file par défaut devient la file la plus
  remplie ») est un événement observable sur n'importe quel tableau de bord :
  c'est l'exemple à donner dans la charte.
