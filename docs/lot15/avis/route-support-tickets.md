# route-support-tickets — avis du relecteur

## Tour 1 — ACCEPTÉE

`node scripts/test-snippets.mjs route-support-tickets` : vert, 4 py, 4 js.

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
