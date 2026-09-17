# parse-address-into-fields — vérification du lot 16

Avis d'origine : `docs/lot15/avis/parse-address-into-fields.md` (REFUSÉE).

## Motif 1 — le niveau recommandé cassait sur les adresses les plus ordinaires

**Le refus.** N1, recommandé, rendait « rue » pour la voie de « 15 rue Victor
Hugo 92100 Boulogne-Billancourt » et « Billancourt » pour la ville, là où N0 lit
juste. La fiche vendait N1 pour un seul gain — le complément — et taisait la
régression.

**Ce qui a été fait.** Ce que l'avis désigne : le complément a des mots-clés en
nombre fini, et se traite comme le type de voie.

- `COMPLEMENTS` entre dans N0 : bâtiment, bât, escalier, esc, appartement, apt,
  appt, étage, porte, résidence, rés, lieu-dit, BP, CS, TSA, CEDEX, chez, hall,
  entrée, immeuble, lotissement.
- `_cut_complement` / `cutComplement` coupe la ligne de voie. Mi-ligne, un
  mot-clé ouvre un complément **s'il est suivi de ce qui suit un complément** —
  un nombre, une lettre seule, un autre mot-clé —, sans quoi « rue de la Porte
  Maillot » perdrait la moitié de son nom. En tête de ligne, le complément se
  ferme là où la voie s'ouvre : le premier type de voie, et le numéro devant lui
  s'il y en a un.
- Le champ `complement` entre dans `FIELDS` de N0.
- **Le verdict passe à N0.**

**La preuve.** Les six lignes du tableau de l'avis, au niveau recommandé, dans
les deux langages :

| Adresse | N0 avant | N0 après |
|---|---|---|
| `15 rue Victor Hugo 92100 Boulogne-Billancourt` | juste | juste |
| `10 bd Saint-Michel 75005 Paris` | juste | juste |
| `Lieu-dit Les Granges 24200 Sarlat-la-Canéda` | tout en voie | complément `Lieu-dit Les Granges` |
| `3 rue de la République, CEDEX 5, 69002 Lyon` | `CEDEX 5` collé à la voie | complément `CEDEX 5` |
| `Résidence du Parc, 3 rue de la Paix, 75002 Paris` | numéro vide, tout en voie | numéro `3`, complément `Résidence du Parc` |
| `8 rue des Lilas Bât C Apt 12, 75011 Paris` | complément collé à la voie | complément `Bât C Apt 12` |

Tests : `un complément écrit après la voie sort dans son champ`,
`un complément écrit devant la voie sort aussi dans son champ`,
`un complément seul, sans voie, occupe toute la ligne`,
`les adresses ordinaires que le niveau recommandé doit lire juste` (règle T5),
`un mot de complément dans un nom de rue reste dans la rue` avec son témoin.

Le `breaking_point` de N1 commence désormais par la régression, avec les trois
adresses nommées. Le `breaking_point` de N0 est réécrit sur ce qui reste vrai :
l'ancre qui tombe hors de France, et le découpage qui ne vérifie rien.

L'essai de la fiche est refait sur N0 (le contrôle de contenu exige que l'essai
tourne le niveau du verdict) : il n'entraîne plus rien, et ses deux cas en échec
sont le code postal parisien sur Lyon et l'adresse allemande.

## Motif 2 — le géocodeur public absent de la fiche

**Ce qui a été fait.** Le service est nommé, vérifié à la source, et placé à
l'endroit où il sert : après le découpage, pour valider.

- Docstring de N0, dans les deux langues : « Splitting without checking gives
  clean fields that can still be wrong: "8 rue des Lilas, 75011 Lyon" splits
  perfectly and names no real place. »
- `verdict_rationale` : « quel que soit le niveau, découper n'est pas vérifier
  […] C'est le service de géocodage de la Géoplateforme qui répond à cette
  question-là, gratuitement et contre le référentiel national ; c'est l'étape
  qui suit le découpage, et elle fait sortir l'adresse de votre
  infrastructure. »
- `further_reading` pointe désormais la page en vigueur, et `sources` cite ce
  qui a été lu : point d'accès `https://data.geopf.fr/geocodage/search`, service
  public gratuit, cinquante requêtes par seconde et par adresse IP, l'API
  Adresse de la Base Adresse Nationale y étant intégrée.

Il n'a pas été fait un niveau : l'échelle en compte quatre, tous occupés, et le
géocodeur ne fait pas le même travail que les quatre — il valide, il ne découpe
pas. L'avis laisse explicitement le choix entre les deux.

Un cas de l'essai le montre en exécution : `8 rue des Lilas, 75011 Lyon` rend
cinq champs propres.

## Motif 3 — deux marquages

| Marquage | État | Correction |
|---|---|---|
| `n2` py/js `INFIRMÉ` « six lines of 38 characters […] Anything longer is refused » | vivant : six lignes font 228, le plafond vaut 300 | Le commentaire dit le calcul et pourquoi le plafond est posé au-dessus ; le test démontre que 238 caractères passent et que 301 sont refusés |
| `n3` py/js `DÉFAUT` client par défaut | périmé, mais l'adaptateur n'était exécuté par aucun test | Trois tests exécutent `ProviderClient(sdk=FakeSDK(...))` / `providerClient(new FakeSDK(...))` : requête envoyée, `content` nul, panne retentée |

```
$ grep -rn "INFIRMÉ\|DÉFAUT\|xfail" content/snippets/parse-address-into-fields/
(aucune sortie)
$ node scripts/test-snippets.mjs parse-address-into-fields
  ok        parse-address-into-fields          4 py, 4 js
```

## Remarques non bloquantes de l'avis

- **libpostal pour tout le monde.** Le `name` de N2 le dit (« l'alternative de
  tout le monde »), et le verdict aussi.
- **Le coût réel de libpostal.** Dit sans chiffre : « un modèle volumineux à
  charger au démarrage et à tenir en mémoire ».
- **La latence de N2.** Dite : la classe vaut par appel, une fois le modèle
  chargé, pas au premier.

## État

**Levée.** `test-snippets` vert, `check-content`, `check-figures`,
`check-french` verts (quatre termes ajoutés au lexique du projet), aucun
marquage.
