# check-a-file-is-really-the-format-it-claims — vérification du lot 18

Avis : `docs/lot17/avis/check-a-file-is-really-the-format-it-claims.md` (REFUSÉE).

## Les motifs de refus, un par un

### 1. `matches_claim` faux sur `photo.jpeg`, dans les deux langages — levé

`ALIASES` n'était appliquée qu'au format **détecté**. Le rapport comparait
ensuite un `jpg` canonique à une extension réclamée laissée brute.

Correction : une fonction `_canonical` / `canonical` en trois lignes, appliquée
dans `_report` / `report` aux **trois** côtés — le détecté, le réclamé, et
chaque entrée de `allowed`. Le champ `claimed` reste rendu tel que le client
l'a écrit : c'est une réclamation, et la fiche existe pour la traiter comme
telle ; seule la comparaison passe par le nom canonique. Le commentaire du code
le dit, et la docstring des deux langages porte un paragraphe de plus.

Preuve, le critère d'acceptation écrit dans l'avis :

```
$ .venv-tools/bin/python -c "... sniff_file(JPEG, claimed_name='photo.jpeg', allowed=('jpeg',))"
{'detected': 'jpg', 'claimed': 'jpeg', 'matches_claim': True, 'allowed': True, 'reason': None}
```

```
$ node -e "... sniffFile(JPEG, {claimedName:'photo.jpeg', allowed:['jpeg']})"
{ detected: 'jpg', claimed: 'jpeg', matches_claim: true, allowed: true, reason: null }
```

### 2. Même asymétrie sur `allowed`, silencieuse — levée

Corrigée par le même changement : `permitted` est l'ensemble des entrées de
`allowed` passées au nom canonique. `allowed=("jpeg",)` autorise désormais un
vrai JPEG, dans les deux langages.

### 3. Le test était écrit dans la forme du code (T3) — levé

`claimed_name=f"fichier.{attendu}"` construisait le nom à partir du format
attendu, donc la table `ALIASES` n'était exercée dans aucun sens. Le témoin
reste — il démontre autre chose —, et un test nouveau l'exerce des deux côtés :

- `test_les_extensions_synonymes_designent_un_seul_format` (et son jumeau
  JavaScript) : `photo.jpeg` avec `allowed=("jpeg",)`, `scan.tif` avec
  `allowed=("tif",)` sur un TIFF réel, une extension **hors** table qui n'est
  pas transformée, et le témoin qui vérifie que l'alias ne fait pas concorder
  deux formats différents (`PNG` réclamé `photo.jpeg` → `matches_claim: False`).
- Les entrées banales gagnent `photo.jpeg` et `scan.tif`, et leur liste
  d'autorisation est écrite `jpeg` / `tif`, comme l'écrit un développeur qui
  part des types MIME.
- Le test de parité réclame `fichier.jpeg` et autorise `jpeg` et `tif` : la
  parité se vérifie là où le défaut était.

Un TIFF minimal de vingt-six octets entre dans les deux jeux de données, avec
les mêmes octets des deux côtés — les deux tables ne l'écrivent pas pareil
(`puremagic` rend `.tiff`, `file-type` rend `tif`), ce qui en fait le bon
témoin de l'alias.

## Les remarques non bloquantes

### 1. `HEAD` promet de ne pas lire le fichier entier, et `_inside_zip` le lit

Le commentaire est réécrit et dit la vérité : `HEAD` borne la recherche de
signature, pas la lecture ; `_inside_zip` tient tout le téléversement en
mémoire parce que le répertoire central d'un ZIP est à la fin ; c'est le prix
d'une réponse `docx` plutôt que `zip`, et de la même réponse dans les deux
langages. Le commentaire JavaScript dit l'autre moitié : `file-type` distingue
les deux depuis la tête seule, donc ce côté ne lit jamais au-delà.

**Écart assumé avec l'avis** : le plafond de taille d'archive suggéré (R8) n'a
pas été ajouté. Il a été écrit, puis retiré. Il crée une divergence de réponse
entre les deux langages — au-dessus du plafond, Python rendrait `zip` là où
JavaScript continue de rendre `docx`, puisqu'il n'a jamais besoin de lire
au-delà de `HEAD`. La fiche vend « les deux langages répondent la même chose » ;
échanger cette garantie contre une borne mémoire aurait introduit un défaut
pour en fermer un autre. La borne est donc dite à l'appelant, dans le
commentaire, avec la phrase qui lui dit quoi faire : « A caller that will not
pay it bounds the upload before calling. »

### 2. `except Exception` + `# noqa: BLE001`

Remplacé par `except (LookupError, ValueError)`, avec le commentaire qui nomme
les exceptions réellement levées, vérifiées à la source :

```
$ .venv-tools/bin/python -c "import puremagic; print(puremagic.PureError.__mro__)"
(<class 'puremagic.main.PureError'>, <class 'LookupError'>, …)
$ .venv-tools/bin/python -c "... puremagic.magic_string(b'')"
empty -> PureValueError Input was empty     # PureValueError hérite de ValueError
```

### 3. R11 — point de rupture de 78 mots

Réécrit : 51 mots en français, 54 en anglais, deux phrases chacun. Ce qui a
sauté — l'énumération complète des huit formats du témoin — n'apportait rien
que le test ne dise mieux. `check-longueur-rupture` le vérifie désormais, et la
fiche sort de `scripts/dette-rupture.json`.

## R14 — les raisons rendues par le code

`a file is bytes, not <type>` n'était lue par aucun test : il vérifiait que la
raison était une chaîne non vide, ce qui aurait passé sur n'importe quoi. Elle
est désormais citée mot pour mot dans les deux langages, et la fiche sort de
`scripts/dette-raisons.json`.

## Preuve

```
$ node scripts/test-snippets.mjs check-a-file-is-really-the-format-it-claims
  ok        check-a-file-is-really-the-format-it-claims 1 py, 1 js
test-snippets : OK — 2 extrait(s) exécuté(s), aucun échec

$ npm run check:rupture
check-longueur-rupture : OK — 208 point(s) de rupture, 164 encore en dette, aucun nouveau dépassement

$ npm run check:raisons
check-raisons : OK — 163 raison(s) rendue(s) par les extraits, toutes citées par un test ; 21 fiche(s) encore en dette

$ npm run check:content && npm run check:figures && npm run check:marquages && npm run check:french
check-content : OK — 50 fiche(s) (50 publiée(s), 0 brouillon(s)), …
check-figures : OK — aucun prix absolu, aucune empreinte chiffrée, aucun banc d'essai affirmé
check-marquages : OK — 50 fiche(s) lue(s), aucun marquage sur une fiche publiée
check-french : OK (410 fichiers)
```

Le jeu de tests passe de seize à dix-sept cas en Python et de quinze à seize en
JavaScript, et la suite Python compte 17 tests verts.
