# mask-personal-data-in-chat — vérification du lot 16

Avis d'origine : `docs/lot15/avis/mask-personal-data-in-chat.md` (REFUSÉE).

## Motif 1 — seuls les numéros français étaient masqués

**Le refus.** Le `breaking_point` disait « l'obfuscation volontaire », mais un
numéro belge, britannique ou écrit `0033` — aucun contournement, un utilisateur
ordinaire d'une place de marché — ressortait intact.

**Ce qui a été fait.** L'avis proposait deux options et désignait la bonne : un
motif international. `INTERNATIONAL` masque un indicatif introduit par `+` ou
`00` suivi de huit à quinze chiffres, quinze étant la longueur maximale d'un
numéro selon la recommandation UIT-T E.164, citée dans le commentaire et ajoutée
en `further_reading`. Le motif français reste devant, pour que `+33 (0)6 …` soit
lu comme un seul numéro.

**La preuve.** Les quatre lignes du tableau de l'avis, en Python et en
JavaScript (`un numéro étranger ordinaire est masqué`) :

| Entrée | Sortie |
|---|---|
| `appelle moi au +32 470 12 34 56` | `appelle moi au [phone]` |
| `+44 7700 900123` | `[phone]` |
| `0033 6 12 34 56 78` | `[phone]` |
| `+33 6 12 34 56 78` | `[phone]` (témoin) |

Témoin de faux positif dans le même test : `le prix est 1 234,56 euros le
01/02/2024` ressort inchangé. Bornes vérifiées par
`la longueur maximale de E.164 borne le motif` : 8 et 15 chiffres masqués, 7 et
16 non.

## Motif 2 — le titre anglais promettait plus que la fiche ne fait

**Ce qui a été fait.**

- `title.en` : « Mask personal data in a chat thread » → « Mask contact details
  in a chat message ».
- `need`, dans les deux langues : dit ce qui est masqué (téléphone, adresse
  électronique, IBAN) et ce qui ne l'est pas (nom, adresse postale).
- Docstrings de `n0.py` et `n0.js`, et leur traduction : même correction, avec
  la phrase « A name, a postal address or a date of birth are personal data too,
  and nothing here touches them ».
- `unavailable_reason` de N2 : ajoute que les noms de personne et les adresses
  postales sont hors du périmètre de la fiche, et que c'est là qu'un modèle
  d'entités serait le bon outil.

L'identifiant de fiche est conservé (il porte les URL publiées).

## Motif 3 — N1 ne masque pas, il bloque

**Ce qui a été fait.** Dit à trois endroits :

- `name` de N1 : « Détection d'un message à coordonnées déguisées, par
  régression logistique sur la forme des jetons » ;
- `breaking_point` de N1, en tête : « Ce niveau ne masque rien : il rend un
  verdict sur le message entier, à bloquer ou à envoyer en modération » ;
- `verdict_rationale` : « N1 ne remplace pas N0, il s'y ajoute », avec ce que le
  changement coûte à l'utilisateur final — un message refusé au lieu d'un
  message publié amputé d'un numéro. Le verdict ouvre aussi sur la raison de ne
  pas prendre N3, l'envoi du message entier au fournisseur.

## Motif 4 — deux marquages vivants

| Marquage | Défaut | Correction |
|---|---|---|
| `n0` py/js `DÉFAUT` | « rendez-vous le 10 mars 2023 pour la signature » masqué en « rendez-vous [iban] la signature » | Le motif IBAN ne lit plus les minuscules : ISO 13616 imprime un IBAN en majuscules. Le commentaire dit pourquoi et cite la phrase |
| `n3` py/js `DÉFAUT` | une réponse tout entière dans une seule clôture ```` ```json ```` n'était pas décodée | `_unfenced` / `unfenced`, comme les extraits déjà corrigés : la clôture unique est retirée, tout autre écart lève |

Les deux tests sont réécrits en démonstration, sans marquage. Celui de l'IBAN
porte son témoin : la même phrase en majuscules est encore prise, et un IBAN en
minuscules n'est plus masqué — le prix du faux positif évité, écrit dans le
commentaire et dans le test.

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/mask-personal-data-in-chat/
(aucune sortie)
$ node scripts/test-snippets.mjs mask-personal-data-in-chat
  ok        mask-personal-data-in-chat         3 py, 3 js
```

## Remarques non bloquantes de l'avis

- **Faux positifs de N0.** Dits dans le `breaking_point` : une référence de
  commande à dix chiffres masquée en `[phone]`, et l'IBAN de coïncidence.
- **L'obfuscation la plus répandue.** `jean [at] example [dot] com` est
  désormais l'exemple de tête du `breaking_point`, avant les caractères sosies.
- **N3 et le message entier envoyé au fournisseur.** Dit en fin de verdict.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts (deux termes ajoutés au lexique du projet : `example`,
`iban`), aucun marquage. L'adaptateur N3 était déjà testé.
