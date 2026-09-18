# validate-a-form-server-side — vérification du lot 16

Avis d'origine : `docs/lot15/avis/validate-a-form-server-side.md` (REFUSÉE).

## Motif 1 — une règle absente présentée comme une frontière

**Le refus.** Le second exemple du point de rupture — « un pseudonyme fait de
deux espaces : `min` compte des caractères, une espace en est un » — n'est pas
une limite de l'approche, c'est une ligne de code manquante. Aucun validateur de
production ne compte les espaces de bord, et la norme HTML retire elle-même les
blancs de la valeur d'un champ `type=email`. Deux conséquences que la fiche ne
disait pas : un champ obligatoire rempli d'espaces passait `required`, et
`" ada@example.com"`, l'espace qu'ajoute la saisie semi-automatique d'un
téléphone, était refusée par le motif sans que l'utilisateur voie pourquoi.

**Ce qui a été fait.**

- **`trimmed` / `trimmed`** retire les blancs de bord de toute chaîne avant le
  moindre contrôle, dans les deux langages, et ce qui n'est pas une chaîne n'est
  pas touché. Une chaîne que cela vide rejoint la clé absente, le `None` et la
  chaîne vide : « that is what a browser posts for a field the user left alone ».
- **La docstring gagne sa quatrième décision** et dit pourquoi, avec les deux
  cas et le renvoi à la norme HTML.
- **Le point de rupture garde la vraie frontière** — l'adresse bien formée dont
  la boîte n'existe pas — et son second exemple devient celui que l'avis
  proposait : **un pseudonyme fait de caractères de largeur nulle**, que `strip`
  ne retire pas et que `min` compte. Il est démontré, pas affirmé.

**La preuve.** `les blancs de bord tombent avant tout contrôle`, dans les deux
langages : le champ obligatoire rempli de deux espaces rend « is required »,
l'adresse entourée d'espaces passe, « A » entourée d'espaces fait bien un
caractère et non trois, un entier n'est pas touché. Et
`un pseudonyme fait de caractères invisibles passe la longueur minimale`, qui
montre la limite qui reste, avec `"​​".strip()` long de deux.

## Motif 2 — le marquage sur la parité des motifs

**Le refus.** Le `DÉFAUT` « un même motif n'a pas le même sens côté navigateur
et côté serveur » était encore actif, alors que la docstring documente
désormais le piège (« write [0-9] and [A-Za-z] »). Un défaut documenté se
démontre, il ne se marque pas.

**Ce qui a été fait.** Le test devient
`un raccourci de motif n'a pas le même sens des deux côtés`, et il mesure les
deux moitiés de la phrase de la docstring :

- `\d{5}` accepte « ١٢٣٤٥ » en Python et le refuse en JavaScript ;
- `[0-9]{5}` le refuse des deux côtés — c'est le conseil ;
- et le prix du conseil, que l'avis demandait de dire : `[A-Za-z]+` refuse
  « Zoé », que `\w` accepte en Python et refuse en JavaScript. Les commentaires
  des deux tests nomment la parade pour les lettres, `\p{L}`, et disent que le
  module `re` ne la connaît pas.

**La preuve.** `node scripts/test-snippets.mjs validate-a-form-server-side` :
**2 extraits, 1 py, 1 js, aucun échec** ; `check-marquages` ne signale plus
cette fiche.

## Remarques non bloquantes de l'avis

- **La relative inversée du verdict** : réécrite dans les deux langues —
  « alors que c'est exactement ce qu'on demande à une validation : pouvoir la
  rejouer et la justifier ».
- **Aucune longueur maximale par défaut** : dit dans les deux docstrings et leur
  traduction, comme une chose que le schéma doit porter — « A field without
  `max` accepts megabytes, and the pattern is then applied to megabytes. »
- **« a validator worth having fits in forty lines »** : retiré des deux
  docstrings et de la traduction, comme ses sœurs dans les autres fiches.

## État

**Levée.** `test-snippets` vert (2 extraits) ; `check-marquages` ne signale plus
cette fiche ; `check-content`, `check-figures`, `check-french` verts.
