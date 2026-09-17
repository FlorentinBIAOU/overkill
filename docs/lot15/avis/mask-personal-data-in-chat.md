# mask-personal-data-in-chat — avis du relecteur

## Tour 1 — REFUSÉE

`node scripts/test-snippets.mjs mask-personal-data-in-chat` : vert, 3 py, 3 js.

### Raisons du refus

1. **[vérité du point de rupture]** `breaking_point` de N0 : « L'obfuscation
   volontaire ». Le lecteur comprend qu'un numéro écrit normalement est masqué.
   Il ne l'est que s'il est **français et écrit sous la forme nationale ou
   +33**. Exécuté sur `n0.py`, sans aucune obfuscation :

   | Entrée | Sortie |
   |---|---|
   | `appelle moi au +32 470 12 34 56` | inchangée |
   | `+44 7700 900123` | inchangée |
   | `0033 6 12 34 56 78` | inchangée |
   | `+33 6 12 34 56 78` | `[phone]` (témoin) |

   Sur une messagerie de place de marché ou de location, le numéro belge,
   suisse ou britannique n'est pas un contournement, c'est un utilisateur
   ordinaire ; et `0033` est la forme que tapent beaucoup de gens depuis
   l'étranger. Le commentaire du code dit « French numbers », la fiche ne le
   dit nulle part : `need` parle d'« un numéro de téléphone », le `name` de
   « Normalisation puis expressions régulières ».

   Ce qu'il faut faire : soit ajouter un motif international (indicatif `+` ou
   `00` suivi de 8 à 15 chiffres avec séparateurs, la longueur maximale E.164
   étant de 15 chiffres — citer la recommandation UIT-T E.164), avec les trois
   premières lignes du tableau en test et un témoin de faux positif (un
   montant, une date) ; soit écrire dans le `breaking_point`, avant
   l'obfuscation, que seuls les numéros français sont reconnus, et le mettre
   dans `need`. La première option est la bonne pour un extrait qui sera
   copié.

2. **[réalité du cas, style]** `title.en` : « Mask personal data in a chat
   thread », et la docstring de `n0.py` / `n0.js` : « Mask personal data in a
   chat message ». Le titre français dit « Masquer les coordonnées », `need` dit
   téléphone et adresse électronique. L'anglais, version canonique, promet
   donc bien plus que ce que la fiche fait : un nom, une adresse postale, une
   date de naissance, un numéro de sécurité sociale sont des données
   personnelles, et aucun niveau ne les touche. Et c'est ce titre-là qui rend
   fausse la raison de N2 : un modèle de reconnaissance d'entités est
   précisément l'outil des noms et des adresses, que N0 ne voit pas.

   Ce qu'il faut faire : `title.en` → « Mask contact details in a chat
   message » (ou équivalent), même correction dans les docstrings py et js et
   leur traduction. Garder l'identifiant de fiche s'il ne peut pas changer.
   `unavailable_reason` N2 : ajouter que les noms et adresses postales sont
   hors du périmètre de cette fiche, et que c'est là qu'un modèle d'entités
   deviendrait utile. C'est fait quand le titre anglais et `need` décrivent la
   même chose.

3. **[pertinence technique, verdict]** N1 ne masque rien : `is_hiding_contact_details`
   rend un booléen pour le **message entier**. Monter de N0 à N1, comme le
   verdict le propose, fait donc passer le produit de « masquer le numéro et
   publier le reste » à « bloquer ou laisser passer tout le message ». Ce
   changement de comportement pour l'utilisateur final n'est dit nulle part —
   ni `name`, ni `breaking_point`, ni `verdict_rationale`.

   Ce qu'il faut faire : l'écrire, dans le `name` de N1 (« Détection de
   message à coordonnées déguisées ») et dans le verdict (« N1 ne masque pas :
   il signale un message, à bloquer ou à envoyer en modération, en plus de
   N0 »). Si l'intention est que N1 s'ajoute à N0 et non qu'il le remplace, le
   dire aussi.

### Remarques non bloquantes

- Faux positifs de N0, attendus mais à dire : `Commande n° 0612345678` et
  `prix 01.02.03.04.05 euros` sont masqués en `[phone]`. Pour une messagerie
  de vente, une référence de commande masquée est une gêne réelle. Une demi-
  phrase dans le `breaking_point`, à côté de l'IBAN par coïncidence.
- `écris à jean [at] gmail [dot] com` passe : c'est bien de l'obfuscation, et
  c'est la forme la plus répandue. Elle mériterait d'être l'exemple cité, plus
  parlant que les emojis.
- N3 : l'extrait envoie le message entier au fournisseur pour en retirer des
  données personnelles. Le bloc `regulatory` le dit ; c'est la meilleure
  raison de ne pas le prendre, et le verdict pourrait la dire en premier.

### Ce qui est solide

- Le verdict N0 est le bon pour ce besoin, et l'argument « un faux négatif
  publie le numéro de quelqu'un, donc on veut un test unitaire » est exact.
- La normalisation (NFKC, espaces fines, caractères de largeur nulle) avec
  report des positions sur le texte d'origine est du travail de production
  sérieux, et le garde-fou contre le temps quadratique du motif d'adresse est
  une vraie leçon.
- La validation modulo 97 de l'IBAN et le cas du faux IBAN qui passe la clé
  sont démontrés avec l'exemple exact de la fiche.
- Le `breaking_point` de N3 dit ce que fait l'extrait, pas ce que fait le
  modèle, et refuse de renvoyer le message non masqué sur une réponse
  illisible : c'est le comportement sûr.
